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


/// <reference path="../../vendor.d.ts/immutable.d.ts" />

import {MultiDict} from '../../util';
import {SimplePageStore, validateNumber} from '../base';
import {PageModel} from '../../pages/document';
import * as Immutable from 'vendor/immutable';


export class ConcSaveStore extends SimplePageStore {

    private static QUICK_SAVE_LINE_LIMIT = 10000;

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private saveformat:string;

    private includeHeading:boolean;

    private fromLine:string;

    private toLine:string;

    private alignKwic:boolean;

    private includeLineNumbers:boolean;

    private concSize:number;

    private saveLinkFn:(string)=>void;validateNumber

    constructor(dispatcher:Kontext.FluxDispatcher, layoutModel:PageModel, concSize:number, saveLinkFn:(string)=>void) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.saveformat = 'csv';
        this.fromLine = '1';
        this.toLine = String(concSize);
        this.alignKwic = false;
        this.includeLineNumbers = false;
        this.includeHeading = false;
        this.concSize = concSize;
        this.saveLinkFn = saveLinkFn;

        dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
            case 'MAIN_MENU_SHOW_SAVE_FORM':
                this.formIsActive = true;
                this.notifyChangeListeners();
            break;
            case 'MAIN_MENU_DIRECT_SAVE':
                this.saveformat = payload.props['saveformat'];
                const tmp = this.toLine;
                this.toLine = String(Math.min(ConcSaveStore.QUICK_SAVE_LINE_LIMIT, this.concSize));
                this.submit();
                this.toLine = tmp;
                this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_RESULT_CLOSE_SAVE_FORM':
                this.formIsActive = false;
                this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_SAVE_FORM_SET_FORMAT':
                this.saveformat = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_SAVE_FORM_SET_FROM_LINE':
                 const v = payload.props['value'];
                 if (validateNumber(v) && parseInt(v, 10) >= 1 && parseInt(v) <= this.concSize) {
                    this.fromLine = v;

                 } else {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate('concview__save_form_line_from_err_msg_{value}',
                                {value: this.concSize}));
                 }
                 this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_SAVE_FORM_SET_TO_LINE':
                const v2 = payload.props['value'];
                if (validateNumber(v2) && parseInt(v2, 10) > parseInt(this.fromLine) && parseInt(v2) <= this.concSize) {
                    this.toLine = v2;

                } else {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate('concview__save_form_line_to_err_msg_{value1}{value2}',
                                    {value1: parseInt(this.fromLine, 10) + 1, value2: this.concSize}));
                }
                this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_SAVE_FORM_SET_ALIGN_KWIC':
                this.alignKwic = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_SAVE_FORM_SET_INCL_LINE_NUMBERS':
                this.includeLineNumbers = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_SAVE_FORM_SET_HEADING':
                this.includeHeading = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'COLL_SAVE_FORM_SUBMIT':
                this.submit();
                this.notifyChangeListeners();
            break;
            }
        });
    }

    private submit():void {
        const args = this.layoutModel.getConcArgs();
        args.set('saveformat', this.saveformat);
        args.set('from_line', this.fromLine);
        args.set('to_line', this.toLine);
        args.set('heading', this.includeHeading ? '1' : '0');
        args.set('numbering', this.includeLineNumbers ? '1' : '0');
        args.set('align_kwic', this.alignKwic ? '1' : '0');
        this.saveLinkFn(this.layoutModel.createActionUrl('saveconc', args.items()));
    }


    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getFromLine():string {
        return this.fromLine;
    }

    getToLine():string {
        return this.toLine;
    }

    getSaveFormat():string {
        return this.saveformat;
    }

    getAlignKwic():boolean {
        return this.alignKwic;
    }

    getIncludeLineNumbers():boolean {
        return this.includeLineNumbers;
    }

    getIncludeHeading():boolean {
        return this.includeHeading;
    }
}
