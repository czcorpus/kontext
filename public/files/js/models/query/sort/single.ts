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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map } from 'rxjs/operators';

import { Kontext } from '../../../types/common';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { PageModel } from '../../../app/page';
import { MultiDict } from '../../../multidict';
import { ConcSortServerArgs } from '../common';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../../mainMenu/actions';
import { Actions, ActionName } from '../actions';
import { Dict, List } from 'cnc-tskit';
import { ISubmitableConcSortModel, SortFormProperties } from './common';


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

        this.addActionHandler<Actions.SortSetActiveModel>(
            ActionName.SortSetActiveModel,
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


