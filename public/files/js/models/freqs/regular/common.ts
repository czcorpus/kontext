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

import { HTTP, List, Maths, pipe, tuple } from 'cnc-tskit';
import { ajaxErrorMapped } from '../../../app/navigation';
import { PageModel } from '../../../app/page';
import { Observable } from 'rxjs';
import { ConcServerArgs } from '../../concordance/common';
import { FreqChartsAvailableOrder, FreqResultResponse } from '../common';
import { AttrItem, BasicFreqModuleType } from '../../../types/kontext';


export const PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS = 500;


export interface ResultItem {
    idx:number;
    Word:Array<string>;
    pfilter:string;
    nfilter:string;
    rel:number;
    relConfidence:[number, number];
    freq:number;
    freqConfidence:[number, number];
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
            heading: res.Head[0] ? res.Head[0].n : '-',
            isEmpty: true
        };
}

export interface BaseFreqModelState {
    freqType:BasicFreqModuleType;
    data:{[sourceId:string]:ResultBlock|EmptyResultBlock};
    currentPage:{[sourceId:string]:string};
    sortColumn:{[sourceId:string]:FreqChartsAvailableOrder};
    freqCrit:Array<AttrItem>;
    freqCritAsync:Array<AttrItem>;
    ftt_include_empty:boolean;
    flimit:string;
    isActive:boolean;
    isBusy:{[sourceId:string]:boolean};
    alphaLevel:Maths.AlphaLevel;
}

/**
 * @todo this probably mixes two types where one represents a higher level approach
 * to freq. args (fttattr, fttattr_async) and the other (fcrit) represents an already
 * encoded arguments as required by the Manatee engine.
 */
export interface FreqServerArgs extends ConcServerArgs {
    flimit:number;
    fpage:number;
    fmaxitems?:number; // TODO this one vs. 'flimit'?
    freqlevel:number;
    freq_sort:string;
    ftt_include_empty:boolean;
    fttattr?:string|Array<string>;
    fttattr_async?:string|Array<string>;
    fcrit?:string;
    force_cache?:0|1;
}


export interface MulticritFreqServerArgs extends ConcServerArgs {
    flimit:number;
    fpage:number;
    fmaxitems?:number;
    freqlevel:number;
    freq_sort:string;
    ftt_include_empty:boolean;
    fcrit:Array<string>;
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
                relConfidence: tuple(0, 0),
                freq: 0,
                freqConfidence: tuple(0, 0),
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


export function recalculateConfIntervals(block:ResultBlock, alphaLevel:Maths.AlphaLevel):ResultBlock {
    block.Items = List.map(
        item => {
            const [normLeftConfidence, normRightConfidence] = Maths.wilsonConfInterval(
                item.freq, item.norm, alphaLevel);
            return {
                ...item,
                relConfidence: tuple(
                    Maths.roundToPos(normLeftConfidence * 1e6, 2),
                    Maths.roundToPos(normRightConfidence * 1e6, 2)
                ),
                freqConfidence: tuple(
                    Maths.roundToPos(normLeftConfidence * item.norm, 2),
                    Maths.roundToPos(normRightConfidence * item.norm, 2)
                ),
            }
        },
        block.Items
    );
    return block;
}