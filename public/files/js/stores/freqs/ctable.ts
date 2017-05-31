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
}


export interface ContingencyTableFormProperties extends ContingencyTableFormInputs {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    multiSattrAllowedStructs:Array<string>;
    queryContainsWithin:boolean;
    attr1:string;
    attr2:string;
}



interface CTFreqCell {
    abs:number;
    ipm:number;
    domainSize:number;
    bgColor:string;
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

    private d1Labels:Immutable.List<string>;

    private d2Labels:Immutable.List<string>;

    private multiSattrAllowedStructs:Immutable.List<string>;

    private setupError:string;

    private queryContainsWithin:boolean;

    private minAbsFreq:string;

    private static colorHeatmap = [
        '#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'
    ];


    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:ContingencyTableFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.availAttrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.availStructAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.attr1 = props.attr1;
        this.attr2 = props.attr2;
        this.d1Labels = Immutable.List<string>();
        this.d2Labels = Immutable.List<string>();
        this.multiSattrAllowedStructs = Immutable.List<string>(props.multiSattrAllowedStructs);
        this.queryContainsWithin = props.queryContainsWithin;
        this.minAbsFreq = props.ctminfreq;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_CT_FORM_SET_DIMENSION_ATTR':
                    this.setDimensionAttr(payload.props['dimension'], payload.props['value']);
                    this.validateAttrs();
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_TRANSPOSE_TABLE':
                    [this.attr1, this.attr2] = [this.attr2, this.attr1];
                    this.submitForm();
                    // leaves page here
                break;
                case 'FREQ_CT_SUBMIT':
                    if (!this.setupError) {
                        this.submitForm();
                        // leaves page here

                    } else {
                        this.pageModel.showMessage('error', this.setupError);
                        this.notifyChangeListeners();
                    }
                break;
                case 'FREQ_CT_SET_MIN_ABS_FREQ':
                    if (this.validateMinAbsFreqAttr(payload.props['value'])) {
                        this.minAbsFreq = payload.props['value'];

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__ct_min_freq_val_error'));
                    }
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private validateMinAbsFreqAttr(v:string):boolean {
        return /^(0?|([1-9][0-9]*))$/.exec(v) !== null;
    }

    private getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('fcrit', `${this.attr1} 0 ${this.attr2} 0`);
        args.set('attr1', this.attr1);
        args.set('attr2', this.attr2);
        return args;
    }

    private validateAttrs():void {
        const isStructAttr = (v:string) => v.indexOf('.') > -1;

        if (isStructAttr(this.attr1) && isStructAttr(this.attr2)
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



    importData(data:FreqResultResponse.CTFreqResultData):void {
        const d1Labels:{[name:string]:boolean} = {};
        const d2Labels:{[name:string]:boolean} = {};
        const tableData:Data2DTable = {};
        const calcIpm = (v:FreqResultResponse.CTFreqResultItem) => v[2] / v[3] * 1e6;
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
                bgColor: undefined
            };

            if (ipm > fMax) {
                fMax = ipm;
            }
            if (ipm < fMin) {
                fMin = ipm;
            }
        });

        this.d1Labels = Immutable.List<string>(Object.keys(d1Labels).sort());
        this.d2Labels = Immutable.List<string>(Object.keys(d2Labels).sort());
        this.data = mapDataTable(tableData, (cell) => {
            return {
                ipm: cell.ipm,
                abs: cell.abs,
                domainSize: cell.domainSize,
                bgColor: ContingencyTableStore.colorHeatmap[~~Math.floor((cell.ipm - fMin) * 8 / (fMax - fMin))]
            };
        });
    }

    getData():any {
        return this.data;
    }

    getD1Labels():Immutable.List<string> {
        return this.d1Labels;
    }

    getD2Labels():Immutable.List<string> {
        return this.d2Labels;
    }

    /**
     * Return both positional and structural attributes
     * as a single list (positional first).
     */
    getAllAvailAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availAttrList
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

    getSetupError():string {
        return this.setupError;
    }

    getQueryContainsWithin():boolean {
        return this.queryContainsWithin;
    }

    getMinAbsFreq():string {
        return this.minAbsFreq;
    }
}