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

import {MultiDict} from '../../util';
import {StatefulModel, validateNumber} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import * as Immutable from 'immutable';


export interface ConcSaveModelArgs {
    dispatcher:ActionDispatcher;
    layoutModel:PageModel;
    concSize:number;
    saveLinkFn:(filename:string, url:string)=>Promise<boolean>;
    quickSaveRowLimit:number;
}


export class ConcSaveModel extends StatefulModel {

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private saveformat:string;

    private includeHeading:boolean;

    private fromLine:string;

    private fromLineValidation:boolean;

    private toLine:string;

    private toLineValidation:boolean;

    private alignKwic:boolean;

    private includeLineNumbers:boolean;

    private concSize:number;

    private saveLinkFn:(filename:string, url:string)=>Promise<boolean>;

    private quickSaveRowLimit:number;

    constructor({dispatcher, layoutModel, concSize, quickSaveRowLimit, saveLinkFn}:ConcSaveModelArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.saveformat = 'csv';
        this.fromLine = '1';
        this.fromLineValidation = true;
        this.toLine = String(concSize);
        this.toLineValidation = true;
        this.alignKwic = false;
        this.includeLineNumbers = false;
        this.includeHeading = false;
        this.concSize = concSize;
        this.saveLinkFn = saveLinkFn;
        this.quickSaveRowLimit = quickSaveRowLimit;

        dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
            case 'MAIN_MENU_SHOW_SAVE_FORM':
                this.formIsActive = true;
                this.notifyChangeListeners();
            break;
            case 'MAIN_MENU_DIRECT_SAVE':
                this.saveformat = payload.props['saveformat'];
                const tmp = this.toLine;
                this.toLine = String(Math.min(this.quickSaveRowLimit, this.concSize));
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
                 this.fromLine = payload.props['value'];
                 this.notifyChangeListeners();
            break;
            case 'CONCORDANCE_SAVE_FORM_SET_TO_LINE':
                this.toLine = payload.props['value'];
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
                const err = this.validateForm();
                if (err) {
                    this.layoutModel.showMessage('error', err);

                } else {
                    this.formIsActive = false;
                    this.submit();
                }
                this.notifyChangeListeners();
            break;
            }
        });
    }

    private validateForm():Error|null {
        if (validateNumber(this.fromLine) && parseInt(this.fromLine, 10) >= 1 &&
                parseInt(this.fromLine) <= this.concSize) {
            this.fromLineValidation = true;

        } else {
            this.fromLineValidation = false;
            return Error(this.layoutModel.translate('concview__save_form_line_from_err_msg_{value}',
                                {value: this.concSize}));
        }

        if (validateNumber(this.toLine) && parseInt(this.toLine, 10) > parseInt(this.fromLine) &&
                parseInt(this.toLine) <= this.concSize) {
            this.toLineValidation = true;

        } else {
            this.toLineValidation = false;
            return Error(this.layoutModel.translate('concview__save_form_line_to_err_msg_{value1}{value2}',
                            {value1: parseInt(this.fromLine, 10) + 1, value2: this.concSize}));
        }
    }

    private submit():void {
        const args = this.layoutModel.getConcArgs();
        args.set('saveformat', this.saveformat);
        args.set('from_line', this.fromLine);
        args.set('to_line', this.toLine);
        args.set('heading', this.includeHeading ? '1' : '0');
        args.set('numbering', this.includeLineNumbers ? '1' : '0');
        args.set('align_kwic', this.alignKwic ? '1' : '0');
        this.saveLinkFn(
            `concordance.${this.getSaveFormat()}`,
            this.layoutModel.createActionUrl('saveconc', args.items())
        );
    }


    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getFromLine():string {
        return this.fromLine;
    }

    getFromLineValidation():boolean {
        return this.fromLineValidation;
    }

    getToLine():string {
        return this.toLine;
    }

    getToLineValidation():boolean {
        return this.toLineValidation;
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
