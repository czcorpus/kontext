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
import { AlignTypes } from '../freqs/twoDimension/common';


export interface PqueryResultModelState {
    isBusy:boolean;
    data:PqueryResult;
    queryId:string;
    concIds:Array<string>;
    sortColumn:SortColumn;
    numLines:number;
    page:number;
    pageSize:number;
    saveFormActive:boolean;
}

export type SortColumn =
    {type:'freq'; reverse:boolean} |
    {type:'value'; reverse:boolean} |
    {type: 'partial_freq', concId: string; reverse:boolean};


function exportSortColumn(sc:SortColumn):string {
    switch (sc.type) {
        case 'freq':
        case 'value':
            return sc.type;
        case 'partial_freq':
            return `freq-${sc.concId}`;
    }
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
                    state.sortColumn = action.payload;
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

        this.addActionHandler<Actions.ResultApplyQuickFilter>(
            ActionName.ResultApplyQuickFilter,
            action => {
                this.suspendWithTimeout(
                    1000,
                    {},
                    (action2, syncData) => Actions.isResultApplyQuickFilterArgsReady(action2) ? null : syncData
                ).subscribe({
                    next: (action2) => {
                        if (Actions.isResultApplyQuickFilterArgsReady(action2)) {
                            const alignIdx = action2.payload.posAlign === AlignTypes.LEFT ? '-1' : '1';
                            const url = this.layoutModel.createActionUrl('quick_filter', [
                                ['q', `~${action.payload.concId}`],
                                ['q2', `p${action2.payload.posSpec} ${action2.payload.posSpec} ${alignIdx} [${action2.payload.attr}="${action.payload.value}"]`]
                            ]);
                            this.layoutModel.setLocationPost(url, [], action.payload.blankWindow);
                        }

                    },
                    error: (error) => {

                    }
                })
            }
        );
    }

    reloadData():void {
        const args = {
            q: `~${this.state.queryId}`,
            page: this.state.page,
            sort: exportSortColumn(this.state.sortColumn),
            reverse: this.state.sortColumn.reverse ? 1 : 0
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
                sort: exportSortColumn(this.state.sortColumn),
                reverse: this.state.sortColumn.reverse ? 1 : 0
            }
        });
    }
}