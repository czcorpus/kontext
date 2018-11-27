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

import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {Kontext} from '../types/common';
import {IPluginApi} from '../types/plugins';
import {StatefulModel} from './base';
import {ActionDispatcher, Action} from '../app/dispatcher';


interface AsyncTaskResponse extends Kontext.AjaxResponse {
    data:Array<Kontext.AsyncTaskInfo>;
}

export enum AsyncTaskStatus {
    PENDING = 'PENDING',
    STARTED = 'STARTED',
    SUCCESS = 'SUCCESS',
    FAILURE = 'FAILURE'
}

/**
 * This class handles checking for the state
 * of currently active bacground tasks triggered
 * by user.
 *
 * Possible task statuses: PENDING, STARTED, RETRY, FAILURE, SUCCESS
 * (see Python module kontext.AsyncTaskStatus)
 */
export class AsyncTaskChecker extends StatefulModel implements Kontext.IAsyncTaskModel {

    private pageModel:IPluginApi;

    private asyncTasks:Immutable.List<Kontext.AsyncTaskInfo>;

    private onUpdate:Immutable.List<Kontext.AsyncTaskOnUpdate>;

    private asyncTaskCheckerInterval:number;

    static CHECK_INTERVAL = 10000;


    constructor(dispatcher:ActionDispatcher, pageModel:IPluginApi, conf:any) {
        super(dispatcher);
        const self = this;
        this.pageModel = pageModel;
        this.asyncTasks = Immutable.List<Kontext.AsyncTaskInfo>(conf.map(item => {
            return {
                status: item['status'],
                ident: item['ident'],
                created: item['created'],
                label: item['label'],
                category: item['category'],
                error: item['error'],
                args: item['args']
            }
        }));
        this.asyncTaskCheckerInterval = null;
        this.onUpdate = Immutable.List<Kontext.AsyncTaskOnUpdate>();

        this.dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'INBOX_CLEAR_FINISHED_TASKS':
                    this.deleteFinishedTaskInfo().then(
                        (data) => {
                            this.updateMessageList(data.data);
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.notifyChangeListeners();
                            this.pageModel.showMessage('error', err);
                        }
                    );
                break;
                case 'INBOX_ADD_ASYNC_TASK':
                    this.asyncTasks = this.asyncTasks.push({
                        status: AsyncTaskStatus.PENDING,
                        ident: action.props['ident'],
                        created: new Date().getTime() / 1000,
                        label: action.props['label'],
                        category: action.props['category'],
                        error: null,
                        args: {}
                    });
                    this.notifyChangeListeners();
                break;
                case 'INBOX_UPDATE_ASYNC_TASK':
                    const srchIdx = this.asyncTasks.findIndex(v => v.ident === action.props['ident']);
                    if (srchIdx > -1) {
                        const old = this.asyncTasks.get(srchIdx);
                        this.asyncTasks = this.asyncTasks.set(srchIdx, {
                            status: action.props['status'],
                            ident: action.props['ident'],
                            created: old.created,
                            label: old.label,
                            category: old.category,
                            error: old.error,
                            args: old.args
                        });
                        this.notifyChangeListeners();
                    }

                break;
            }
        });
    }

    private updateMessageList(data:Array<Kontext.AsyncTaskInfo>) {
        this.asyncTasks = Immutable.List<Kontext.AsyncTaskInfo>(data);
    }

    registerTask(task:Kontext.AsyncTaskInfo):void {
        this.asyncTasks = this.asyncTasks.push(task);
        this.init();
    }

    getAsyncTasks():Immutable.List<Kontext.AsyncTaskInfo> {
        return this.asyncTasks;
    }

    private taskIsActive(t:Kontext.AsyncTaskInfo):boolean {
        return t.status === 'STARTED' || t.status === 'PENDING';
    }

    private taskIsFinished(t:Kontext.AsyncTaskInfo):boolean {
        return t.status === 'SUCCESS' || t.status === 'FAILURE';
    }

    getNumRunningTasks():number {
        return this.asyncTasks.filter(this.taskIsActive).size;
    }

    getNumFinishedTasks():number {
        return this.asyncTasks.filter(item => this.taskIsFinished(item)).size;
    }

    private checkForStatus():RSVP.Promise<AsyncTaskResponse> {
         return this.pageModel.ajax(
            'GET',
            this.pageModel.createActionUrl('check_tasks_status'),
            {}
        );
    }

    private deleteFinishedTaskInfo():RSVP.Promise<AsyncTaskResponse> {
        const finishedTasksIds = this.asyncTasks.filter(this.taskIsFinished).map(item => item.ident).toArray();
        return this.pageModel.ajax(
            'DELETE',
            this.pageModel.createActionUrl('remove_task_info'),
            {'tasks': finishedTasksIds}
        );
    }

    private getFinishedTasks():Immutable.List<Kontext.AsyncTaskInfo> {
        return this.asyncTasks.filter(item => this.taskIsFinished(item)).toList();
    }

    private createTaskDesc(taskInfo:Kontext.AsyncTaskInfo) {
        let label = taskInfo.label ? taskInfo.label : taskInfo.ident.substr(0, 8) + '...';
        let desc = taskInfo.error ? taskInfo.status + ': ' + taskInfo.error : taskInfo.status;
        return label + ' (' + desc + ')';
    }

    /**
     * Adds a handler triggered when task information is
     * received from server.
     */
    addOnUpdate(fn:Kontext.AsyncTaskOnUpdate):void {
        this.onUpdate = this.onUpdate.push(fn);
    }

    init():void {
        if (this.asyncTasks.size > 0) {
            this.notifyChangeListeners();
            if (!this.asyncTaskCheckerInterval) {
                this.asyncTaskCheckerInterval = window.setInterval(() => {
                    this.checkForStatus().then(
                        (data) => {
                            this.asyncTasks = Immutable.List<Kontext.AsyncTaskInfo>(data.data);
                            if (this.getNumRunningTasks() === 0) {
                                window.clearInterval(this.asyncTaskCheckerInterval);
                                this.asyncTaskCheckerInterval = null;
                            }
                            const finished = this.getFinishedTasks();
                            if (finished.size > 0) {
                                this.onUpdate.forEach(item => {
                                    item(finished);
                                });
                            }
                            this.updateMessageList(data.data);
                            this.notifyChangeListeners();
                        }
                    ).catch(
                        (err) => {
                            this.pageModel.showMessage('error', err);
                        }
                    );
                }, AsyncTaskChecker.CHECK_INTERVAL);
            }
        }
    }
}
