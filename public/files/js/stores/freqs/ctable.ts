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

import {SimplePageStore} from '../base';
import {PageModel} from '../../tpl/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';
import {MultiDict} from '../../util';


const sortAttrVals = (x1:Kontext.AttrItem, x2:Kontext.AttrItem) => {
    if (x1.label < x2.label) {
        return -1;
    }
    if (x1.label > x2.label) {
        return 1;
    }
    return 0;
};

export interface ContingencyTableFormInputs {
    ctminfreq:string;
    ctattr1:string;
    ctattr2:string;
    ctfcrit1:string;
    ctfcrit2:string;
}


export interface ContingencyTableFormProperties extends ContingencyTableFormInputs {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    multiSattrAllowedStructs:Array<string>;
    queryContainsWithin:boolean;
}



interface CTFreqCell {
    abs:number;
    ipm:number;
    domainSize:number;
    bgColor:string;
    pfilter:[string, string];
}

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
export class ContingencyTableStore extends SimplePageStore {

    private pageModel:PageModel;

    private availAttrList:Immutable.List<Kontext.AttrItem>;

    private availStructAttrList:Immutable.List<Kontext.AttrItem>;

    private attr1:string;

    private attr2:string;

    private data:Data2DTable;

    private origData:Data2DTable;

    private d1Labels:Immutable.List<[string, boolean]>;

    private d2Labels:Immutable.List<[string, boolean]>;

    private multiSattrAllowedStructs:Immutable.List<string>;

    private setupError:string;

    private queryContainsWithin:boolean;

    private minAbsFreq:string;

    private filterZeroVectors:boolean;

    private isTransposed:boolean;

    private alignType1:string;

    private ctxIndex1:number;

    private alignType2:string;

    private ctxIndex2:number;

    private static COLOR_HEATMAP = [
        '#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'
    ];

    private static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    private static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    private static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'Node', '1R', '2R', '3R', '4R', '5R', '6R'];


    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:ContingencyTableFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.availAttrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.availStructAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.attr1 = props.ctattr1;
        this.attr2 = props.ctattr2;
        this.d1Labels = Immutable.List<[string, boolean]>();
        this.d2Labels = Immutable.List<[string, boolean]>();
        this.multiSattrAllowedStructs = Immutable.List<string>(props.multiSattrAllowedStructs);
        this.queryContainsWithin = props.queryContainsWithin;
        this.minAbsFreq = props.ctminfreq;
        this.filterZeroVectors = true;
        this.isTransposed = false;
        [this.ctxIndex1, this.alignType1] = this.importCtxValue(props.ctfcrit1);
        [this.ctxIndex2, this.alignType2] = this.importCtxValue(props.ctfcrit2);


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
                        if (this.data) {
                            this.updateData();
                        }

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__ct_min_freq_val_error'));
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY':
                    this.filterZeroVectors = payload.props['value'];
                    this.updateData();
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
            }
        });
    }


    private applyQuickFilter(arg1:string, arg2:string):void {
        const args = this.pageModel.getConcArgs();
        args.set('q2', arg1);
        args.set('format', 'json');
        this.pageModel.ajax<Kontext.AjaxResponse>(
            'GET',
            this.pageModel.createActionUrl('quick_filter'),
            args

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.pageModel.replaceConcArg('q', data['Q']);
                    const args = this.pageModel.getConcArgs();
                    args.set('q2', arg2);
                    window.location.href = this.pageModel.createActionUrl('quick_filter', args.items());

                } else {
                    this.pageModel.showMessage('error', data.messages[0]);
                }

            },
            (err) => {
                this.pageModel.showMessage('error', err);
            }
        );
    }


    private updateData():void {
        this.data = filterDataTable(this.origData, (item) => {
            return item && item.abs >= parseInt(this.minAbsFreq || '0', 10);
        });
        if (this.filterZeroVectors) {
            this.removeZeroVectors();

        } else {
            this.d1Labels = this.d1Labels.map<[string, boolean]>(x => [x[0], true]).toList();
            this.d2Labels = this.d2Labels.map<[string, boolean]>(x => [x[0], true]).toList();
        }
    }

    private importCtxValue(v:string):[number, string] {
        let srchIdx = ContingencyTableStore.POSITION_LA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, 'left'];
        }
        srchIdx = ContingencyTableStore.POSITION_RA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, 'right'];
        }
        return  [6, 'left'];
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
        this.updateData();
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

    private getAttrCtx(attr:string):string {
        if (attr === this.attr1) {
            return this.alignType1 === 'left' ?
                ContingencyTableStore.POSITION_LA[this.ctxIndex1] : ContingencyTableStore.POSITION_RA[this.ctxIndex1];

        } else if (attr === this.attr2) {
            return this.alignType2 === 'left' ?
                ContingencyTableStore.POSITION_LA[this.ctxIndex2] : ContingencyTableStore.POSITION_RA[this.ctxIndex2];
        }
        throw new Error('Unknown attr ' + attr);
    }

    private generateCrit(attr:string):string {
        return this.isStructAttr(attr) ? '0' : this.getAttrCtx(attr);
    }

    private getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('ctfcrit1', this.generateCrit(this.attr1));
        args.set('ctfcrit2', this.generateCrit(this.attr2));
        args.set('ctattr1', this.attr1);
        args.set('ctattr2', this.attr2);
        args.set('ctminfreq', this.minAbsFreq);
        return args;
    }

    private reloadData():RSVP.Promise<any> { // TODO
        const args = this.getSubmitArgs();
        args.set('format', 'json');
        return this.pageModel.ajax(
            'GET',
            this.pageModel.createActionUrl('freqct'),
            args

        ).then(
            (data:any) => { // TODO type
                this.importData(data);
            }
        );
    }

    private validateMinAbsFreqAttr(v:string):boolean {
        return /^(0?|([1-9][0-9]*))$/.exec(v) !== null;
    }

    private isStructAttr(v:string):boolean {
        return v.indexOf('.') > -1;
    }

    private validateAttrs():void {
        if (this.isStructAttr(this.attr1) && this.isStructAttr(this.attr2)
            && (this.multiSattrAllowedStructs.indexOf(this.attr1.split('.')[0]) === -1
                || this.multiSattrAllowedStructs.indexOf(this.attr2.split('.')[0]) === -1)) {
            this.setupError =
                this.multiSattrAllowedStructs.size > 0 ?
                    this.pageModel.translate('freq__ct_only_some_sattr_allowed_{allowed_sattrs}',
                                             {allowed_sattrs: this.multiSattrAllowedStructs.join(', ')}) :
                    this.pageModel.translate('freq__ct_two_sattrs_not_allowed');

        } else {
            this.setupError = '';
        }
    }


    submitForm():void {
        const args = this.getSubmitArgs();
        window.location.href = this.pageModel.createActionUrl('freqct', args.items());
    }

    private generatePFilter(v1:string, v2:string):[string, string] {

        const pfilter = (attr:string, v:string):string => {
            if (this.isStructAttr(attr)) {
                const [s, a] = attr.split('.');
                return `p0 0 1 [] within <${s} ${a}="${v}" />`;

            } else {
                const icase = ''; // TODO - optionally (?i)
                const begin = this.getAttrCtx(attr);
                const end = this.getAttrCtx(attr);
                return `p${begin} ${end} 0 [${attr}="${icase}${v}"]`;
            }
        };

        return [pfilter(this.attr1, v1), pfilter(this.attr2, v2)];
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
            tableData[item[0]][item[1]] = {
                ipm: ipm,
                abs: item[2],
                domainSize: item[3],
                bgColor: undefined,
                pfilter: this.generatePFilter(item[0], item[1]),
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
                domainSize: cell.domainSize,
                bgColor: ContingencyTableStore.COLOR_HEATMAP[~~Math.floor((cell.ipm - fMin) * 8 / (fMax - fMin))],
                pfilter: cell.pfilter
            };
        });
        this.updateData();
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

    /**
     * Return both positional and structural attributes
     * as a single list (positional first).
     */
    getAllAvailAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availAttrList
                .concat([{n: null, label: '--------------------'}])
                .concat(this.availStructAttrList.sort(sortAttrVals)).toList();
    }


    private setDimensionAttr(dimNum:number, v:string):void {
        if (dimNum === 1) {
            this.attr1 = v;

        } else if (dimNum === 2) {
            this.attr2 = v;

        } else {
            throw new Error('Unknown dimension specification');
        }
    }


    getAttr1():string {
        return this.attr1;
    }

    getAttr2():string {
        return this.attr2;
    }

    getAttr1IsStruct():boolean {
        return this.isStructAttr(this.attr1);
    }

    getAttr2IsStruct():boolean {
        return this.isStructAttr(this.attr2);
    }

    getSetupError():string {
        return this.setupError;
    }

    getQueryContainsWithin():boolean {
        return this.queryContainsWithin;
    }

    getMinAbsFreq():string {
        return this.minAbsFreq;
    }

    getFilterZeroVectors():boolean {
        return this.filterZeroVectors;
    }

    getIsTransposed():boolean {
        return this.isTransposed;
    }

    getPositionRangeLabels():Array<string> {
        return ContingencyTableStore.POSITION_LABELS;
    }

    getAlignType(dim:number):string {
        if (dim === 1) {
            return this.alignType1;

        } else if (dim === 2) {
            return this.alignType2;
        }
        return undefined;
    }

    getCtxIndex(dim:number):number {
        if (dim === 1) {
            return this.ctxIndex1;

        } else if (dim === 2) {
            return this.ctxIndex2;
        }
        return undefined;
    }


}
