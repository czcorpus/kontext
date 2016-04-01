/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../ts/declarations/common.d.ts" />
/// <reference path="../ts/declarations/immutable.d.ts" />

import Immutable = require('vendor/immutable');


interface AsyncTaskResponse extends Kontext.AjaxResponse {
    num_remaining?: number;
    data?:Array<Kontext.AsyncTaskInfo>;
    contains_errors: boolean;
}

/**
 * This class handles checking for the state
 * of currently active bacground tasks triggered
 * by user.
 */
export class AsyncTaskChecker {

    private pageModel:Kontext.PluginApi;

    private asyncTasks:Immutable.List<Kontext.AsyncTaskInfo>;

    private onUpdate:Immutable.List<Kontext.AsyncTaskOnUpdate>;

    private asyncTaskCheckerInterval:number;

    static CHECK_INTERVAL = 10000;


    constructor(pageModel:Kontext.PluginApi, conf:any) {
        this.pageModel = pageModel;
        this.asyncTasks = Immutable.List<Kontext.AsyncTaskInfo>(conf.map((item) => {
            return {
                status: conf['status'],
                ident: conf['ident'],
                created: conf['created'],
                label: conf['label'],
                category: conf['category'],
                error: conf['error'],
                args: conf['args']
            }
        }));
        this.asyncTaskCheckerInterval = null;
        this.onUpdate = Immutable.List<Kontext.AsyncTaskOnUpdate>();
    }

    private checkForStatus():RSVP.Promise<AsyncTaskResponse> {
         return this.pageModel.ajax(
            'GET',
            this.pageModel.createActionUrl('check_tasks_status'),
            {},
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private deleteTaskInfo(taskIds:Array<string>):RSVP.Promise<AsyncTaskResponse> {
        return this.pageModel.ajax(
            'DELETE',
            this.pageModel.createActionUrl('remove_task_info'),
            {'tasks': taskIds},
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private getFinishedTasks():Immutable.List<Kontext.AsyncTaskInfo> {
        return this.asyncTasks.filter((item)=>(item.status === 'SUCCESS' || item.status === 'FAILURE')).toList();
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
        if (this.asyncTasks.size > 0 && !this.asyncTaskCheckerInterval) {
            this.asyncTaskCheckerInterval = window.setInterval(() => {
                this.checkForStatus().then(
                    (data) => {
                        if (!data.contains_errors) {
                            this.asyncTasks = Immutable.List<Kontext.AsyncTaskInfo>(data.data);
                            if (this.asyncTasks.size === 0) {
                                window.clearInterval(this.asyncTaskCheckerInterval);

                            } else {
                                let finished = this.getFinishedTasks();
                                if (finished.size > 0) {
                                    window.clearInterval(this.asyncTaskCheckerInterval);
                                    this.onUpdate.forEach(item => {
                                        item(finished);
                                    });
                                    let info = finished.map((item) => this.createTaskDesc(item))
                                            .join(', ');
                                    this.pageModel.showMessage(
                                        'mail',
                                        this.pageModel.translate('global__these_task_are_finished') + ': ' + info,
                                        () => {
                                            this.deleteTaskInfo(finished.map(item => item.ident).toArray()).then(
                                                (data) => {
                                                    if (data.num_remaining > 0) {
                                                        this.init();
                                                    }
                                                },
                                                (err) => {
                                                    this.pageModel.showMessage('error', err);
                                                }
                                            )
                                        }
                                    );
                                }
                            }

                        } else {
                            this.pageModel.showMessage('error', data.messages.join(', '));
                        }
                    },
                    (err) => {
                        this.pageModel.showMessage('error', err);
                    }
                )
            }, AsyncTaskChecker.CHECK_INTERVAL);
        }
    }
}
