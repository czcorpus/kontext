/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { Dict, List, pipe, tuple } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext.js';
import { PageModel } from '../../../app/page.js';
import { FreqServerArgs, MLFreqServerArgs } from './common.js';
import { AlignTypes } from '../twoDimension/common.js';
import { Actions } from './actions.js';
import { FreqChartsAvailableOrder } from '../common.js';
import { validateNumber } from '../../base.js';


export interface FreqFormInputs {
    fttattr:Array<string>;
    flimit:string;
    freq_sort:FreqChartsAvailableOrder;

    mlxattr:Array<string>;
    mlxicase:Array<boolean>;
    mlxctx:Array<string>;
    alignType:Array<AlignTypes>;
}


/**
 * Contains values for both freq form stores
 */
export interface FreqFormProps extends FreqFormInputs {
    structAttrList:Array<Kontext.AttrItem>;
    attrList:Array<Kontext.AttrItem>;
}

/**
 *
 */
function validateGzNumber(s:string):boolean {
    return !!/^([1-9]\d*)?$/.exec(s);
}

/**
 *
 */
export interface MLFreqFormModelState {
    attrList:Array<Kontext.AttrItem>;
    flimit:Kontext.FormValue<string>;
    freqSort:string;
    mlxattr:Array<string>;
    mlxicase:Array<boolean>;
    mlxctxIndices:Array<number>;
    alignType:Array<AlignTypes>;
    maxNumLevels:number;
}

function importMlxctxValue(v:string, positionLa:string[], positionRa:string[]):number {
    let srchIdx = positionLa.indexOf(v);
    if (srchIdx > -1) {
        return srchIdx;
    }
    srchIdx = positionRa.indexOf(v);
    if (srchIdx > -1) {
        return srchIdx;
    }
    return undefined;
}

export class MLFreqFormModel extends StatelessModel<MLFreqFormModelState> {

    private pageModel:PageModel;

    private static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    private static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    private static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'Node', '1R', '2R', '3R', '4R', '5R', '6R'];

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:FreqFormProps, maxNumLevels:number) {
        super(
            dispatcher,
            {
                attrList: props.attrList,
                flimit: {value: props.flimit, isInvalid: false, isRequired: true},
                freqSort: props.freq_sort,
                mlxattr: props.mlxattr,
                mlxicase: props.mlxicase,
                mlxctxIndices: List.map(item => importMlxctxValue(item, MLFreqFormModel.POSITION_LA, MLFreqFormModel.POSITION_RA), props.mlxctx),
                alignType: props.alignType,
                maxNumLevels: maxNumLevels,
            }
        );

        this.pageModel = pageModel;

        this.addActionHandler(
            Actions.MLSetFLimit,
            (state, action) => {state.flimit.value = action.payload.value}
        );

        this.addActionHandler(
            Actions.MLAddLevel,
            (state, action) => {
                if (state.mlxattr.length < state.maxNumLevels) {
                    this.addLevel(state);

                } else {
                    throw new Error('Maximum number of levels reached');
                }
            }
        );

        this.addActionHandler(
            Actions.MLRemoveLevel,
            (state, action) => this.removeLevel(state, action.payload.levelIdx)
        );

        this.addActionHandler(
            Actions.MLChangeLevel,
            (state, action) => this.changeLevel(state, action.payload.levelIdx, action.payload.direction)
        );

        this.addActionHandler(
            Actions.MLSetMlxAttr,
            (state, action) => {state.mlxattr[action.payload.levelIdx] = action.payload.value}
        );

        this.addActionHandler(
            Actions.MLSetMlxiCase,
            (state, action) => {state.mlxicase[action.payload.levelIdx] = !state.mlxicase[action.payload.levelIdx]}
        );

        this.addActionHandler(
            Actions.MLSetMlxctxIndex,
            (state, action) => {state.mlxctxIndices[action.payload.levelIdx] = Number(action.payload.value)}
        );

        this.addActionHandler(
            Actions.MLSetAlignType,
            (state, action) => {state.alignType[action.payload.levelIdx] = action.payload.value}
        );

        this.addActionHandler(
            Actions.MLSubmit,
            (state, action) => {
                const err = this.validateForm(state);
                if (!err) {
                    this.submit(state);

                } else {
                    this.pageModel.showMessage('error', err);
                }
            }
        );
    }

    private validateForm(state:MLFreqFormModelState):Error|null {
        if (validateGzNumber(state.flimit.value)) {
            state.flimit.isInvalid = false;
            return null;

        } else {
            state.flimit.isInvalid = true;
            return new Error(this.pageModel.translate('global__invalid_gz_number_value'));
        }
    }

    private addLevel(state:MLFreqFormModelState):void {
        state.mlxattr.push(state.attrList[0].n);
        state.mlxicase.push(false);
        state.mlxctxIndices.push(importMlxctxValue('0>0', MLFreqFormModel.POSITION_LA, MLFreqFormModel.POSITION_RA));
        state.alignType.push(AlignTypes.LEFT);
    }

    private removeLevel(state:MLFreqFormModelState, levelIdx:number):void {
        state.mlxattr = List.removeAt(levelIdx, state.mlxattr);
        state.mlxicase = List.removeAt(levelIdx, state.mlxicase);
        state.mlxctxIndices = List.removeAt(levelIdx, state.mlxctxIndices);
        state.alignType = List.removeAt(levelIdx, state.alignType);
    }

    private changeLevel(state:MLFreqFormModelState, levelIdx:number, direction:string):void {
        const shift = direction === 'down' ? 1 : -1;
        [state.mlxattr[levelIdx], state.mlxattr[levelIdx + shift]] = [
            state.mlxattr[levelIdx + shift],
            state.mlxattr[levelIdx]
        ];
        [state.mlxicase[levelIdx], state.mlxicase[levelIdx + shift]] = [
            state.mlxicase[levelIdx + shift],
            state.mlxicase[levelIdx]
        ];
        [state.mlxctxIndices[levelIdx], state.mlxctxIndices[levelIdx + shift]] = [
            state.mlxctxIndices[levelIdx + shift],
            state.mlxctxIndices[levelIdx]
        ];
        [state.alignType[levelIdx], state.alignType[levelIdx + shift]] = [
            state.alignType[levelIdx + shift],
            state.alignType[levelIdx]
        ]
    }

    getSubmitArgs(state:MLFreqFormModelState):MLFreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            freq_type: 'tokens',
            fpage: 1,
            flimit: parseInt(state.flimit.value),
            ...pipe(
                state.mlxattr,
                List.map((item, i) => tuple(`ml${i+1}attr`, item)),
                Dict.fromEntries()
            ),
            ... pipe(
                state.mlxicase,
                List.map((item, i) => tuple(`ml${i+1}icase`, item ? 'i' : '')),
                Dict.fromEntries()
            ),
            ...pipe(
                state.mlxctxIndices,
                List.map((item, i) => {
                    const val = state.alignType[i] === 'left' ?
                        MLFreqFormModel.POSITION_LA[item] : MLFreqFormModel.POSITION_RA[item];
                    return tuple(`ml${i+1}ctx`, val);
                }),
                Dict.fromEntries()
            ),
            freqlevel: state.mlxattr.length,
            freq_sort: state.freqSort
        };
    }

    private submit(state:MLFreqFormModelState):void {
        window.location.href = this.pageModel.createActionUrl(
            'freqml', this.getSubmitArgs(state));
    }

    getPositionRangeLabels():Array<string> {
        return MLFreqFormModel.POSITION_LABELS;
    }

}

/**
 *
 */
export interface TTFreqFormModelState {
    structAttrList:Array<Kontext.AttrItem>;
    fttattr:Array<string>;
    flimit:Kontext.FormValue<string>;
    freqSort:string;
    isSubcorpusSelected:boolean;
}

export class TTFreqFormModel extends StatelessModel<TTFreqFormModelState> {

    private pageModel:PageModel;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:FreqFormProps) {
        super(
            dispatcher,
            {
                structAttrList: props.structAttrList,
                fttattr: props.fttattr,
                flimit: {value: props.flimit, isInvalid: false, isRequired: true},
                freqSort: props.freq_sort,
                isSubcorpusSelected: !!pageModel.getCorpusIdent().usesubcorp
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler(
            Actions.TTSetFttAttr,
            (state, action) => {
                if (state.fttattr.includes(action.payload.value)) {
                    state.fttattr = List.removeValue(action.payload.value, state.fttattr);

                } else {
                    state.fttattr = List.addUnique(action.payload.value, state.fttattr);
                }
            }
        );

        this.addActionHandler(
            Actions.TTSetFLimit,
            (state, action) => {
                state.flimit.value = action.payload.value;
                const err = this.validateFlimit(state);
                if (err instanceof Error) {
                    state.flimit.isInvalid = true;
                    state.flimit.errorDesc = err.message;

                } else {
                    state.flimit.isInvalid = false;
                    state.flimit.errorDesc = undefined;
                }
            },
            (state, action, dispatch) => {

            }
        );

        this.addActionHandler(
            Actions.TTSubmit,
            (state, action) => {
                const err = this.validateForm(state);
                if (!err) {
                    this.submit(state);
                    // we leave page here

                } else {
                    this.pageModel.showMessage('error', err);
                }
            }
        );
    }

    private validateFlimit(state:TTFreqFormModelState):Error|null {
        if (!validateNumber(state.flimit.value) || parseInt(state.flimit.value) < 0) {
            return new Error(this.pageModel.translate('global__invalid_nneg_number_value'));
        }
        return null;
    }

    private validateForm(state:TTFreqFormModelState):Error|null {
        const validateError = this.validateFlimit(state);
        if (!validateError) {
            state.flimit.isInvalid = false;

        } else {
            state.flimit.isInvalid = true;
            return validateError;
        }
        return null;
    }

    private submit(state:TTFreqFormModelState):void {
        const args:FreqServerArgs = {
            ...this.pageModel.getConcArgs(),
            freq_type: 'text-types',
            fttattr: List.head(state.fttattr),
            fttattr_async: List.tail(state.fttattr),
            flimit: parseInt(state.flimit.value),
            fpage: 1,
            freq_sort: state.freqSort,
            freqlevel: undefined
        };
        window.location.href = this.pageModel.createActionUrl('freqtt', args);
    }

}
