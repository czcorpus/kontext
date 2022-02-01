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

import { HTTP, List, pipe } from 'cnc-tskit';
import { ajaxErrorMapped } from '../../../app/navigation';
import { PageModel } from '../../../app/page';
import { Observable } from 'rxjs';
import { ConcServerArgs } from '../../concordance/common';
import { FreqResultResponse } from '../common';
import { AttrItem } from '../../../types/kontext';
import { FreqChartsAvailableOrder } from './freqCharts';


export const PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS = 500;


export interface ResultItem {
    idx:number;
    Word:Array<string>;
    pfilter:string;
    nfilter:string;
    rel:number;
    freq:number;
    norm:number;
}

export interface ResultHeader {
    s:FreqChartsAvailableOrder;
    n:string;
    isPosTag:boolean;
    allowSorting:boolean;
}

export interface ResultBlock {
    TotalPages:number;
    Total:number;
    Items:Array<ResultItem>;
    Head:Array<ResultHeader>;
    SkippedEmpty:boolean;
    NoRelSorting:boolean;
    fcrit:string; // original encoded freq. criterium (serves as an identifier of the result)
}

export interface EmptyResultBlock {
    TotalPages:0;
    fcrit:string;
    heading:string;
    isEmpty:true;
}

export function isEmptyResultBlock(v:ResultBlock|EmptyResultBlock):v is EmptyResultBlock {
    return v['isEmpty'] === true;
}

export function clearResultBlock(res:ResultBlock|EmptyResultBlock):EmptyResultBlock {
    return isEmptyResultBlock(res) ?
        res :
        {
            TotalPages: 0,
            fcrit: res.fcrit,
            heading: res.Head[0].n,
            isEmpty: true
        };
}

export interface BaseFreqModelState {
    data:{[sourceId:string]:ResultBlock|EmptyResultBlock};
    currentPage:{[sourceId:string]:string};
    sortColumn:{[sourceId:string]:FreqChartsAvailableOrder};
    freqCrit:Array<AttrItem>;
    freqCritAsync:Array<AttrItem>;
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

/**
 * reduceNumResultItems produces an array of items with max size maxItems by taking
 * first maxItems-1 items and adding a new items with values summed (representing "other").
 */
export function reduceNumResultItems(data:Array<ResultItem>, maxItems:number, restLabel:string):Array<ResultItem> {
    if (maxItems < 1) {
        throw new Error('reduceNumResultItems requires maxItems > 0');
    }
    if (List.size(data) <= maxItems) {
        return data;
    }
    const subList = List.slice(0, maxItems, data);
    const other = pipe(
        data,
        List.slice(maxItems, List.size(data)),
        List.foldl<ResultItem, ResultItem>(
            (acc, curr) => {
                return {
                    ...acc,
                    rel: acc.rel + curr.rel,
                    freq: acc.freq + curr.freq
                };
            },
            {
                idx: maxItems,
                Word: [restLabel],
                pfilter: '',
                nfilter: '',
                rel: 0,
                freq: 0,
                norm: 0,
            }
        )
    );
    return List.push(other, subList);
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


export type FreqDisplayMode = 'tables'|'charts';
