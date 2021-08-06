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

import { HTTP, List, pipe } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
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

        this.addActionHandler<typeof Actions.SortLines>(
            Actions.SortLines.name,
            action => {
                this.changeState(state => {
                    state.sortColumn = action.payload;
                    state.isBusy = true;
                });
                this.reloadData();
            }
        );

        this.addActionHandler<typeof Actions.SetPage>(
            Actions.SetPage.name,
            action => {
                this.changeState(state => {
                    state.page = isNaN(action.payload.value) ? state.page : action.payload.value;
                });
                this.reloadData();
            }
        );

        this.addActionHandler<typeof Actions.ResultCloseSaveForm>(
            Actions.ResultCloseSaveForm.name,
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

        this.addActionHandler<typeof Actions.SaveFormSubmit>(
            Actions.SaveFormSubmit.name,
            action => {this.sendSaveArgs(dispatcher)}
        );

        this.addActionHandler<MainMenuActions.DirectSave>(
            MainMenuActionName.DirectSave,
            action => {this.sendSaveArgs(dispatcher)}
        );

        this.addActionHandler<typeof Actions.ResultApplyQuickFilter>(
            Actions.ResultApplyQuickFilter.name,
            action => {
                this.suspendWithTimeout(
                    1000,
                    {},
                    (action2, syncData) => Actions.isResultApplyQuickFilterArgsReady(action2) ? null : syncData
                ).subscribe({
                    next: (action2) => {
                        if (Actions.isResultApplyQuickFilterArgsReady(action2)) {
                            const alignIdx = action2.payload.posAlign === AlignTypes.LEFT ? '-1' : '1';
                            const cqlList = pipe(
                                action.payload.value.split(' '),
                                List.filter(v => v.length > 0),
                                List.map(s => `[${action2.payload.attr}="${s}"]`)
                            )
                            const posRight = action2.payload.posLeft + List.size(cqlList) - 1                            
                            const url = this.layoutModel.createActionUrl('quick_filter', [
                                ['q', `~${action.payload.concId}`],
                                ['q2', `p${action2.payload.posLeft} ${posRight} ${alignIdx} ${cqlList.join('')}`]
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
        dispatcher.dispatchSideEffect<typeof Actions.SaveFormPrepareSubmitArgsDone>({
            name: Actions.SaveFormPrepareSubmitArgsDone.name,
            payload: {
                queryId: this.state.queryId,
                sort: exportSortColumn(this.state.sortColumn),
                reverse: this.state.sortColumn.reverse ? 1 : 0
            }
        });
    }
}