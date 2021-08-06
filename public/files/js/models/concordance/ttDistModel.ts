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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { map, concatMap, tap } from 'rxjs/operators';
import { pipe, List, HTTP, tuple } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { ConcordanceModel } from './main';
import { Actions as ConcActions } from '../../models/concordance/actions';
import { SampleServerArgs } from '../query/common';
import { FreqServerArgs } from '../freqs/common';


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
    maxBlockItems:number;
    isBusy:boolean;
    blockedByAsyncConc:boolean;
    lastArgs:string;
}


export class TextTypesDistModel extends StatefulModel<TextTypesDistModelState> {

    private static SAMPLE_SIZE = 100000;

    private static IPM_BAR_WIDTH = 400;

    private static COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
                             '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

    private static DEFAULT_MAX_BLOCK_ITEMS = 10;

    private readonly layoutModel:PageModel;

    private readonly concLineModel:ConcordanceModel;


    constructor(dispatcher:IFullActionControl, layoutModel:PageModel,
            concLineModel:ConcordanceModel, props:TextTypesDistModelProps) {
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

        this.addActionHandler<typeof ConcActions.AsyncCalculationUpdated>(
            ConcActions.AsyncCalculationUpdated.name,
            action => {
                this.state.blockedByAsyncConc = !action.payload.finished;
                this.suspendWithTimeout(5000, {}, (action, syncData) => {
                    if (ConcActions.isConcordanceRecalculationReady(action)) {
                        return null;
                    }
                    return syncData;

                }).subscribe(
                    action => {
                        if (ConcActions.isConcordanceRecalculationReady(action)) {
                            this.performDataLoad(action.payload.concSize, action.payload.overviewMinFreq);
                        }
                    },
                    error => {
                        this.layoutModel.showMessage('error', error);
                    }
                );
            }
        );

        this.addActionHandler<typeof ConcActions.LoadTTDictOverview>(
            ConcActions.LoadTTDictOverview.name,
            action => {
                if (this.state.blocks.length === 0) {
                    this.suspendWithTimeout(5000, {}, (action, syncData) => {
                        if (ConcActions.isConcordanceRecalculationReady(action)) {
                            return null;
                        }
                        return syncData;

                    }).subscribe(
                        action => {
                            if (ConcActions.isConcordanceRecalculationReady(action)) {
                                this.performDataLoad(action.payload.concSize, action.payload.overviewMinFreq);
                            }
                        },
                        error => {
                            this.layoutModel.showMessage('error', error);
                        }
                    );
                }
            }
        );

        this.addActionHandler<typeof ConcActions.RemoveChartItemsLimit>(
            ConcActions.RemoveChartItemsLimit.name,
            action => {
                this.state.maxBlockItems = -1;
                this.emitChange();
            }
        );

        this.addActionHandler<typeof ConcActions.RestoreChartItemsLimit>(
            ConcActions.RestoreChartItemsLimit.name,
            action => {
                this.state.maxBlockItems = TextTypesDistModel.DEFAULT_MAX_BLOCK_ITEMS;
                this.emitChange();
            }
        );
    }

    private performDataLoad(concSize:number, flimit:number):void {
        if (!this.state.blockedByAsyncConc && concSize > 0) {
            const args = this.layoutModel.exportConcArgs();
            if (this.state.lastArgs !== args.head('q')) {
                this.state.isBusy = true;
                this.emitChange();
                this.loadData(args, concSize, flimit).subscribe(
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

    private loadData(args:MultiDict<SampleServerArgs>, concSize:number, flimit:number):Observable<boolean> {

        return (() => {
            if (concSize > TextTypesDistModel.SAMPLE_SIZE) {
                args.set('rlines', TextTypesDistModel.SAMPLE_SIZE);
                args.set('format', 'json');
                this.state.lastArgs = args.head('q');
                return this.layoutModel.ajax$<Response.Reduce>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl('reduce', args),
                    {}
                );

            } else {
                return rxOf({sampled_size: 0, conc_persistence_op_id: ''});
            }
        })().pipe(
            map(
                (reduceAns) => tuple(reduceAns, this.layoutModel.exportConcArgs() as MultiDict<FreqServerArgs>)
            ),
            concatMap(([reduceAns, args]) => {  // TODO side effects here
                this.state.ttCrit.forEach(([key, value]) => args.add(key, value));
                this.state.flimit = flimit;
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
                            label: block.Head && block.Head[0] ?
                                block.Head.length > 0 && block.Head[0].n :
                                null,
                            items: pipe(
                                block.Items,
                                List.sortBy(v => v.rel),
                                List.map((v, i) => ({
                                    value: v.Word.map(v => v.n).join(', '),
                                    ipm: v.rel,
                                    abs: v.freq,
                                    barWidth: Math.round(
                                        v.rel / sumRes * TextTypesDistModel.IPM_BAR_WIDTH),
                                    color: TextTypesDistModel.COLORS[
                                        i % TextTypesDistModel.COLORS.length]
                                }))
                            )
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
        return List.some(
            block => block.items.length > state.maxBlockItems,
            state.blocks
        );
    }
}