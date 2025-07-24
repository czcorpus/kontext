/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { WlnumsTypes } from '../wordlist/common.js';
import { AsyncTaskInfo } from '../../types/kontext.js';
import { ScoreType } from './form.js';

export interface KeywordsSubmitArgs {
    corpname:string;
    usesubcorp:string;
    ref_corpname:string;
    ref_usesubcorp:string;
    wlattr:string;
    wlpat:string;
    wlminfreq:number;
    wlmaxfreq:number;
    wlnums:WlnumsTypes;
    wltype:string;
    include_nonwords:boolean;
    score_type:ScoreType;
}

export interface KeywordsSubmitResponse {
    corpname:string;
    usesubcorp:string;
    freq_files_avail:boolean;
    subtasks:Array<AsyncTaskInfo<{}>>;
    kw_query_id:string;
}

export interface Keyword {
    item:string;
    score:number;
    logL?:number;
    chi2?:number;
    din?:number;
    frq1:number;
    frq2:number;
    rel_frq1:number;
    rel_frq2:number;
    query:string;
}