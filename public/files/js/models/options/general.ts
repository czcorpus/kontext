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

import {Kontext, ViewOptions} from '../../types/common';
import {StatefulModel, validateGzNumber} from '../base';
import * as Immutable from 'immutable';
import {PageModel} from '../../app/page';
import {MultiDict} from '../../util';
import { Action, IFullActionControl } from 'kombo';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';


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


export class GeneralViewOptionsModel extends StatefulModel implements ViewOptions.IGeneralViewOptionsModel {

    private static readonly MAX_ITEMS_PER_PAGE = 500;

    private static readonly MAX_CTX_SIZE = 100;

    private layoutModel:PageModel;

    // ---- concordance opts

    private pageSize:Kontext.FormValue<string>;

    private newCtxSize:Kontext.FormValue<string>;

    private ctxUnit:string;

    private lineNumbers:boolean;

    private shuffle:boolean;

    private useCQLEditor:boolean;

    // --- word list opts

    private wlpagesize:Kontext.FormValue<string>;

    // --- freq. page opts

    private fmaxitems:Kontext.FormValue<string>;

    // ---- coll. page opts

    private citemsperpage:Kontext.FormValue<string>;

    private isBusy:boolean;

    private userIsAnonymous:boolean;

    private submitResponseHandlers:Immutable.List<(store:ViewOptions.IGeneralViewOptionsModel)=>void>;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel, userIsAnonymous:boolean) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.userIsAnonymous = userIsAnonymous;
        this.submitResponseHandlers = Immutable.List<()=>void>();
        this.isBusy = false;

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'GENERAL_VIEW_OPTIONS_SET_PAGESIZE':
                    this.pageSize.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_CONTEXTSIZE':
                    this.newCtxSize.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_LINE_NUMS':
                    this.lineNumbers = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE':
                    this.shuffle = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_USE_CQL_EDITOR':
                    this.useCQLEditor = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_WLPAGESIZE':
                    this.wlpagesize.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_FMAXITEMS':
                    this.fmaxitems.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_CITEMSPERPAGE':
                    this.citemsperpage.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'GENERAL_VIEW_OPTIONS_SUBMIT':
                    const err = this.validateForm();
                    if (!err) {
                        this.isBusy = true;
                        this.emitChange();
                        this.submit().subscribe(
                            () => {
                                this.isBusy = false;
                                this.emitChange();
                                this.submitResponseHandlers.forEach(fn => fn(this));
                            },
                            (err) => {
                                this.isBusy = false;
                                this.emitChange();
                                this.layoutModel.showMessage('error', err);
                            }
                        );

                    } else {
                        this.layoutModel.showMessage('error', err);
                        this.emitChange();
                    }

                break;
            }
        });
    }

    private testMaxPageSize(v:string):Error|null {
        if (parseInt(v) > GeneralViewOptionsModel.MAX_ITEMS_PER_PAGE) {
            return new Error(this.layoutModel.translate('options__max_items_per_page_exceeded_{num}',
                    {num: GeneralViewOptionsModel.MAX_ITEMS_PER_PAGE}));
        }
        return null;
    }

    private testMaxCtxSize(v:string):Error|null {
        if (parseInt(v) > GeneralViewOptionsModel.MAX_CTX_SIZE) {
            return new Error(this.layoutModel.translate('options__max_context_exceeded_{num}',
                    {num: GeneralViewOptionsModel.MAX_CTX_SIZE}));
        }
        return null;
    }

    private validateForm():Error|null {
        const valItems = [this.pageSize, this.newCtxSize, this.wlpagesize,
                          this.fmaxitems, this.citemsperpage];
        for (let i = 0; i < valItems.length; i += 1) {
            if (validateGzNumber(valItems[i].value)) {
                valItems[i].isInvalid = false;

            } else {
                valItems[i].isInvalid = true;
                return new Error(this.layoutModel.translate('global__invalid_number_format'));
            }
        }

        const pagingItems = [this.pageSize, this.wlpagesize, this.fmaxitems, this.citemsperpage];
        for (let i = 0; i < pagingItems.length; i += 1) {
            const err = this.testMaxPageSize(pagingItems[i].value);
            if (err) {
                return err;
            }
        }

        const ctxItems = [this.newCtxSize];
        for (let i = 0; i < ctxItems.length; i += 1) {
            const err = this.testMaxCtxSize(ctxItems[i].value);
            if (err) {
                return err;
            }
        }
        return null;
    }

    addOnSubmitResponseHandler(fn:(model:ViewOptions.IGeneralViewOptionsModel)=>void):void {
        this.submitResponseHandlers = this.submitResponseHandlers.push(fn);
    }

    loadData():Observable<boolean> {
        return this.layoutModel.ajax$<ViewOptsResponse>(
            'GET',
            this.layoutModel.createActionUrl('options/viewopts'),
            {}

        ).pipe(
            tap(
                (data) => {
                    this.pageSize = {value: `${data.pagesize}`, isInvalid: false, isRequired: true};
                    this.newCtxSize = {value: `${data.newctxsize}`, isInvalid: false, isRequired: true};
                    this.ctxUnit = data.ctxunit;
                    this.lineNumbers = !!data.line_numbers;
                    this.shuffle = !!data.shuffle;
                    this.wlpagesize = {value: `${data.wlpagesize}`, isInvalid: false, isRequired: true};
                    this.fmaxitems = {value: `${data.fmaxitems}`, isInvalid: false, isRequired: true};
                    this.citemsperpage = {value: `${data.citemsperpage}`, isInvalid: false, isRequired: true};
                    this.useCQLEditor = !!data.cql_editor;
                }
            ),
            map(
                data => true
            )
        );
    }

    private submit():Observable<Kontext.AjaxResponse> {
        const args = new MultiDict();
        args.set('pagesize', this.pageSize.value);
        args.set('newctxsize', this.newCtxSize.value);
        args.set('ctxunit', this.ctxUnit);
        args.set('line_numbers', this.lineNumbers ? '1' : '0');
        args.set('shuffle', this.shuffle ? '1' : '0');
        args.set('wlpagesize', this.wlpagesize.value);
        args.set('fmaxitems', this.fmaxitems.value);
        args.set('citemsperpage', this.citemsperpage.value);
        args.set('cql_editor', this.useCQLEditor ? '1' : '0');
        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
            'POST',
            this.layoutModel.createActionUrl('options/viewoptsx'),
            args

        ).pipe(
            tap((d) => {
                this.layoutModel.replaceConcArg('pagesize', [this.pageSize.value]);
                return d;
            })
        );
    }

    getPageSize():Kontext.FormValue<string> {
        return this.pageSize;
    }

    getNewCtxSize():Kontext.FormValue<string> {
        return this.newCtxSize;
    }

    getLineNumbers():boolean {
        return this.lineNumbers;
    }

    getShuffle():boolean {
        return this.shuffle;
    }

    getWlPageSize():Kontext.FormValue<string> {
        return this.wlpagesize;
    }

    getFmaxItems():Kontext.FormValue<string> {
        return this.fmaxitems;
    }

    getCitemsPerPage():Kontext.FormValue<string> {
        return this.citemsperpage;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getUseCQLEditor():boolean {
        return this.useCQLEditor;
    }

    getUserIsAnonymous():boolean {
        return this.userIsAnonymous;
    }
}
