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

import { Action, IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { map, concatMap, tap } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { ConcLineModel } from './lines';
import { ActionName as ConcActionName, Actions as ConcActions } from '../../models/concordance/actions';
import { pipe, List, HTTP } from 'cnc-tskit';


export type TTCrit = Array<[string, string]>;

export interface TextTypesDistModelProps {
    ttCrit:TTCrit;
}


export namespace Response {

    interface FreqItem {
        Word:Array<{n:string}>;
        fbar:number;
        freq:number;
        freqbar:number;
        nbar:number;
        nfilter:Array<[string, string]>;
        norel:number;
        norm:number;
        pfilter:Array<[string, string]>;
        rel:number;
        relbar:number;
    }

    interface FreqBlock {
        Total:number;
        TotalPages:number;
        Items:Array<FreqItem>;
        Head:Array<{s:string; n:string}>;
    }

    export interface FreqData {
        FCrit:TTCrit;
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
}


export interface FreqItem {
    value:string;
    ipm:number;
    abs:number;
    barWidth:number;
    color:string;
}


export interface FreqBlock {
    label:string;
    items:Array<FreqItem>;
}


export interface TextTypesDistModelState {
    ttCrit:TTCrit;
    blocks:Array<FreqBlock>;
    flimit:number;
    sampleSize:number;
    isBusy:boolean;
    blockedByAsyncConc:boolean;
    lastArgs:string;
    maxBlockItems:number;
}


export class TextTypesDistModel extends StatefulModel<TextTypesDistModelState> {

    private static SAMPLE_SIZE = 100000;

    private static IPM_BAR_WIDTH = 400;

    private static COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
                             "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

    private static DEFAULT_MAX_BLOCK_ITEMS = 10;

    private readonly layoutModel:PageModel;

    private readonly concLineModel:ConcLineModel;


    constructor(dispatcher:IFullActionControl, layoutModel:PageModel, concLineModel:ConcLineModel, props:TextTypesDistModelProps) {
        super(
            dispatcher,
            {
                ttCrit: props.ttCrit,
                blocks: [],
                flimit: 100, // this is always recalculated according to data
                sampleSize: 0,
                maxBlockItems: TextTypesDistModel.DEFAULT_MAX_BLOCK_ITEMS,
                blockedByAsyncConc: concLineModel.isUnfinishedCalculation(),
                isBusy: concLineModel.isUnfinishedCalculation(),
                lastArgs: ''
            }
        );
        this.layoutModel = layoutModel;
        this.concLineModel = concLineModel;

        this.addActionHandler<ConcActions.AsyncCalculationUpdated>(
            ConcActionName.AsyncCalculationUpdated,
            action => {
                this.state.blockedByAsyncConc = !action.payload.finished;
                this.performDataLoad();
            }
        );

        this.addActionHandler<ConcActions.LoadTTDictOverview>(
            ConcActionName.LoadTTDictOverview,
            action => {
                if (this.state.blocks.length === 0) {
                    this.performDataLoad();
                }
            }
        );

        this.addActionHandler<ConcActions.RemoveChartItemsLimit>(
            ConcActionName.RemoveChartItemsLimit,
            action => {
                this.state.maxBlockItems = -1;
                this.emitChange();
            }
        );

        this.addActionHandler<ConcActions.RestoreChartItemsLimit>(
            ConcActionName.RestoreChartItemsLimit,
            action => {
                this.state.maxBlockItems = TextTypesDistModel.DEFAULT_MAX_BLOCK_ITEMS;
                this.emitChange();
            }
        );
    }

    unregister():void {}

    private performDataLoad():void {
        if (!this.state.blockedByAsyncConc && this.getConcSize() > 0) {
            const args = this.layoutModel.getConcArgs();
            if (this.state.lastArgs !== args.head('q')) {
                this.state.isBusy = true;
                this.emitChange();
                this.loadData(args).subscribe(
                    (ans) => {
                        this.state.isBusy = false;
                        this.emitChange();
                    },
                    (err) => {
                        this.state.isBusy = false;
                        this.layoutModel.showMessage('error', err);
                        this.emitChange();
                    }
                );
            }
        }
    }

    private getConcSize():number {
        return this.concLineModel.getConcSummary().concSize;
    }

    private loadData(args:MultiDict):Observable<boolean> {

        return (() => {
            if (this.getConcSize() > TextTypesDistModel.SAMPLE_SIZE) {
                args.set('rlines', TextTypesDistModel.SAMPLE_SIZE);
                args.set('format', 'json');
                this.state.lastArgs = args.head('q');
                return this.layoutModel.ajax$<Response.Reduce>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl('reduce'),
                    args
                );

            } else {
                return rxOf({});
            }
        })().pipe(
            map((reduceAns) => [reduceAns, this.layoutModel.getConcArgs()] as [Response.Reduce, MultiDict]),
            concatMap(([reduceAns, args]) => {  // TODO side effects here
                this.state.ttCrit.forEach(v => args.add(v[0], v[1]));
                this.state.flimit = this.concLineModel.getRecommOverviewMinFreq();
                args.set('ml', 0);
                args.set('flimit', this.state.flimit);
                args.set('force_cache', '1');
                args.set('format', 'json');
                if (reduceAns.conc_persistence_op_id) {
                    this.state.sampleSize = reduceAns.sampled_size;
                    args.set('q', `~${reduceAns.conc_persistence_op_id}`);
                }
                return this.layoutModel.ajax$<Response.FreqData>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl('freqs'),
                    args
                );
            }),
            tap((data) => {
                this.state.blocks = pipe(
                    data.Blocks,
                    List.filter(block => block.Items.length > 0),
                    List.map(block => {
                        const sumRes = block.Items.reduce((r, v) => r + v.rel, 0);
                        return {
                            label: block.Head && block.Head[0] ? block.Head.length > 0 && block.Head[0].n : null,
                            items: block.Items.sort((v1, v2) => v2.rel - v1.rel).map((v, i) => {
                                return {
                                    value: v.Word.map(v => v.n).join(', '),
                                    ipm: v.rel,
                                    abs: v.freq,
                                    barWidth: ~~Math.round(v.rel / sumRes * TextTypesDistModel.IPM_BAR_WIDTH),
                                    color: TextTypesDistModel.COLORS[i % TextTypesDistModel.COLORS.length]
                                };
                            })
                        };
                    })
                );
            }),
            map(_ => true)
        );
    }

    static getDisplayableBlocks(state:TextTypesDistModelState):Array<FreqBlock> {
        return List.filter(
            block => block.items.length <= state.maxBlockItems || state.maxBlockItems === -1,
            state.blocks
        );
    }

    static isDisplayedBlocksSubset(state:TextTypesDistModelState):boolean {
        return state.blocks.length > TextTypesDistModel.getDisplayableBlocks(state).length;
    }

    static shouldDisplayBlocksSubset(state:TextTypesDistModelState):boolean {
        return List.find(block => block.items.length > state.maxBlockItems, state.blocks) !== undefined;
    }
}