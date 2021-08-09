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

import { AjaxConcResponse, ConcQuickFilterServerArgs } from '../concordance/common';


export interface Item {
    Word:Array<{n:string}>;
    pfilter:Array<[keyof ConcQuickFilterServerArgs,
        ConcQuickFilterServerArgs[keyof ConcQuickFilterServerArgs]]>;
    nfilter:Array<[keyof ConcQuickFilterServerArgs,
        ConcQuickFilterServerArgs[keyof ConcQuickFilterServerArgs]]>;
    fbar:number;
    freqbar:number;
    rel:number;
    relbar:number;
    freq:number;
    nbar:number;
    norm:number;
    norel:0|1; // (TODO bool?)
}

export interface Header {
    s:string;
    n:string;
}

export interface Block {
    TotalPages:number;
    Items:Array<Item>;
    Head:Array<Header>;
    Total:number;
    SkippedEmpty:boolean;
}

export interface FreqResultResponse extends AjaxConcResponse {
    Blocks:Array<Block>;
    lastpage:number; // 0|1 TODO type
    paging:number;
    quick_to_line:number; // TODO type?
    quick_from_line:number;
    freq_ipm_warn_enabled:boolean;
    FCrit:Array<{fcrit:string}>;
    fcrit:Array<{fcrit:string}>;
    fmaxitems:number;
    concsize:number;
}
