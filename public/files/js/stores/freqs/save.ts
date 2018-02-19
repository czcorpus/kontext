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

import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../../stores/base';
import {PageModel} from '../../app/main';
import {ActionDispatcher} from '../../app/dispatcher';
import {MultiDict} from '../../util';
import {ContingencyTableStore} from './ctable';
import {CTFlatStore} from './flatCtable';

/**
 *
 */
export class FreqResultsSaveStore extends SimplePageStore {

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private saveformat:string;

    private includeColHeaders:boolean;

    private includeHeading:boolean;

    private fromLine:string;

    private toLine:string;

    private saveLinkFn:(string)=>void;

    private freqArgsProviderFn:()=>MultiDict;

    private static QUICK_SAVE_LINE_LIMIT = 10000;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel,
            freqArgsProviderFn:()=>MultiDict, saveLinkFn:(string)=>void) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.formIsActive = false;
        this.saveformat = 'csv';
        this.fromLine = '1';
        this.toLine = '';
        this.includeHeading = false;
        this.includeColHeaders = false;
        this.freqArgsProviderFn = freqArgsProviderFn;
        this.saveLinkFn = saveLinkFn;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'MAIN_MENU_SHOW_SAVE_FORM':
                    this.formIsActive = true;
                    this.toLine = '';
                    this.notifyChangeListeners();
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    this.saveformat = payload.props['saveformat'];
                    this.toLine = String(FreqResultsSaveStore.QUICK_SAVE_LINE_LIMIT);
                    this.submit();
                    this.toLine = '';
                    this.notifyChangeListeners();
                break;
                case 'FREQ_RESULT_CLOSE_SAVE_FORM':
                    this.formIsActive = false;
                    this.notifyChangeListeners();
                break;
                case 'FREQ_SAVE_FORM_SET_FORMAT':
                    this.saveformat = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_SAVE_FORM_SET_FROM_LINE':
                    this.fromLine = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_SAVE_FORM_SET_TO_LINE':
                    this.toLine = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_SAVE_FORM_SET_INCLUDE_HEADING':
                    this.includeHeading = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_SAVE_FORM_SET_INCLUDE_COL_HEADERS':
                    this.includeColHeaders = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'FREQ_SAVE_FORM_SUBMIT':
                    const err0 = this.validateNumberFormat(this.fromLine, false) ||
                            this.validateNumberFormat(this.toLine, true);
                    if (err0) {
                        this.layoutModel.showMessage('error', err0);
                        break;
                    }
                    const err1 = this.validateFromToLines();
                    if (err1) {
                        this.layoutModel.showMessage('error', err1);
                        break;
                    }
                    this.submit();
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private validateNumberFormat(v:string, allowEmpty:boolean):Error {
        if (!isNaN(parseInt(v, 10)) || allowEmpty && v === '') {
            return null;
        }
        return Error(this.layoutModel.translate('global__invalid_number_format'));
    }

    private validateFromToLines():Error {
        const v1 = parseInt(this.fromLine, 10);
        const v2 = parseInt(this.toLine, 10);

        if (v1 >= 1 && (v1 < v2 || this.toLine === '')) {
            return null;
        }
        return Error(this.layoutModel.translate('freq__save_form_from_value_err_msg'));
    }

    private submit():void {
        const args = this.freqArgsProviderFn();
        args.set('saveformat', this.saveformat);
        args.set('colheaders', this.includeColHeaders ? '1' : '0');
        args.set('heading', this.includeHeading ? '1' : '0');
        args.set('from_line', this.fromLine);
        args.set('to_line', this.toLine);
        args.remove('format'); // cannot risk 'json' here
        this.saveLinkFn(this.layoutModel.createActionUrl('savefreq', args.items()));
    }

    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getSaveformat():string {
        return this.saveformat;
    }

    getIncludeColHeaders():boolean {
        return this.includeColHeaders;
    }

    getIncludeHeading():boolean {
        return this.includeHeading;
    }

    getFromLine():string {
        return this.fromLine;
    }

    getToLine():string {
        return this.toLine;
    }
}



export class FreqCTResultsSaveStore extends SimplePageStore {

    ctTableStore:ContingencyTableStore;

    ctFlatStore:CTFlatStore;

    saveMode:string;


    constructor(dispatcher:ActionDispatcher, ctTableStore:ContingencyTableStore, ctFlatStore:CTFlatStore) {
        super(dispatcher);
        this.ctTableStore = ctTableStore;
        this.ctFlatStore = ctFlatStore;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FREQ_CT_SET_SAVE_MODE':
                    this.saveMode = payload.props['value'];
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    if (this.saveMode === 'table') {
                        this.ctTableStore.submitDataConversion(payload.props['saveformat']);

                    } else if (this.saveMode === 'list') {
                        this.ctFlatStore.submitDataConversion(payload.props['saveformat']);
                    }
                break;
            }
        });
    }

}