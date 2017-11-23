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
/// <reference path="../../vendor.d.ts/immutable.d.ts" />

import {SimplePageStore} from '../base';
import {PageModel} from '../../pages/document';
import * as Immutable from 'vendor/immutable';
import { dispatch } from 'vendor/d3';
import {MultiDict} from '../../util';


export const sortAttrVals = (x1:Kontext.AttrItem, x2:Kontext.AttrItem) => {
    if (x1.label < x2.label) {
        return -1;
    }
    if (x1.label > x2.label) {
        return 1;
    }
    return 0;
};


/**
 * Provides a unified way how to round internal values. Number
 * are round to 2 decimal places.
 * @param v
 */
export const roundFloat = (v:number):number => Math.round(v * 100) / 100;


export const isStructAttr = (v:string):boolean => {
    return v.indexOf('.') > -1;
};


export const validateMinAbsFreqAttr = (v:string):boolean => {
    return /^(0?|([1-9][0-9]*))$/.exec(v) !== null;
};


export interface CTFormInputs {
    ctminfreq:string;
    ctminfreq_type:string;
    ctattr1:string;
    ctattr2:string;
    ctfcrit1:string;
    ctfcrit2:string;
}


export interface CTFormProperties extends CTFormInputs {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    multiSattrAllowedStructs:Array<string>;
}

/**
 * Supported filtering quantities.
 */
export const enum FreqFilterQuantities {
    ABS = "abs",
    ABS_PERCENTILE = "pabs",
    IPM = "ipm",
    IPM_PERCENTILE = "pipm"
}


export class CTFreqFormStore extends SimplePageStore {

    public static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    public static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    public static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'Node', '1R', '2R', '3R', '4R', '5R', '6R'];

    private pageModel:PageModel;

    private availAttrList:Immutable.List<Kontext.AttrItem>;

    private availStructAttrList:Immutable.List<Kontext.AttrItem>;

    private multiSattrAllowedStructs:Immutable.List<string>;

    private attr1:string;

    private attr2:string;

    private minFreq:string;

    private minFreqType:string;

    private setupError:string;

    private alignType1:string;

    private ctxIndex1:number;

    private alignType2:string;

    private ctxIndex2:number;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:CTFormProperties) {
        super(dispatcher);

        this.pageModel = pageModel;
        this.availAttrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.availStructAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.multiSattrAllowedStructs = Immutable.List<string>(props.multiSattrAllowedStructs);
        this.attr1 = props.ctattr1;
        this.attr2 = props.ctattr2;
        this.minFreq = props.ctminfreq;
        this.minFreqType = props.ctminfreq_type;
        [this.ctxIndex1, this.alignType1] = this.importCtxValue(props.ctfcrit1);
        [this.ctxIndex2, this.alignType2] = this.importCtxValue(props.ctfcrit2);

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_CT_FORM_SET_DIMENSION_ATTR':
                    this.setDimensionAttr(payload.props['dimension'], payload.props['value']);
                    this.validateAttrs();
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_FORM_SET_MIN_FREQ_TYPE':
                    this.minFreqType = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_FORM_SET_MIN_FREQ':
                    if (validateMinAbsFreqAttr(payload.props['value']) &&
                            this.minFreqType !== FreqFilterQuantities.ABS_PERCENTILE &&
                            this.minFreqType !== FreqFilterQuantities.IPM_PERCENTILE ||
                            parseFloat(payload.props['value'] || '0') > 0 &&
                            parseFloat(payload.props['value'] || '0') <= 100) {
                        this.minFreq = payload.props['value'];
                        this.notifyChangeListeners();

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__ct_min_freq_val_error'));
                        this.notifyChangeListeners();
                    }
                break;
                case 'FREQ_CT_FORM_SET_CTX':
                    if (payload.props['dim'] === 1) {
                        this.ctxIndex1 = payload.props['value'];

                    } else if (payload.props['dim'] === 2) {
                        this.ctxIndex2 = payload.props['value'];
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_FORM_SET_ALIGN_TYPE':
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
            }
        });
    }

    private importCtxValue(v:string):[number, string] {
        let srchIdx = CTFreqFormStore.POSITION_LA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, 'left'];
        }
        srchIdx = CTFreqFormStore.POSITION_RA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, 'right'];
        }
        return  [6, 'left'];
    }

    private validateAttrs():void {
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

    private setDimensionAttr(dimNum:number, v:string):void {
        if (dimNum === 1) {
            this.attr1 = v;

        } else if (dimNum === 2) {
            this.attr2 = v;

        } else {
            throw new Error('Unknown dimension specification');
        }
    }

    private getAttrOfDim(dim:number):string {
        switch (dim) {
            case 1:
            return this.attr1;
            case 2:
            return this.attr2;
            default:
            throw new Error(`Unknown dimension: ${dim}`);
        }
    }

    /**
     * Return filter range value (e.g. '-3>0') for a provided dimension attribute.
     *
     * @param dim either 1 (rows) or 2 (cols)
     */
    private getAttrCtx(dim:number):string {
        if (dim === 1) {
            return this.alignType1 === 'left' ?
                CTFreqFormStore.POSITION_LA[this.ctxIndex1] :
                CTFreqFormStore.POSITION_RA[this.ctxIndex1];

        } else if (dim === 2) {
            return this.alignType2 === 'left' ?
                CTFreqFormStore.POSITION_LA[this.ctxIndex2] :
                CTFreqFormStore.POSITION_RA[this.ctxIndex2];
        }
        throw new Error('Unknown dimension ' + dim);
    }

    private generateCrit(dim:number):string {
        const attr = this.getAttrOfDim(dim);
        return isStructAttr(attr) ? '0' : this.getAttrCtx(dim);
    }

    private getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('ctfcrit1', this.generateCrit(1));
        args.set('ctfcrit2', this.generateCrit(2));
        args.set('ctattr1', this.attr1);
        args.set('ctattr2', this.attr2);
        args.set('ctminfreq', this.minFreq);
        args.set('ctminfreq_type', this.minFreqType);
        return args;
    }

    submitForm():void {
        const args = this.getSubmitArgs();
        window.location.href = this.pageModel.createActionUrl('freqct', args.items());
    }

    getPosAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availAttrList;
    }

    getStructAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availStructAttrList.sort(sortAttrVals).toList();
    }

    getAttr1():string {
        return this.attr1;
    }

    getAttr2():string {
        return this.attr2;
    }

    getAttr1IsStruct():boolean {
        return isStructAttr(this.attr1);
    }

    getAttr2IsStruct():boolean {
        return isStructAttr(this.attr2);
    }

    getMinFreq():string {
        return this.minFreq;
    }

    getMinFreqHint():string {
        if (this.minFreqType === FreqFilterQuantities.ABS_PERCENTILE ||
            this.minFreqType === FreqFilterQuantities.IPM_PERCENTILE) {
            return this.pageModel.translate('freq__ct_percentile_hint_{value}',
                    {value: roundFloat(100 - parseFloat(this.minFreq))})
        }
        return null;
    }

    getMinFreqType():string {
        return this.minFreqType;
    }

    getSetupError():string {
        return this.setupError;
    }

    getPositionRangeLabels():Array<string> {
        return CTFreqFormStore.POSITION_LABELS;
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
