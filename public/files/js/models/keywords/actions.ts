/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
import { ScoreType } from './form';
import { AsyncTaskInfo } from '../../types/kontext';
import { Keyword } from './common';


export class Actions {
    static SubmitQuery:Action<{}> = {
        name: 'KEYWORDS_SUBMIT_QUERY'
    };

    static SubmitQueryDone:Action<{}> = {
        name: 'KEYWORDS_SUBMIT_QUERY_DONE'
    };

    static SetAttr:Action<{
        value: string
    }> = {
        name: 'KEYWORDS_SET_ATTR'
    };

    static SetPattern:Action<{
        value: string
    }> = {
        name: 'KEYWORDS_SET_PATTERN'
    };

    static SetScoreType:Action<{
        value: ScoreType
    }> = {
        name: 'KEYWORDS_SET_SCORE_TYPE'
    };

    static RegisterPrecalcTasks:Action<{
        tasks:Array<AsyncTaskInfo<{}>>;
    }> = {
        name: 'KEYWORDS_REGISTER_PRECALC_TASKS'
    };

    static SetMinFreq:Action<{
        value:string;
        debounced?:boolean;
    }> = {
        name: 'KEYWORDS_SET_MIN_FREQ'
    };

    static SetMaxFreq:Action<{
        value:string;
        debounced?:boolean;
    }> = {
        name: 'KEYWORDS_SET_MAX_FREQ'
    };

    static ResultSetPage:Action<{
        page:string;
    }> = {
        name: 'KEYWORDS_RESULT_SET_PAGE'
    };

    static ResultPageLoadDone:Action<{
        data:Array<Keyword>;
        page:number;
        sort:string;
        reverse:boolean;
    }> = {
        name: 'KEYWORDS_RESULT_PAGE_LOAD_DONE'
    };
}
