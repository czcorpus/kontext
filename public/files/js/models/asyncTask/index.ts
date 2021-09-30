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


interface AsyncTaskResponse extends Kontext.AjaxResponse {
    data:Array<Kontext.AsyncTaskInfo>;
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

    private triggerUpdateAction:(resp:AsyncTaskResponse)=>void;

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
        this.triggerUpdateAction = (resp:AsyncTaskResponse) => {
            // we don't want to notify about finished tasks multiple times so the
            // receivers do not have to handle it by themselves
            const tasks = pipe(
                resp.data,
                List.filter(v => {
                    const srch = List.find(c => c.ident === v.ident, this.state.asyncTasks);
                    return !(srch && (srch.status === 'FAILURE' || srch.status === 'SUCCESS')
                            && v.status === srch.status);
                })
            );
            if (!List.empty(tasks)) {
                dispatcher.dispatch<typeof Actions.AsyncTasksChecked>({
                    name: Actions.AsyncTasksChecked.name,
                    payload: {
                        tasks
                    }
                });
            }
        };

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
                    this.changeState(state => {
                        state.asyncTasks.push({
                            status: action.payload.status ? action.payload.status : 'PENDING',
                            ident: action.payload.ident,
                            created: action.payload.created ? action.payload.created : new Date().getTime() / 1000,
                            label: action.payload.label,
                            category: action.payload.category,
                            error: action.payload.error,
                            args: action.payload.args ? action.payload.args : {},
                            url: action.payload.url ? action.payload.url : undefined
                        });
                    });
                    this.checkCurrentTasks();

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
        this.checkCurrentTasks();
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

    private updateTasksStatusAjax(
        state:AsyncTaskCheckerState,
        incoming:Array<Kontext.AsyncTaskInfo>
    ):Array<Kontext.AsyncTaskInfo> {
        state.asyncTasks = pipe(
            state.asyncTasks,
            List.map(
                curr => {
                    const ans = {...curr};
                    const idx = List.findIndex(incom => incom.ident === curr.ident, incoming);
                    if (idx === -1 && !Dict.hasValue(ans.category, DownloadType)) {
                        ans.status = 'FAILURE';
                    }
                    return ans;
                }
            ),
            List.concat(incoming),
            List.groupBy(v => v.ident),
            List.map(([,v]) => List.maxItem(
                item => item.status === 'FAILURE' || item.status === 'SUCCESS' ? 2 : 1, v))
        );
        return List.filter(taskIsFinished, state.asyncTasks);
    }

    // updates only status and error, since ws does not have access to other parameters
    private updateTasksStatusWS(
        state:AsyncTaskCheckerState,
        incoming:Array<Kontext.AsyncTaskInfo>
    ):Array<Kontext.AsyncTaskInfo> {
        state.asyncTasks = pipe(
            state.asyncTasks,
            List.map(
                curr => {
                    const ans = {...curr};
                    const item = List.find(incom => incom.ident === curr.ident, incoming);
                    if (item === undefined && !Dict.hasValue(ans.category, DownloadType)) {
                        ans.status = 'FAILURE';

                    } else {
                        ans.status = item.status;
                        ans.error = item.error;
                    }
                    return ans;
                }
            ),
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

    private checkCurrentTasks():void {
        if (this.pageModel.supportsWebSocket()) {
            const [checkTasks$, statusSocket] = this.pageModel.openWebSocket<Array<string>, Array<Kontext.AsyncTaskInfo>>('job_status');
            statusSocket.subscribe({
                next: data => {
                    this.changeState(state => {
                        const finished = this.updateTasksStatusWS(state, data);
                        if (!List.empty(finished)) {
                            this.onUpdate.forEach(item => {
                                item(finished);
                            });
                        }
                        this.dispatchSideEffect<typeof Actions.AsyncTasksChecked>({
                            name: Actions.AsyncTasksChecked.name,
                            payload: {
                                tasks: state.asyncTasks
                            }
                        });
                    });
                },
                error: error => {
                    console.log('error: ', error);
                }
            });
            checkTasks$.next(
                pipe(
                    this.state.asyncTasks,
                    // exclude download tasks
                    List.filter(v => !Dict.hasValue(v.category, DownloadType)),
                    List.map(item => item.ident),
                )
            );

        } else { // the ajax way

            const timer$ = taskCheckTimer();
            timer$.pipe(
                concatMap(
                    _ => this.pageModel.ajax$<AsyncTaskResponse>(
                        HTTP.Method.GET,
                        this.pageModel.createActionUrl('check_tasks_status'),
                        {}
                    )
                ),
                takeWhile(
                    (ans, i) => this.getNumRunningTasks(ans.data) > 0 || i === 0,
                    true // inclusive
                ),
                tap(
                    (data) => {
                        this.triggerUpdateAction(data)
                    }
                )
            ).subscribe({
                next: data => {
                    this.changeState(state => {
                        const finished = this.updateTasksStatusAjax(state, data.data);
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

    init():void {
        if (!List.empty(this.state.asyncTasks)) {
            // refresh watched tasks received by ws
            this.checkCurrentTasks();

        } else {
        }
    }
}
