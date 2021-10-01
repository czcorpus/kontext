/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
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

import * as Kontext from '../../types/kontext';
import { ConcServerArgs } from '../concordance/common';
import { DataSaveFormat } from '../../app/navigation/save';


export interface CollResultRow {
    pfilter: { [key: string]: string };
    nfilter: { [key: string]: string };
    freq:number;
    Stats:Array<{s:string}>;
    str:string;
}

export type CollResultData = Array<CollResultRow>;

export type CollResultHeadingCell = {s:string; n:string};

export type CollResultHeading = Array<CollResultHeadingCell>;

export interface AjaxResponse extends Kontext.AjaxResponse {
    Head:CollResultHeading;
    Items:CollResultData;
    lastpage:number;
}

export interface CollServerArgs extends ConcServerArgs {
    cattr:string;
    cfromw:string;
    ctow:string;
    cminfreq:string;
    cminbgr:string;
    cbgrfns:Array<string>;
    csortfn:string;
    collpage:number;
}

export interface CollSaveServerArgs extends CollServerArgs {
    saveformat:DataSaveFormat;
    colheaders:boolean;
    heading:boolean;
    from_line:number;
    to_line:number;
}

export interface HistoryState {
    currPage:number;
    currPageInput:string;
    sortFn:string;
}

export interface StatusRequestArgs {
    corpname:string;
    usesubcorp:string|undefined;
    attrname:string;
    worker_tasks:Array<string>;
}