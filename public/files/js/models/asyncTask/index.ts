/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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
import { List, HTTP, pipe } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { IPluginApi } from '../../types/plugins';
import { map } from 'rxjs/operators';
import { Actions, ActionName } from './actions';


function taskIsActive(t:Kontext.AsyncTaskInfo):boolean {
    return t.status === AsyncTaskStatus.STARTED || t.status === AsyncTaskStatus.PENDING;
}

function taskIsFinished(t:Kontext.AsyncTaskInfo):boolean {
    return t.status === AsyncTaskStatus.SUCCESS || t.status === AsyncTaskStatus.FAILURE;
}


interface AsyncTaskResponse extends Kontext.AjaxResponse {
    data:Array<Kontext.AsyncTaskInfo>;
}

export enum AsyncTaskStatus {
    PENDING = 'PENDING',
    STARTED = 'STARTED',
    SUCCESS = 'SUCCESS',
    FAILURE = 'FAILURE'
}

export interface AsyncTaskCheckerState {
    asyncTasks:Array<Kontext.AsyncTaskInfo>;
    asyncTaskCheckerInterval:number;
    removeFinishedOnSubmit:boolean;
    numRunning:number;
    numFinished:number;
    overviewVisible:boolean;
}

/**
 * This class handles checking for the state
 * of currently active bacground tasks triggered
 * by user.
 *
 * Possible task statuses: PENDING, STARTED, RETRY, FAILURE, SUCCESS
 * (see Python module kontext.AsyncTaskStatus)
 */
export class AsyncTaskChecker extends StatefulModel<AsyncTaskCheckerState> {

    private readonly pageModel:IPluginApi;

    private readonly onUpdate:Array<Kontext.AsyncTaskOnUpdate>;

    static CHECK_INTERVAL = 10000;


    constructor(
        dispatcher:IFullActionControl,
        pageModel:IPluginApi,
        currTasks:Array<Kontext.AsyncTaskInfo>
    ) {
        super(
            dispatcher,
            AsyncTaskChecker.recalcNums({
                asyncTasks: [...currTasks],
                asyncTaskCheckerInterval: AsyncTaskChecker.CHECK_INTERVAL,
                removeFinishedOnSubmit: false,
                numRunning: 0,
                numFinished: 0,
                overviewVisible: false
            })
        );
        ;
        this.pageModel = pageModel;
        this.onUpdate = [];

        this.addActionHandler<Actions.InboxToggleOverviewVisibility>(
            ActionName.InboxToggleOverviewVisibility,
            action => {
                this.changeState(state => {
                    state.overviewVisible = !state.overviewVisible
                })
            }
        );

        this.addActionHandler<Actions.InboxToggleRemoveFinishedOnSubmit>(
            ActionName.InboxToggleRemoveFinishedOnSubmit,
            action => {
                this.changeState(state => {
                    state.removeFinishedOnSubmit = !state.removeFinishedOnSubmit;
                });
            }
        );

        this.addActionHandler<Actions.InboxCloseTaskOverview>(
            ActionName.InboxCloseTaskOverview,
            action => {
                (this.state.removeFinishedOnSubmit ?
                    this.deleteFinishedTaskInfo() :
                    rxOf(this.state.asyncTasks)

                ).subscribe(
                    (data) => {
                        this.changeState(state => {
                            this.updateMessageList(state, data);
                            AsyncTaskChecker.recalcNums(state);
                            state.overviewVisible = false;
                        });
                    },
                    (err) => {
                        this.changeState(state => {
                            AsyncTaskChecker.recalcNums(state);
                            state.overviewVisible = false;
                        });
                        this.pageModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.InboxAddAsyncTask>(
            ActionName.InboxAddAsyncTask,
            action => {
                this.changeState(state => {
                    state.asyncTasks.push({
                        status: AsyncTaskStatus.PENDING,
                        ident: action.payload['ident'],
                        created: new Date().getTime() / 1000,
                        label: action.payload['label'],
                        category: action.payload['category'],
                        error: null,
                        args: {}
                    });
                    AsyncTaskChecker.recalcNums(state);
                });
            }
        );

        this.addActionHandler<Actions.InboxUpdateAsyncTask>(
            ActionName.InboxUpdateAsyncTask,
            action => {
                this.changeState(state => {
                    const srchIdx = List.findIndex(
                        v => v.ident === action.payload.ident,
                        state.asyncTasks
                    );
                    if (srchIdx > -1) {
                        const old = state.asyncTasks[srchIdx];
                        state.asyncTasks[srchIdx] = {
                            ...old,
                            status: action.payload['status'],
                            ident: action.payload['ident'],
                        };
                        if ((old.status === AsyncTaskStatus.PENDING ||
                                old.status === AsyncTaskStatus.STARTED)
                                && (state.asyncTasks[srchIdx].status === AsyncTaskStatus.FAILURE ||
                                    state.asyncTasks[srchIdx].status === AsyncTaskStatus.SUCCESS)) {
                            state.overviewVisible = true;
                        }
                        AsyncTaskChecker.recalcNums(state);
                    }
                });
            }
        );
    }

    unregister():void {}

    private updateMessageList(state:AsyncTaskCheckerState, data:Array<Kontext.AsyncTaskInfo>) {
        state.asyncTasks = [...data];
    }

    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.changeState(state => {
            state.asyncTasks.push(task);
        });
        this.init();
    }

    /**
     * note: returns mutated version of provided state
     */
    static recalcNums(state:AsyncTaskCheckerState):AsyncTaskCheckerState {
        state.numRunning = List.filter(taskIsActive, state.asyncTasks).length;
        state.numFinished = List.filter(taskIsFinished, state.asyncTasks).length;
        return state;
    }

    private getNumRunningTasks(state:AsyncTaskCheckerState):number {
        return List.filter(taskIsActive, state.asyncTasks).length;
    }

    private checkForStatus():Observable<AsyncTaskResponse> {
         return this.pageModel.ajax$(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('check_tasks_status'),
            {}
        );
    }

    private deleteFinishedTaskInfo():Observable<Array<Kontext.AsyncTaskInfo>> {
        return this.pageModel.ajax$<AsyncTaskResponse>(
            HTTP.Method.DELETE,
            this.pageModel.createActionUrl('remove_task_info'),
            {
                tasks: pipe(
                    this.state.asyncTasks,
                    List.filter(taskIsFinished),
                    List.map(item => item.ident)
                )
            }
        ).pipe(map(resp => resp.data));
    }

    private getFinishedTasks(state:AsyncTaskCheckerState):Array<Kontext.AsyncTaskInfo> {
        return List.filter(taskIsFinished, state.asyncTasks);
    }

    /**
     * Adds a handler triggered when task information is
     * received from server.
     */
    addOnUpdate(fn:Kontext.AsyncTaskOnUpdate):void {
        this.onUpdate.push(fn);
    }

    init():void {
        if (!List.empty(this.state.asyncTasks)) {
            this.emitChange();
            if (!this.state.asyncTaskCheckerInterval) {
                this.state.asyncTaskCheckerInterval = window.setInterval(() => {
                    this.checkForStatus().subscribe(
                        (data) => {
                            this.changeState(state => {
                                state.asyncTasks = [...data.data];
                                if (this.getNumRunningTasks(state) === 0) {
                                    window.clearInterval(this.state.asyncTaskCheckerInterval);
                                    this.state.asyncTaskCheckerInterval = null;
                                }
                                const finished = this.getFinishedTasks(state);
                                if (finished.length > 0) {
                                    this.onUpdate.forEach(item => {
                                        item(finished);
                                    });
                                    }
                                this.updateMessageList(state, data.data);
                            });
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                        }
                    );
                }, AsyncTaskChecker.CHECK_INTERVAL);
            }
        }
    }
}
