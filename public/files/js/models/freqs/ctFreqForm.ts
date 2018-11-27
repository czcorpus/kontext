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

import {Kontext, TextTypes} from '../../types/common';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, Action} from '../../app/dispatcher';
import * as Immutable from 'immutable';
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

/**
 * Test whether a provided identifier represents
 * a structural attribute (e.g. 'doc.id', 'div.author').
 */
export const isStructAttr = (v:string):boolean => {
    return v.indexOf('.') > -1;
};

/**
 * Test for non-negative values.
 */
export const validateMinAbsFreqAttr = (v:string):boolean => {
    return /^(0?|([1-9][0-9]*))$/.exec(v) !== null;
};

/**
 * Test for values 0 < x <= 100
 */
export const validatePercentile = (v:string):boolean => {
    return validateMinAbsFreqAttr(v) && parseFloat(v) > 0 && parseFloat(v) <= 100;
};

/**
 * Test whether a provided quantity represents
 * a percentile-based one.
 */
export const isPercentileFilterQuantity = (v:FreqFilterQuantities):boolean => {
    return v === FreqFilterQuantities.ABS_PERCENTILE || v === FreqFilterQuantities.IPM_PERCENTILE;
};

/**
 * Input values for 2d frequency entry form.
 */
export interface CTFormInputs {
    ctminfreq:string;
    ctminfreq_type:FreqFilterQuantities;
    ctattr1:string;
    ctattr2:string;
    ctfcrit1:string;
    ctfcrit2:string;
}

/**
 * All the inputs and required data for 2d freq.
 * entry form.
 */
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

export const enum AlignTypes {
    RIGHT = "right",
    LEFT = "left"
}

export const enum Dimensions {
    FIRST = 1,
    SECOND = 2
}

/**
 *
 */
export class Freq2DFormModel extends StatefulModel {

    public static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    public static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    public static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'node', '1R', '2R', '3R', '4R', '5R', '6R'];

    private pageModel:PageModel;

    private adhocSubcDetector:TextTypes.IAdHocSubcorpusDetector;

    private availAttrList:Immutable.List<Kontext.AttrItem>;

    private availStructAttrList:Immutable.List<Kontext.AttrItem>;

    private multiSattrAllowedStructs:Immutable.List<string>;

    private attr1:string;

    private attr2:string;

    private minFreq:string;

    private minFreqType:FreqFilterQuantities;

    private alignType1:AlignTypes;

    private ctxIndex1:number;

    private alignType2:AlignTypes;

    private ctxIndex2:number;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, props:CTFormProperties,
            adhocSubcIdentifier:TextTypes.IAdHocSubcorpusDetector) {
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
        this.adhocSubcDetector = adhocSubcIdentifier;

        dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'FREQ_CT_FORM_SET_DIMENSION_ATTR':
                    this.setDimensionAttr(action.props['dimension'], action.props['value']);
                    const err1 = this.validateAttrs();
                    if (err1) {
                        this.pageModel.showMessage('error', err1);
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_FORM_SET_MIN_FREQ_TYPE':
                    this.minFreqType = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_FORM_SET_MIN_FREQ':
                    this.minFreq = action.props['value'];
                    const err2 = this.validateMinFreq();
                    if (err2) {
                        this.pageModel.showMessage('error', err2);
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_FORM_SET_CTX':
                    if (action.props['dim'] === 1) {
                        this.ctxIndex1 = action.props['value'];

                    } else if (action.props['dim'] === 2) {
                        this.ctxIndex2 = action.props['value'];
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_FORM_SET_ALIGN_TYPE':
                    if (action.props['dim'] === 1) {
                        this.alignType1 = action.props['value'];

                    } else if (action.props['dim'] === 2) {
                        this.alignType2 = action.props['value'];
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_CT_SUBMIT':
                    const err3 = this.validateMinFreq();
                    const err4 = this.validateAttrs();
                    if (!err3 && !err4) {
                        this.submitForm();
                        // leaves the page here

                    } else {
                        if (err3) {
                            this.pageModel.showMessage('error', err3);
                        }
                        if (err4) {
                            this.pageModel.showMessage('error', err4);
                        }
                        this.notifyChangeListeners();
                    }
            break;
            }
        });
    }

    private validateMinFreq():Error {
        if (isPercentileFilterQuantity(this.minFreqType) &&
                validatePercentile(this.minFreq) ||
                !isPercentileFilterQuantity(this.minFreqType) &&
                validateMinAbsFreqAttr(this.minFreq)) {
            return null;

        } else {
            return Error(this.pageModel.translate('freq__ct_min_freq_val_error'));
        }
    }

    private importCtxValue(v:string):[number, AlignTypes] {
        let srchIdx = Freq2DFormModel.POSITION_LA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, AlignTypes.LEFT];
        }
        srchIdx = Freq2DFormModel.POSITION_RA.indexOf(v);
        if (srchIdx > -1) {
            return [srchIdx, AlignTypes.RIGHT];
        }
        return  [6, AlignTypes.LEFT];
    }

    private validateAttrs():Error {
        if (isStructAttr(this.attr1) && isStructAttr(this.attr2)
                && (this.multiSattrAllowedStructs.indexOf(this.attr1.split('.')[0]) === -1
                || this.multiSattrAllowedStructs.indexOf(this.attr2.split('.')[0]) === -1)) {
            return new Error(
                this.multiSattrAllowedStructs.size > 0 ?
                    this.pageModel.translate('freq__ct_only_some_sattr_allowed_{allowed_sattrs}',
                                             {allowed_sattrs: this.multiSattrAllowedStructs.join(', ')}) :
                    this.pageModel.translate('freq__ct_two_sattrs_not_allowed')
                );

        } else {
            return null;
        }
    }

    private setDimensionAttr(dimNum:Dimensions, v:string):void {
        if (dimNum === Dimensions.FIRST) {
            this.attr1 = v;

        } else if (dimNum === Dimensions.SECOND) {
            this.attr2 = v;

        } else {
            throw new Error('Unknown dimension specification');
        }
    }

    private getAttrOfDim(dim:Dimensions):string {
        switch (dim) {
            case Dimensions.FIRST:
            return this.attr1;
            case Dimensions.SECOND:
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
    private getAttrCtx(dim:Dimensions):string {
        if (dim === 1) {
            return this.alignType1 === 'left' ?
                Freq2DFormModel.POSITION_LA[this.ctxIndex1] :
                Freq2DFormModel.POSITION_RA[this.ctxIndex1];

        } else if (dim === 2) {
            return this.alignType2 === 'left' ?
                Freq2DFormModel.POSITION_LA[this.ctxIndex2] :
                Freq2DFormModel.POSITION_RA[this.ctxIndex2];
        }
        throw new Error('Unknown dimension ' + dim);
    }

    private generateCrit(dim:Dimensions):string {
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

    getMinFreqType():FreqFilterQuantities {
        return this.minFreqType;
    }

    getPositionRangeLabels():Array<string> {
        return Freq2DFormModel.POSITION_LABELS;
    }

    getAlignType(dim:Dimensions):AlignTypes {
        if (dim === Dimensions.FIRST) {
            return this.alignType1;

        } else if (dim === Dimensions.SECOND) {
            return this.alignType2;
        }
        return undefined;
    }

    getCtxIndex(dim:Dimensions):number {
        if (dim === Dimensions.FIRST) {
            return this.ctxIndex1;

        } else if (dim === Dimensions.SECOND) {
            return this.ctxIndex2;
        }
        return undefined;
    }

    getUsesAdHocSubcorpus():boolean {
        return this.adhocSubcDetector.usesAdHocSubcorpus();
    }

}
