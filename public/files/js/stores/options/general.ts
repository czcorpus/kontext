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
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import {SimplePageStore} from '../base';
import * as Immutable from 'vendor/immutable';
import {PageModel} from '../../app/main';
import {ActionDispatcher} from '../../app/dispatcher';
import {MultiDict} from '../../util';


interface ViewOptsResponse extends Kontext.AjaxResponse {
    pagesize:number;
    newctxsize:number;
    ctxunit:string;
    line_numbers:number;
    shuffle:number;
    wlpagesize:number;
    fmaxitems:number;
    citemsperpage:number;
    tt_overview:number;
    cql_editor:number;
}


export class GeneralViewOptionsStore extends SimplePageStore implements ViewOptions.IGeneralViewOptionsStore {

    private layoutModel:PageModel;

    // ---- concordance opts

    private pageSize:string;

    private newCtxSize:string;

    private ctxUnit:string;

    private lineNumbers:boolean;

    private shuffle:boolean;

    private showTTOverview:boolean;

    private useCQLEditor:boolean;

    // --- word list opts

    private wlpagesize:string;

    // --- freq. page opts

    private fmaxitems:string;

    // ---- coll. page opts

    private citemsperpage:string;

    private isBusy:boolean;

    private submitResponseHandlers:Immutable.List<(store:ViewOptions.IGeneralViewOptionsStore)=>void>;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.submitResponseHandlers = Immutable.List<()=>void>();
        this.isBusy = false;

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'GENERAL_VIEW_OPTIONS_SET_PAGESIZE':
                    this.pageSize = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_CONTEXTSIZE':
                    this.newCtxSize = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_LINE_NUMS':
                    this.lineNumbers = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE':
                    this.shuffle = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_SHOW_TT_OVERVIEW':
                    this.showTTOverview = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_USE_CQL_EDITOR':
                    this.useCQLEditor = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_WLPAGESIZE':
                    this.wlpagesize = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_FMAXITEMS':
                    this.fmaxitems = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_CITEMSPERPAGE':
                    this.citemsperpage = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_TT_OVERVIEW_VISIBILITY':
                    this.showTTOverview = payload.props['value'];
                    this.submitTTOverview().then(
                        (_) => {
                            this.notifyChangeListeners();
                            this.submitResponseHandlers.forEach(fn => fn(this));
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'GENERAL_VIEW_OPTIONS_SUBMIT':
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.submit().then(
                        () => {
                            this.isBusy = false;
                            this.notifyChangeListeners();
                            this.submitResponseHandlers.forEach(fn => fn(this));
                        },
                        (err) => {
                            this.isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    );

                break;
            }
        });
    }

    private submitTTOverview():RSVP.Promise<Kontext.AjaxResponse> {
        return this.layoutModel.ajax<Kontext.AjaxResponse>(
            'POST',
            this.layoutModel.createActionUrl('options/set_tt_overview'),
            {tt_overview: this.showTTOverview ? '1' : '0'}
        );
    }

    addOnSubmitResponseHandler(fn:(store:ViewOptions.IGeneralViewOptionsStore)=>void):void {
        this.submitResponseHandlers = this.submitResponseHandlers.push(fn);
    }

    loadData():RSVP.Promise<boolean> {
        return this.layoutModel.ajax<ViewOptsResponse>(
            'GET',
            this.layoutModel.createActionUrl('options/viewopts'),
            {}

        ).then(
            (data) => {
                this.pageSize = String(data.pagesize);
                this.newCtxSize = String(data.newctxsize);
                this.ctxUnit = data.ctxunit;
                this.lineNumbers = !!data.line_numbers;
                this.shuffle = !!data.shuffle;
                this.wlpagesize = String(data.wlpagesize);
                this.fmaxitems = String(data.fmaxitems);
                this.citemsperpage = String(data.citemsperpage);
                this.showTTOverview = !!data.tt_overview;
                this.useCQLEditor = !!data.cql_editor;
                return true;
            }
        );
    }

    private submit():RSVP.Promise<Kontext.AjaxResponse> {
        const args = new MultiDict();
        args.set('pagesize', this.pageSize);
        args.set('newctxsize', this.newCtxSize);
        args.set('ctxunit', this.ctxUnit);
        args.set('line_numbers', this.lineNumbers ? '1' : '0');
        args.set('shuffle', this.shuffle ? '1' : '0');
        args.set('wlpagesize', this.wlpagesize);
        args.set('fmaxitems', this.fmaxitems);
        args.set('citemsperpage', this.citemsperpage);
        args.set('tt_overview', this.showTTOverview ? '1' : '0');
        args.set('cql_editor', this.useCQLEditor ? '1' : '0');
        return this.layoutModel.ajax<Kontext.AjaxResponse>(
            'POST',
            this.layoutModel.createActionUrl('options/viewoptsx'),
            args

        ).then(
            (d) => {
                this.layoutModel.replaceConcArg('pagesize', [this.pageSize]);
                return d;
            }
        )
    }

    getPageSize():string {
        return this.pageSize;
    }

    getNewCtxSize():string {
        return this.newCtxSize;
    }

    getLineNumbers():boolean {
        return this.lineNumbers;
    }

    getShuffle():boolean {
        return this.shuffle;
    }

    getWlPageSize():string {
        return this.wlpagesize;
    }

    getFmaxItems():string {
        return this.fmaxitems;
    }

    getCitemsPerPage():string {
        return this.citemsperpage;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getShowTTOverview():boolean {
        return this.showTTOverview;
    }

    getUseCQLEditor():boolean {
        return this.useCQLEditor;
    }
}
