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

import { IFullActionControl, StatelessModel } from 'kombo';

import { Kontext } from '../../../types/common';
import { PageModel } from '../../../app/page';
import { MultiDict } from '../../../multidict';
import { CTFreqServerArgs } from '../common';
import { Actions, ActionName } from '../actions';
import { FreqFilterQuantities, AlignTypes, CTFormProperties, Dimensions, isStructAttr, roundFloat, validatePercentile,
    isPercentileFilterQuantity, validateMinAbsFreqAttr } from './common';


export interface Freq2DFormModelState {

    availAttrList:Array<Kontext.AttrItem>;
    availStructAttrList:Array<Kontext.AttrItem>;
    attr1:string;
    attr2:string;
    minFreq:string;
    minFreqType:FreqFilterQuantities;
    alignType1:AlignTypes;
    ctxIndex1:number;
    alignType2:AlignTypes;
    ctxIndex2:number;
    positionRangeLabels:Array<string>;
    usesAdHocSubcorpus:boolean;
    minFreqHint:string;
}

/**
 *
 */
export class Freq2DFormModel extends StatelessModel<Freq2DFormModelState> {

    public static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    public static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    public static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'node', '1R', '2R', '3R', '4R', '5R', '6R'];

    private readonly pageModel:PageModel;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:CTFormProperties) {

        const [ctxIndex1, alignType1] = Freq2DFormModel.importCtxValue(props.ctfcrit1);
        const [ctxIndex2, alignType2] = Freq2DFormModel.importCtxValue(props.ctfcrit2);
        super(
            dispatcher,
            {
                availAttrList: props.attrList,
                availStructAttrList: props.structAttrList,
                attr1: props.ctattr1,
                attr2: props.ctattr2,
                minFreq: props.ctminfreq,
                minFreqType: props.ctminfreq_type,
                ctxIndex1,
                alignType1,
                ctxIndex2,
                alignType2,
                positionRangeLabels: Freq2DFormModel.POSITION_LABELS,
                usesAdHocSubcorpus: props.usesAdHocSubcorpus,
                minFreqHint: ''
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler<Actions.FreqctFormSetDimensionAttr>(
            ActionName.FreqctFormSetDimensionAttr,
            (state, action) => {
                this.setDimensionAttr(state, action.payload.dimension, action.payload.value);
            }
        );

        this.addActionHandler<Actions.FreqctFormSetMinFreqType>(
            ActionName.FreqctFormSetMinFreqType,
            (state, action) => {
                state.minFreqType = action.payload.value;
            }
        );

        this.addActionHandler<Actions.FreqctFormSetMinFreq>(
            ActionName.FreqctFormSetMinFreq,
            (state, action) => {
                state.minFreq = action.payload.value;
                state.minFreqHint = this.getMinFreqHint(state);
            },
            (state, action, dispatch) => {
                const err2 = this.validateMinFreq(state.minFreqType, action.payload.value);
                if (err2) {
                    this.pageModel.showMessage('error', err2);
                }
            }
        );

        this.addActionHandler<Actions.FreqctFormSetCtx>(
            ActionName.FreqctFormSetCtx,
            (state, action) => {
                if (action.payload.dim === Dimensions.FIRST) {
                    state.ctxIndex1 = action.payload.value;

                } else if (action.payload.dim === Dimensions.SECOND) {
                    state.ctxIndex2 = action.payload.value;
                }
            }
        );

        this.addActionHandler<Actions.FreqctFormSetAlignType>(
            ActionName.FreqctFormSetAlignType,
            (state, action) => {
                if (action.payload.dim === Dimensions.FIRST) {
                    state.alignType1 = action.payload.value;

                } else if (action.payload.dim === Dimensions.SECOND) {
                    state.alignType2 = action.payload.value;
                }
            }
        );

        this.addActionHandler<Actions.FreqctFormSubmit>(
            ActionName.FreqctFormSubmit,
            null,
            (state, action, dispatch) => {
                const err = this.validateMinFreq(state.minFreqType, state.minFreq);
                if (!err) {
                    this.submitForm(state);
                    // leaves the page here

                } else {
                    if (err) {
                        this.pageModel.showMessage('error', err);
                    }
                }
            }
        );

    }

    private validateMinFreq(minFreqType:FreqFilterQuantities, minFreqInput:string):Error {
        if (isPercentileFilterQuantity(minFreqType) &&
                validatePercentile(minFreqInput) ||
                !isPercentileFilterQuantity(minFreqType) &&
                validateMinAbsFreqAttr(minFreqInput)) {
            return null;

        } else {
            return Error(this.pageModel.translate('freq__ct_min_freq_val_error'));
        }
    }

    static importCtxValue(v:string):[number, AlignTypes] {
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

    private setDimensionAttr(state:Freq2DFormModelState, dimNum:Dimensions, v:string):void {
        if (dimNum === Dimensions.FIRST) {
            state.attr1 = v;

        } else if (dimNum === Dimensions.SECOND) {
            state.attr2 = v;

        } else {
            throw new Error('Unknown dimension specification');
        }
    }

    private getAttrOfDim(state:Freq2DFormModelState, dim:Dimensions):string {
        switch (dim) {
            case Dimensions.FIRST:
            return state.attr1;
            case Dimensions.SECOND:
            return state.attr2;
            default:
            throw new Error(`Unknown dimension: ${dim}`);
        }
    }

    /**
     * Return filter range value (e.g. '-3>0') for a provided dimension attribute.
     *
     * @param dim either 1 (rows) or 2 (cols)
     */
    private getAttrCtx(state:Freq2DFormModelState, dim:Dimensions):string {
        if (dim === 1) {
            return state.alignType1 === 'left' ?
                Freq2DFormModel.POSITION_LA[state.ctxIndex1] :
                Freq2DFormModel.POSITION_RA[state.ctxIndex1];

        } else if (dim === 2) {
            return state.alignType2 === 'left' ?
                Freq2DFormModel.POSITION_LA[state.ctxIndex2] :
                Freq2DFormModel.POSITION_RA[state.ctxIndex2];
        }
        throw new Error('Unknown dimension ' + dim);
    }

    private generateCrit(state:Freq2DFormModelState, dim:Dimensions):string {
        const attr = this.getAttrOfDim(state, dim);
        return isStructAttr(attr) ? '0' : this.getAttrCtx(state, dim);
    }

    private getSubmitArgs(state:Freq2DFormModelState):MultiDict<CTFreqServerArgs> {
        const args = this.pageModel.getConcArgs() as MultiDict<CTFreqServerArgs>;
        args.set('ctfcrit1', this.generateCrit(state, 1));
        args.set('ctfcrit2', this.generateCrit(state, 2));
        args.set('ctattr1', state.attr1);
        args.set('ctattr2', state.attr2);
        args.set('ctminfreq', state.minFreq);
        args.set('ctminfreq_type', state.minFreqType);
        return args;
    }

    submitForm(state:Freq2DFormModelState):void {
        const args = this.getSubmitArgs(state);
        window.location.href = this.pageModel.createActionUrl('freqct', args.items());
    }

    private getMinFreqHint(state:Freq2DFormModelState):string {
        if (state.minFreqType === FreqFilterQuantities.ABS_PERCENTILE ||
            state.minFreqType === FreqFilterQuantities.IPM_PERCENTILE) {
            return this.pageModel.translate('freq__ct_percentile_hint_{value}',
                    {value: roundFloat(100 - parseFloat(state.minFreq))})
        }
        return null;
    }

    static getAlignType(state:Freq2DFormModelState, dim:Dimensions):AlignTypes {
        if (dim === Dimensions.FIRST) {
            return state.alignType1;

        } else if (dim === Dimensions.SECOND) {
            return state.alignType2;
        }
        return undefined;
    }

    static getCtxIndex(state:Freq2DFormModelState, dim:Dimensions):number {
        if (dim === Dimensions.FIRST) {
            return state.ctxIndex1;

        } else if (dim === Dimensions.SECOND) {
            return state.ctxIndex2;
        }
        return undefined;
    }

}
