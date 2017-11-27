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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/ajaxResponses.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {SimplePageStore} from '../base';
import {PageModel} from '../../pages/document';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';
import {FreqFormInputs} from './freqForms';
import {FreqResultsSaveStore} from './save';
import {MultiDict} from '../../util';


export interface ResultItem {
    idx:number;
    Word:Immutable.List<string>;
    pfilter:Immutable.List<[string, string]>;
    nfilter:Immutable.List<[string, string]>;
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


export class FreqDataRowsStore extends SimplePageStore {

    private pageModel:PageModel;

    private data:Immutable.List<ResultBlock>;

    private currentPage:string;

    private sortColumn:string

    private freqCrit:Array<[string, string]>;

    private fttattr:Array<string>;

    private ftt_include_empty:boolean;

    private flimit:string;

    private mlxattr:Array<string>;

    private mlxicase:Array<boolean>;

    private mlxctx:Array<string>;

    private alignType:Array<string>;

    private saveStore:FreqResultsSaveStore;

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, freqCrit:Array<[string, string]>,
            formProps:FreqFormInputs, saveLinkFn:(string)=>void) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.data = Immutable.List<ResultBlock>();
        this.freqCrit = freqCrit;
        this.currentPage = null;
        this.sortColumn = formProps.freq_sort;
        this.fttattr = formProps.fttattr;
        this.ftt_include_empty = formProps.ftt_include_empty;
        this.flimit = formProps.flimit || '0';
        this.mlxattr = formProps.mlxattr;
        this.mlxicase = formProps.mlxicase;
        this.mlxctx = formProps.mlxctx;
        this.alignType = formProps.alignType;
        this.saveStore = new FreqResultsSaveStore(
            dispatcher,
            pageModel,
            ()=>this.getSubmitArgs(),
            saveLinkFn
        );

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_RESULT_SET_MIN_FREQ_VAL':
                    if (this.validateNumber(payload.props['value'], 0)) {
                        this.flimit = payload.props['value'];

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__limit_invalid_val'));
                    }
                    this.notifyChangeListeners();
                break;
                case 'FREQ_RESULT_APPLY_MIN_FREQ':
                    this.loadPage().then(
                        (data) => {
                            if (data.contains_errors) {
                                this.pageModel.showMessage('error', data.messages);
                            }
                            this.notifyChangeListeners();

                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'FREQ_RESULT_SORT_BY_COLUMN':
                    this.sortColumn = payload.props['value'];
                    this.loadPage().then(
                        (data) => {
                            if (!data.contains_errors) {
                                this.notifyChangeListeners();

                            } else {
                                this.pageModel.showMessage('error', data.messages);
                                this.notifyChangeListeners();
                            }
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'FREQ_RESULT_SET_CURRENT_PAGE':
                    if (this.validateNumber(payload.props['value'], 1)) {
                        this.currentPage = payload.props['value'];
                        this.loadPage().then(
                            (data) => {
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.pageModel.showMessage('error', err);
                                this.notifyChangeListeners();
                            }
                        );

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('freq__page_invalid_val'));
                        this.notifyChangeListeners();
                     }
                break;
                case 'FREQ_RESULT_APPLY_QUICK_FILTER':
                    this.applyQuickFilter(payload.props['args']);
                    // a new page is loaded here
                break;
            }
        });
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
        args.set('fpage', this.currentPage);
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
                        pfilter: Immutable.List<[string, string]>(item.pfilter),
                        nfilter: Immutable.List<[string, string]>(item.nfilter),
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

    private applyQuickFilter(args:Array<[string, string]>) {
        const submitArgs = this.pageModel.getConcArgs();
        submitArgs.remove('q2');
        args.forEach(item => submitArgs.add(item[0], item[1]));
        window.location.href = this.pageModel.createActionUrl('quick_filter', submitArgs.items());
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

    hasPrevPage():boolean {
        return Number(this.currentPage) > 1 && this.data.get(0).TotalPages > 1;
    }

    getSaveStore():FreqResultsSaveStore {
        return this.saveStore;
    }

}