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
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {StatefulModel} from '../../models/base';
import {MultiDict} from '../../util';


export interface WordlistSaveModelArgs {
    dispatcher:ActionDispatcher;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
    wordlistArgsProviderFn:()=>MultiDict;
}


export class WordlistSaveModel extends StatefulModel {

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private toLine:Kontext.FormValue<string>;

    private saveFormat:string;

    private includeHeading:boolean;

    private includeColHeaders:boolean;

    private quickSaveRowLimit:number;

    private saveLinkFn:(file:string, url:string)=>void;

    private wordlistArgsProviderFn:()=>MultiDict;

    constructor({
            dispatcher, layoutModel, quickSaveRowLimit,
            saveLinkFn, wordlistArgsProviderFn}:WordlistSaveModelArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.saveLinkFn = saveLinkFn;
        this.wordlistArgsProviderFn = wordlistArgsProviderFn;
        this.toLine = {value: '', isInvalid: false, isRequired: true};
        this.saveFormat = 'csv';
        this.includeHeading = false;
        this.includeColHeaders = false;
        this.formIsActive = false;
        this.quickSaveRowLimit = quickSaveRowLimit;

        this.dispatcherRegister((payload:ActionPayload) => {
            switch (payload.actionType) {
            case 'MAIN_MENU_SHOW_SAVE_FORM':
                this.formIsActive = true;
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_SAVE_FORM_HIDE':
                this.formIsActive = false;
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_SAVE_FORM_SET_TO_LINE':
                this.toLine.value = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_SAVE_FORM_SET_FORMAT':
                this.saveFormat = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_SAVE_SET_INCLUDE_HEADING':
                this.includeHeading = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_SAVE_SET_INCLUDE_COL_HEADERS':
                this.includeColHeaders = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_SAVE_FORM_SUBMIT':
                const err = this.validateForm();
                if (err) {
                    this.layoutModel.showMessage('error', err);

                } else {
                    this.submit();
                    this.formIsActive = false;
                }
                this.notifyChangeListeners();
            break;
            case 'MAIN_MENU_DIRECT_SAVE':
                this.saveFormat = payload.props['saveformat'];
                this.toLine.value = `${this.quickSaveRowLimit}`;
                this.submit();
                this.toLine.value = '';
                this.notifyChangeListeners();
                break;
            }
        });
    }

    private validateForm():Error|null {
        if (this.toLine.value === '' || !isNaN(parseInt(this.toLine.value))) {
            this.toLine.isInvalid = false;
            return null;

        } else {
            this.toLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
    }

    private submit():void {
        const args = this.wordlistArgsProviderFn();
        args.remove('format');
        args.set('saveformat', this.saveFormat);
        args.set('from_line', '1');
        args.set('to_line', this.toLine.value);
        if (this.saveFormat === 'csv' || this.saveFormat === 'xlsx') {
            args.set('colheaders', this.includeColHeaders ? '1' : '0');
            args.remove('heading');

        } else {
            args.set('heading', this.includeHeading ? '1' : '0');
            args.remove('colheaders');
        }
        this.saveLinkFn(
            `word-list.${this.saveFormat}`,
            this.layoutModel.createActionUrl('savewl', args.items())
        );
    }

    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getToLine():Kontext.FormValue<string> {
        return this.toLine;
    }

    getSaveFormat():string {
        return this.saveFormat;
    }

    getIncludeHeading():boolean {
        return this.includeHeading;
    }

    getIncludeColHeaders():boolean {
        return this.includeColHeaders;
    }
}