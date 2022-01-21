/*
 * Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import { HTTP } from 'cnc-tskit';
import { ajaxErrorMapped } from '../../../app/navigation';
import { PageModel } from '../../../app/page';
import { Observable } from 'rxjs';
import { ConcServerArgs } from '../../concordance/common';
import { FreqResultResponse } from '../common';


export const PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS = 500;


export interface ResultItem {
    idx:number;
    Word:Array<string>;
    pfilter:string;
    nfilter:string;
    fbar:number;
    freqbar:number;
    rel:number;
    relbar:number;
    freq:number;
    nbar:number;
    norm:number;
    norel:number; // 0|1 (TODO bool?)
}

export interface ResultHeader {
    s:string;
    n:string;
    isPosTag:boolean;
}

export interface ResultBlock {
    TotalPages:number;
    Total:number;
    Items:Array<ResultItem>;
    Head:Array<ResultHeader>;
    SkippedEmpty:boolean;
    fcrit:string; // original encoded freq. criterium (serves as an identifier of the result)
}

export interface BaseFreqModelState {
    data:{[sourceId:string]:ResultBlock};
    currentPage:{[sourceId:string]:string};
    sortColumn:{[sourceId:string]:string};
    freqCrit:Array<string>;
    freqCritAsync:Array<string>;
    ftt_include_empty:boolean;
    flimit:string;
    isActive:boolean;
    isBusy:{[sourceId:string]:boolean};
}

export interface FreqServerArgs extends ConcServerArgs {
    flimit:number;
    freqlevel:number;
    freq_sort:string;
    ftt_include_empty:boolean;
    fttattr?:string|Array<string>;
    fttattr_async?:string|Array<string>;
    [other:string]:any;
}

export function validateNumber(v:string, minNum:number):boolean {
    if (v === '') {
        return true;

    } else if (/^(0|[1-9][0-9]*)$/.exec(v) !== null) {
        return parseInt(v) >= minNum;
    }
    return false;
}

export class FreqDataLoader {

    private pageModel:PageModel;

    constructor({pageModel}) {
        this.pageModel = pageModel;
    }

    loadPage(args:FreqServerArgs):Observable<FreqResultResponse> {
        return this.pageModel.ajax$<FreqResultResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('freqs'),
            args

        ).pipe(
            ajaxErrorMapped({
                502: this.pageModel.translate('global__human_readable_502')
            }),
        )
    }
}
