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
import RSVP from 'rsvp';
import {PageModel} from '../../app/main';
import {ActionDispatcher, Action} from '../../app/dispatcher';
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


export class GeneralViewOptionsModel extends StatefulModel implements ViewOptions.IGeneralViewOptionsModel {

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

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, userIsAnonymous:boolean) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.userIsAnonymous = userIsAnonymous;
        this.submitResponseHandlers = Immutable.List<()=>void>();
        this.isBusy = false;

        this.dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'GENERAL_VIEW_OPTIONS_SET_PAGESIZE':
                    this.pageSize.value = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_CONTEXTSIZE':
                    this.newCtxSize.value = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_LINE_NUMS':
                    this.lineNumbers = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE':
                    this.shuffle = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_USE_CQL_EDITOR':
                    this.useCQLEditor = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_WLPAGESIZE':
                    this.wlpagesize.value = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_FMAXITEMS':
                    this.fmaxitems.value = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SET_CITEMSPERPAGE':
                    this.citemsperpage.value = action.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'GENERAL_VIEW_OPTIONS_SUBMIT':
                    const err = this.validateForm();
                    if (!err) {
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

                    } else {
                        this.layoutModel.showMessage('error', err);
                        this.notifyChangeListeners();
                    }

                break;
            }
        });
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
        return null;
    }

    addOnSubmitResponseHandler(fn:(model:ViewOptions.IGeneralViewOptionsModel)=>void):void {
        this.submitResponseHandlers = this.submitResponseHandlers.push(fn);
    }

    loadData():RSVP.Promise<boolean> {
        return this.layoutModel.ajax<ViewOptsResponse>(
            'GET',
            this.layoutModel.createActionUrl('options/viewopts'),
            {}

        ).then(
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
                return true;
            }
        );
    }

    private submit():RSVP.Promise<Kontext.AjaxResponse> {
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
        return this.layoutModel.ajax<Kontext.AjaxResponse>(
            'POST',
            this.layoutModel.createActionUrl('options/viewoptsx'),
            args

        ).then(
            (d) => {
                this.layoutModel.replaceConcArg('pagesize', [this.pageSize.value]);
                return d;
            }
        )
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
