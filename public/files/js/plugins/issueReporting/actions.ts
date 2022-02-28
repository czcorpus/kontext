/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import { Action } from 'kombo';


export class Actions {

    static SetVisibility:Action<{
        value:boolean;
    }> = {
        name: 'ISSUE_REPORTING_SET_VISIBILITY'
    };

    static UpdateIssueBody:Action<{
        value:string;
    }> = {
        name: 'ISSUE_REPORTING_UPDATE_ISSUE_BODY'
    };

    static SubmitIssue:Action<{
    }> = {
        name: 'ISSUE_REPORTING_SUBMIT_ISSUE'
    };

    static SubmitIssueDone:Action<{
    }> = {
        name: 'ISSUE_REPORTING_SUBMIT_ISSUE_DONE'
    };
}