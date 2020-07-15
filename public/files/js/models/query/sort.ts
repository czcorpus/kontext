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

import { Action, IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import * as Immutable from 'immutable';

import { Kontext } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { ConcSortServerArgs } from './common';
import { StatefulModel as KontextStatefulModel } from '../base';


export interface SortFormProperties {
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    sbward:Array<[string, string]>;
    skey:Array<[string, string]>;
    spos:Array<[string, string]>;
    sicase:Array<[string, string]>;
    sattr:Array<[string, string]>;
    // multi-level form specific stuff
    sortlevel:Array<[string, number]>; // specifies an actual number of levels to be used from the lists below
    defaultFormAction:Array<[string, string]>; // specifies whether 'sortx' or 'mlsortx' is the default sub-form
    mlxattr:Array<[string, Array<string>]>;
    mlxicase:Array<[string, Array<string>]>;
    mlxbward:Array<[string, Array<string>]>;
    mlxpos:Array<[string, Array<number>]>;
    mlxctx:Array<[string, Array<string>]>;
}


export function importMultiLevelArg<T>(name:string, data:AjaxResponse.SortFormArgs, dflt?:(n:string)=>T):Array<T> {
    const ans:Array<T> = [];
    const srch = /mlx(.+)/.exec(name);
    const dfltFn = dflt ? dflt : (n:string) => '';
    if (!srch) {
        throw new Error('failed to parse name - not a multi-level sort identifier: ' + name);
    }
    const mkid = (i) => `ml${i}${srch[1]}`;
    let key;
    for (let i = 1; i <= 9; i += 1) {
        key = mkid(i);
        if (data.hasOwnProperty(key)) {
            ans.push(data[key] || dfltFn(key));

        } else {
            break;
        }
    }
    return ans;
}


export function fetchSortFormArgs<T>(args:{[ident:string]:AjaxResponse.ConcFormArgs},
        key:(item:AjaxResponse.SortFormArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'sort') {
            ans.push([formId, key(<AjaxResponse.SortFormArgs>args[formId])]);
        }
    }
    return ans;
}

/**
 *
 */
export interface ISubmitableConcSortModel {
    getSubmitUrl(sortId:string):string;
    submit(sortId:string):void;
}

const sortAttrVals = (x1:Kontext.AttrItem, x2:Kontext.AttrItem) => {
    if (x1.label < x2.label) {
        return -1;
    }
    if (x1.label > x2.label) {
        return 1;
    }
    return 0;
};

/**
 *
 */
export interface ConcSortModelState {
    availAttrList:Immutable.List<Kontext.AttrItem>;
    availStructAttrList:Immutable.List<Kontext.AttrItem>;
    sattrValues:Immutable.Map<string, string>;
    skeyValues:Immutable.Map<string, string>;
    sposValues:Immutable.Map<string, string>;
    sicaseValues:Immutable.Map<string, string>; // value 'i' means 'case insensitive'
    sbwardValues:Immutable.Map<string, string>; // value 'r' means 'backward'
    /**
     * Specifies whether the single-level variant (i.e. this specific sorting model)
     * is the active one in case of known (= used or in use) sort forms. It must be
     * mutually-exclusive when compared with the same attribute and its keys
     * in MultiLevelConcSortModel.
     */
    isActiveActionValues:Immutable.Map<string, boolean>;
}

export class ConcSortModel extends StatefulModel<ConcSortModelState> implements ISubmitableConcSortModel {

    private readonly pageModel:PageModel;

    private readonly syncInitialArgs:AjaxResponse.SortFormArgs;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:SortFormProperties, syncInitialArgs:AjaxResponse.SortFormArgs) {
        super(
            dispatcher,
            {
                availAttrList: Immutable.List<Kontext.AttrItem>(props.attrList),
                availStructAttrList: Immutable.List<Kontext.AttrItem>(props.structAttrList),
                sattrValues: Immutable.Map<string, string>(props.sattr),
                skeyValues: Immutable.Map<string, string>(props.skey),
                sbwardValues: Immutable.Map<string, string>(props.sbward),
                sicaseValues: Immutable.Map<string, string>(props.sicase),
                sposValues: Immutable.Map<string, string>(props.spos),
                isActiveActionValues: Immutable.Map<string, boolean>(props.defaultFormAction.map(item => [item[0], item[1] === 'sortx'])),
            }
        );
        this.pageModel = pageModel;
        this.syncInitialArgs = syncInitialArgs;

        this.onAction((action:Action) => {
            switch (action.name) {
                case 'MAIN_MENU_SHOW_SORT':
                    this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload}));
                    this.emitChange();
                break;
                case 'SORT_SET_ACTIVE_STORE':
                    this.state.isActiveActionValues = this.state.isActiveActionValues.set(
                        action.payload['sortId'], action.payload['formAction'] === 'sortx'
                    );
                    this.emitChange();
                break;
                case 'SORT_FORM_SUBMIT':
                    this.submit(action.payload['sortId']);
                    // no need to notify anybody - we're leaving the page here
                break;
                case 'SORT_FORM_SET_SATTR':
                    this.state.sattrValues = this.state.sattrValues.set(action.payload['sortId'],
                            action.payload['value']);
                    this.emitChange();
                break;
                case 'SORT_FORM_SET_SKEY':
                    this.state.skeyValues = this.state.skeyValues.set(action.payload['sortId'],
                            action.payload['value']);
                    this.emitChange();
                break;
                case 'SORT_FORM_SET_SBWARD':
                    this.state.sbwardValues = this.state.sbwardValues.set(action.payload['sortId'],
                            action.payload['value']);
                    this.emitChange();
                break;
                case 'SORT_FORM_SET_SICASE':
                    this.state.sicaseValues = this.state.sicaseValues.set(action.payload['sortId'],
                            action.payload['value']);
                    this.emitChange();
                break;
                case 'SORT_FORM_SET_SPOS':
                    if (/^([1-9]\d*)*$/.exec(action.payload['value'])) {
                        this.state.sposValues = this.state.sposValues.set(action.payload['sortId'],
                                action.payload['value']);

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('query__sort_set_spos_error_msg'));
                    }
                    this.emitChange();
                break;
            }
        });
    }

    unregister() {}

    syncFrom(src:Observable<AjaxResponse.SortFormArgs>):Observable<AjaxResponse.SortFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'sort') {
                        const sortId = data.op_key;
                        this.state.isActiveActionValues = this.state.isActiveActionValues.set(sortId, data.form_action === 'sortx');
                        this.state.sattrValues = this.state.sattrValues.set(sortId, data.sattr);
                        this.state.skeyValues = this.state.skeyValues.set(sortId, data.skey);
                        this.state.sposValues = this.state.sposValues.set(sortId, data.spos);
                        this.state.sbwardValues = this.state.sbwardValues.set(sortId, data.sbward);
                        this.state.sicaseValues = this.state.sicaseValues.set(sortId, data.sicase);
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === 'sort') {
                        return data;

                    } else if (data.form_type === 'locked') {
                        return null;

                    } else {
                        throw new Error('Cannot sync sort model - invalid form data type: ' + data.form_type);
                    }
                }
            )
        );
    }

    submit(sortId:string):void {
        const args = this.createSubmitArgs(sortId);
        const url = this.pageModel.createActionUrl('sortx', args.items());
        window.location.href = url;
    }

    getSubmitUrl(sortId:string):string {
        return this.pageModel.createActionUrl('sortx', this.createSubmitArgs(sortId).items());
    }

    private createSubmitArgs(sortId:string):MultiDict<ConcSortServerArgs> {
        const val2List = (v) => v ? [v] : [];

        const args = this.pageModel.getConcArgs() as MultiDict<ConcSortServerArgs>;
        args.replace('sattr', val2List(this.state.sattrValues.get(sortId)));
        args.replace('skey', val2List(this.state.skeyValues.get(sortId)));
        args.replace('sbward', val2List(this.state.sbwardValues.get(sortId)));
        args.replace('sicase', val2List(this.state.sicaseValues.get(sortId)));
        args.replace('spos', val2List(this.state.sposValues.get(sortId)));
        return args;
    }

    isActiveActionValue(sortId:string):boolean {
        return this.state.isActiveActionValues.get(sortId);
    }
}


/**
 *
 */
export class MultiLevelConcSortModel extends KontextStatefulModel implements ISubmitableConcSortModel {

    private static LEFTMOST_CTX = ['-3<0', '-2<0', '-1<0', '0~0<0', '1<0', '2<0', '3<0'];
    private static RIGHTMOST_CTX = ['-3>0', '-2>0', '-1>0', '0~0>0', '1>0', '2>0', '3>0'];

    private readonly pageModel:PageModel;

    private readonly syncInitialArgs:AjaxResponse.SortFormArgs;

    private availAttrList:Immutable.List<Kontext.AttrItem>;

    private availStructAttrList:Immutable.List<Kontext.AttrItem>;

    private sortlevelValues:Immutable.Map<string, number>;

    private mlxattrValues:Immutable.Map<string, Immutable.List<string>>;

    private mlxicaseValues:Immutable.Map<string, Immutable.List<string>>;

    private mlxbwardValues:Immutable.Map<string, Immutable.List<string>>;

    // there are no server-side 'ml[x]ctxindex' arguments,
    // we use indices to LEFTMOST_CTX and RIGHTMOST_CTX values instead
    ctxIndexValues:Immutable.Map<string, Immutable.List<number>>;

    // there are no server-side 'ml[x]ctxalign' arguments,
    // we used this to determine whether to use LEFTMOST_CTX or RIGHTMOST_CTX
    // based on user's actions
    private ctxAlignValues:Immutable.Map<string, Immutable.List<string>>;

    /**
     * Specifies whether the single-level variant (i.e. this specific sorting model)
     * is the active one in case of known (= used or in use) sort forms. It must be
     * mutually-exclusive  when compared with the same attribute and its keys in ConcSortModel.
     */
    private isActiveActionValues:Immutable.Map<string, boolean>;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:SortFormProperties, syncInitialArgs:AjaxResponse.SortFormArgs) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.syncInitialArgs = syncInitialArgs;
        this.availAttrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.availStructAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.sortlevelValues = Immutable.Map<string, number>(props.sortlevel);
        this.mlxattrValues = Immutable.Map<string, Immutable.List<string>>(
            props.mlxattr.map(item => [item[0], Immutable.List<string>(item[1])]));
        this.mlxicaseValues = Immutable.Map<string, Immutable.List<string>>(
            props.mlxicase.map(item => [item[0], Immutable.List<string>(item[1])]));
        this.mlxbwardValues = Immutable.Map<string, Immutable.List<string>>(
            props.mlxbward.map(item => [item[0], Immutable.List<string>(item[1])]));


        this.ctxIndexValues = Immutable.Map<string, Immutable.List<number>>(
            props.mlxctx.map(item => [item[0], Immutable.List<number>(item[1].map(subitem => this.decodeCtxValue(subitem)))])
        );
        this.ctxAlignValues = Immutable.Map<string, Immutable.List<string>>(
            props.mlxctx.map(item => [item[0], Immutable.List<string>(item[1].map(subitem => this.decodeCtxAlignValue(subitem)))])
        );

        this.isActiveActionValues = Immutable.Map<string, boolean>(props.defaultFormAction.map(item => [item[0], item[1] === 'mlsortx']));

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'MAIN_MENU_SHOW_SORT':
                    this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload}));
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_SUBMIT':
                    this.submit(action.payload['sortId']);
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_ADD_LEVEL':
                    this.addLevel(action.payload['sortId']);
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_REMOVE_LEVEL':
                    this.removeLevel(action.payload['sortId'], action.payload['levelIdx']);
                    this.emitChange();
                break;
                case 'SORT_SET_ACTIVE_STORE':
                    this.isActiveActionValues = this.isActiveActionValues.set(
                        action.payload['sortId'], action.payload['formAction'] === 'mlsortx'
                    );
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_SET_SATTR':
                    this.mlxattrValues = this.mlxattrValues.set(
                        action.payload['sortId'],
                        this.mlxattrValues.get(action.payload['sortId']).set(action.payload['levelIdx'], action.payload['value'])
                    );
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_SET_SICASE':
                    this.mlxicaseValues = this.mlxicaseValues.set(
                        action.payload['sortId'],
                        this.mlxicaseValues.get(action.payload['sortId']).set(action.payload['levelIdx'], action.payload['value'])
                    );
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_SET_SBWARD':
                    this.mlxbwardValues = this.mlxbwardValues.set(
                        action.payload['sortId'],
                        this.mlxbwardValues.get(action.payload['sortId']).set(action.payload['levelIdx'], action.payload['value'])
                    )
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_SET_CTX':
                    this.ctxIndexValues = this.ctxIndexValues.set(
                        action.payload['sortId'],
                        this.ctxIndexValues.get(action.payload['sortId']).set(action.payload['levelIdx'], action.payload['index'])
                    );
                    this.emitChange();
                break;
                case 'ML_SORT_FORM_SET_CTX_ALIGN':
                    this.ctxAlignValues = this.ctxAlignValues.set(
                        action.payload['sortId'],
                        this.ctxAlignValues.get(action.payload['sortId']).set(action.payload['levelIdx'], action.payload['value'])
                    );
                    this.emitChange();
                break;
            }
        });
    }

    syncFrom(src:Observable<AjaxResponse.SortFormArgs>):Observable<AjaxResponse.SortFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'sort') {
                        const sortId = data.op_key;
                        this.isActiveActionValues = this.isActiveActionValues.set(sortId, data.form_action === 'mlsortx');
                        this.sortlevelValues = this.sortlevelValues.set(sortId, data.sortlevel);
                        this.mlxattrValues = this.mlxattrValues.set(sortId, Immutable.List<string>(
                                importMultiLevelArg<string>('mlxattr', data, (n)=>this.availAttrList.get(0).n)));
                        this.mlxicaseValues = this.mlxicaseValues.set(sortId, Immutable.List<string>(
                                importMultiLevelArg<string>('mlxicase', data)));
                        this.mlxbwardValues = this.mlxbwardValues.set(sortId, Immutable.List<string>(
                                importMultiLevelArg<string>('mlxbward', data)));

                        const mlxctxTmp = importMultiLevelArg<string>('mlxctx', data);
                        this.ctxIndexValues = this.ctxIndexValues.set(sortId,
                                Immutable.List<number>(mlxctxTmp.map(item => this.decodeCtxValue(item))));
                        this.ctxAlignValues = this.ctxAlignValues.set(sortId,
                                Immutable.List<string>(mlxctxTmp.map(item => this.decodeCtxAlignValue(item))));
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === 'sort') {
                        return data;

                    } else if (data.form_type === 'locked') {
                        return null;

                    } else {
                        throw new Error('Cannot sync mlsort model - invalid form data type: ' + data.form_type);
                    }
                }
            )
        );
    }

    submit(sortId:string):void {
        const args = this.createSubmitArgs(sortId);
        const url = this.pageModel.createActionUrl('mlsortx', args.items());
        window.location.href = url;
    }

    private createSubmitArgs(sortId:string):MultiDict<ConcSortServerArgs> {
        const args = this.pageModel.getConcArgs() as MultiDict<ConcSortServerArgs>;
        for (let i = 0; i < this.sortlevelValues.get(sortId); i += 1) {
            args.replace('sortlevel', [String(this.sortlevelValues.get(sortId))]);
            args.replace(`ml${i+1}attr`, [this.mlxattrValues.get(sortId).get(i)]);
            args.replace(`ml${i+1}icase`, [this.mlxicaseValues.get(sortId).get(i)]);
            args.replace(`ml${i+1}bward`, [this.mlxbwardValues.get(sortId).get(i)]);
            args.replace(`ml${i+1}ctx`, [this.encodeCtxValue(this.ctxIndexValues.get(sortId).get(i),
                                         this.ctxAlignValues.get(sortId).get(i))]);
        }
        return args;
    }

    getSubmitUrl(sortId:string):string {
        return this.pageModel.createActionUrl('mlsortx', this.createSubmitArgs(sortId).items());
    }

    /**
     * Transform a ctx value (e.g. '-3<0') back to its
     * index in LEFTMOST_CTX or RIGHTMOST_CTX
     */
    private decodeCtxValue(v:string):number {
        let idx = MultiLevelConcSortModel.LEFTMOST_CTX.indexOf(v);
        if (idx > -1) {
            return idx
        }
        idx = MultiLevelConcSortModel.RIGHTMOST_CTX.indexOf(v);
        if (idx > -1) {
            return idx
        }
        throw new Error('Unable to decode ctx value ' + v);
    }

    private decodeCtxAlignValue(v:string):string {
        let idx = MultiLevelConcSortModel.LEFTMOST_CTX.indexOf(v);
        if (idx > -1) {
            return 'left';
        }
        idx = MultiLevelConcSortModel.RIGHTMOST_CTX.indexOf(v);
        if (idx > -1) {
            return 'right';
        }
        throw new Error('Unable to decode ctx value ' + v);
    }

    private encodeCtxValue(idx:number, align:string):string {
        if (align === 'left') {
            return MultiLevelConcSortModel.LEFTMOST_CTX[idx];

        } else if (align === 'right') {
            return MultiLevelConcSortModel.RIGHTMOST_CTX[idx];

        } else {
            throw new Error(`Failed to encode mlxctx value. Idx: ${idx}, align: ${align}`);
        }
    }

    private addLevel(sortId:string):void {
        const currLevel = this.sortlevelValues.get(sortId);
        // we expect here that the individual attributes below contain
        // the maximum allowed number of levels. I.e. there should be
        // no need to add/remove levels - we just increase 'sortlevel'.
        this.sortlevelValues = this.sortlevelValues.set(sortId, currLevel + 1);
    }

    private removeLevel(sortId:string, level:number):void {
        if (this.sortlevelValues.get(sortId) - 1 === 0) {
            throw new Error('At least one level must be defined');
        }
        this.mlxattrValues = this.mlxattrValues.set(
            sortId,
            this.mlxattrValues.get(sortId).remove(level).push(this.availAttrList.get(0).n)
        );
        this.mlxicaseValues = this.mlxicaseValues.set(
            sortId,
            this.mlxicaseValues.get(sortId).remove(level).push('')
        );
        this.mlxbwardValues = this.mlxbwardValues.set(
            sortId,
            this.mlxbwardValues.get(sortId).remove(level).push('')
        );
        this.ctxIndexValues = this.ctxIndexValues.set(
            sortId,
            this.ctxIndexValues.get(sortId).remove(level).push(0)
        );
        this.ctxAlignValues = this.ctxAlignValues.set(
            sortId,
            this.ctxAlignValues.get(sortId).remove(level).push('left')
        );
        const currLevel = this.sortlevelValues.get(sortId);
        this.sortlevelValues = this.sortlevelValues.set(sortId, currLevel - 1);
    }

    getMaxNumLevels(sortId:string):number {
        return Math.min(
            this.mlxattrValues.get(sortId).size,
            this.mlxicaseValues.get(sortId).size,
            this.mlxbwardValues.get(sortId).size,
            this.ctxIndexValues.get(sortId).size,
            this.ctxAlignValues.get(sortId).size
        );
    }

    /**
     * Return both positional and structural attributes
     * as a single list (positional first).
     */
    getAllAvailAttrs():Immutable.List<Kontext.AttrItem> {
        return this.availAttrList
                .concat(this.availStructAttrList.sort(sortAttrVals)).toList();
    }

    getMlxattrValues(sortId:string):Immutable.List<string> {
        return this.mlxattrValues.get(sortId);
    }

    getMlxicaseValues(sortId:string):Immutable.List<string> {
        return this.mlxicaseValues.get(sortId);
    }

    getMlxbwardValues(sortId:string):Immutable.List<string> {
        return this.mlxbwardValues.get(sortId);
    }

    getCtxIndexValues(sortId:string):Immutable.List<number> {
        return this.ctxIndexValues.get(sortId);
    }

    getCtxAlignValues(sortId:string):Immutable.List<string> {
        return this.ctxAlignValues.get(sortId);
    }

    getLevelIndices(sortId:string):Immutable.List<number> {
        const sortLevel = this.sortlevelValues.get(sortId);
        return this.mlxattrValues.get(sortId).slice(0, sortLevel).map((_, i) => i).toList();
    }

    isActiveActionValue(sortId:string):boolean {
        return this.isActiveActionValues.get(sortId);
    }
}