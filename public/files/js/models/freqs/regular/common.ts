/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { ajaxErrorMapped } from '../../../app/navigation/index.js';
import { PageModel } from '../../../app/page.js';
import { Observable } from 'rxjs';
import { ConcServerArgs } from '../../concordance/common.js';
import {
    FreqChartsAvailableData,
    FreqChartsAvailableOrder,
    FreqChartsAvailableTypes,
    FreqResultResponse,
    FreqResultViews
} from '../common.js';
import { AttrItem, BasicFreqModuleType } from '../../../types/kontext.js';
import * as Kontext from '../../../types/kontext.js';


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

export interface ShareLink {
    sourceId:string;
    url:string;
}

export interface BaseFreqModelState {
    freqType:BasicFreqModuleType;
    data:{[sourceId:string]:ResultBlock|EmptyResultBlock};
    currentPage:{[sourceId:string]:string};
    sortColumn:{[sourceId:string]:FreqChartsAvailableOrder};
    freqCrit:Array<AttrItem>;
    freqCritAsync:Array<AttrItem>;
    isActive:boolean;
    isBusy:{[sourceId:string]:boolean};
    shareWidgetIsBusy:boolean;
    isError:{[sourceId:string]:Error};
    alphaLevel:Maths.AlphaLevel;
    saveFormActive:boolean;
    shareLink:ShareLink|null;
    /**
     * flimit is a derived value from TabWrapperModel
     */
    flimit:number;
    concHasAdhocQuery:boolean;
}

export interface FreqDataRowsModelState extends BaseFreqModelState {
    displayConfidence:boolean;
}

export interface FreqChartsModelState extends BaseFreqModelState {
    type:{[sourceId:string]:FreqChartsAvailableTypes};
    dataKey:{[sourceId:string]:FreqChartsAvailableData};
    fpagesize:{[sourceId:string]:Kontext.FormValue<string>};
    dtFormat:{[sourceId:string]:string};
    downloadFormat:{[sourceId:string]:Kontext.ChartExportFormat};
}

export interface FreqViewProps {
    userEmail:string;
}

export function isFreqChartsModelState(s:BaseFreqModelState):s is FreqChartsModelState {
    return s['type'] != undefined && s['dataKey'] != undefined &&
        s['fpagesize'] != undefined && s['dtFormat'] != undefined &&
        s['downloadFormat'] != undefined;
}

export interface HistoryState {
    activeView:FreqResultViews;
    state:FreqDataRowsModelState|FreqChartsModelState;
}

export interface BaseFreqServerArgs extends ConcServerArgs {
    flimit:number;
    fpage:number;
    freqlevel:number;
    freq_sort:string;
}

/**
 * @todo this probably mixes two types where one represents a higher level approach
 * to freq. args (fttattr, fttattr_async) and the other (fcrit) represents an already
 * encoded arguments as required by the Manatee engine.
 */
export interface FreqServerArgs extends BaseFreqServerArgs {
    freq_type:BasicFreqModuleType;
    fpagesize?:number;
    fttattr?:string|Array<string>;
    fttattr_async?:string|Array<string>;
    fcrit?:string;
}

export interface MLFreqServerArgs extends BaseFreqServerArgs {
    freq_type:'tokens';
    ml1attr?:string;
    ml2attr?:string;
    ml3attr?:string;
    ml4attr?:string;
    ml5attr?:string;
    ml1icase?:0|1;
    ml2icase?:0|1;
    ml3icase?:0|1;
    ml4icase?:0|1;
    ml1bward?:string;
    ml2bward?:string;
    ml3bward?:string;
    ml4bward?:string;
    ml5bward?:string;
    ml1pos?:number;
    ml2pos?:number;
    ml3pos?:number;
    ml4pos?:number;
    ml5pos?:number;
    ml1ctx?:string;
    ml2ctx?:string;
    ml3ctx?:string;
    ml4ctx?:string;
    ml5ctx?:string;
}


export interface MulticritFreqServerArgs extends ConcServerArgs {
    flimit:number;
    fpage:number;
    fpagesize?:number;
    freqlevel:number;
    freq_sort:Array<string>;
    freq_type:BasicFreqModuleType;
    fcrit:Array<string>;
}

export function validateNumber(v:string, minNum:number):boolean {
    if (/^(0|[1-9][0-9]*)$/.exec(v) !== null) {
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


export function recalculateConfIntervals(block:ResultBlock, alphaLevel:Maths.AlphaLevel):ResultBlock {
    block.Items = List.map(
        item => {
            const [normLeftConfidence, normRightConfidence] = Maths.wilsonConfInterval(
                item.freq, item.norm, alphaLevel);
            return {
                ...item,
                relConfidence: tuple(
                    Maths.roundToPos(normLeftConfidence * 1e6, 3),
                    Maths.roundToPos(normRightConfidence * 1e6, 3)
                ),
                freqConfidence: tuple(
                    Maths.roundToPos(normLeftConfidence * item.norm, 3),
                    Maths.roundToPos(normRightConfidence * item.norm, 3)
                ),
            }
        },
        block.Items
    );
    return block;
}
