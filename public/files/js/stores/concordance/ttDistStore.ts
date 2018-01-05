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

/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../../types/common.d.ts" />


import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';
import {SimplePageStore} from '../base';
import {PageModel} from '../../app/main';
import {MultiDict} from '../../util';
import {ConcLineStore} from './lines';

export type TTCrit = Array<[string, string]>;

export interface TextTypesDistStoreProps {
    ttCrit:TTCrit;
}

export interface FreqItem {
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

export interface FreqBlock {
    Total:number;
    TotalPages:number;
    Items:Array<FreqItem>;
    Head:Array<{s:string; n:string}>;
}

export interface FreqDataResponse {
    FCrit:TTCrit;
    Blocks:Array<FreqBlock>;
    paging:number;
    concsize:number;
    fmaxitems:number;
    quick_from_line:number;
    quick_to_line:number;
}


export class TextTypesDistStore extends SimplePageStore {

    private static SAMPLE_SIZE = 10000;

    private layoutModel:PageModel;

    private ttCrit:TTCrit;

    private blocks:Immutable.List<FreqBlock>;

    private flimit:number;

    private sampleSize:number;

    private isBusy:boolean;

    private concLineStore:ConcLineStore;

    constructor(dispatcher:Kontext.FluxDispatcher, layoutModel:PageModel, concLineStore:ConcLineStore, props:TextTypesDistStoreProps) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.concLineStore = concLineStore;
        this.ttCrit = props.ttCrit;
        this.blocks = Immutable.List<FreqBlock>();
        this.flimit = 100; // TODO
        this.isBusy = false;
        this.sampleSize = 0;
        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW':
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.loadData().then(
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
                break;
            }
        });
    }

    private getConcSize():number {
        return this.concLineStore.getConcSummary().fullSize;
    }

    private calcMinFreq():number {
        if (this.getConcSize() > 1000) {
            return 100;

        } else if (this.getConcSize() > 100) {
            return 10;
        }
        return 1;
    }

    private loadData():RSVP.Promise<boolean> {

        return (() => {
            if (this.getConcSize() > TextTypesDistStore.SAMPLE_SIZE) {
                const args = this.layoutModel.getConcArgs();
                args.set('rlines', TextTypesDistStore.SAMPLE_SIZE);
                args.set('format', 'json');
                return this.layoutModel.ajax<any>(
                    'GET',
                    this.layoutModel.createActionUrl('reduce'),
                    args
                );

            } else {
                return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                    resolve({});
                });
            }
        })().then(
            (reduceAns) => {  // TODO  types !!!
                const args = this.layoutModel.getConcArgs();
                this.ttCrit.forEach(v => args.add(v[0], v[1]));
                this.flimit = this.calcMinFreq();
                args.set('ml', 0);
                args.set('flimit', this.flimit);
                args.set('format', 'json');
                if (reduceAns['conc_persistence_op_id']) {
                    this.sampleSize = reduceAns['sampled_size'];
                    args.set('q', `~${reduceAns['conc_persistence_op_id']}`);
                }
                return this.layoutModel.ajax<FreqDataResponse>(
                    'GET',
                    this.layoutModel.createActionUrl('freqs'),
                    args
                );
            }
        ).then(
            (data) => {
                this.blocks = Immutable.List<FreqBlock>(data.Blocks);
                return true;
            }
        );
    }

    getBlocks():Immutable.List<FreqBlock> {
        return this.blocks;
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
}