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
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { Actions, ActionName } from './actions';
import { Dict, List, pipe } from 'cnc-tskit';


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
    availAttrList:Array<Kontext.AttrItem>;
    availStructAttrList:Array<Kontext.AttrItem>;
    sattrValues:{[key:string]:string};
    skeyValues:{[key:string]:string};
    sposValues:{[key:string]:string};
    sicaseValues:{[key:string]:string}; // value 'i' means 'case insensitive'
    sbwardValues:{[key:string]:string}; // value 'r' means 'backward'
    /**
     * Specifies whether the single-level variant (i.e. this specific sorting model)
     * is the active one in case of known (= used or in use) sort forms. It must be
     * mutually-exclusive when compared with the same attribute and its keys
     * in MultiLevelConcSortModel.
     */
    isActiveActionValues:{[key:string]:boolean};
}

export class ConcSortModel extends StatefulModel<ConcSortModelState> implements ISubmitableConcSortModel {

    private readonly pageModel:PageModel;

    private readonly syncInitialArgs:AjaxResponse.SortFormArgs;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:SortFormProperties, syncInitialArgs:AjaxResponse.SortFormArgs) {
        super(
            dispatcher,
            {
                availAttrList: props.attrList,
                availStructAttrList: props.structAttrList,
                sattrValues: Dict.fromEntries(props.sattr),
                skeyValues: Dict.fromEntries(props.skey),
                sbwardValues: Dict.fromEntries(props.sbward),
                sicaseValues: Dict.fromEntries(props.sicase),
                sposValues: Dict.fromEntries(props.spos),
                isActiveActionValues: Dict.fromEntries(List.map(item => [item[0], item[1] === 'sortx'], props.defaultFormAction)),
            }
        );
        this.pageModel = pageModel;
        this.syncInitialArgs = syncInitialArgs;

        this.addActionHandler<MainMenuActions.ShowSort>(
            MainMenuActionName.ShowSort,
            action => {
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload}));
            }
        );

        this.addActionHandler<Actions.SortSetActiveStore>(
            ActionName.SortSetActiveStore,
            action => {this.changeState(state => {
                state.isActiveActionValues[action.payload.sortId] = action.payload.formAction === 'sortx';
            })}
        );

        this.addActionHandler<Actions.SortFormSubmit>(
            ActionName.SortFormSubmit,
            action => {
                this.submit(action.payload.sortId);
                // no need to notify anybody - we're leaving the page here
            }
        );

        this.addActionHandler<Actions.SortFormSetSattr>(
            ActionName.SortFormSetSattr,
            action => {this.changeState(state => {
                state.sattrValues[action.payload.sortId] = action.payload.value;
            })}
        );

        this.addActionHandler<Actions.SortFormSetSkey>(
            ActionName.SortFormSetSkey,
            action => {this.changeState(state => {
                state.skeyValues[action.payload.sortId] = action.payload.value;
            })}
        );

        this.addActionHandler<Actions.SortFormSetSbward>(
            ActionName.SortFormSetSbward,
            action => {this.changeState(state => {
                state.sbwardValues[action.payload.sortId] = action.payload.value;
            })}
        );

        this.addActionHandler<Actions.SortFormSetSicase>(
            ActionName.SortFormSetSicase,
            action => {this.changeState(state => {
                state.sicaseValues[action.payload.sortId] = action.payload.value;
            })}
        );

        this.addActionHandler<Actions.SortFormSetSpos>(
            ActionName.SortFormSetSpos,
            action => {
                if (/^([1-9]\d*)*$/.exec(action.payload.value)) {
                    this.changeState(state => {
                        state.sposValues[action.payload.sortId] = action.payload.value;
                    })

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('query__sort_set_spos_error_msg'));
                }
            }
        );
    }

    unregister() {}

    syncFrom(src:Observable<AjaxResponse.SortFormArgs>):Observable<AjaxResponse.SortFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'sort') {
                        const sortId = data.op_key;
                        this.changeState(state => {
                            state.isActiveActionValues[sortId] = data.form_action === 'sortx';
                            state.sattrValues[sortId] = data.sattr;
                            state.skeyValues[sortId] = data.skey;
                            state.sposValues[sortId] = data.spos;
                            state.sbwardValues[sortId] = data.sbward;
                            state.sicaseValues[sortId] = data.sicase;
                        });
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
        args.replace('sattr', val2List(this.state.sattrValues[sortId]));
        args.replace('skey', val2List(this.state.skeyValues[sortId]));
        args.replace('sbward', val2List(this.state.sbwardValues[sortId]));
        args.replace('sicase', val2List(this.state.sicaseValues[sortId]));
        args.replace('spos', val2List(this.state.sposValues[sortId]));
        return args;
    }

    isActiveActionValue(sortId:string):boolean {
        return this.state.isActiveActionValues[sortId];
    }
}


/**
 *
 */
export interface MultiLevelConcSortModelState {
    availAttrList:Array<Kontext.AttrItem>;
    availStructAttrList:Array<Kontext.AttrItem>;
    sortlevelValues:{[key:string]:number};
    mlxattrValues:{[key:string]:Array<string>};
    mlxicaseValues:{[key:string]:Array<string>};
    mlxbwardValues:{[key:string]:Array<string>};
    // there are no server-side 'ml[x]ctxindex' arguments,
    // we use indices to LEFTMOST_CTX and RIGHTMOST_CTX values instead
    ctxIndexValues:{[key:string]:Array<number>};
    // there are no server-side 'ml[x]ctxalign' arguments,
    // we used this to determine whether to use LEFTMOST_CTX or RIGHTMOST_CTX
    // based on user's actions
    ctxAlignValues:{[key:string]:Array<string>};
    /**
     * Specifies whether the single-level variant (i.e. this specific sorting model)
     * is the active one in case of known (= used or in use) sort forms. It must be
     * mutually-exclusive  when compared with the same attribute and its keys in ConcSortModel.
     */
    isActiveActionValues:{[key:string]:boolean};
}

export class MultiLevelConcSortModel extends StatefulModel<MultiLevelConcSortModelState> implements ISubmitableConcSortModel {

    private static LEFTMOST_CTX = ['-3<0', '-2<0', '-1<0', '0~0<0', '1<0', '2<0', '3<0'];
    private static RIGHTMOST_CTX = ['-3>0', '-2>0', '-1>0', '0~0>0', '1>0', '2>0', '3>0'];

    private readonly pageModel:PageModel;

    private readonly syncInitialArgs:AjaxResponse.SortFormArgs;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:SortFormProperties, syncInitialArgs:AjaxResponse.SortFormArgs) {
        super(
            dispatcher,
            {
                availAttrList: props.attrList,
                availStructAttrList: props.structAttrList,
                sortlevelValues: Dict.fromEntries(props.sortlevel),
                mlxattrValues: Dict.fromEntries(props.mlxattr),
                mlxicaseValues: Dict.fromEntries(props.mlxicase),
                mlxbwardValues: Dict.fromEntries(props.mlxbward),
                ctxIndexValues: pipe(
                    props.mlxctx,
                    Dict.fromEntries(),
                    Dict.map((v, k) => List.map(this.decodeCtxValue, v))
                ),
                ctxAlignValues: pipe(
                    props.mlxctx,
                    Dict.fromEntries(),
                    Dict.map((v, k) => List.map(this.decodeCtxAlignValue, v))
                ),
                isActiveActionValues: pipe(
                    props.defaultFormAction,
                    Dict.fromEntries(),
                    Dict.map((v, k) => v === 'mlsortx')
                )
            }
        );
        this.pageModel = pageModel;
        this.syncInitialArgs = syncInitialArgs;

        this.onAction((action:Action) => {
            switch (action.name) {
                case MainMenuActionName.ShowSort:
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
                case ActionName.SortSetActiveStore:
                    this.changeState(state => {
                        state.isActiveActionValues[action.payload['sortId']] = action.payload['formAction'] === 'mlsortx';
                    });
                break;
                case 'ML_SORT_FORM_SET_SATTR':
                    this.changeState(state => {
                        state.mlxattrValues[action.payload['sortId']][action.payload['levelIdx']] = action.payload['value'];
                    });
                break;
                case 'ML_SORT_FORM_SET_SICASE':
                    this.changeState(state => {
                        state.mlxicaseValues[action.payload['sortId']][action.payload['levelIdx']] = action.payload['value'];
                    });
                break;
                case 'ML_SORT_FORM_SET_SBWARD':
                    this.changeState(state => {
                        state.mlxbwardValues[action.payload['sortId']][action.payload['levelIdx']] = action.payload['value'];
                    });
                break;
                case 'ML_SORT_FORM_SET_CTX':
                    this.changeState(state => {
                        state.ctxIndexValues[action.payload['sortId']][action.payload['levelIdx']] = action.payload['index'];
                    });
                break;
                case 'ML_SORT_FORM_SET_CTX_ALIGN':
                    this.changeState(state => {
                        state.ctxAlignValues[action.payload['sortId']][action.payload['levelIdx']] = action.payload['value'];
                    });
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
                        this.changeState(state => {
                            state.isActiveActionValues[sortId] = data.form_action === 'mlsortx';
                            state.sortlevelValues[sortId] = data.sortlevel;
                            state.mlxattrValues[sortId] = importMultiLevelArg('mlxattr', data, n => state.availAttrList[0].n);
                            state.mlxicaseValues[sortId] = importMultiLevelArg('mlxicase', data);
                            state.mlxbwardValues[sortId] = importMultiLevelArg('mlxbward', data);

                            const mlxctxTmp = importMultiLevelArg<string>('mlxctx', data);
                            state.ctxIndexValues[sortId] = List.map(item => this.decodeCtxValue(item), mlxctxTmp);
                            state.ctxAlignValues[sortId] = List.map(item => this.decodeCtxAlignValue(item), mlxctxTmp);
                        });
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
        for (let i = 0; i < this.state.sortlevelValues[sortId]; i += 1) {
            args.replace('sortlevel', [String(this.state.sortlevelValues[sortId])]);
            args.replace(`ml${i+1}attr`, [this.state.mlxattrValues[sortId][i]]);
            args.replace(`ml${i+1}icase`, [this.state.mlxicaseValues[sortId][i]]);
            args.replace(`ml${i+1}bward`, [this.state.mlxbwardValues[sortId][i]]);
            args.replace(`ml${i+1}ctx`, [this.encodeCtxValue(this.state.ctxIndexValues[sortId][i],
                                         this.state.ctxAlignValues[sortId][i])]);
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
        const currLevel = this.state.sortlevelValues[sortId];
        // we expect here that the individual attributes below contain
        // the maximum allowed number of levels. I.e. there should be
        // no need to add/remove levels - we just increase 'sortlevel'.
        this.state.sortlevelValues[sortId] = currLevel + 1;
    }

    private removeLevel(sortId:string, level:number):void {
        if (this.state.sortlevelValues[sortId] - 1 === 0) {
            throw new Error('At least one level must be defined');
        }
        this.changeState(state => {
            state.mlxattrValues[sortId] = List.removeAt(level, state.mlxattrValues[sortId]);
            state.mlxattrValues[sortId].push(state.availAttrList[0].n);
            state.mlxicaseValues[sortId] = List.removeAt(level, state.mlxicaseValues[sortId]);
            state.mlxicaseValues[sortId].push('');
            state.mlxbwardValues[sortId] = List.removeAt(level, state.mlxbwardValues[sortId]);
            state.mlxbwardValues[sortId].push('');
            state.ctxIndexValues[sortId] = List.removeAt(level, state.ctxIndexValues[sortId]);
            state.ctxIndexValues[sortId].push(0);
            state.ctxAlignValues[sortId] = List.removeAt(level, state.ctxAlignValues[sortId]);
            state.ctxAlignValues[sortId].push('left');
            state.sortlevelValues[sortId] = state.sortlevelValues[sortId] - 1;
        });
    }

    isActiveActionValue(sortId:string):boolean {
        return this.state.isActiveActionValues[sortId];
    }
}