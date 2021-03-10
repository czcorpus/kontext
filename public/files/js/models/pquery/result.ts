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

import { HTTP } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';
import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { PqueryResult } from './common';
import { PqueryResultsSaveModel } from './save';


export interface PqueryResultModelState {
    isBusy:boolean;
    isVisible:boolean;
    data:PqueryResult;
    queryId:string|undefined;
    sortKey:SortKey;
    resultId:string|undefined;
    numLines:number|undefined;
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

    private saveModel:PqueryResultsSaveModel;

    constructor(dispatcher:IFullActionControl, initState:PqueryResultModelState, layoutModel:PageModel, saveLinkFn:(file:string, url:string)=>void, quickSaveRowLimit:number) {
        super(dispatcher, initState);
        this.layoutModel = layoutModel;

        this.saveModel = new PqueryResultsSaveModel({
            dispatcher: dispatcher,
            layoutModel: layoutModel,
            saveLinkFn: saveLinkFn,
            quickSaveRowLimit: quickSaveRowLimit
        });

        this.addActionHandler<Actions.SubmitQuery>(
            ActionName.SubmitQuery,
            action => this.changeState(state => {
                state.isBusy = true;
                state.data = [];
                state.resultId = undefined;
                state.numLines = undefined;
            })
        );

        this.addActionHandler<Actions.SubmitQueryDone>(
            ActionName.SubmitQueryDone,
            action => this.changeState(state => {
                state.queryId = action.payload.queryId;
            })
        );

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

        this.addActionHandler<Actions.AsyncResultRecieved>(
            ActionName.AsyncResultRecieved,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.resultId = action.payload.resultId;
                        state.numLines = action.payload.numLines;
                        state.page = 1;
                    });
                    this.reloadData();
                }
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
    }

    reloadData():void {
        const args = {
            page: this.state.page,
            page_size: this.state.pageSize,
            sort: this.state.sortKey.column,
            reverse: this.state.sortKey.reverse ? 1 : 0,
            resultId: this.state.resultId
        };

        this.layoutModel.ajax$<PqueryResult>(
            HTTP.Method.GET,
            'get_results',
            args
        ).subscribe(
            results => this.changeState(state => {
                state.data = results;
                state.isBusy = false;
                state.isVisible = true;
            })
        );
    }

    getSaveModel():PqueryResultsSaveModel {
        return this.saveModel;
    }
}