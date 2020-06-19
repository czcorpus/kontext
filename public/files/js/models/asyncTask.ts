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

import { Action, IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { List, HTTP, pipe } from 'cnc-tskit';

import { Kontext } from '../types/common';
import { IPluginApi } from '../types/plugins';
import { map } from 'rxjs/operators';


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


    constructor(dispatcher:IFullActionControl, pageModel:IPluginApi, currTasks:Array<Kontext.AsyncTaskInfo>) {
        super(
            dispatcher,
            {
                asyncTasks: [...currTasks],
                asyncTaskCheckerInterval: AsyncTaskChecker.CHECK_INTERVAL,
                removeFinishedOnSubmit: false,
                numRunning: 0,
                numFinished: 0,
                overviewVisible: false
            }
        );
        this.recalcNums();
        this.pageModel = pageModel;
        this.onUpdate = [];
    }

    onAction(action:Action) {
        switch (action.name) {
            case 'INBOX_TOGGLE_OVERVIEW_VISIBILITY':
                this.state.overviewVisible = !this.state.overviewVisible;
                this.emitChange();
            break;
            case 'INBOX_TOGGLE_REMOVE_FINISHED_ON_SUBMIT':
                this.state.removeFinishedOnSubmit = !this.state.removeFinishedOnSubmit;
                this.emitChange();
            break;
            case 'INBOX_CLOSE_TASK_OVERVIEW':
                (this.state.removeFinishedOnSubmit ?
                    this.deleteFinishedTaskInfo() :
                    rxOf(this.state.asyncTasks)

                ).subscribe(
                    (data) => {
                        this.updateMessageList(data);
                        this.recalcNums();
                        this.state.overviewVisible = false;
                        this.emitChange();
                    },
                    (err) => {
                        this.recalcNums();
                        this.state.overviewVisible = false;
                        this.emitChange();
                        this.pageModel.showMessage('error', err);
                    }
                );
            break;
            case 'INBOX_ADD_ASYNC_TASK':
                this.state.asyncTasks.push({
                    status: AsyncTaskStatus.PENDING,
                    ident: action.payload['ident'],
                    created: new Date().getTime() / 1000,
                    label: action.payload['label'],
                    category: action.payload['category'],
                    error: null,
                    args: {}
                });
                this.recalcNums();
                this.emitChange();
            break;
            case 'INBOX_UPDATE_ASYNC_TASK':
                const srchIdx = List.findIndex(v => v.ident === action.payload['ident'], this.state.asyncTasks);
                if (srchIdx > -1) {
                    const old = this.state.asyncTasks[srchIdx];
                    this.state.asyncTasks[srchIdx] = {
                        ...old,
                        status: action.payload['status'],
                        ident: action.payload['ident'],
                    };
                    if ((old.status === AsyncTaskStatus.PENDING || old.status === AsyncTaskStatus.STARTED)
                            && (this.state.asyncTasks[srchIdx].status === AsyncTaskStatus.FAILURE ||
                                this.state.asyncTasks[srchIdx].status === AsyncTaskStatus.SUCCESS)) {
                        this.state.overviewVisible = true;
                    }
                    this.recalcNums();
                    this.emitChange();
                }

            break;
        }
    }

    unregister():void {}

    private updateMessageList(data:Array<Kontext.AsyncTaskInfo>) {
        this.state.asyncTasks = [...data];
    }

    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.state.asyncTasks.push(task);
        this.init();
    }

    private recalcNums():void {
        this.state.numRunning = List.filter(this.taskIsActive, this.state.asyncTasks).length;
        this.state.numFinished = List.filter(this.taskIsFinished, this.state.asyncTasks).length;
    }

    private taskIsActive(t:Kontext.AsyncTaskInfo):boolean {
        return t.status === AsyncTaskStatus.STARTED || t.status === AsyncTaskStatus.PENDING;
    }

    private taskIsFinished(t:Kontext.AsyncTaskInfo):boolean {
        return t.status === AsyncTaskStatus.SUCCESS || t.status === AsyncTaskStatus.FAILURE;
    }

    private getNumRunningTasks():number {
        return List.filter(this.taskIsActive, this.state.asyncTasks).length;
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
                    List.filter(this.taskIsFinished),
                    List.map(item => item.ident)
                )
            }
        ).pipe(map(resp => resp.data));
    }

    private getFinishedTasks():Array<Kontext.AsyncTaskInfo> {
        return List.filter(this.taskIsFinished, this.state.asyncTasks);
    }

    /**
     * Adds a handler triggered when task information is
     * received from server.
     */
    addOnUpdate(fn:Kontext.AsyncTaskOnUpdate):void {
        this.onUpdate.push(fn);
    }

    init():void {
        if (this.state.asyncTasks.length > 0) {
            this.emitChange();
            if (!this.state.asyncTaskCheckerInterval) {
                this.state.asyncTaskCheckerInterval = window.setInterval(() => {
                    this.checkForStatus().subscribe(
                        (data) => {
                            this.state.asyncTasks = [...data.data];
                            if (this.getNumRunningTasks() === 0) {
                                window.clearInterval(this.state.asyncTaskCheckerInterval);
                                this.state.asyncTaskCheckerInterval = null;
                            }
                            const finished = this.getFinishedTasks();
                            if (finished.length > 0) {
                                this.onUpdate.forEach(item => {
                                    item(finished);
                                });
                            }
                            this.updateMessageList(data.data);
                            this.emitChange();
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
