/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Kontext from '../../../types/kontext';


interface FreqItem {
    Word:Array<{n:string}>;
    freq:number;
    norm:number;
    rel:number;
    pfilter:{[key:string]:string};
    nfilter:{[key:string]:string};
}

interface FreqBlock {
    Total:number;
    TotalPages:number;
    Items:Array<FreqItem>;
    Head:Array<{s:string; n:string}>;
    NoRelSorting:boolean;
}

export interface FreqData {
    FCrit:Array<string>;
    Blocks:Array<FreqBlock>;
    paging:number;
    concsize:number;
    fmaxitems:number;
    quick_from_line:number;
    quick_to_line:number;
}

export interface Reduce extends Kontext.AjaxResponse {
    sampled_size:number;
    conc_persistence_op_id:string;
}
