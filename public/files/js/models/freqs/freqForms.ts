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
import {AlignTypes} from './ctFreqForm';
import { IFullActionControl, StatelessModel } from 'kombo';
import { FreqServerArgs } from './common';
import { MultiDict } from '../../multidict';
import { ActionName, Actions } from './actions';
import { List } from 'cnc-tskit';


export interface FreqFormInputs {
    fttattr:Array<string>;
    ftt_include_empty:boolean;
    flimit:string;
    freq_sort:string;

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

        this.addActionHandler<Actions.MLSetFLimit>(
            ActionName.MLSetFLimit,
            (state, action) => {state.flimit.value = action.payload.value}
        );

        this.addActionHandler<Actions.MLAddLevel>(
            ActionName.MLAddLevel,
            (state, action) => {
                if (state.mlxattr.length < state.maxNumLevels) {
                    this.addLevel(state);

                } else {
                    throw new Error('Maximum number of levels reached');
                }
            }
        );
        
        this.addActionHandler<Actions.MLRemoveLevel>(
            ActionName.MLRemoveLevel,
            (state, action) => this.removeLevel(state, action.payload.levelIdx)
        );

        this.addActionHandler<Actions.MLChangeLevel>(
            ActionName.MLChangeLevel,
            (state, action) => this.changeLevel(state, action.payload.levelIdx, action.payload.direction)
        );

        this.addActionHandler<Actions.MLSetMlxAttr>(
            ActionName.MLSetMlxAttr,
            (state, action) => {state.mlxattr[action.payload.levelIdx] = action.payload.value}
        );

        this.addActionHandler<Actions.MLSetMlxiCase>(
            ActionName.MLSetMlxiCase,
            (state, action) => {state.mlxicase[action.payload.levelIdx] = !state.mlxicase[action.payload.levelIdx]}
        );

        this.addActionHandler<Actions.MLSetMlxctxIndex>(
            ActionName.MLSetMlxctxIndex,
            (state, action) => {state.mlxctxIndices[action.payload.levelIdx] = Number(action.payload.value)}
        );

        this.addActionHandler<Actions.MLSetAlignType>(
            ActionName.MLSetAlignType,
            (state, action) => {state.alignType[action.payload.levelIdx] = action.payload.value}
        );

        this.addActionHandler<Actions.MLSubmit>(
            ActionName.MLSubmit,
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
        [state.mlxattr[levelIdx], state.mlxattr[levelIdx + shift]] = [state.mlxattr[levelIdx + shift], state.mlxattr[levelIdx]];
        [state.mlxicase[levelIdx], state.mlxicase[levelIdx + shift]] = [state.mlxicase[levelIdx + shift], state.mlxicase[levelIdx]];
        [state.mlxctxIndices[levelIdx], state.mlxctxIndices[levelIdx + shift]] = [state.mlxctxIndices[levelIdx + shift], state.mlxctxIndices[levelIdx]];
        [state.alignType[levelIdx], state.alignType[levelIdx + shift]] = [state.alignType[levelIdx + shift], state.alignType[levelIdx]]
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
            const val = state.alignType[i] === 'left' ?
                    MLFreqFormModel.POSITION_LA[item] : MLFreqFormModel.POSITION_RA[item];
            args.set(`ml${i+1}ctx`, val);
        });
        args.set('freqlevel', state.mlxattr.length);
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
    structAttrList:Array<Kontext.AttrItem>;
    fttattr:Array<string>;
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
                structAttrList: props.structAttrList,
                fttattr: props.fttattr,
                fttIncludeEmpty: props.ftt_include_empty,
                flimit: {value: props.flimit, isInvalid: false, isRequired: true},
                freqSort: props.freq_sort,
            }
        );
        this.pageModel = pageModel;
        
        this.addActionHandler<Actions.TTSetFttAttr>(
            ActionName.TTSetFttAttr,
            (state, action) => {
                if (state.fttattr.includes(action.payload.value)) {
                    state.fttattr = List.removeValue(action.payload.value, state.fttattr);

                } else {
                    state.fttattr = List.addUnique(action.payload.value, state.fttattr);
                }
            }
        );

        this.addActionHandler<Actions.TTSetIncludeEmpty>(
            ActionName.TTSetIncludeEmpty,
            (state, action) => {state.fttIncludeEmpty = !state.fttIncludeEmpty}
        );
        
        this.addActionHandler<Actions.TTSetFLimit>(
            ActionName.TTSetFLimit,
            (state, action) => {state.flimit.value = action.payload.value}
        );

        this.addActionHandler<Actions.TTSubmit>(
            ActionName.TTSubmit,
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
        args.replace('fttattr', state.fttattr);
        args.set('ftt_include_empty', state.fttIncludeEmpty ? '1' : '0');
        args.set('flimit', parseInt(state.flimit.value));
        args.set('freq_sort', state.freqSort);
        window.location.href = this.pageModel.createActionUrl('freqtt', args.items());
    }

}
