/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Action } from 'kombo';
import * as Kontext from '../../types/kontext';


export class Actions {

    static InboxToggleOverviewVisibility:Action<{
    }> = {
        name: 'INBOX_TOGGLE_OVERVIEW_VISIBILITY'
    };

    static InboxToggleRemoveFinishedOnSubmit:Action<{
    }> = {
        name: 'INBOX_TOGGLE_REMOVE_FINISHED_ON_SUBMIT'
    };

    static InboxCloseTaskOverview:Action<{
    }> = {
        name: 'INBOX_CLOSE_TASK_OVERVIEW'
    };

    static InboxAddAsyncTask:Action<{
        ident:string;
        label:string;
        category:string;
        status?:Kontext.AsyncTaskStatus;
        created?:number;
        args?:unknown;
        error?:string;
        url?:string;
    }> = {
        name: 'INBOX_ADD_ASYNC_TASK'
    };

    /**
     * Update externally a task. This can be used to unify some
     * async operation with the ones handled naturally by the AsyncTaskModel
     */
    static InboxUpdateAsyncTask:Action<{
        ident:string;
        status:Kontext.AsyncTaskInfo['status'];
    }> = {
        name: 'INBOX_UPDATE_ASYNC_TASK'
    };


    static AsyncTasksChecked:Action<{
        tasks:Array<Kontext.AsyncTaskInfo<unknown>>;
    }> = {
        name: 'ASYNC_TASKS_CHECKED'
    };

}