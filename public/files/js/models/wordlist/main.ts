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

import {Kontext} from '../../types/common';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {StatefulModel, validateGzNumber} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, Action} from '../../app/dispatcher';
import {WordlistFormModel} from './form';
import {MultiDict} from '../../util';
import {WordlistSaveModel} from './save';


export type ResultData = {
    data:Array<ResultItem>,
    page:number;
    pageSize:number;
    isLastPage:boolean;
}


export interface ResultItem {
    freq:number;
    str:string;
}

export interface IndexedResultItem extends ResultItem {
    idx:number;
}

export interface HeadingItem {
    str:string;
    sortKey:string;
}


export interface DataAjaxResponse extends Kontext.AjaxResponse {
    Items:Array<ResultItem>;
    lastpage:number; // 0 = no, 1 = yes
}


export interface WlSizeAjaxResponse extends Kontext.AjaxResponse {
    size:number;
}


/**
 *
 */
export class WordlistResultModel extends StatefulModel {

    layoutModel:PageModel;

    formModel:WordlistFormModel;

    data:Immutable.List<IndexedResultItem>;

    headings:Immutable.List<HeadingItem>;

    currPage:number;

    currPageInput:string;

    pageSize:number;

    isLastPage:boolean;

     /*
      * this is not obtained automatically as a
      * respective Manatee result object does not
      * provide this. We fetch this by user's
      * explicit request (when going to the last page)
      */
    private numItems:number;

    isBusy:boolean;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, formModel:WordlistFormModel,
            data:ResultData, headings:Array<HeadingItem>) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.formModel = formModel;
        this.currPage = data.page;
        this.currPageInput = String(this.currPage);
        this.pageSize = data.pageSize;
        this.isLastPage = data.isLastPage;
        this.data = this.importData(data.data);
        this.headings = Immutable.List<HeadingItem>(headings);
        this.isBusy = false;
        this.numItems = null;


        dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'WORDLIST_RESULT_VIEW_CONC':
                    const args = new MultiDict();
                    args.set('corpname', this.formModel.getCorpusIdent().id);
                    args.set('usesubcorp', this.formModel.getCurrentSubcorpus());
                    args.set('default_attr', this.formModel.getWlattr());
                    args.set('qmcase', '1');
                    args.set('queryselector', 'cqlrow');
                    args.set('cql', this.createPQuery(action.props['word']));
                    window.location.href = this.layoutModel.createActionUrl('first', args.items());
                break;
                case 'WORDLIST_RESULT_RELOAD':
                    this.processPageLoad();
                break;
                case 'WORDLIST_RESULT_NEXT_PAGE':
                    if (!this.isLastPage) {
                        this.currPage += 1;
                        this.currPageInput = String(this.currPage);
                        this.processPageLoad();

                    } else {
                        this.layoutModel.showMessage('error',
                                this.layoutModel.translate('wordlist__page_not_found_err'));
                    }
                break;
                case 'WORDLIST_RESULT_PREV_PAGE':
                    if (this.currPage > 1) {
                        this.currPage -= 1;
                        this.currPageInput = String(this.currPage);
                        this.processPageLoad();

                    } else {
                        this.layoutModel.showMessage('error',
                                this.layoutModel.translate('wordlist__page_not_found_err'));
                    }
                break;
                case 'WORDLIST_RESULT_SET_PAGE':
                    if (validateGzNumber(action.props['page'])) {
                        this.currPageInput = action.props['page'];

                    } else {
                        this.layoutModel.showMessage('error',
                                this.layoutModel.translate('wordlist__invalid_page_num'));
                    }
                    this.notifyChangeListeners();
                break;
                case 'WORDLIST_RESULT_CONFIRM_PAGE':
                    this.currPage = parseInt(this.currPageInput, 10);
                    this.processPageLoad();
                break;
                case 'WORDLIST_GO_TO_LAST_PAGE':
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.fetchLastPage().then(
                        (ans) => {
                            this.processPageLoad();
                        }
                    ).catch(
                        (err) => {
                            this.isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    )
                break;
                case 'WORDLIST_GO_TO_FIRST_PAGE':
                    this.currPageInput = '1';
                    this.currPage = 1;
                    this.processPageLoad();
                break;
            }
        });
    }

    private fetchLastPage():RSVP.Promise<boolean> {
        const args = this.formModel.createSubmitArgs();
        return (() => {
            if (this.numItems === null) {
                return this.layoutModel.ajax<WlSizeAjaxResponse>(
                    'GET',
                    this.layoutModel.createActionUrl('ajax_get_wordlist_size'),
                    args

                );

            } else {
                return new RSVP.Promise<WlSizeAjaxResponse>((resolve:(d)=>void, reject:(err)=>void) => {
                    resolve({
                        messages: [],
                        size: this.numItems
                    });
                });
            }
        })().then(
            (data) => {
                this.numItems = data.size;
                this.currPage = ~~Math.ceil(this.numItems / this.pageSize);
                this.currPageInput = String(this.currPage);
                return true;
            }
        );
    }

    private createPQuery(s:string):string {
        return `[${this.formModel.getWlattr()}="${s.replace(/([.?+*\[\]{}])/g, '\\$1')}"]`;
    }

    private processPageLoad():void {
        this.isBusy = true;
        this.notifyChangeListeners();
        this.loadData().then(
            () => {
                this.isBusy = false;
                this.notifyChangeListeners();
            }
        ).catch(
            (err) => {
                this.isBusy = false;
                this.layoutModel.showMessage('error', err);
                this.notifyChangeListeners();
            }
        );
    }

    private importData(data:Array<ResultItem>):Immutable.List<IndexedResultItem> {
        return Immutable.List<IndexedResultItem>(data.map((item, i) => {
            return {
                freq: item.freq,
                str: item.str,
                idx: (this.currPage - 1) * this.pageSize + i
            }
        }));
    }

    private loadData():RSVP.Promise<DataAjaxResponse> {
        const args = this.formModel.createSubmitArgs();
        args.set('wlpage', this.currPage);
        args.set('format', 'json');

        return this.layoutModel.ajax<DataAjaxResponse>(
            'POST',
            this.layoutModel.createActionUrl('wordlist/result'),
            args

        ).then(
            (data) => {
                if (data.lastpage && data.Items.length === 0) {
                    throw new Error(this.layoutModel.translate('wordlist__page_not_found_err'));
                }
                this.data = this.importData(data.Items);
                this.isLastPage = !!data.lastpage;
                return data;
            }
        );
    }

    getData():Immutable.List<IndexedResultItem> {
        return this.data;
    }

    getHeadings():Immutable.List<HeadingItem> {
        return this.headings;
    }

    getCurrPageInput():string {
        return this.currPageInput;
    }

    getIsLastPage():boolean {
        return this.isLastPage;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    usesStructAttr():boolean {
        return this.formModel.getWlattr().indexOf('.') > -1;
    }

    getWlsort():string {
        return this.formModel.getWlsort();
    }
}