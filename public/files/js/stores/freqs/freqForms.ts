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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />

import {SimplePageStore} from '../base';
import {PageModel} from '../../tpl/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';


export type AttrValue = {n:string; label:string};


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
    structAttrList:Array<AttrValue>;
    attrList:Array<AttrValue>;
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
export class MLFreqFormStore extends SimplePageStore {

    private pageModel:PageModel;

    private attrList:Immutable.List<AttrValue>;

    private flimit:string;

    private freqSort:string;

    private mlxattr:Immutable.List<string>;

    private mlxicase:Immutable.List<boolean>;

    private mlxctxIndices:Immutable.List<number>;

    private alignType:Immutable.List<string>;

    private maxNumLevels:number;

    private static POSITION_LA = ['-6<0', '-5<0', '-4<0', '-3<0', '-2<0', '-1<0', '0<0', '1<0', '2<0', '3<0', '4<0', '5<0', '6<0'];

    private static POSITION_RA = ['-6>0', '-5>0', '-4>0', '-3>0', '-2>0', '-1>0', '0>0', '1>0', '2>0', '3>0', '4>0', '5>0', '6>0'];

    private static POSITION_LABELS = ['6L', '5L', '4L', '3L', '2L', '1L', 'Node', '1R', '2R', '3R', '4R', '5R', '6R'];

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:FreqFormProps, maxNumLevels:number) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.attrList = Immutable.List<AttrValue>(props.attrList);
        this.flimit = props.flimit;
        this.freqSort = props.freq_sort;
        this.mlxattr = Immutable.List<string>(props.mlxattr);
        this.mlxicase = Immutable.List<boolean>(props.mlxicase);
        this.mlxctxIndices = Immutable.List<number>(props.mlxctx.map(item => this.importMlxctxValue(item)));
        this.alignType = Immutable.List<string>(props.alignType);
        this.maxNumLevels = maxNumLevels;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_ML_SET_FLIMIT':
                    if (validateGzNumber(payload.props['value'])) {
                        this.flimit = payload.props['value'];

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('coll__invalid_gz_number_value'));
                    }
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
                    this.removeLevel(payload.props['levelIdx']);
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_CHANGE_LEVEL':
                    this.changeLevel(payload.props['levelIdx'], payload.props['direction']);
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_MLXATTR':
                    this.mlxattr = this.mlxattr.set(payload.props['levelIdx'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_MLXICASE':
                    this.mlxicase = this.mlxicase.set(
                        payload.props['levelIdx'],
                        !this.mlxicase.get(payload.props['levelIdx'])
                    );
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_MLXCTX_INDEX':
                    this.mlxctxIndices = this.mlxctxIndices.set(
                        payload.props['levelIdx'],
                        Number(payload.props['value'])
                    );
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SET_ALIGN_TYPE':
                    this.alignType = this.alignType.set(
                        payload.props['levelIdx'],
                        payload.props['value']
                    );
                    this.notifyChangeListeners();
                break;
                case 'FREQ_ML_SUBMIT':
                    this.submit();
                    // no need to notify anybody
                break;
            }
        });
    }

    private importMlxctxValue(v:string):number {
        let srchIdx = MLFreqFormStore.POSITION_LA.indexOf(v);
        if (srchIdx > -1) {
            return srchIdx;
        }
        srchIdx = MLFreqFormStore.POSITION_RA.indexOf(v);
        if (srchIdx > -1) {
            return srchIdx;
        }
        return undefined;
    }

    private detectAlignType(ctxVal:string):string {
        if (MLFreqFormStore.POSITION_LA.indexOf(ctxVal) > -1) {
            return 'left';

        } else if (MLFreqFormStore.POSITION_RA.indexOf(ctxVal) > 1) {
            return 'right';
        }
        return undefined;
    }

    private addLevel():void {
        this.mlxattr = this.mlxattr.push(this.attrList.get(0).n);
        this.mlxicase = this.mlxicase.push(false);
        this.mlxctxIndices = this.mlxctxIndices.push(this.importMlxctxValue('0>0'));
        this.alignType = this.alignType.push('left');
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
        args.set('flimit', this.flimit);
        this.mlxattr.forEach((item, i) => {
            args.set(`ml${i+1}attr`, item);
        });
        this.mlxicase.forEach((item, i) => {
            args.set(`ml${i+1}icase`, item ? 'i' : '');
        });
        this.mlxctxIndices.forEach((item, i) => {
            const val = this.alignType.get(i) === 'left' ?
                    MLFreqFormStore.POSITION_LA[item] : MLFreqFormStore.POSITION_RA[item];
            args.set(`ml${i+1}ctx`, val);
        });
        args.set('freqlevel', this.mlxattr.size);
        args.set('freq_sort', this.freqSort);
        window.location.href = this.pageModel.createActionUrl('freqml', args.items());
    }

    getPositionRangeLabels():Array<string> {
        return MLFreqFormStore.POSITION_LABELS;
    }

    getFlimit():string {
        return this.flimit;
    }

    getLevels():Immutable.List<number> {
        return this.mlxattr.map((_, i) => i).toList();
    }

    getAttrList():Immutable.List<AttrValue> {
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

    getAlignTypes():Immutable.List<string> {
        return this.alignType;
    }

    getMaxNumLevels():number {
        return this.maxNumLevels;
    }
}

/**
 *
 */
export class TTFreqFormStore extends SimplePageStore {

    private pageModel:PageModel;

    private structAttrList:Immutable.List<AttrValue>;

    private fttattr:Immutable.Set<string>;

    private fttIncludeEmpty:boolean;

    private flimit:string;

    private freqSort:string;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, props:FreqFormProps) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.structAttrList = Immutable.List<AttrValue>(props.structAttrList);
        this.fttattr = Immutable.Set<string>(props.fttattr);
        this.fttIncludeEmpty = props.ftt_include_empty;
        this.flimit = props.flimit;
        this.freqSort = props.freq_sort;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_TT_SET_FTTATTR':
                    if (this.fttattr.contains(payload.props['value'])) {
                        this.fttattr = this.fttattr.remove((payload.props['value']));

                    } else {
                        this.fttattr = this.fttattr.add(payload.props['value']);
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_TT_SET_FTT_INCLUDE_EMPTY':
                    this.fttIncludeEmpty = !this.fttIncludeEmpty;
                    this.notifyChangeListeners();
                break;
                case 'FREQ_TT_SET_FLIMIT':
                    if (validateGzNumber(payload.props['value'])) {
                        this.flimit = payload.props['value'];

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('coll__invalid_gz_number_value'));
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_TT_SUBMIT':
                    this.submit();
                    // no need to notify
                break;
            }
        });
    }

    private submit():void {
        const args = this.pageModel.getConcArgs();
        args.replace('fttattr', this.fttattr.toArray());
        args.set('ftt_include_empty', this.fttIncludeEmpty ? '1' : '0');
        args.set('flimit', this.flimit);
        args.set('freq_sort', this.freqSort);
        window.location.href = this.pageModel.createActionUrl('freqtt', args.items());
    }

    getStructAttrList():Immutable.List<AttrValue> {
        return this.structAttrList;
    }

    getFttattr():Immutable.Set<string> {
        return this.fttattr;
    }

    getFttIncludeEmpty():boolean {
        return this.fttIncludeEmpty;
    }

    getFlimit():string {
        return this.flimit;
    }
}
