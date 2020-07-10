/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import {Kontext} from '../../types/common';
import {PageModel} from '../../app/page';
import * as Immutable from 'immutable';
import {AlignTypes} from './ctFreqForm';
import { IFullActionControl, StatelessModel } from 'kombo';
import { FreqServerArgs } from './common';
import { MultiDict } from '../../multidict';


export interface FreqFormInputs {
    fttattr:Array<string>;
    ftt_include_empty:boolean;
    flimit:string;
    freq_sort:string;

    mlxattr:Array<string>;
    mlxicase:Array<boolean>;
    mlxctx:Array<string>;
    alignType:Array<string>;
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
    attrList:Immutable.List<Kontext.AttrItem>;
    flimit:Kontext.FormValue<string>;
    freqSort:string;
    mlxattr:Immutable.List<string>;
    mlxicase:Immutable.List<boolean>;
    mlxctxIndices:Immutable.List<number>;
    alignType:Immutable.List<AlignTypes>;
    maxNumLevels:number;
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
                attrList: Immutable.List<Kontext.AttrItem>(props.attrList),
                flimit: {value: props.flimit, isInvalid: false, isRequired: true},
                freqSort: props.freq_sort,
                mlxattr: Immutable.List<string>(props.mlxattr),
                mlxicase: Immutable.List<boolean>(props.mlxicase),
                mlxctxIndices: Immutable.List<number>(props.mlxctx.map(item => this.importMlxctxValue(item))),
                alignType: Immutable.List<AlignTypes>(props.alignType),
                maxNumLevels: maxNumLevels,
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler(
            'FREQ_ML_SET_FLIMIT',
            (state, action) => {state.flimit.value = action.payload['value']}
        );

        this.addActionHandler(
            'FREQ_ML_ADD_LEVEL',
            (state, action) => {
                if (state.mlxattr.size < state.maxNumLevels) {
                    this.addLevel(state);

                } else {
                    throw new Error('Maximum number of levels reached');
                }
            }
        );
        
        this.addActionHandler(
            'FREQ_ML_REMOVE_LEVEL',
            (state, action) => this.removeLevel(state, action.payload['levelIdx'])
        );

        this.addActionHandler(
            'FREQ_ML_CHANGE_LEVEL',
            (state, action) => this.changeLevel(state, action.payload['levelIdx'], action.payload['direction'])
        );

        this.addActionHandler(
            'FREQ_ML_SET_MLXATTR',
            (state, action) => {state.mlxattr = state.mlxattr.set(action.payload['levelIdx'], action.payload['value'])}
        );

        this.addActionHandler(
            'FREQ_ML_SET_MLXICASE',
            (state, action) => {state.mlxicase = state.mlxicase.set(
                action.payload['levelIdx'],
                !state.mlxicase.get(action.payload['levelIdx'])
            )}
        );

        this.addActionHandler(
            'FREQ_ML_SET_MLXCTX_INDEX',
            (state, action) => {state.mlxctxIndices = state.mlxctxIndices.set(
                action.payload['levelIdx'],
                Number(action.payload['value'])
            )}
        );

        this.addActionHandler(
            'FREQ_ML_SET_ALIGN_TYPE',
            (state, action) => {state.alignType = state.alignType.set(
                action.payload['levelIdx'],
                action.payload['value']
            )}
        );

        this.addActionHandler(
            'FREQ_ML_SUBMIT',
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
            return new Error(this.pageModel.translate('coll__invalid_gz_number_value'));
        }
    }

    private importMlxctxValue(v:string):number {
        let srchIdx = MLFreqFormModel.POSITION_LA.indexOf(v);
        if (srchIdx > -1) {
            return srchIdx;
        }
        srchIdx = MLFreqFormModel.POSITION_RA.indexOf(v);
        if (srchIdx > -1) {
            return srchIdx;
        }
        return undefined;
    }

    private addLevel(state:MLFreqFormModelState):void {
        state.mlxattr = state.mlxattr.push(state.attrList.get(0).n);
        state.mlxicase = state.mlxicase.push(false);
        state.mlxctxIndices = state.mlxctxIndices.push(this.importMlxctxValue('0>0'));
        state.alignType = state.alignType.push(AlignTypes.LEFT);
    }

    private removeLevel(state:MLFreqFormModelState, levelIdx:number):void {
        state.mlxattr = state.mlxattr.remove(levelIdx);
        state.mlxicase = state.mlxicase.remove(levelIdx);
        state.mlxctxIndices = state.mlxctxIndices.remove(levelIdx);
        state.alignType = state.alignType.remove(levelIdx);
    }

    private changeLevel(state:MLFreqFormModelState, levelIdx:number, direction:string):void {
        const shift = direction === 'down' ? 1 : -1;
        const rmMlxattr = state.mlxattr.get(levelIdx);
        state.mlxattr = state.mlxattr.remove(levelIdx).insert(levelIdx + shift, rmMlxattr);
        const rmMlxicase = state.mlxicase.get(levelIdx);
        state.mlxicase = state.mlxicase.remove(levelIdx).insert(levelIdx + shift, rmMlxicase);
        const rmMlxctxIndex = state.mlxctxIndices.get(levelIdx);
        state.mlxctxIndices = state.mlxctxIndices.remove(levelIdx).insert(levelIdx + shift, rmMlxctxIndex);
        const rmAlignType = state.alignType.get(levelIdx);
        state.alignType = state.alignType.remove(levelIdx).insert(levelIdx + shift, rmAlignType);
    }

    private submit(state:MLFreqFormModelState):void {
        const args = this.pageModel.getConcArgs() as MultiDict<FreqServerArgs>;
        args.set('flimit', parseInt(state.flimit.value));
        state.mlxattr.forEach((item, i) => {
            args.set(`ml${i+1}attr`, item);
        });
        state.mlxicase.forEach((item, i) => {
            args.set(`ml${i+1}icase`, item ? 'i' : '');
        });
        state.mlxctxIndices.forEach((item, i) => {
            const val = state.alignType.get(i) === 'left' ?
                    MLFreqFormModel.POSITION_LA[item] : MLFreqFormModel.POSITION_RA[item];
            args.set(`ml${i+1}ctx`, val);
        });
        args.set('freqlevel', state.mlxattr.size);
        args.set('freq_sort', state.freqSort);
        window.location.href = this.pageModel.createActionUrl('freqml', args.items());
    }

    getPositionRangeLabels():Array<string> {
        return MLFreqFormModel.POSITION_LABELS;
    }

}

/**
 *
 */
export interface TTFreqFormModelState {
    structAttrList:Immutable.List<Kontext.AttrItem>;
    fttattr:Immutable.Set<string>;
    fttIncludeEmpty:boolean;
    flimit:Kontext.FormValue<string>;
    freqSort:string;
}

export class TTFreqFormModel extends StatelessModel<TTFreqFormModelState> {

    private pageModel:PageModel;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:FreqFormProps) {
        super(
            dispatcher,
            {
                structAttrList: Immutable.List<Kontext.AttrItem>(props.structAttrList),
                fttattr: Immutable.Set<string>(props.fttattr),
                fttIncludeEmpty: props.ftt_include_empty,
                flimit: {value: props.flimit, isInvalid: false, isRequired: true},
                freqSort: props.freq_sort,
            }
        );
        this.pageModel = pageModel;
        
        this.addActionHandler(
            'FREQ_TT_SET_FTTATTR',
            (state, action) => {
                if (state.fttattr.contains(action.payload['value'])) {
                    state.fttattr = state.fttattr.remove((action.payload['value']));

                } else {
                    state.fttattr = state.fttattr.add(action.payload['value']);
                }
            }
        );

        this.addActionHandler(
            'FREQ_TT_SET_FTT_INCLUDE_EMPTY',
            (state, action) => {state.fttIncludeEmpty = !state.fttIncludeEmpty}
        );
        
        this.addActionHandler(
            'FREQ_TT_SET_FLIMIT',
            (state, action) => {state.flimit.value = action.payload['value']}
        );

        this.addActionHandler(
            'FREQ_TT_SUBMIT',
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

    private validateForm(state:TTFreqFormModelState):Error|null {
        if (validateGzNumber(state.flimit.value)) {
            state.flimit.isInvalid = false;
            return null;

        } else {
            state.flimit.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_gz_number_value'));
        }
    }

    private submit(state:TTFreqFormModelState):void {
        const args = this.pageModel.getConcArgs() as MultiDict<FreqServerArgs>;
        args.replace('fttattr', state.fttattr.toArray());
        args.set('ftt_include_empty', state.fttIncludeEmpty ? '1' : '0');
        args.set('flimit', parseInt(state.flimit.value));
        args.set('freq_sort', state.freqSort);
        window.location.href = this.pageModel.createActionUrl('freqtt', args.items());
    }

}
