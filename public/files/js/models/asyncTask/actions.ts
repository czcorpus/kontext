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
import { Kontext } from '../../types/common';


export enum ActionName {
    InboxToggleOverviewVisibility = 'INBOX_TOGGLE_OVERVIEW_VISIBILITY',
    InboxToggleRemoveFinishedOnSubmit = 'INBOX_TOGGLE_REMOVE_FINISHED_ON_SUBMIT',
    InboxCloseTaskOverview = 'INBOX_CLOSE_TASK_OVERVIEW',
    InboxAddAsyncTask = 'INBOX_ADD_ASYNC_TASK',
    InboxUpdateAsyncTask = 'INBOX_UPDATE_ASYNC_TASK'
}

export namespace Actions {

    export interface InboxToggleOverviewVisibility extends Action<{
    }> {
        name: ActionName.InboxToggleOverviewVisibility;
    }

    export interface InboxToggleRemoveFinishedOnSubmit extends Action<{
    }> {
        name: ActionName.InboxToggleRemoveFinishedOnSubmit;
    }

    export interface InboxCloseTaskOverview extends Action<{
    }> {
        name: ActionName.InboxCloseTaskOverview;
    }

    export interface InboxAddAsyncTask extends Action<{
        ident:string;
        label:string;
        category:string;
    }> {
        name: ActionName.InboxAddAsyncTask;
    }

    export interface InboxUpdateAsyncTask extends Action<{
        ident:string;
        status:Kontext.AsyncTaskInfo['status'];
    }> {
        name: ActionName.InboxUpdateAsyncTask;
    }


}