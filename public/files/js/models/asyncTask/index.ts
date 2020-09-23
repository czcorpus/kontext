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
import { interval, Observable, of as rxOf } from 'rxjs';
import { List, HTTP, pipe } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { IPluginApi } from '../../types/plugins';
import { concatAll, concatMap, filter, map, repeat, take, takeUntil, takeWhile, tap, timeout } from 'rxjs/operators';
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

    static CHECK_INTERVAL = 5000;

    private checker$:Observable<AsyncTaskResponse>;

    constructor(
        dispatcher:IFullActionControl,
        pageModel:IPluginApi,
        currTasks:Array<Kontext.AsyncTaskInfo>
    ) {
        super(
            dispatcher,
            {
                asyncTasks: [...currTasks],
                asyncTaskCheckerInterval: AsyncTaskChecker.CHECK_INTERVAL,
                removeFinishedOnSubmit: false,
                overviewVisible: false
            }
        );
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
                            state.overviewVisible = false;
                        });
                    },
                    (err) => {
                        this.changeState(state => {
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
                        ident: action.payload.ident,
                        created: new Date().getTime() / 1000,
                        label: action.payload.label,
                        category: action.payload.category,
                        error: null,
                        args: {}
                    });
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
                            status: action.payload.status,
                            ident: action.payload.ident,
                        };
                        if ((old.status === AsyncTaskStatus.PENDING ||
                                old.status === AsyncTaskStatus.STARTED)
                                && (state.asyncTasks[srchIdx].status === AsyncTaskStatus.FAILURE ||
                                    state.asyncTasks[srchIdx].status === AsyncTaskStatus.SUCCESS)) {
                            state.overviewVisible = true;
                        }
                    }
                });
            }
        );
    }

    private updateMessageList(state:AsyncTaskCheckerState, data:Array<Kontext.AsyncTaskInfo>) {
        state.asyncTasks = [...data];
    }

    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.changeState(state => {
            state.asyncTasks.push(task);
        });
        this.init();
    }

    static numRunning(state:AsyncTaskCheckerState):number {
        return pipe(state.asyncTasks, List.filter(taskIsActive), List.size());
    }

    static numFinished(state:AsyncTaskCheckerState):number {
        return pipe(state.asyncTasks, List.filter(taskIsFinished), List.size());
    }

    private getNumRunningTasks(tasks:Array<Kontext.AsyncTaskInfo>):number {
        return List.filter(taskIsActive, tasks).length;
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

    private updateTasksStatus(
        state:AsyncTaskCheckerState,
        incoming:Array<Kontext.AsyncTaskInfo>
    ):Array<Kontext.AsyncTaskInfo> {
        state.asyncTasks = pipe(
            state.asyncTasks,
            List.map(
                curr => {
                    const ans = {...curr};
                    const idx = List.findIndex(incom => incom.ident === curr.ident , incoming);
                    if (idx === -1) {
                        ans.status = "FAILURE";
                    }
                    return ans;
                }
            ),
            List.concat(incoming),
            List.groupBy(v => v.ident),
            List.map(([,v]) => List.maxItem(item => item.created, v))
        );
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
            this.checker$ = rxOf(
                rxOf(1, 1, 1, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4,
                    1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 2, 2.5, 3, 3.5, 4, 4.5),
                rxOf(5).pipe(repeat(100))
            ).pipe(
                concatAll(),
                concatMap(
                    v => interval(v * 1000).pipe(take(1))
                ),
                concatMap(
                    _ => this.checkForStatus()
                ),
            );

            const noTasks$ = this.checker$.pipe(
                filter(
                    (ans, i) => {
                        return this.getNumRunningTasks(ans.data) === 0 && i > 0;
                    }
                )
            );

            this.checker$.pipe(takeUntil(noTasks$)).subscribe(
                (data) => {
                    this.changeState(state => {
                        const finished = this.updateTasksStatus(state, data.data);
                        if (!List.empty(finished)) {
                            this.onUpdate.forEach(item => {
                                item(finished);
                            });
                        }
                    });
                },
                (err) => {
                    this.pageModel.showMessage('error', err);
                }
            );
        }
    }
}
