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

import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {StatefulModel} from '../../stores/base';
import {MultiDict} from '../../util';


export class WordlistSaveStore extends StatefulModel {

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private toLine:string;

    private saveFormat:string;

    private includeHeading:boolean;

    private includeColHeaders:boolean;

    private saveLinkFn:(string)=>void;

    private wordlistArgsProviderFn:()=>MultiDict;

    private static QUICK_SAVE_LINE_LIMIT = 10000;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, saveLinkFn:(string)=>void,
            wordlistArgsProviderFn:()=>MultiDict) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.saveLinkFn = saveLinkFn;
        this.wordlistArgsProviderFn = wordlistArgsProviderFn;
        this.toLine = '';
        this.saveFormat = 'csv';
        this.includeHeading = false;
        this.includeColHeaders = false;
        this.formIsActive = false;

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
                this.toLine = payload.props['value'];
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
                this.submit();
                this.notifyChangeListeners();
            break;
            case 'MAIN_MENU_DIRECT_SAVE':
                this.saveFormat = payload.props['saveformat'];
                this.toLine = String(WordlistSaveStore.QUICK_SAVE_LINE_LIMIT);
                this.submit();
                this.toLine = '';
                this.notifyChangeListeners();
                break;
            }
        });
    }

    private submit():void {
        const args = this.wordlistArgsProviderFn();
        args.remove('format');
        args.set('saveformat', this.saveFormat);
        args.set('from_line', '1');
        args.set('to_line', this.toLine);
        if (this.saveFormat === 'csv' || this.saveFormat === 'xlsx') {
            args.set('colheaders', this.includeColHeaders ? '1' : '0');
            args.remove('heading');

        } else {
            args.set('heading', this.includeHeading ? '1' : '0');
            args.remove('colheaders');
        }
        this.saveLinkFn(this.layoutModel.createActionUrl('savewl', args.items()));
    }

    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getToLine():string {
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