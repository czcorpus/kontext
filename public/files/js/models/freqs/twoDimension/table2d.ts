/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { IFullActionControl } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { Maths, HTTP, pipe, List, tuple, Dict } from 'cnc-tskit';

import { PageModel, DownloadType } from '../../../app/page';
import { FreqResultResponse } from '../../../types/ajaxResponses';
import { MultiDict } from '../../../multidict';
import { GeneralFreq2DModel, CTFreqCell, importAvailAlphaLevels, GeneralFreq2DModelState } from './generalDisplay';
import { DataPoint, ConfIntervals } from '../../../charts/confIntervals';
import { CTFreqServerArgs } from '../common';
import { CTFormProperties, roundFloat, Dimensions, FreqQuantities, FreqFilterQuantities, CTFreqResultDummyResponse, CTFreqResultResponse, CTFreqResultData, isDummyResponse } from './common';
import { Actions,  ActionName } from '../actions';

/**
 * A representation of 2D freq table.
 */
export type Data2DTable = {[d1:string]:{[d2:string]:CTFreqCell}};

/**
 * A helper type used when exporting data for Excel etc.
 */
type ConfIntervalItem = [number, number, number, string];

/**
 * A type representing exported (for Excel etc.) data
 * sent to a server for conversion.
 */
export interface FormatConversionExportData {
    attr1:string;
    attr2:string;
    minFreq:number;
    minFreqType:string;
    alphaLevel:number;
    labels1:Array<string>;
    labels2:Array<string>;
    data:Array<Array<[number, number, number, string]>>;
}

export interface TableInfo {
    size:number;
    numNonZero:number;
    totalAbs:number;
}

/**
 * A helper function used to apply a filter to an existing
 * 2d data table. Returns a new instance.
 */
const filterDataTable = (t:Data2DTable, cond:(cell:CTFreqCell)=>boolean):Data2DTable => {
    return Dict.map(
        col => Dict.map(
            cell => cond(cell) ? cell : undefined,
            col
        ),
        t
    );
};

/**
 * An implementation of MAP for 2d data table. Returns a new instance.
 */
const mapDataTable = (t:Data2DTable, fn:(cell:CTFreqCell)=>CTFreqCell):Data2DTable => {
    return Dict.map(
        col => Dict.map(
            cell => cell ? fn(cell) : undefined,
            col
        ),
        t
    );
};

/**
 * A function similar to flatMap which applies a provided function
 * on existing 2d table and returns a 1d list.
 */
const mapDataTableAsList = <T>(t:Data2DTable, fn:(cell:CTFreqCell)=>T):Array<T> => {
    return pipe(
        t,
        Dict.toEntries(),
        List.flatMap(([k, v]) => Dict.toEntries(v)),
        List.map(([,v]) => v ? fn(v) : undefined)
    );
};

/**
 * Available color mappings for 2d data table cells.
 */
export const enum ColorMappings {
    LINEAR = 'linear',
    PERCENTILE = "percentile"
}

export interface Freq2DTableModelState extends GeneralFreq2DModelState {

    /**
     * Original data as imported from page initialization.
     */
    origData:Data2DTable;

    /**
     * Current data derived from origData by applying filters etc.
     */
    data:Data2DTable;

    /**
     * Rows labels. It contains all the server-returned values
     * even if some of them are not displayed (due to all zero
     * values in a row) - the show/hide status is given by the
     * boolean value in the pair.
     */
    d1Labels:Array<[string, boolean]>;

    /**
     * Column labels. It contains all the server-returned values
     * even if some of them are not displayed (due to all zero
     * values in a column) - the show/hide status is given by the
     * boolean value in the pair.
     */
    d2Labels:Array<[string, boolean]>;

    filterZeroVectors:boolean;

    /**
     * An attribute/quantity current rows are sorted by
     */
    sortDim1:string;

    /**
     * An attribute/quantity current columns are sorted by
     */
    sortDim2:string;

    isTransposed:boolean;

    colorMapping:ColorMappings;

    displayQuantity:FreqQuantities;

    /**
     * A lower freq. limit used by server when fetching data.
     * This is allows the model to retrieve additional data
     * in case user requires a lower limit (which is currently
     * not on the client-side).
     */
    serverMinFreq:number;

    isWaiting:boolean;

    onNewDataHandlers:Array<(data:CTFreqResultData)=>void>;

    highlightedGroup:[number, number];

    highlightedCoord:[number, number]|null;

    selectedTextTypes:{[attr:string]:Array<string>};

}


/**
 * A model for 2d frequency table operations
 */
export class Freq2DTableModel extends GeneralFreq2DModel<Freq2DTableModelState> {

    private throttleTimeout:number;

    private static COLOR_HEATMAP = [
        '#ffffff', '#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'
    ];

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:CTFormProperties) {
        super(
            dispatcher,
            pageModel,
            {
                ctFcrit1: props.ctfcrit1,
                ctFcrit2: props.ctfcrit2,
                attr1: props.ctattr1,
                attr2: props.ctattr2,
                minFreq: props.ctminfreq,
                minFreqType: props.ctminfreq_type,
                alphaLevel: Maths.AlphaLevel.LEVEL_5,
                availAlphaLevels: importAvailAlphaLevels(),
                fullSize: null,
                usesAdHocSubcorpus: props.usesAdHocSubcorpus,
                d1Labels: [],
                d2Labels: [],
                filterZeroVectors: true,
                isTransposed: false,
                colorMapping: ColorMappings.LINEAR,
                sortDim1: 'attr',
                sortDim2: 'attr',
                serverMinFreq: parseInt(props.ctminfreq, 10),
                isWaiting: false,
                displayQuantity: FreqQuantities.ABS,
                onNewDataHandlers: [], // TODO ??
                highlightedGroup: [null, null],
                origData: {},
                data: {},
                confIntervalLeftMinWarn: GeneralFreq2DModel.CONF_INTERVAL_LEFT_MIN_WARN,
                highlightedCoord: null,
                selectedTextTypes: props.selectedTextTypes
            }
        );

        this.addActionHandler<Actions.FreqctSetAlphaLevel>(
            ActionName.FreqctSetAlphaLevel,
            action => {
                this.changeState(state => {
                    state.alphaLevel = action.payload.value;
                    this.recalculateConfIntervals(state);
                    this.updateLocalData(state);
                });
            }
        );

        this.addActionHandler<Actions.FreqctFormSetMinFreqType>(
            ActionName.FreqctFormSetMinFreqType,
            action => {
                this.changeState(state =>  {
                    state.minFreqType = action.payload.value;
                    state.isWaiting = true;
                });
                this.waitAndReload(true);
            }
        );

        this.addActionHandler<Actions.FreqctSetMinFreq>(
            ActionName.FreqctSetMinFreq,
            action => {
                if (this.validateMinAbsFreqAttr(action.payload.value)) {
                    this.changeState(state => {
                        state.minFreq = action.payload.value;
                        state.isWaiting = true;
                    });
                    this.waitAndReload(false);

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('freq__ct_min_freq_val_error'));
                }
            }
        );

        this.addActionHandler<Actions.FreqctSetEmptyVecVisibility>(
            ActionName.FreqctSetEmptyVecVisibility,
            action => {
                this.changeState(state => {
                    state.filterZeroVectors = action.payload.value;
                    this.updateLocalData(state);
                });
            }
        );

        this.addActionHandler<Actions.FreqctTransposeTable>(
            ActionName.FreqctTransposeTable,
            action => {
                this.changeState(state => {
                    this.transposeTable(state);
                });
            }
        );

        this.addActionHandler<Actions.FreqctSortByDimension>(
            ActionName.FreqctSortByDimension,
            action => {
                this.changeState(state => {
                    this.sortByDimension(
                        state,
                        action.payload.dim,
                        action.payload.attr
                    );
                    this.updateLocalData(state);
                });
            }
        );

        this.addActionHandler<Actions.FreqctSetDisplayQuantity>(
            ActionName.FreqctSetDisplayQuantity,
            action => {
                this.changeState(state => {
                    state.displayQuantity = action.payload.value;
                    this.recalcHeatmap(state);
                });
            }
        );

        this.addActionHandler<Actions.FreqctSetColorMapping>(
            ActionName.FreqctSetColorMapping,
            action => {
                this.changeState(state => {
                    state.colorMapping = action.payload.value;
                    this.recalcHeatmap(state);
                });
            }
        );

        this.addActionHandler<Actions.FreqctSetHighlightedGroup>(
            ActionName.FreqctSetHighlightedGroup,
            action => {
                this.changeState(state => {
                    state.highlightedGroup = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.FreqctHighlight2DCoord>(
            ActionName.FreqctHighlight2DCoord,
            action =>  {
                this.changeState(state => {
                    state.highlightedCoord = action.payload.coord
                });
            }
        );

        this.addActionHandler<Actions.FreqctReset2DCoordHighlight>(
            ActionName.FreqctReset2DCoordHighlight,
            action => {
                this.changeState(state => {
                    state.highlightedCoord = null;
                });
            }
        )
    }

    private pushStateToHistory():void {
        const args = this.getSubmitArgs();
        args.remove('format');
        this.pageModel.getHistory().pushState(
            'freqct',
            args,
            {},
            window.document.title
        );
    }

    private waitAndReload(resetServerMinFreq:boolean):void {

        const mustLoadDueToLimit = () => parseInt(this.state.minFreq, 10) < this.state.serverMinFreq || this.state.serverMinFreq === null;

        if (this.throttleTimeout) {
            window.clearTimeout(this.throttleTimeout);
        }
        this.throttleTimeout = window.setTimeout(() => {
            if (this.state.data) {
                this.changeState(state => {
                    if (resetServerMinFreq) {
                        state.serverMinFreq = null; // we must force data reload
                    }
                    state.isWaiting = true;
                });
                const data$:Observable<CTFreqResultResponse|CTFreqResultDummyResponse> = mustLoadDueToLimit() ?
                    this.fetchData() :
                    rxOf<CTFreqResultDummyResponse>({
                        data: {
                            data: [],
                            full_size: 0
                        },
                        isDummy: true
                    });
                data$.subscribe(
                    data => {
                        this.changeState(state => {
                            if (isDummyResponse(data)) {
                                this.updateLocalData(state);

                            } else {
                                state.serverMinFreq = parseInt(data.ctfreq_form_args.ctminfreq, 10);
                                this.importData(state, data.data);
                            }
                            state.isWaiting = false;
                        });
                        this.pushStateToHistory();
                    },
                    (err) => {
                        this.changeState(state => {
                            state.isWaiting = false;
                        });
                        this.pageModel.showMessage('error', err);
                    }
                );
            }
        }, 400);
    }

    submitDataConversion(format:string):void {
        const args = new MultiDict();
        args.set('saveformat', format);
        args.set('savemode', 'table');
        this.pageModel.bgDownload(
            `2d-frequency.${format}`,
            DownloadType.FREQ2D,
            this.pageModel.createActionUrl('export_freqct', args),
            {data: JSON.stringify(this.exportData())}
        );
    }

    private sortByDimension(state:Freq2DTableModelState, dim:Dimensions, sortAttr:string):void {
        if (dim === Dimensions.FIRST) {
            state.sortDim1 = sortAttr;

        } else if (dim === Dimensions.SECOND) {
            state.sortDim2 = sortAttr;
        }
    }

    private getRowSum(state:Freq2DTableModelState, attrVal:string):{ipm:number; abs:number} {
        const d = state.data[attrVal];
        let sumIpm = 0;
        let sumAbs = 0;
        for (let k in d) {
            sumIpm += d[k] ? d[k].ipm : 0;
            sumAbs += d[k] ? d[k].abs : 0;
        }
        return {ipm: sumIpm, abs: sumAbs};
    }

    private getColSum(state:Freq2DTableModelState, attrVal:string):{ipm:number; abs:number} {
        let sumIpm = 0;
        let sumAbs = 0;
        for (let k in state.data) {
            const d = state.data[k][attrVal];
            sumIpm += d ? d.ipm : 0;
            sumAbs += d ? d.abs : 0;
        }
        return {ipm: sumIpm, abs: sumAbs};
    }

    /**
     *
     * @param items
     * @param quantity either 'ipm', 'abs' or 'attr'
     * @param vector either 'col' or 'row'
     */
    sortLabels(state:Freq2DTableModelState, dim:Dimensions):void {
        const sumFn:(v:string)=>{ipm:number; abs:number} = dim === Dimensions.FIRST ?
            this.getRowSum.bind(this, state) : this.getColSum.bind(this, state);
        const quantity = dim === Dimensions.FIRST ? state.sortDim1 : state.sortDim2;
        const cmpValFn:(v1:string, v2:string)=>number = (() => {
            switch (quantity) {
            case 'ipm':
                return (v1, v2) => sumFn(v2).ipm - sumFn(v1).ipm;
            case 'abs':
                return (v1, v2) => sumFn(v2).abs - sumFn(v1).abs;
            case 'attr':
                return (v1, v2) => v1.localeCompare(v2)
            }
        })();
        const sortFn = List.sorted<[string, boolean]>((x1, x2) => cmpValFn(x1[0], x2[0]));
        if (dim === Dimensions.FIRST) {
            state.d1Labels = sortFn(state.d1Labels);

        } else {
            state.d2Labels = sortFn(state.d2Labels);
        }
    }

    createPercentileSortMapping(state:Freq2DTableModelState):[{[key:string]:number}, number] {
        const fetchFreq = this.getFreqFetchFn(state);
        const data = mapDataTableAsList(state.origData, x => tuple(x.origOrder, fetchFreq(x)));
        const asList = pipe(
            data,
            List.filter(x => x !== undefined),
            List.sortedBy(([,v]) => v),
            List.map(([x,], i) => tuple(x.toFixed(), i)),
        );
        return tuple(
            Dict.fromEntries(asList),
            List.size(asList)
        );
    }

    static getTableInfo(state:Freq2DTableModelState):TableInfo {
        let size = state.fullSize;
        let numNonZero:number = 0;
        let totalAbs:number = 0;
        for (let p in state.data) {
            for (let p2 in state.data[p]) {
                if (state.data[p] && state.data[p][p2]) {
                    numNonZero += 1;
                    totalAbs += state.data[p][p2].abs;
                }
            }
        }
        return {size: size, numNonZero: numNonZero, totalAbs: totalAbs};
    }

    updateLocalData(state:Freq2DTableModelState):void {
        state.data = filterDataTable(state.origData, this.createMinFreqFilterFn(state));
        if (state.filterZeroVectors) {
            this.removeZeroVectors(state);

        } else { // reset visibility of all the values
            state.d1Labels = state.d1Labels.map<[string, boolean]>(x => [x[0], true]);
            state.d2Labels = state.d2Labels.map<[string, boolean]>(x => [x[0], true]);
        }
        this.sortLabels(state, Dimensions.FIRST);
        this.sortLabels(state, Dimensions.SECOND);
        this.recalcHeatmap(state);
    }

    private transposeTable(state:Freq2DTableModelState):void {
        const ans:Data2DTable = {};
        for (let k1 in state.origData) {
            const tmp = state.origData[k1] || {};
            for (let k2 in tmp) {
                if (ans[k2] === undefined) {
                    ans[k2] = {};
                }
                ans[k2][k1] = state.origData[k1][k2];
            }
        }
        state.origData = ans;
        [state.d1Labels, state.d2Labels] = [state.d2Labels, state.d1Labels];
        [state.attr1, state.attr2] = [state.attr2, state.attr1];
        state.isTransposed = !state.isTransposed;
        this.updateLocalData(state);
    }

    private removeZeroVectors(state:Freq2DTableModelState):void {
        const counts1 = [];
        for (let i = 0; i < state.d1Labels.length; i += 1) {
            counts1.push(0);
        }
        const counts2 = [];
        for (let i = 0; i < state.d2Labels.length; i += 1) {
            counts2.push(0);
        }

        state.d1Labels.forEach((d1, i1) => {
            state.d2Labels.forEach((d2, i2) => {
                if (!state.data[d1[0]][d2[0]] || state.data[d1[0]][d2[0]].abs === 0) {
                    counts1[i1] += 1;
                    counts2[i2] += 1;
                }
            });
        });
        const remove1 = counts1.map(x => x === counts2.length);
        state.d1Labels = state.d1Labels.map<[string, boolean]>((item, i) => {
            return [item[0], !remove1[i]];
        });
        const remove2 = counts2.map(x => x === counts1.length);
        state.d2Labels = state.d2Labels.map<[string, boolean]>((item, i) => {
            return [item[0], !remove2[i]];
        });
    }


    private resetData(state:Freq2DTableModelState):void { // TODO do we need this?
        state.data = state.origData;
    }

    getSubmitArgs():MultiDict<CTFreqServerArgs> {
        const args = this.pageModel.exportConcArgs() as MultiDict<CTFreqServerArgs>;
        args.set('ctfcrit1', this.state.ctFcrit1);
        args.set('ctfcrit2', this.state.ctFcrit2);
        args.set('ctattr1', this.state.attr1);
        args.set('ctattr2', this.state.attr2);
        args.set('ctminfreq', this.state.minFreq);
        args.set('ctminfreq_type', this.state.minFreqType);
        return args;
    }

    private fetchData():Observable<CTFreqResultResponse> {
        const args = this.getSubmitArgs();
        args.set('format', 'json');
        return this.pageModel.ajax$<CTFreqResultResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('freqct'),
            args

        );
    }

    private recalculateConfIntervals(state:Freq2DTableModelState):void {
        state.origData = mapDataTable(state.origData, cell => {
            const confInt = Maths.wilsonConfInterval(cell.abs, cell.domainSize, state.alphaLevel);
            return {
                origOrder: cell.origOrder,
                ipm: cell.ipm,
                ipmConfInterval: [confInt[0] * 1e6, confInt[1] * 1e6],
                abs: cell.abs,
                absConfInterval: [confInt[0] * cell.domainSize, confInt[1] * cell.domainSize],
                domainSize: cell.domainSize,
                bgColor: cell.bgColor,
                pfilter: cell.pfilter
            }
        });
    }

    getOnTableFrameReady() {
        const width = 600;
        const height = 14 * (this.state.d1Labels.filter(x => x[1]).length +
            this.state.d2Labels.filter(x => x[1]).length) / 2;
        return tuple(
            width,
            height,
            (data:Array<DataPoint>, heading:string) => {
                const charts = new ConfIntervals(
                    this.pageModel,
                    width,
                    height,
                    document.getElementById('confidence-intervals-frame')
                );
                charts.renderChart(data, heading);
            }
        );
    }

    /**
     * Import data and update initial state. Please note that
     * this won't work once you change the state via any action
     * (runtime error will be thrown).
     */
    initialImportData(data:CTFreqResultData):void {
        this.importData(this.state, data);
    }

    protected importData(state:Freq2DTableModelState, data:CTFreqResultData):void {
        const d1Labels:{[name:string]:boolean} = {};
        const d2Labels:{[name:string]:boolean} = {};
        const tableData:Data2DTable = {};

        state.fullSize = data.full_size;
        let origOrder = 0;
        let prevAbs = 0;
        data.data.forEach(([label1, label2, absFreq, total]) => {
            d1Labels[label1] = true;
            d2Labels[label2] = true;
            if (absFreq > prevAbs) {
                origOrder += 1;
            }
            prevAbs = absFreq;

            if (tableData[label1] === undefined) {
                tableData[label1] = {};
            }
            const ipm = GeneralFreq2DModel.calcIpm(absFreq, total);
            const confInt = Maths.wilsonConfInterval(absFreq, total, state.alphaLevel);
            tableData[label1][label2] = {
                origOrder: origOrder,
                ipm: ipm,
                ipmConfInterval: [roundFloat(confInt[0] * 1e6), roundFloat(confInt[1] * 1e6)],
                abs: absFreq,
                absConfInterval: [Math.round(confInt[0] * total), Math.round(confInt[1] * total)],
                domainSize: total,
                bgColor: '#FFFFFF',
                pfilter: this.generatePFilter(state, label1, label2)
            };

        });
        state.d1Labels = pipe(
            d1Labels,
            Dict.keys(),
            List.sortedAlphaBy(x => x),
            List.map(x => tuple<string, boolean>(x, true))
        );
        state.d2Labels = Object.keys(d2Labels).sort().map(x => [x, true]);
        state.origData = tableData;
        this.updateLocalData(state);

    }

    private getFreqFetchFn(state:Freq2DTableModelState):(c:CTFreqCell)=>number {
        switch (state.minFreqType) {
            case FreqFilterQuantities.ABS:
            case FreqFilterQuantities.ABS_PERCENTILE:
                return (c:CTFreqCell) => c.abs;
            case FreqFilterQuantities.IPM:
            case FreqFilterQuantities.IPM_PERCENTILE:
                return (c:CTFreqCell) => c.ipm;
            default:
                throw new Error('Unknown quantity: ' + state.minFreqType);
        }
    }

    private recalcHeatmap(state:Freq2DTableModelState):void {
        const fetchFreq = this.getFreqFetchFn(state);
        const dataList = mapDataTableAsList(state.data, x => tuple(x.origOrder, fetchFreq(x)));
        if (!dataList.find(x => x !== undefined)) {
            return;
        }
        const [,fMax] = pipe(
            dataList,
            List.filter(x => x !== undefined),
            List.maxItem(([,v2]) => v2)
        );
        const [,fMin] = pipe(
            dataList,
            List.filter(x => x !== undefined),
            List.maxItem(([,v2]) => -v2)
        );

        const mappingFunc:(c:CTFreqCell)=>string = (() => {
            const a = Freq2DTableModel.COLOR_HEATMAP.length - 1;
            if (state.colorMapping === ColorMappings.LINEAR) {
                return (c:CTFreqCell) => Freq2DTableModel.COLOR_HEATMAP[~~Math.floor((fetchFreq(c) - fMin) * a / (fMax - fMin))];


            } else if (state.colorMapping === ColorMappings.PERCENTILE) {
                const orderedAsList = pipe(
                    dataList,
                    List.filter(x => x !== undefined),
                    List.sortedBy(([,freq]) => freq),
                    List.map(([k,], i) => tuple(k.toFixed(), i)),
                );
                const numOrdered = List.size(orderedAsList); // we must preserve this to keep correct size as...
                const ordered = Dict.fromEntries(orderedAsList); // ... now we loose some size due to non-unique "origOrder"
                return (c:CTFreqCell) => {
                    return Freq2DTableModel.COLOR_HEATMAP[~~Math.floor(ordered[c.origOrder] * (a + 1) / numOrdered)];
                }

            } else {
                throw new Error('Falied to define mapping func');
            }
        })();

        state.data = mapDataTable(state.data, item => ({
            ...item,
            bgColor: mappingFunc(item)
        }));
    }


    exportGroupLabel(row, col):string {
        if (row !== null) {
            return `${this.state.attr1} = "${this.state.d1Labels.filter(v => v[1])[row][0]}" vs. ${this.state.attr2}`;

        } else if (col !== null) {
            return `${this.state.attr2} = "${this.state.d2Labels.filter(v => v[1])[col][0]}" vs. ${this.state.attr1}`;
        }
        return '';
    }

    /**
     * Generate data for d3.js visualisation of confidence intervals.
     */
    exportGroup(row, col):Array<DataPoint> {
        const d1Labels = this.state.d1Labels.filter(v => v[1]).map(v => v[0]);
        const d2Labels = this.state.d2Labels.filter(v => v[1]).map(v => v[0]);
        const ans:Array<DataPoint> = [];
        const mkAns = (d1Key:string, d2Key:string, label:string) => {
            const cell = this.state.data[d1Key][d2Key];
            if (cell) {
                ans.push({
                    data: [cell.ipmConfInterval[0], cell.ipm, cell.ipmConfInterval[1]],
                    label: label
                });

            } else {
                ans.push(null);
            }
        };

        if (col === null) {
            const d1Key = d1Labels[row];
            d2Labels.forEach(d2Key => {
                mkAns(d1Key, d2Key, d2Key);
            });

        } else if (row === null) {
            const d2Key = d2Labels[col];
            d1Labels.forEach(d1Key => {
                mkAns(d1Key, d2Key, d1Key);
            });
        }
        return ans.filter(x => x !== null).sort((x1, x2) => x2.data[1] - x1.data[1]);
    }

    /**
     * Export data for Excel etc. conversion on server.
     */
    exportData():FormatConversionExportData {
        const d1Labels = this.state.d1Labels.filter(v => v[1]).map(v => v[0]);
        const d2Labels = this.state.d2Labels.filter(v => v[1]).map(v => v[0]);

        const fetchVals:(c:CTFreqCell)=>ConfIntervalItem = (() => {
            switch (this.state.displayQuantity) {
                case FreqQuantities.ABS:
                return (c:CTFreqCell) => <ConfIntervalItem>[c.absConfInterval[0], c.abs, c.absConfInterval[1], c.bgColor];
                case FreqQuantities.IPM:
                return (c:CTFreqCell) => <ConfIntervalItem>[c.ipmConfInterval[0], c.ipm, c.ipmConfInterval[1], c.bgColor];
                default:
                throw new Error('Unknown display quantity');
            }
        })();

        const rows = [];
        d1Labels.forEach(v1 => {
            const row = [];
            d2Labels.forEach(v2 => {
                const cell = this.state.data[v1][v2];
                if (cell !== undefined) {
                    row.push(fetchVals(cell));

                } else {
                    row.push(null);
                }
            });
            rows.push(row);
        });
        return {
            attr1: this.state.attr1,
            attr2: this.state.attr2,
            labels1: d1Labels,
            labels2: d2Labels,
            minFreq: parseFloat(this.state.minFreq),
            minFreqType: this.state.minFreqType,
            alphaLevel: parseFloat(this.state.alphaLevel),
            data: rows
        };
    }

    static determineQuickFreqMode(state:Freq2DTableModelState):string|null {
        if (state.sortDim1 === state.sortDim2 && state.sortDim2 === state.displayQuantity) {
            return state.displayQuantity;
        }
        return null;
    }

}
