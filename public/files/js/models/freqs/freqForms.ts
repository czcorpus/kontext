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
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, Action} from '../../app/dispatcher';
import * as Immutable from 'immutable';
import {AlignTypes} from './ctFreqForm';


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
export class MLFreqFormModel extends StatefulModel {

    private pageModel:PageModel;

    private attrList:Immutable.List<Kontext.AttrItem>;

    private flimit:Kontext.FormValue<string>;

    private freqSort:string;

    private mlxattr:Immutable.List<string>;

    private mlxicase:Immutable.List<boolean>;

    private mlxctxIndices:Immutable.List<number>;

    private alignType:Immutable.List<AlignTypes>;

    private maxNumLevels:number;

    private static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    private static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    private static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'Node', '1R', '2R', '3R', '4R', '5R', '6R'];

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, props:FreqFormProps, maxNumLevels:number) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.attrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.flimit = {value: props.flimit, isInvalid: false, isRequired: true};
        this.freqSort = props.freq_sort;
        this.mlxattr = Immutable.List<string>(props.mlxattr);
        this.mlxicase = Immutable.List<boolean>(props.mlxicase);
        this.mlxctxIndices = Immutable.List<number>(props.mlxctx.map(item => this.importMlxctxValue(item)));
        this.alignType = Immutable.List<AlignTypes>(props.alignType);
        this.maxNumLevels = maxNumLevels;

        dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'FREQ_ML_SET_FLIMIT':
                    this.flimit.value = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_ADD_LEVEL':
                    if (this.mlxattr.size < this.maxNumLevels) {
                        this.addLevel();

                    } else {
                        throw new Error('Maximum number of levels reached');
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_REMOVE_LEVEL':
                    this.removeLevel(action.props['levelIdx']);
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_CHANGE_LEVEL':
                    this.changeLevel(action.props['levelIdx'], action.props['direction']);
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_MLXATTR':
                    this.mlxattr = this.mlxattr.set(action.props['levelIdx'], action.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_MLXICASE':
                    this.mlxicase = this.mlxicase.set(
                        action.props['levelIdx'],
                        !this.mlxicase.get(action.props['levelIdx'])
                    );
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_MLXCTX_INDEX':
                    this.mlxctxIndices = this.mlxctxIndices.set(
                        action.props['levelIdx'],
                        Number(action.props['value'])
                    );
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_ALIGN_TYPE':
                    this.alignType = this.alignType.set(
                        action.props['levelIdx'],
                        action.props['value']
                    );
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SUBMIT':
                    const err = this.validateForm();
                    if (!err) {
                        this.notifyChangeListeners();
                        this.submit();

                    } else {
                        this.pageModel.showMessage('error', err);
                        this.notifyChangeListeners();
                    }
                break;
            }
        });
    }

    private validateForm():Error|null {
        if (validateGzNumber(this.flimit.value)) {
            this.flimit.isInvalid = false;
            return null;

        } else {
            this.flimit.isInvalid = true;
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

    private addLevel():void {
        this.mlxattr = this.mlxattr.push(this.attrList.get(0).n);
        this.mlxicase = this.mlxicase.push(false);
        this.mlxctxIndices = this.mlxctxIndices.push(this.importMlxctxValue('0>0'));
        this.alignType = this.alignType.push(AlignTypes.LEFT);
    }

    private removeLevel(levelIdx:number):void {
        this.mlxattr = this.mlxattr.remove(levelIdx);
        this.mlxicase = this.mlxicase.remove(levelIdx);
        this.mlxctxIndices = this.mlxctxIndices.remove(levelIdx);
        this.alignType = this.alignType.remove(levelIdx);
    }

    private changeLevel(levelIdx:number, direction:string):void {
        const shift = direction === 'down' ? 1 : -1;
        const rmMlxattr = this.mlxattr.get(levelIdx);
        this.mlxattr = this.mlxattr.remove(levelIdx).insert(levelIdx + shift, rmMlxattr);
        const rmMlxicase = this.mlxicase.get(levelIdx);
        this.mlxicase = this.mlxicase.remove(levelIdx).insert(levelIdx + shift, rmMlxicase);
        const rmMlxctxIndex = this.mlxctxIndices.get(levelIdx);
        this.mlxctxIndices = this.mlxctxIndices.remove(levelIdx).insert(levelIdx + shift, rmMlxctxIndex);
        const rmAlignType = this.alignType.get(levelIdx);
        this.alignType = this.alignType.remove(levelIdx).insert(levelIdx + shift, rmAlignType);
    }

    private submit():void {
        const args = this.pageModel.getConcArgs();
        args.set('flimit', this.flimit.value);
        this.mlxattr.forEach((item, i) => {
            args.set(`ml${i+1}attr`, item);
        });
        this.mlxicase.forEach((item, i) => {
            args.set(`ml${i+1}icase`, item ? 'i' : '');
        });
        this.mlxctxIndices.forEach((item, i) => {
            const val = this.alignType.get(i) === 'left' ?
                    MLFreqFormModel.POSITION_LA[item] : MLFreqFormModel.POSITION_RA[item];
            args.set(`ml${i+1}ctx`, val);
        });
        args.set('freqlevel', this.mlxattr.size);
        args.set('freq_sort', this.freqSort);
        window.location.href = this.pageModel.createActionUrl('freqml', args.items());
    }

    getPositionRangeLabels():Array<string> {
        return MLFreqFormModel.POSITION_LABELS;
    }

    getFlimit():Kontext.FormValue<string> {
        return this.flimit;
    }

    getLevels():Immutable.List<number> {
        return this.mlxattr.map((_, i) => i).toList();
    }

    getAttrList():Immutable.List<Kontext.AttrItem> {
        return this.attrList;
    }

    getMlxattrValues():Immutable.List<string> {
        return this.mlxattr;
    }

    getMlxicaseValues():Immutable.List<boolean> {
        return this.mlxicase;
    }

    getMlxctxIndices():Immutable.List<number> {
        return this.mlxctxIndices;
    }

    getAlignTypes():Immutable.List<AlignTypes> {
        return this.alignType;
    }

    getMaxNumLevels():number {
        return this.maxNumLevels;
    }
}

/**
 *
 */
export class TTFreqFormModel extends StatefulModel {

    private pageModel:PageModel;

    private structAttrList:Immutable.List<Kontext.AttrItem>;

    private fttattr:Immutable.Set<string>;

    private fttIncludeEmpty:boolean;

    private flimit:Kontext.FormValue<string>;

    private freqSort:string;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, props:FreqFormProps) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.structAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.fttattr = Immutable.Set<string>(props.fttattr);
        this.fttIncludeEmpty = props.ftt_include_empty;
        this.flimit = {value: props.flimit, isInvalid: false, isRequired: true};
        this.freqSort = props.freq_sort;

        dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'FREQ_TT_SET_FTTATTR':
                    if (this.fttattr.contains(action.props['value'])) {
                        this.fttattr = this.fttattr.remove((action.props['value']));

                    } else {
                        this.fttattr = this.fttattr.add(action.props['value']);
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_TT_SET_FTT_INCLUDE_EMPTY':
                    this.fttIncludeEmpty = !this.fttIncludeEmpty;
                    this.notifyChangeListeners();
                break;
                case 'FREQ_TT_SET_FLIMIT':
                    this.flimit.value = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_TT_SUBMIT':
                    const err = this.validateForm();
                    if (!err) {
                        this.submit();
                        // we leave page here

                    } else {
                        this.pageModel.showMessage('error', err);
                    }
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private validateForm():Error|null {
        if (validateGzNumber(this.flimit.value)) {
            this.flimit.isInvalid = false;
            return null;

        } else {
            this.flimit.isInvalid = true;
            return new Error(this.pageModel.translate('coll__invalid_gz_number_value'));
        }
    }

    private submit():void {
        const args = this.pageModel.getConcArgs();
        args.replace('fttattr', this.fttattr.toArray());
        args.set('ftt_include_empty', this.fttIncludeEmpty ? '1' : '0');
        args.set('flimit', this.flimit.value);
        args.set('freq_sort', this.freqSort);
        window.location.href = this.pageModel.createActionUrl('freqtt', args.items());
    }

    getStructAttrList():Immutable.List<Kontext.AttrItem> {
        return this.structAttrList;
    }

    getStructAttrListSplitTypes():Immutable.List<Immutable.List<Kontext.AttrItem>> {
        const structOf = (a:Kontext.AttrItem) => a.n.split('.')[0];
        return this.structAttrList.reduce<Immutable.List<Immutable.List<Kontext.AttrItem>>>((reduc, curr) => {
            if (reduc.size === 0 || structOf(curr) !== structOf(reduc.last().last())) {
                if (reduc.last()) {
                    const tmp = reduc.last();
                    return reduc
                        .pop()
                        .push(tmp.sort((v1, v2) => v1.n.localeCompare(v2.n)).toList())
                        .push(Immutable.List<Kontext.AttrItem>([{n: curr.n, label: curr.label}]));

                } else {
                    return reduc.push(Immutable.List<Kontext.AttrItem>([{n: curr.n, label: curr.label}]));
                }

            } else {
                const tmp = reduc.last();
                return reduc.pop().push(tmp.push({n: curr.n, label: curr.label}));
            }
        }, Immutable.List<Immutable.List<Kontext.AttrItem>>());
    }

    getFttattr():Immutable.Set<string> {
        return this.fttattr;
    }

    getFttIncludeEmpty():boolean {
        return this.fttIncludeEmpty;
    }

    getFlimit():Kontext.FormValue<string> {
        return this.flimit;
    }
}
