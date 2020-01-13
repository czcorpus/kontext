/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
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

import {FreqResultResponse} from '../../types/ajaxResponses';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/page';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {FreqFormInputs} from './freqForms';
import {FreqResultsSaveModel} from './save';
import {MultiDict} from '../../util';
import { Action, IFullActionControl } from 'kombo';


export interface ResultItem {
    idx:number;
    Word:Immutable.List<string>;
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
}

export interface ResultBlock {
    TotalPages:number;
    Total:number;
    Items:Immutable.List<ResultItem>;
    Head:Immutable.List<ResultHeader>;
}

export interface FreqDataRowsModelArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqCrit:Array<[string, string]>;
    formProps:FreqFormInputs;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
}


export class FreqDataRowsModel extends StatefulModel {

    private pageModel:PageModel;

    private data:Immutable.List<ResultBlock>;

    private currentPage:string;

    private sortColumn:string

    private freqCrit:Array<[string, string]>;

    private ftt_include_empty:boolean;

    private flimit:string;

    private saveModel:FreqResultsSaveModel;

    constructor({dispatcher, pageModel, freqCrit, formProps, saveLinkFn,
                quickSaveRowLimit}:FreqDataRowsModelArgs) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.data = Immutable.List<ResultBlock>();
        this.freqCrit = freqCrit;
        this.currentPage = null;
        this.sortColumn = formProps.freq_sort;
        this.ftt_include_empty = formProps.ftt_include_empty;
        this.flimit = formProps.flimit || '0';
        this.saveModel = new FreqResultsSaveModel({
            dispatcher: dispatcher,
            layoutModel: pageModel,
            freqArgsProviderFn: ()=>this.getSubmitArgs(),
            saveLinkFn: saveLinkFn,
            quickSaveRowLimit: quickSaveRowLimit
        });

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'FREQ_RESULT_SET_MIN_FREQ_VAL':
                    if (this.validateNumber(action.payload['value'], 0)) {
                        this.flimit = action.payload['value'];

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__limit_invalid_val'));
                    }
                    this.emitChange();
                break;
                case 'FREQ_RESULT_APPLY_MIN_FREQ':
                    this.loadPage().then(
                        (data) => {
                            this.currentPage = '1';
                            this.pushStateToHistory();
                            this.emitChange();

                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                            this.emitChange();
                        }
                    );
                break;
                case 'FREQ_RESULT_SORT_BY_COLUMN':
                    this.sortColumn = action.payload['value'];
                    this.loadPage().then(
                        (data) => {
                            this.emitChange();
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                            this.emitChange();
                        }
                    );
                break;
                case 'FREQ_RESULT_SET_CURRENT_PAGE':
                    if (this.validateNumber(action.payload['value'], 1)) {
                        this.currentPage = action.payload['value'];
                        this.loadPage().then(
                            (data) => {
                                this.emitChange();
                            },
                            (err) => {
                                this.pageModel.showMessage('error', err);
                                this.emitChange();
                            }
                        );

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__page_invalid_val'));
                        this.emitChange();
                     }
                break;
            }
        });
    }

    private pushStateToHistory():void {
        const args = this.getSubmitArgs();
        args.remove('format');
        this.pageModel.getHistory().pushState(
            'freqs',
            args,
            {},
            window.document.title
        );
    }

    validateNumber(v:string, minNum:number):boolean {
        if (v === '') {
            return true;

        } else if (/^(0|[1-9][0-9]*)$/.exec(v) !== null) {
            return parseInt(v) >= minNum;
        }
        return false;
    }

    getSubmitArgs():MultiDict {
        const args = this.pageModel.getConcArgs();
        args.remove('fcrit');
        this.freqCrit.forEach((item) => {
            args.add(item[0], item[1]);
        });
        args.set('flimit', this.flimit);
        args.set('freq_sort', this.sortColumn);
        // fpage: for client, null means 'multi-block' output, for server '1' must be filled in
        args.set('fpage', this.currentPage !== null ? this.currentPage : '1');
        args.set('ftt_include_empty', this.ftt_include_empty);
        args.set('format', 'json');
        return args;
    }

    loadPage():RSVP.Promise<FreqResultResponse.FreqResultResponse> {
        return this.pageModel.ajax<FreqResultResponse.FreqResultResponse>(
            'GET',
            this.pageModel.createActionUrl('freqs'),
            this.getSubmitArgs()

        ).then(
            (data) => {
                this.importData(data['Blocks'], data['fmaxitems'],  Number(this.currentPage));
                return data;
            }
        )
    }


    importData(data:Array<FreqResultResponse.Block>, pageSize:number, pageNumber:number):void {
        this.data = this.data.clear();
        data.forEach(item => {
            this.data = this.data.push({
                Items: Immutable.List<ResultItem>(item.Items.map((item, i) => {
                    return {
                        idx: i + this.getCurrentPageIdx() * pageSize,
                        Word: Immutable.List<string>(item.Word.map(x => x.n)),
                        pfilter: this.createQuickFilterUrl(item.pfilter),
                        nfilter: this.createQuickFilterUrl(item.nfilter),
                        fbar: item.fbar,
                        freqbar: item.freqbar,
                        rel: item.rel,
                        relbar: item.relbar,
                        freq: item.freq,
                        nbar: item.nbar,
                        norm: item.norm,
                        norel: item.norel
                    }
                })),
                Head: Immutable.List<ResultHeader>(item.Head),
                TotalPages: item.TotalPages,
                Total: item.Total
            });
        });
        if (this.data.size === 1) {
            this.currentPage = String(pageNumber);
        }
    }

    private createQuickFilterUrl(args:Array<[string, string]>):string {
        if (args && args.length > 0) {
            const submitArgs = this.pageModel.getConcArgs();
            submitArgs.remove('q2');
            args.forEach(item => submitArgs.add(item[0], item[1]));
            return this.pageModel.createActionUrl('quick_filter', submitArgs.items());

        } else {
            return null;
        }
    }

    getBlocks():Immutable.List<ResultBlock> {
        return this.data;
    }

    getMinFreq():string {
        return this.flimit;
    }

    getCurrentPage():string {
        return this.currentPage;
    }

    getCurrentPageIdx():number {
        if (!isNaN(parseInt(this.currentPage))) {
            return parseInt(this.currentPage) - 1;
        }
        return 0;
    }

    getSortColumn():string {
        return this.sortColumn;
    }

    hasNextPage():boolean {
        return Number(this.currentPage) < this.data.get(0).TotalPages;
    }

    getTotalPages():number {
        return this.data.get(0).TotalPages;
    }

    hasPrevPage():boolean {
        return Number(this.currentPage) > 1 && this.data.get(0).TotalPages > 1;
    }

    getSaveModel():FreqResultsSaveModel {
        return this.saveModel;
    }

}