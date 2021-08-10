/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import { List, pipe } from 'cnc-tskit';
import { DataSaveFormat } from '../../app/navigation/save';
import * as Kontext from '../../types/kontext';


export enum WlnumsTypes {
    FRQ = 'frq',
    DOCF = 'docf',
    ARF = 'arf'
}


export interface WordlistSubmitArgs {
    corpname:string;
    usesubcorp:string;
    wlattr:string;
    wlpat:string;
    wlminfreq:number;
    wlnums:WlnumsTypes;
    wltype:string;
    pfilter_words:Array<string>;
    nfilter_words:Array<string>;
    include_nonwords:boolean;
    wlposattrs:Array<string>;
}

export interface WordlistSaveArgs {
    q:string;
    corpname:string;
    usesubcorp:string;
    from_line:number;
    to_line:number;
    saveformat:DataSaveFormat;
    colheaders:boolean;
    heading:boolean;
}

export type ResultData = {
    queryId:string;
    corpname:string;
    usesubcorp:string;
    data:Array<ResultItem>;
    total:number;
    wlsort:string;
    reversed:boolean;
    page:number;
    pageSize:number;
    isLastPage:boolean;
}


export type ResultItem = [string, number];


export interface IndexedResultItem {
    str:string;
    freq:number;
    idx:number;
}

export interface HeadingItem {
    str:string;
    sortKey:string;
}

export type WlTypes = 'simple'|'multilevel';

export type FileTarget = 'pfilter'|'nfilter'|'empty';


export interface SubmitResponse {
    corpname:string;
    usesubcorp:string;
    wl_query_id:string;
    freq_files_avail:boolean;
    subtasks:Array<Kontext.AsyncTaskInfo<{}>>;
}

export interface ConcFreqRedirectResponse {
    location:string;
}

export function isConcFreqRedirectResponse(r:SubmitResponse|ConcFreqRedirectResponse):r is ConcFreqRedirectResponse {
    return 'location' in r;
}

export function splitFilterWords(s:string):Array<string> {
    return pipe(
        s.split(/\s+/),
        List.filter(v => v !== '')
    );
}