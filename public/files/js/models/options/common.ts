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
import { FreqResultViews } from '../freqs/common';

export interface ViewOptsResponse extends Kontext.AjaxResponse {
    pagesize:number;
    newctxsize:number;
    ctxunit:string;
    line_numbers:boolean;
    wlpagesize:number;
    fpagesize:number;
    fdefault_view:FreqResultViews;
    citemsperpage:number;
    pqueryitemsperpage:number;
    tt_overview:number;
    rich_query_editor:boolean;
    subcpagesize:number;
    kwpagesize:number;
    ref_max_width:number;
}

export interface GeneralOptionsShared {
    showLineNumbers:boolean;
    pageSize:number;
    refMaxWidth:number;
    newCtxSize:number;
    wlpagesize:number;
    fpagesize:number;
    citemsperpage:number;
    pqueryitemsperpage:number;
    subcpagesize:number;
    kwpagesize:number;
}