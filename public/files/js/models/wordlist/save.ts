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
import {SaveData} from '../../app/navigation';
import {PageModel} from '../../app/page';
import {StatefulModel} from '../../models/base';
import {MultiDict} from '../../multidict';
import { Action, IFullActionControl } from 'kombo';


export interface WordlistSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
    wordlistArgsProviderFn:()=>MultiDict;
}


export class WordlistSaveModel extends StatefulModel {

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private toLine:Kontext.FormValue<string>;

    private saveFormat:SaveData.Format;

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
        this.saveFormat = SaveData.Format.CSV;
        this.includeHeading = false;
        this.includeColHeaders = false;
        this.formIsActive = false;
        this.quickSaveRowLimit = quickSaveRowLimit;

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
            case 'MAIN_MENU_SHOW_SAVE_FORM':
                this.formIsActive = true;
                this.emitChange();
            break;
            case 'WORDLIST_SAVE_FORM_HIDE':
                this.formIsActive = false;
                this.emitChange();
            break;
            case 'WORDLIST_SAVE_FORM_SET_TO_LINE':
                this.toLine.value = action.payload['value'];
                this.emitChange();
            break;
            case 'WORDLIST_SAVE_FORM_SET_FORMAT':
                this.saveFormat = action.payload['value'];
                this.emitChange();
            break;
            case 'WORDLIST_SAVE_SET_INCLUDE_HEADING':
                this.includeHeading = action.payload['value'];
                this.emitChange();
            break;
            case 'WORDLIST_SAVE_SET_INCLUDE_COL_HEADERS':
                this.includeColHeaders = action.payload['value'];
                this.emitChange();
            break;
            case 'WORDLIST_SAVE_FORM_SUBMIT':
                const err = this.validateForm();
                if (err) {
                    this.layoutModel.showMessage('error', err);

                } else {
                    this.submit();
                    this.formIsActive = false;
                }
                this.emitChange();
            break;
            case 'MAIN_MENU_DIRECT_SAVE':
                if (window.confirm(this.layoutModel.translate(
                    'global__quicksave_limit_warning_{format}{lines}',
                    {format: action.payload['saveformat'], lines: this.quickSaveRowLimit}
                ))) {
                    this.saveFormat = action.payload['saveformat'];
                    this.toLine.value = `${this.quickSaveRowLimit}`;
                    this.submit();
                    this.toLine.value = '';
                    this.emitChange();
                }
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
        if (this.saveFormat === SaveData.Format.CSV || this.saveFormat === SaveData.Format.XLSX) {
            args.set('colheaders', this.includeColHeaders ? '1' : '0');
            args.remove('heading');

        } else {
            args.set('heading', this.includeHeading ? '1' : '0');
            args.remove('colheaders');
        }
        this.saveLinkFn(
            `word-list.${SaveData.formatToExt(this.saveFormat)}`,
            this.layoutModel.createActionUrl('wordlist/savewl', args.items())
        );
    }

    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getToLine():Kontext.FormValue<string> {
        return this.toLine;
    }

    getSaveFormat():SaveData.Format {
        return this.saveFormat;
    }

    getIncludeHeading():boolean {
        return this.includeHeading;
    }

    getIncludeColHeaders():boolean {
        return this.includeColHeaders;
    }
}