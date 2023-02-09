/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
import { List, HTTP, pipe, Dict } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import { concatMap, map, takeWhile, tap } from 'rxjs/operators';
import { Actions } from './actions';
import { taskCheckTimer } from './common';
import { DownloadType, isDownloadType, PageModel } from '../../app/page';
import { AjaxError } from 'rxjs/ajax';


function taskIsActive(t:Kontext.AsyncTaskInfo):boolean {
    return t.status === 'STARTED' || t.status === 'PENDING';
}

function taskIsFinished(t:Kontext.AsyncTaskInfo):boolean {
    return t.status === 'SUCCESS' || t.status === 'FAILURE';
}


interface DeleteTaskResponse extends Kontext.AjaxResponse {
    data:Array<Kontext.AsyncTaskInfo>;
}

interface CheckTaskStatusResponse extends Kontext.AjaxResponse {
    data:Kontext.AsyncTaskInfo;
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

    private readonly pageModel:PageModel;

    private readonly onUpdate:Array<Kontext.AsyncTaskOnUpdate>;

    static CHECK_INTERVAL = 5000;

    constructor(
        dispatcher:IFullActionControl,
        pageModel:PageModel,
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

        this.addActionHandler<typeof Actions.AsyncTasksChecked>(
            Actions.AsyncTasksChecked.name,
            action => {
                this.changeState(state => {
                    const updatedList:Array<Kontext.AsyncTaskInfo> = [
                        ...List.filter(v => isDownloadType(v.category), state.asyncTasks)];
                    List.forEach(
                        newTask => {
                            const updated = List.find(t => t.ident === newTask.ident, this.state.asyncTasks);
                            updatedList.push(updated ? updated : newTask);
                        },
                        action.payload.tasks
                    );
                    state.asyncTasks = updatedList;
                });
            }
        );

        this.addActionHandler<typeof Actions.InboxToggleOverviewVisibility>(
            Actions.InboxToggleOverviewVisibility.name,
            action => {
                this.changeState(state => {
                    state.overviewVisible = !state.overviewVisible
                })
            }
        );

        this.addActionHandler<typeof Actions.InboxToggleRemoveFinishedOnSubmit>(
            Actions.InboxToggleRemoveFinishedOnSubmit.name,
            action => {
                this.changeState(state => {
                    state.removeFinishedOnSubmit = !state.removeFinishedOnSubmit;
                });
            }
        );

        this.addActionHandler<typeof Actions.InboxCloseTaskOverview>(
            Actions.InboxCloseTaskOverview.name,
            action => {
                (this.state.removeFinishedOnSubmit ?
                    this.deleteFinishedTaskInfo() :
                    rxOf(this.state.asyncTasks)

                ).subscribe({
                    next: data => {
                        this.changeState(state => {
                            this.updateMessageList(state, data);
                            state.overviewVisible = false;
                        });
                    },
                    error: error => {
                        this.changeState(state => {
                            state.overviewVisible = false;
                        });
                        this.pageModel.showMessage('error', error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.InboxAddAsyncTask,
            action => {
                if (!action.error) {
                    const newTask = {
                        status: action.payload.status ? action.payload.status : 'PENDING',
                        ident: action.payload.ident,
                        created: action.payload.created ? action.payload.created : new Date().getTime() / 1000,
                        label: action.payload.label,
                        category: action.payload.category,
                        error: action.payload.error,
                        args: action.payload.args ? action.payload.args : {},
                        url: action.payload.url ? action.payload.url : undefined
                    };
                    this.changeState(state => {
                        state.asyncTasks.push(newTask);
                    });
                    this.startWatchingTask(newTask);

                } else {
                    this.pageModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.InboxUpdateAsyncTask,
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
                            error: action.error ? this.decodeError(old, action.error) : undefined
                        };
                        if ((old.status === 'PENDING' || old.status === 'STARTED')
                                && (state.asyncTasks[srchIdx].status === 'FAILURE' ||
                                    state.asyncTasks[srchIdx].status === 'SUCCESS')) {
                            state.overviewVisible = true;
                        }
                    }
                });
            }
        );
    }

    private decodeError(status:Kontext.AsyncTaskInfo, error:Error):string {
        if (isDownloadType(status.category) &&
                error instanceof AjaxError &&
                error.status === HTTP.Status.NotFound) {
            return this.pageModel.translate('global__result_no_more_avail_for_download_pls_update');
        }
        return error.message;
    }

    private updateMessageList(state:AsyncTaskCheckerState, data:Array<Kontext.AsyncTaskInfo>) {
        state.asyncTasks = [...data];
    }

    /**
     * @deprecated
     */
    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.changeState(state => {
            state.asyncTasks.push(task);
        });
        this.startWatchingTask(task);
    }

    static numRunning(state:AsyncTaskCheckerState):number {
        return pipe(state.asyncTasks, List.filter(taskIsActive), List.size());
    }

    static numFinished(state:AsyncTaskCheckerState):number {
        return pipe(state.asyncTasks, List.filter(taskIsFinished), List.size());
    }

    private deleteFinishedTaskInfo():Observable<Array<Kontext.AsyncTaskInfo>> {
        return this.pageModel.ajax$<DeleteTaskResponse>(
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
        incoming:Kontext.AsyncTaskInfo
    ):Array<Kontext.AsyncTaskInfo> {
        const srch = List.find(x => x.ident === incoming.ident, state.asyncTasks)
        if (srch) {
            if (incoming === undefined && !Dict.hasValue(srch.category, DownloadType)) {
                srch.status = 'FAILURE';

            } else {
                srch.status = incoming.status;
                srch.error = incoming.error;
            }

        } else {
            List.push(incoming, state.asyncTasks);
        }
        return List.filter(taskIsFinished, state.asyncTasks);
    }

    /**
     * Adds a handler triggered when task information is
     * received from server.
     */
    addOnUpdate(fn:Kontext.AsyncTaskOnUpdate):void {
        this.onUpdate.push(fn);
    }

    private startWatchingTask(task:Kontext.AsyncTaskInfo) {
        if (this.pageModel.supportsWebSocket()) {
            const [,statusSocket] = this.pageModel.openWebSocket<undefined, Kontext.AsyncTaskInfo>(
                this.pageModel.createActionUrl<{taskId: string}>(
                    'ws/task_status',
                    {taskId: task.ident},
                    true,
                )
            );
            statusSocket.subscribe({
                next: data => {
                    this.changeState(state => {
                        const finished = this.updateTasksStatus(state, data);
                        if (!List.empty(finished)) {
                            this.onUpdate.forEach(item => {
                                item(finished);
                            });
                        }
                    });
                    this.dispatchSideEffect(
                        Actions.AsyncTasksChecked,
                        {tasks: this.state.asyncTasks},
                    );
                },
                error: err => {
                    if (err instanceof CloseEvent) {
                        if (err.code > 1001) {
                            this.pageModel.showMessage('error', err.reason);
                        }
                    } else {
                        this.pageModel.showMessage('error', err);
                    }
                }
            });

        } else {
            taskCheckTimer().pipe(
                concatMap(
                    _ => this.pageModel.ajax$<CheckTaskStatusResponse>(
                        HTTP.Method.GET,
                        this.pageModel.createActionUrl('check_tasks_status', {task_id: task.ident}),
                        {}
                    )
                ),
                takeWhile(
                    (ans, i) => ans.data.status !== 'FAILURE' && ans.data.status !== 'SUCCESS',
                    true // inclusive
                )
            ).subscribe({
                next: data => {
                    this.changeState(state => {
                        const finished = this.updateTasksStatus(state, data.data);
                        if (!List.empty(finished)) {
                            this.onUpdate.forEach(item => {
                                item(finished);
                            });
                        }
                    });

                },
                error: error => {
                    this.pageModel.showMessage('error', error);
                }
            });
        }
    }

    private checkCurrentTasks():void {
        pipe(
            this.state.asyncTasks,
            // exclude download tasks
            List.filter(v => !Dict.hasValue(v.category, DownloadType)),
            List.forEach(item => {
                this.startWatchingTask(item);
            })
        );
    }

    init():void {
        if (!List.empty(this.state.asyncTasks)) {
            // refresh watched tasks received by ws
            this.checkCurrentTasks();

        } else {
        }
    }
}
