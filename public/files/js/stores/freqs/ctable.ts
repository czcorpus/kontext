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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../types/ajaxResponses.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import {PageModel} from '../../tpl/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';
import {MultiDict} from '../../util';
import {CTFormInputs, CTFormProperties, GeneralCTStore, CTFreqCell} from './generalCtable';
import {confInterval} from './statTables';


type Data2DTable = {[d1:string]:{[d2:string]:CTFreqCell}};


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

const mapDataTable = (t:Data2DTable, fn:(cell:CTFreqCell)=>CTFreqCell):Data2DTable => {
    const ans:Data2DTable = {};
    for (let k1 in t) {
        for (let k2 in t[k1]) {
            if (ans[k1] === undefined) {
                ans[k1] = {};
            }
            ans[k1][k2] = fn(t[k1][k2]);
        }
    }
    return ans;
}

/**
 *
 */
export class ContingencyTableStore extends GeneralCTStore {

    private data:Data2DTable;

    private origData:Data2DTable;

    private d1Labels:Immutable.List<[string, boolean]>;

    private d2Labels:Immutable.List<[string, boolean]>;

    private filterZeroVectors:boolean;

    private sortDim1:string;

    private sortDim2:string;

    private isTransposed:boolean;

    /**
     * A lower freq. limit used by server when fetching data.
     * This is allows the store to retrieve additional data
     * in case user requires a lower limit (which is currently
     * not on the client-side).
     */
    private serverMinAbsFreq:number;

    private isWaiting:boolean;

    private throttleTimeout:number;

    private onNewDataHandlers:Immutable.List<(data:FreqResultResponse.CTFreqResultData)=>void>;

    private static COLOR_HEATMAP = [
        '#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'
    ];

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:CTFormProperties) {
        super(dispatcher, pageModel, props);
        this.d1Labels = Immutable.List<[string, boolean]>();
        this.d2Labels = Immutable.List<[string, boolean]>();
        this.filterZeroVectors = true;
        this.isTransposed = false;
        this.sortDim1 = 'attr';
        this.sortDim2 = 'attr';
        this.serverMinAbsFreq = parseInt(props.ctminfreq, 10);
        this.isWaiting = false;
        this.onNewDataHandlers = Immutable.List<(data:FreqResultResponse.CTFreqResultData)=>void>();

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_CT_FORM_SET_DIMENSION_ATTR':
                    this.setDimensionAttr(payload.props['dimension'], payload.props['value']);
                    this.validateAttrs();
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SET_CTX':
                    if (payload.props['dim'] === 1) {
                        this.ctxIndex1 = payload.props['value'];

                    } else if (payload.props['dim'] === 2) {
                        this.ctxIndex2 = payload.props['value'];
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SET_ALIGN_TYPE':
                    if (payload.props['dim'] === 1) {
                        this.alignType1 = payload.props['value'];

                    } else if (payload.props['dim'] === 2) {
                        this.alignType2 = payload.props['value'];
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SUBMIT':
                    if (!this.setupError) {
                        this.submitForm();
                        // leaves the page here

                    } else {
                        this.pageModel.showMessage('error', this.setupError);
                        this.notifyChangeListeners();
                    }
                break;
                case 'FREQ_CT_SET_MIN_ABS_FREQ':
                    if (this.validateMinAbsFreqAttr(payload.props['value'])) {
                        this.minAbsFreq = payload.props['value'];

                        if (this.throttleTimeout) {
                            window.clearTimeout(this.throttleTimeout);
                        }
                        this.isWaiting = true;
                        this.throttleTimeout = window.setTimeout(() => {
                            if (this.data) {
                                this.updateData().then(
                                    () => {
                                        this.notifyChangeListeners();
                                    },
                                    (err) => {
                                        this.pageModel.showMessage('error', err);
                                    }
                                );
                            }
                        }, 400);

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__ct_min_freq_val_error'));
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY':
                    this.filterZeroVectors = payload.props['value'];
                    this.updateLocalData();
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_TRANSPOSE_TABLE':
                    this.transposeTable();
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_QUICK_FILTER_CONCORDANCE':
                    this.applyQuickFilter(payload.props['args'][0], payload.props['args'][1]);
                    // leaves the page here
                break;
                case 'FREQ_CT_SORT_BY_DIMENSION':
                    this.sortByDimension(
                        payload.props['dim'],
                        payload.props['attr']
                    );
                    this.updateLocalData();
                    this.notifyChangeListeners();
                break;
            }
        });
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
            sumAbs += d ? d.ipm : 0;
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
        const fetchValFn:(v:string)=>any = (() => {
            switch (quantity) {
            case 'ipm':
                return v => sumFn(v).ipm;
            case 'abs':
                return v => sumFn(v).abs;
            case 'attr':
                return v => v;
            }
        })();
        const v = quantity === 'attr' ? 1 : -1;
        return items.sort((x1, x2) => {
            if (fetchValFn(x1[0]) > fetchValFn(x2[0])) {
                return v;
            }
            if (fetchValFn(x1[0]) < fetchValFn(x2[0])) {
                return -1 * v;
            }
            return 0;
        }).toList();
    }

    private updateLocalData():void {
        this.data = filterDataTable(this.origData, (item) => {
            return item && item.abs >= parseInt(this.minAbsFreq || '0', 10);
        });
        if (this.filterZeroVectors) {
            this.removeZeroVectors();

        } else { // reset visibility of all the values
            this.d1Labels = this.d1Labels.map<[string, boolean]>(x => [x[0], true]).toList();
            this.d2Labels = this.d2Labels.map<[string, boolean]>(x => [x[0], true]).toList();
        }
        this.d1Labels = this.sortLabels(this.d1Labels, this.sortDim1, 'row');
        this.d2Labels = this.sortLabels(this.d2Labels, this.sortDim2, 'col');
    }

    private updateData():RSVP.Promise<boolean> { // TODO type
        return (() => {
            if (parseInt(this.minAbsFreq, 10) < this.serverMinAbsFreq) {
                return this.fetchData();

            } else {
                return new RSVP.Promise((resolve, reject) => {
                    resolve(null);
                });
            }
        })().then(
            (data) => {
                this.isWaiting = false;
                if (data !== null) {
                    this.serverMinAbsFreq = parseInt(data.ctfreq_form_args.ctminfreq, 10);
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

    private generateCrit(dim:number):string {
        const attr = this.getAttrOfDim(dim);
        return this.isStructAttr(attr) ? '0' : this.getAttrCtx(dim);
    }

    private getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('ctfcrit1', this.generateCrit(1));
        args.set('ctfcrit2', this.generateCrit(2));
        args.set('ctattr1', this.attr1);
        args.set('ctattr2', this.attr2);
        args.set('ctminfreq', this.minAbsFreq);
        return args;
    }

    submitForm():void {
        const args = this.getSubmitArgs();
        window.location.href = this.pageModel.createActionUrl('freqct', args.items());
    }

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
                if (!data.contains_errors) {
                    this.onNewDataHandlers.forEach(fn => fn(data.data));
                    return data;

                } else {
                    throw new Error(data.messages[0]);
                }
            }
        );
    }

    importData(data:FreqResultResponse.CTFreqResultData):void {
        const d1Labels:{[name:string]:boolean} = {};
        const d2Labels:{[name:string]:boolean} = {};
        const tableData:Data2DTable = {};
        const calcIpm = (v:FreqResultResponse.CTFreqResultItem) => Math.round(v[2] / v[3] * 1e6 * 10) / 10;
        let fMin = calcIpm(data[0]);
        let fMax = calcIpm(data[0]);

        data.forEach(item => {
            d1Labels[item[0]] = true;
            d2Labels[item[1]] = true;

            if (tableData[item[0]] === undefined) {
                tableData[item[0]] = {};
            }
            const ipm = calcIpm(item);
            const confInt = confInterval(item[2], item[3], '0.05');
            tableData[item[0]][item[1]] = {
                ipm: ipm,
                ipmConfInterval: [confInt[0] * 1e6, confInt[1] * 1e6],
                abs: item[2],
                absConfInterval: [confInt[0] * item[3], confInt[1] * item[3]],
                domainSize: item[3],
                bgColor: undefined,
                pfilter: this.generatePFilter(item[0], item[1])
            };

            if (ipm > fMax) {
                fMax = ipm;
            }
            if (ipm < fMin) {
                fMin = ipm;
            }
        });

        this.d1Labels = Immutable.List<[string, boolean]>(Object.keys(d1Labels).sort().map(x => [x, true]));
        this.d2Labels = Immutable.List<[string, boolean]>(Object.keys(d2Labels).sort().map(x => [x, true]));

        this.origData = mapDataTable(tableData, (cell) => {
            return {
                ipm: cell.ipm,
                abs: cell.abs,
                absConfInterval: cell.absConfInterval,
                ipmConfInterval: cell.ipmConfInterval,
                domainSize: cell.domainSize,
                bgColor: ContingencyTableStore.COLOR_HEATMAP[~~Math.floor((cell.ipm - fMin) * 8 / (fMax - fMin))],
                pfilter: cell.pfilter
            };
        });
        this.updateLocalData();
    }

    getData():any {
        return this.data;
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

    getPositionRangeLabels():Array<string> {
        return GeneralCTStore.POSITION_LABELS;
    }

    getIsWaiting():boolean {
        return this.isWaiting;
    }

}
