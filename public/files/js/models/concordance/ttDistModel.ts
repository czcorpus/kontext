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

import {Kontext} from '../../types/common';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {MultiDict} from '../../util';
import {ConcLineModel} from './lines';

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



export class TextTypesDistModel extends StatefulModel {

    private static SAMPLE_SIZE = 10000;

    private static IPM_BAR_WIDTH = 400;

    private static COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
                             "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

    private static DEFAULT_MAX_BLOCK_ITEMS = 10;

    private layoutModel:PageModel;

    private ttCrit:TTCrit;

    private blocks:Immutable.List<FreqBlock>;

    private flimit:number;

    private sampleSize:number;

    private isBusy:boolean;

    private concLineModel:ConcLineModel;

    private blockedByAsyncConc:boolean;

    private lastArgs:string;

    private maxBlockItems:number;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, concLineModel:ConcLineModel, props:TextTypesDistModelProps) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.concLineModel = concLineModel;
        this.ttCrit = props.ttCrit;
        this.blocks = Immutable.List<FreqBlock>();
        this.flimit = 100; // this is always recalculated according to data
        this.sampleSize = 0;
        this.maxBlockItems = TextTypesDistModel.DEFAULT_MAX_BLOCK_ITEMS;
        this.blockedByAsyncConc = this.concLineModel.isUnfinishedCalculation();
        this.isBusy = this.concLineModel.isUnfinishedCalculation();
        this.dispatcherRegister((payload:ActionPayload) => {
            switch (payload.actionType) {
                case '@CONCORDANCE_ASYNC_CALCULATION_UPDATED':
                    this.blockedByAsyncConc = payload.props['isUnfinished'];
                    this.performDataLoad();
                break;
                case 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW':
                    this.performDataLoad();
                break;
                case 'REMOVE_CHART_ITEMS_LIMIT':
                    this.maxBlockItems = -1;
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private performDataLoad():void {
        const args = this.layoutModel.getConcArgs();
        if (this.lastArgs !== args.getFirst('q')) {
            this.isBusy = true;
            this.notifyChangeListeners();
            this.loadData(args).then(
                (ans) => {
                    this.isBusy = false;
                    this.notifyChangeListeners();
                },
                (err) => {
                    this.isBusy = false;
                    this.layoutModel.showMessage('error', err);
                    this.notifyChangeListeners();
                }
            );
        }
    }

    private getConcSize():number {
        return this.concLineModel.getConcSummary().concSize;
    }

    private calcMinFreq():number {
        if (this.getConcSize() > 1000) {
            return 100;

        } else if (this.getConcSize() > 100) {
            return 10;
        }
        return 1;
    }

    private loadData(args:MultiDict):RSVP.Promise<boolean> {

        return (() => {
            if (this.getConcSize() > TextTypesDistModel.SAMPLE_SIZE) {
                args.set('rlines', TextTypesDistModel.SAMPLE_SIZE);
                args.set('format', 'json');
                this.lastArgs = args.getFirst('q');
                return this.layoutModel.ajax<any>(
                    'GET',
                    this.layoutModel.createActionUrl('reduce'),
                    args
                );

            } else {
                return RSVP.Promise.resolve({});
            }
        })().then(
            (reduceAns:Response.Reduce) => {
                const args = this.layoutModel.getConcArgs();
                this.ttCrit.forEach(v => args.add(v[0], v[1]));
                this.flimit = this.calcMinFreq();
                args.set('ml', 0);
                args.set('flimit', this.flimit);
                args.set('force_cache', '1');
                args.set('format', 'json');
                if (reduceAns.conc_persistence_op_id) {
                    this.sampleSize = reduceAns.sampled_size;
                    args.set('q', `~${reduceAns.conc_persistence_op_id}`);
                }
                return this.layoutModel.ajax<Response.FreqData>(
                    'GET',
                    this.layoutModel.createActionUrl('freqs'),
                    args
                );
            }
        ).then(
            (data) => {
                this.blocks = Immutable.List<FreqBlock>(
                    data.Blocks.filter(block => block.Items.length > 0).map(block => {
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
                return true;
            }
        );
    }

    getBlocks():Immutable.List<FreqBlock> {
        return this.blocks;
    }

    getDisplayableBlocks():Immutable.List<FreqBlock> {
        return this.blocks.filter(block => block.items.length <= this.maxBlockItems || this.maxBlockItems === -1).toList();
    }

    isDisplayedBlocksSubset():boolean {
        return this.getBlocks().size > this.getDisplayableBlocks().size;
    }

    getMaxChartItems():number {
        return this.maxBlockItems;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getMinFreq():number {
        return this.flimit;
    }

    getSampleSize():number {
        return this.sampleSize;
    }

    getBlockedByAsyncConc():boolean {
        return this.blockedByAsyncConc;
    }
}