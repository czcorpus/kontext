/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
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

import { ConcServerArgs } from '../concordance/common';

export interface FreqServerArgs extends ConcServerArgs {
    flimit:number;
    freqlevel:number;
    freq_sort:string;
    ftt_include_empty:'0'|'1';
    [other:string]:any;
}

export interface CTFreqServerArgs extends ConcServerArgs {
    ctfcrit1:string;
    ctfcrit2:string;
    ctattr1:string;
    ctattr2:string;
    ctminfreq:string;
    ctminfreq_type:string;
}