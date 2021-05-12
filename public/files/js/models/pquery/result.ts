/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { HTTP, List } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';
import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { PqueryResult } from './common';
import { Actions as MMActions, ActionName as MMActionName } from '../mainMenu/actions';


export interface PqueryResultModelState {
    isBusy:boolean;
    data:PqueryResult;
    queryId:string;
    sortKey:SortKey;
    numLines:number;
    page:number;
    pageSize:number;
    saveFormActive:boolean;
}

export type SortColumn = 'freq'|'value';

export interface SortKey {
    column:SortColumn;
    reverse:boolean;
}


export class PqueryResultModel extends StatefulModel<PqueryResultModelState> {

    private readonly layoutModel:PageModel;

    constructor(dispatcher:IFullActionControl, initState:PqueryResultModelState, layoutModel:PageModel) {
        super(dispatcher, initState);
        this.layoutModel = layoutModel;

        this.addActionHandler<Actions.SortLines>(
            ActionName.SortLines,
            action => {
                this.changeState(state => {
                    state.sortKey = action.payload;
                    state.isBusy = true;
                });
                this.reloadData();
            }
        );

        this.addActionHandler<Actions.SetPage>(
            ActionName.SetPage,
            action => {
                this.changeState(state => {
                    state.page = isNaN(action.payload.value) ? state.page : action.payload.value;
                });
                this.reloadData();
            }
        );

        this.addActionHandler<Actions.ResultCloseSaveForm>(
            ActionName.ResultCloseSaveForm,
            action => {
                this.changeState(state => {
                    state.saveFormActive = false;
                });
            }
        );

        this.addActionHandler<MainMenuActions.ShowSaveForm>(
            MainMenuActionName.ShowSaveForm,
            action => {
                this.changeState(state => {
                    state.saveFormActive = true;
                });
            }
        );

        this.addActionHandler<Actions.SaveFormSubmit>(
            ActionName.SaveFormSubmit,
            action => {this.sendSaveArgs(dispatcher)}
        );

        this.addActionHandler<MainMenuActions.DirectSave>(
            MainMenuActionName.DirectSave,
            action => {this.sendSaveArgs(dispatcher)}
        );
    }

    reloadData():void {
        const args = {
            q: `~${this.state.queryId}`,
            page: this.state.page,
            sort: this.state.sortKey.column,
            reverse: this.state.sortKey.reverse ? 1 : 0
        };

        this.layoutModel.ajax$<{rows: PqueryResult}>(
            HTTP.Method.GET,
            'get_results',
            args

        ).subscribe(
            resp => {
                this.dispatchSideEffect<MMActions.ToggleDisabled>({
                    name: MMActionName.ToggleDisabled,
                    payload: {
                        menuId: 'menu-save',
                        disabled: List.empty(resp.rows)
                    }
                });
                this.changeState(state => {
                    state.data = resp.rows;
                    state.isBusy = false;
                })
            }
        );
    }

    sendSaveArgs(dispatcher:IFullActionControl):void {
        dispatcher.dispatchSideEffect<Actions.SaveFormPrepareSubmitArgsDone>({
            name: ActionName.SaveFormPrepareSubmitArgsDone,
            payload: {
                queryId: this.state.queryId,
                sort: this.state.sortKey.column,
                reverse: this.state.sortKey.reverse ? 1 : 0
            }
        });
    }
}