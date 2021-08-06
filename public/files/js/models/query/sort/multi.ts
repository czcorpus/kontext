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

 import { StatefulModel, IFullActionControl } from 'kombo';
 import { Dict, pipe, List, HTTP } from 'cnc-tskit';
 import { of as rxOf, Observable } from 'rxjs';

import { Kontext } from '../../../types/common';
import { SortFormProperties, importMultiLevelArg } from './common';
import { PageModel } from '../../../app/page';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../../mainMenu/actions';
import { Actions, ActionName } from '../actions';
import { tap, map } from 'rxjs/operators';
import { MLSortServerArgs } from '../common';
import { AjaxConcResponse } from '../../concordance/common';
import { Actions as ConcActions } from '../../concordance/actions';


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
    isBusy:boolean;
}

export class MultiLevelConcSortModel extends StatefulModel<MultiLevelConcSortModelState> {

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
                    Dict.map((v, k) => List.map(MultiLevelConcSortModel.decodeCtxValue, v))
                ),
                ctxAlignValues: pipe(
                    props.mlxctx,
                    Dict.fromEntries(),
                    Dict.map((v, k) => List.map(MultiLevelConcSortModel.decodeCtxAlignValue, v))
                ),
                isActiveActionValues: pipe(
                    props.defaultFormAction,
                    Dict.fromEntries(),
                    Dict.map((v, k) => v === 'mlsortx')
                ),
                isBusy: false
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

        this.addActionHandler<Actions.MLSortFormSubmit>(
            ActionName.MLSortFormSubmit,
            action => {
                this.submitQuery(
                    action.payload.sortId,
                    this.pageModel.getConf('concPersistenceOpId')

                ).pipe(
                    tap(
                        (data) => {
                            this.pageModel.updateConcPersistenceId(data.conc_persistence_op_id);
                            this.changeState(state => {
                                state.isBusy = false;
                            });
                        }
                    )
                ).subscribe(
                    (data) => {
                        dispatcher.dispatch<typeof ConcActions.AddedNewOperation>({
                            name: ConcActions.AddedNewOperation.name,
                            payload: {
                                concId: data.conc_persistence_op_id,
                                data
                            }
                        });

                    },
                    (err) => {
                        this.pageModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.MLSortFormAddLevel>(
            ActionName.MLSortFormAddLevel,
            action => {
                this.changeState(state => {
                    this.addLevel(state, action.payload.sortId);
                });
            }
        );

        this.addActionHandler<Actions.MLSortFormRemoveLevel>(
            ActionName.MLSortFormRemoveLevel,
            action => {
                this.changeState(state => {
                    this.removeLevel(state, action.payload.sortId, action.payload.levelIdx);
                });
            }
        );

        this.addActionHandler<Actions.SortSetActiveModel>(
            ActionName.SortSetActiveModel,
            action => {this.changeState(state => {
                state.isActiveActionValues[action.payload.sortId] = action.payload.formAction === 'mlsortx';
            })}
        );

        this.addActionHandler<Actions.MLSortFormSetSattr>(
            ActionName.MLSortFormSetSattr,
            action => {this.changeState(state => {
                state.mlxattrValues[action.payload.sortId][action.payload.levelIdx] = action.payload.value;
            })}
        );

        this.addActionHandler<Actions.MLSortFormSetSicase>(
            ActionName.MLSortFormSetSicase,
            action => {this.changeState(state => {
                state.mlxicaseValues[action.payload.sortId][action.payload.levelIdx] = action.payload.value;
            })}
        );

        this.addActionHandler<Actions.MLSortFormSetSbward>(
            ActionName.MLSortFormSetSbward,
            action => {this.changeState(state => {
                state.mlxbwardValues[action.payload.sortId][action.payload.levelIdx] = action.payload.value;
            })}
        );

        this.addActionHandler<Actions.MLSortFormSetCtx>(
            ActionName.MLSortFormSetCtx,
            action => {this.changeState(state => {
                state.ctxIndexValues[action.payload.sortId][action.payload.levelIdx] = action.payload.index;
            })}
        );

        this.addActionHandler<Actions.MLSortFormSetCtxAlign>(
            ActionName.MLSortFormSetCtxAlign,
            action => {this.changeState(state => {
                state.ctxAlignValues[action.payload.sortId][action.payload.levelIdx] = action.payload.value;
            })}
        );
    }

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
                            state.ctxIndexValues[sortId] = List.map(item => MultiLevelConcSortModel.decodeCtxValue(item), mlxctxTmp);
                            state.ctxAlignValues[sortId] = List.map(item => MultiLevelConcSortModel.decodeCtxAlignValue(item), mlxctxTmp);
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

    submitQuery(sortId:string, concId:string):Observable<AjaxConcResponse> {
        const args = this.createSubmitArgs(sortId, concId);
        return this.pageModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.pageModel.createActionUrl(
                'mlsortx',
                [
                    ['format', 'json'],
                    ['q', '~' + concId]
                ]
            ),
            args,
            {
                contentType: 'application/json'
            }
        );
    }

    private createSubmitArgs(sortId:string, concId:string):MLSortServerArgs {
        const args:MLSortServerArgs = {
            levels: [],
            type:'mlSortQueryArgs',
            ...this.pageModel.getConcArgs(),
            q: '~' + concId
        };
        for (let i = 0; i < this.state.sortlevelValues[sortId]; i += 1) {
            args.levels.push({
                sattr: this.state.mlxattrValues[sortId][i],
                sbward: this.state.mlxbwardValues[sortId][i],
                sicase: this.state.mlxicaseValues[sortId][i],
                ctx: MultiLevelConcSortModel.encodeCtxValue(this.state.ctxIndexValues[sortId][i],
                    this.state.ctxAlignValues[sortId][i]),
                spos: null // TODO
            });
        }
        return args;
    }

    /**
     * Transform a ctx value (e.g. '-3<0') back to its
     * index in LEFTMOST_CTX or RIGHTMOST_CTX
     */
    private static decodeCtxValue(v:string):number {
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

    private static decodeCtxAlignValue(v:string):string {
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

    private static encodeCtxValue(idx:number, align:string):string {
        if (align === 'left') {
            return MultiLevelConcSortModel.LEFTMOST_CTX[idx];

        } else if (align === 'right') {
            return MultiLevelConcSortModel.RIGHTMOST_CTX[idx];

        } else {
            throw new Error(`Failed to encode mlxctx value. Idx: ${idx}, align: ${align}`);
        }
    }

    private addLevel(state:MultiLevelConcSortModelState, sortId:string):void {
        const currLevel = state.sortlevelValues[sortId];
        // we expect here that the individual attributes below contain
        // the maximum allowed number of levels. I.e. there should be
        // no need to add/remove levels - we just increase 'sortlevel'.
        state.sortlevelValues[sortId] = currLevel + 1;
    }

    private removeLevel(state:MultiLevelConcSortModelState, sortId:string, level:number):void {
        if (state.sortlevelValues[sortId] - 1 === 0) {
            throw new Error('At least one level must be defined');
        }
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
    }

    isActiveActionValue(sortId:string):boolean {
        return this.state.isActiveActionValues[sortId];
    }
}