/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as Kontext from '../../types/kontext.js';
import { map } from 'rxjs/operators';
import { Actions } from './actions.js';
import { DownloadType, isDownloadType, PageModel } from '../../app/page.js';
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

export interface AsyncTaskCheckerState {
    asyncTasks:Array<Kontext.AsyncTaskInfo>;
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

    constructor(
        dispatcher:IFullActionControl,
        pageModel:PageModel,
        currTasks:Array<Kontext.AsyncTaskInfo>
    ) {
        super(
            dispatcher,
            {
                asyncTasks: [...currTasks],
                removeFinishedOnSubmit: false,
                overviewVisible: false
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler<typeof Actions.AsyncTasksChecked>(
            Actions.AsyncTasksChecked.name,
            action => {
                this.changeState(state => {
                    const updatedList:Array<Kontext.AsyncTaskInfo> = [
                        ...List.filter(v => isDownloadType(v.category), state.asyncTasks)];
                    List.forEach(
                        newTask => {
                            const updated = List.find(t => t.ident === newTask.ident, this.state.asyncTasks);
                            if (List.find(t => t.ident === newTask.ident, updatedList) === undefined) {
                                updatedList.push(updated ? updated : newTask);
                            }
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
                    if (!Dict.hasValue(newTask.category, DownloadType)) {
                        this.startWatchingTask(newTask.ident);
                    }

                } else {
                    this.pageModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.AsyncTasksWatch,
            action => {
                this.startWatchingTask(action.payload.ident);
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
        if (isDownloadType(status.category) && error instanceof AjaxError) {
            switch (error.status) {
                case HTTP.Status.NotFound:
                    return this.pageModel.translate('global__result_no_more_avail_for_download_pls_update');
                case HTTP.Status.UnavailableForLegalReasons:
                    if (status.category === DownloadType.CONCORDANCE) {
                        return this.pageModel.translate('concview__save_kwic_too_large');
                    }
                    break
            }
        }
        return error.message;
    }

    private updateMessageList(state:AsyncTaskCheckerState, data:Array<Kontext.AsyncTaskInfo>) {
        state.asyncTasks = [...data];
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

    /**
     * Update task information based on the 'incoming' value.
     * In case it is not already present, the item is added
     * to the end of the list of active tasks.
     *
     * @return list of finished tasks
     */
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

    private startWatchingTask(ident:string) {
        this.pageModel.openEventSource<Kontext.AsyncTaskInfo>(
            this.pageModel.createActionUrl<{taskId: string}>(
                'task_status',
                {taskId: ident}
            ),
            (v:Kontext.AsyncTaskInfo) => v.status === 'SUCCESS' || v.status === 'FAILURE'

        ).subscribe({
            next: data => {
                this.changeState(state => {
                    this.updateTasksStatus(state, data);
                });
                this.dispatchSideEffect(
                    Actions.AsyncTasksChecked,
                    {tasks: this.state.asyncTasks},
                );
            },
            error: err => {
                this.pageModel.showMessage('error', err);
            }
        });

    }

    init():void {
        if (!List.empty(this.state.asyncTasks)) {
            pipe(
                this.state.asyncTasks,
                // exclude download tasks
                List.filter(v => !Dict.hasValue(v.category, DownloadType)),
                List.forEach(item => {
                    this.startWatchingTask(item.ident);
                })
            );
        }
    }
}
