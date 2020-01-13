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

import {TextTypes} from '../../types/common';
import {PageModel, DownloadType} from '../../app/page';
import {FreqResultResponse} from '../../types/ajaxResponses';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {MultiDict} from '../../util';
import {GeneralFreq2DModel, CTFreqCell, FreqQuantities} from './generalCtable';
import {CTFormProperties, roundFloat} from './ctFreqForm';
import {wilsonConfInterval} from './confIntervalCalc';
import {DataPoint} from '../../charts/confIntervals';
import { Action, IFullActionControl } from 'kombo';

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
    const ans:Data2DTable = {};
    for (let k1 in t) {
        for (let k2 in t[k1]) {
            if (ans[k1] === undefined) {
                ans[k1] = {};
            }
            if (cond(t[k1][k2])) {
                ans[k1][k2] = t[k1][k2];

            } else {
                ans[k1][k2] = undefined;
            }
        }
    }
    return ans;
};

/**
 * An implementation of MAP for 2d data table. Returns a new instance.
 */
const mapDataTable = (t:Data2DTable, fn:(cell:CTFreqCell)=>CTFreqCell):Data2DTable => {
    const ans:Data2DTable = {};
    for (let k1 in t) {
        for (let k2 in t[k1]) {
            if (ans[k1] === undefined) {
                ans[k1] = {};
            }
            ans[k1][k2] = t[k1][k2] !== undefined ? fn(t[k1][k2]) : undefined;
        }
    }
    return ans;
};

/**
 * A function similar to flatMap which applies a provided function
 * on existing 2d table and returns a 1d list.
 */
const mapDataTableAsList = <T>(t:Data2DTable, fn:(cell:CTFreqCell)=>T):Immutable.List<T> => {
    const ans:Array<T> = [];
    for (let k1 in t) {
        for (let k2 in t[k1]) {
            ans.push(t[k1][k2] !== undefined ? fn(t[k1][k2]) : undefined);
        }
    }
    return Immutable.List(ans);
};

/**
 * Available color mappings for 2d data table cells.
 */
export const enum ColorMappings {
    LINEAR = "linear",
    PERCENTILE = "percentile"
}


/**
 * A model for 2d frequency table operations
 */
export class Freq2DTableModel extends GeneralFreq2DModel {

    /**
     * Original data as imported from page initialization.
     */
    private origData:Data2DTable;

    /**
     * Current data derived from origData by applying filters etc.
     */
    private data:Data2DTable;

    /**
     * Rows labels. It contains all the server-returned values
     * even if some of them are not displayed (due to all zero
     * values in a row) - the show/hide status is given by the
     * boolean value in the pair.
     */
    private d1Labels:Immutable.List<[string, boolean]>;

    /**
     * Column labels. It contains all the server-returned values
     * even if some of them are not displayed (due to all zero
     * values in a column) - the show/hide status is given by the
     * boolean value in the pair.
     */
    private d2Labels:Immutable.List<[string, boolean]>;

    private filterZeroVectors:boolean;

    /**
     * An attribute/quantity current rows are sorted by
     */
    private sortDim1:string;

    /**
     * An attribute/quantity current columns are sorted by
     */
    private sortDim2:string;

    private isTransposed:boolean;

    private colorMapping:ColorMappings;

    private displayQuantity:FreqQuantities;

    /**
     * A lower freq. limit used by server when fetching data.
     * This is allows the model to retrieve additional data
     * in case user requires a lower limit (which is currently
     * not on the client-side).
     */
    private serverMinFreq:number;

    private isWaiting:boolean;

    private throttleTimeout:number;

    private onNewDataHandlers:Immutable.List<(data:FreqResultResponse.CTFreqResultData)=>void>;

    private highlightedGroup:[number, number];

    private static COLOR_HEATMAP = [
        '#ffffff', '#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'
    ];

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:CTFormProperties,
                adhocSubcDetector:TextTypes.IAdHocSubcorpusDetector) {
        super(dispatcher, pageModel, props, adhocSubcDetector);
        this.d1Labels = Immutable.List<[string, boolean]>();
        this.d2Labels = Immutable.List<[string, boolean]>();
        this.filterZeroVectors = true;
        this.isTransposed = false;
        this.colorMapping = ColorMappings.LINEAR;
        this.sortDim1 = 'attr';
        this.sortDim2 = 'attr';
        this.serverMinFreq = parseInt(props.ctminfreq, 10);
        this.isWaiting = false;
        this.displayQuantity = FreqQuantities.ABS;
        this.onNewDataHandlers = Immutable.List<(data:FreqResultResponse.CTFreqResultData)=>void>();
        this.highlightedGroup = [null, null];

        // TODO attrs from form model:
        // 1.

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'FREQ_CT_SET_ALPHA_LEVEL':
                    this.alphaLevel = action.payload['value'];
                    this.recalculateConfIntervals();
                    this.updateLocalData();
                    this.emitChange();
                break;
                case 'FREQ_CT_SET_MIN_FREQ_TYPE':
                    this.minFreqType = action.payload['value'];
                    this.isWaiting = true;
                    this.emitChange();
                    this.waitAndReload(true);
                break;
                case 'FREQ_CT_SET_MIN_FREQ':
                    if (this.validateMinAbsFreqAttr(action.payload['value'])) {
                        this.minFreq = action.payload['value'];
                        this.isWaiting = true;
                        this.emitChange();
                        this.waitAndReload(false);

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__ct_min_freq_val_error'));
                        this.emitChange();
                    }
                break;
                case 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY':
                    this.filterZeroVectors = action.payload['value'];
                    this.updateLocalData();
                    this.emitChange();
                break;
                case 'FREQ_CT_TRANSPOSE_TABLE':
                    this.transposeTable();
                    this.emitChange();
                break;
                case 'FREQ_CT_SORT_BY_DIMENSION':
                    this.sortByDimension(
                        action.payload['dim'],
                        action.payload['attr']
                    );
                    this.updateLocalData();
                    this.emitChange();
                break;
                case 'FREQ_CT_SET_DISPLAY_QUANTITY':
                    this.displayQuantity = action.payload['value'];
                    this.recalcHeatmap();
                    this.emitChange();
                break;
                case 'FREQ_CT_SET_COLOR_MAPPING':
                    this.colorMapping = action.payload['value'];
                    this.recalcHeatmap();
                    this.emitChange();
                break;
                case 'FREQ_CT_SET_HIGHLIGHTED_GROUP':
                    this.highlightedGroup = action.payload['value'];
                    this.emitChange();
                break;
            }
        });
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
        if (this.throttleTimeout) {
            window.clearTimeout(this.throttleTimeout);
        }
        this.throttleTimeout = window.setTimeout(() => {
            if (this.data) {
                if (resetServerMinFreq) {
                    this.serverMinFreq = null; // we must force data reload
                }
                this.isWaiting = true;
                this.emitChange();
                this.updateData().then(
                    () => {
                        this.isWaiting = false;
                        this.pushStateToHistory();
                        this.emitChange();
                    },
                    (err) => {
                        this.isWaiting = false;
                        this.pageModel.showMessage('error', err);
                        this.emitChange();
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

    private sortByDimension(dim:number, sortAttr:string):void {
        if (dim === 1) {
            this.sortDim1 = sortAttr;

        } else if (dim === 2) {
            this.sortDim2 = sortAttr;
        }
    }

    private getRowSum(attrVal:string):{ipm:number; abs:number} {
        const d = this.data[attrVal];
        let sumIpm = 0;
        let sumAbs = 0;
        for (let k in d) {
            sumIpm += d[k] ? d[k].ipm : 0;
            sumAbs += d[k] ? d[k].abs : 0;
        }
        return {ipm: sumIpm, abs: sumAbs};
    }

    private getColSum(attrVal:string):{ipm:number; abs:number} {
        let sumIpm = 0;
        let sumAbs = 0;
        for (let k in this.data) {
            const d = this.data[k][attrVal];
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
    private sortLabels(items:Immutable.List<[string, boolean]>, quantity:string, vector:string):Immutable.List<[string, boolean]> {
        const sumFn:(v:string)=>{ipm:number; abs:number} = (() => {
            switch (vector) {
            case 'row':
                return this.getRowSum.bind(this);
            case 'col':
                return this.getColSum.bind(this);
            }
        })();
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
        const v = quantity === 'attr' ? 1 : -1;
        return items.sort((x1, x2) => cmpValFn(x1[0], x2[0])).toList();
    }


    createPercentileSortMapping():Immutable.Map<number, number> {
        const fetchFreq = this.getFreqFetchFn();
        const data = mapDataTableAsList(this.origData, x => [x.origOrder, fetchFreq(x)]);
        return Immutable.Map<number, number>(data
            .filter(x => x !== undefined)
            .sort((x1, x2) => x1[1] - x2[1])
            .map((x, i) => [x[0], i]));
    }

    getTableInfo():TableInfo {
        let size = this.fullSize;
        let numNonZero:number = 0;
        let totalAbs:number = 0;
        for (let p in this.data) {
            for (let p2 in this.data[p]) {
                if (this.data[p] && this.data[p][p2]) {
                    numNonZero += 1;
                    totalAbs += this.data[p][p2].abs;
                }
            }
        }
        return {size: size, numNonZero: numNonZero, totalAbs: totalAbs};
    }

    private updateLocalData():void {
        this.data = filterDataTable(this.origData, this.createMinFreqFilterFn());
        if (this.filterZeroVectors) {
            this.removeZeroVectors();

        } else { // reset visibility of all the values
            this.d1Labels = this.d1Labels.map<[string, boolean]>(x => [x[0], true]).toList();
            this.d2Labels = this.d2Labels.map<[string, boolean]>(x => [x[0], true]).toList();
        }
        this.d1Labels = this.sortLabels(this.d1Labels, this.sortDim1, 'row');
        this.d2Labels = this.sortLabels(this.d2Labels, this.sortDim2, 'col');
        this.recalcHeatmap();
    }

    private mustLoadDueToLimit():boolean {
        return parseInt(this.minFreq, 10) < this.serverMinFreq || this.serverMinFreq === null;
    }

    private updateData():RSVP.Promise<boolean> {
        return (() => {
            if (this.mustLoadDueToLimit()) {
                return this.fetchData();

            } else {
                return new RSVP.Promise((resolve, reject) => {
                    resolve(null);
                });
            }
        })().then(
            (data:FreqResultResponse.CTFreqResultResponse) => {
                if (data !== null) {
                    this.serverMinFreq = parseInt(data.ctfreq_form_args.ctminfreq, 10);
                    this.importData(data.data);

                } else {
                    this.updateLocalData();
                }
                return true;
            }
        );
    }

    private transposeTable():void {
        const ans:Data2DTable = {};
        for (let k1 in this.origData) {
            const tmp = this.origData[k1] || {};
            for (let k2 in tmp) {
                if (ans[k2] === undefined) {
                    ans[k2] = {};
                }
                ans[k2][k1] = this.origData[k1][k2];
            }
        }
        this.origData = ans;
        [this.d1Labels, this.d2Labels] = [this.d2Labels, this.d1Labels];
        [this.attr1, this.attr2] = [this.attr2, this.attr1];
        this.isTransposed = !this.isTransposed;
        this.updateLocalData();
    }

    private removeZeroVectors():void {
        const counts1 = [];
        for (let i = 0; i < this.d1Labels.size; i += 1) {
            counts1.push(0);
        }
        const counts2 = [];
        for (let i = 0; i < this.d2Labels.size; i += 1) {
            counts2.push(0);
        }

        this.d1Labels.forEach((d1, i1) => {
            this.d2Labels.forEach((d2, i2) => {
                if (!this.data[d1[0]][d2[0]] || this.data[d1[0]][d2[0]].abs === 0) {
                    counts1[i1] += 1;
                    counts2[i2] += 1;
                }
            });
        });
        const remove1 = counts1.map(x => x === counts2.length);
        this.d1Labels = this.d1Labels.map<[string, boolean]>((item, i) => {
            return [item[0], !remove1[i]];
        }).toList();
        const remove2 = counts2.map(x => x === counts1.length);
        this.d2Labels = this.d2Labels.map<[string, boolean]>((item, i) => {
            return [item[0], !remove2[i]];
        }).toList();
    }


    private resetData():void {
        this.data = this.origData;
    }

    getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('ctfcrit1', this.ctFcrit1);
        args.set('ctfcrit2', this.ctFcrit2);
        args.set('ctattr1', this.attr1);
        args.set('ctattr2', this.attr2);
        args.set('ctminfreq', this.minFreq);
        args.set('ctminfreq_type', this.minFreqType);
        return args;
    }

    /**
     * This is intended especially for flat table data store which must
     * be kept synchronized with this model. I.e. once something changes
     * here - the flat store (which registered its listener here) will
     * update its data accordingly.
     */
    addOnNewDataHandler(fn:(data:FreqResultResponse.CTFreqResultData)=>void) {
        this.onNewDataHandlers = this.onNewDataHandlers.push(fn);
    }

    private fetchData():RSVP.Promise<FreqResultResponse.CTFreqResultResponse> {
        const args = this.getSubmitArgs();
        args.set('format', 'json');
        return this.pageModel.ajax<FreqResultResponse.CTFreqResultResponse>(
            'GET',
            this.pageModel.createActionUrl('freqct'),
            args

        ).then(
            (data) => {
                this.onNewDataHandlers.forEach(fn => fn(data.data));
                return data;
            }
        );
    }

    private recalculateConfIntervals():void {
        this.origData = mapDataTable(this.origData, cell => {
            const confInt = wilsonConfInterval(cell.abs, cell.domainSize, this.alphaLevel);
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

    importData(data:FreqResultResponse.CTFreqResultData):void {
        const d1Labels:{[name:string]:boolean} = {};
        const d2Labels:{[name:string]:boolean} = {};
        const tableData:Data2DTable = {};

        this.fullSize = data.full_size;
        data.data.forEach((item, i) => {
            d1Labels[item[0]] = true;
            d2Labels[item[1]] = true;

            if (tableData[item[0]] === undefined) {
                tableData[item[0]] = {};
            }
            const ipm = this.calcIpm(item);
            const confInt = wilsonConfInterval(item[2], item[3], this.alphaLevel);
            tableData[item[0]][item[1]] = {
                origOrder: i,
                ipm: ipm,
                ipmConfInterval: [roundFloat(confInt[0] * 1e6), roundFloat(confInt[1] * 1e6)],
                abs: item[2],
                absConfInterval: [Math.round(confInt[0] * item[3]), Math.round(confInt[1] * item[3])],
                domainSize: item[3],
                bgColor: '#FFFFFF',
                pfilter: this.generatePFilter(item[0], item[1])
            };
        });
        this.d1Labels = Immutable.List<[string, boolean]>(Object.keys(d1Labels).sort().map(x => [x, true]));
        this.d2Labels = Immutable.List<[string, boolean]>(Object.keys(d2Labels).sort().map(x => [x, true]));
        this.origData = tableData;
        this.updateLocalData();
    }

    private getFreqFetchFn():(c:CTFreqCell)=>number {
        switch (this.displayQuantity) {
            case FreqQuantities.ABS:
                return (c:CTFreqCell) => c.abs;
            case FreqQuantities.IPM:
                return (c:CTFreqCell) => c.ipm;
            default:
                throw new Error('Unknown quantity: ' + this.displayQuantity);
        }
    }

    private recalcHeatmap():void {
        const fetchFreq = this.getFreqFetchFn();
        const data = mapDataTableAsList(this.data, x => [x.origOrder, fetchFreq(x)]);
        if (!data.find(x => x !== undefined)) {
            return;
        }
        let fMin = data.size > 0 ? data.find(x => x !== undefined)[1] : null;
        let fMax = data.size > 0 ? data.find(x => x !== undefined)[1] : null;
        data.filter(x => x !== undefined).forEach(item => {
            if (item[1] > fMax) {
                fMax = item[1];
            }
            if (item[1] < fMin) {
                fMin = item[1];
            }
        });

        const mappingFunc:(c:CTFreqCell)=>string = (() => {
            const a = Freq2DTableModel.COLOR_HEATMAP.length - 1;
            if (this.colorMapping === ColorMappings.LINEAR) {
                return (c:CTFreqCell) => Freq2DTableModel.COLOR_HEATMAP[~~Math.floor((fetchFreq(c) - fMin) * a / (fMax - fMin))];


            } else if (this.colorMapping === ColorMappings.PERCENTILE) {
                const ordered = Immutable.Map<number, number>(data
                    .filter(x => x !== undefined)
                    .sort((x1, x2) => x1[1] - x2[1])
                    .map((x, i) => [x[0], i]));

                return (c:CTFreqCell) => Freq2DTableModel.COLOR_HEATMAP[~~Math.floor(ordered.get(c.origOrder) * (a + 1) / ordered.size)];

            } else {
                throw new Error('Falied to define mapping func');
            }
        })();

        this.data = mapDataTable(this.data, item => ({
            abs: item.abs,
            absConfInterval: item.absConfInterval,
            bgColor: mappingFunc(item),
            domainSize: item.domainSize,
            ipm: item.ipm,
            ipmConfInterval: item.ipmConfInterval,
            origOrder: item.origOrder,
            pfilter: item.pfilter
        }));
    }

    getData():Data2DTable {
        return this.data;
    }

    exportGroupLabel(row, col):string {
        if (row !== null) {
            return `${this.attr1} = "${this.d1Labels.filter(v => v[1]).get(row)[0]}" vs. ${this.attr2}`;

        } else if (col !== null) {
            return `${this.attr2} = "${this.d2Labels.filter(v => v[1]).get(col)[0]}" vs. ${this.attr1}`;
        }
        return '';
    }

    /**
     * Generate data for d3.js visualisation of confidence intervals.
     */
    exportGroup(row, col):Array<DataPoint> {
        const d1Labels = this.d1Labels.filter(v => v[1]).map(v => v[0]);
        const d2Labels = this.d2Labels.filter(v => v[1]).map(v => v[0]);
        const ans:Array<DataPoint> = [];
        const mkAns = (d1Key:string, d2Key:string, label:string) => {
            const cell = this.data[d1Key][d2Key];
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
            const d1Key = d1Labels.get(row);
            d2Labels.forEach(d2Key => {
                mkAns(d1Key, d2Key, d2Key);
            });

        } else if (row === null) {
            const d2Key = d2Labels.get(col);
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
        const d1Labels = this.d1Labels.filter(v => v[1]).map(v => v[0]);
        const d2Labels = this.d2Labels.filter(v => v[1]).map(v => v[0]);

        const fetchVals:(c:CTFreqCell)=>ConfIntervalItem = (() => {
            switch (this.displayQuantity) {
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
                const cell = this.data[v1][v2];
                if (cell !== undefined) {
                    row.push(fetchVals(cell));

                } else {
                    row.push(null);
                }
            });
            rows.push(row);
        });
        return {
            attr1: this.attr1,
            attr2: this.attr2,
            labels1: d1Labels.toArray(),
            labels2: d2Labels.toArray(),
            minFreq: parseFloat(this.minFreq),
            minFreqType: this.minFreqType,
            alphaLevel: parseFloat(this.alphaLevel),
            data: rows
        };
    }

    getD1Labels():Immutable.List<[string, boolean]> {
        return this.d1Labels;
    }

    getD2Labels():Immutable.List<[string, boolean]> {
        return this.d2Labels;
    }

    getFilterZeroVectors():boolean {
        return this.filterZeroVectors;
    }

    getIsTransposed():boolean {
        return this.isTransposed;
    }

    getSortDim1():string {
        return this.sortDim1;
    }

    getSortDim2():string {
        return this.sortDim2;
    }

    getIsWaiting():boolean {
        return this.isWaiting;
    }

    getColorMapping():ColorMappings {
        return this.colorMapping;
    }

    getDisplayQuantity():FreqQuantities {
        return this.displayQuantity;
    }

    getHighlightedGroup():[number, number] {
        return this.highlightedGroup;
    }

    getQuickFreqMode():string {
        if (this.sortDim1 === this.sortDim2 && this.sortDim2 === this.displayQuantity) {
            return this.displayQuantity;
        }
        return null;
    }

    isEmpty():boolean {
        return Object.keys(this.data).length === 0;
    }
}
