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
import {StatefulModel, validateNumber} from '../base';
import {PageModel} from '../../app/page';
import { Action, IFullActionControl } from 'kombo';
import { ActionName } from './actions';


export interface ConcSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    concSize:number;
    saveLinkFn:(filename:string, url:string)=>Promise<boolean>;
    quickSaveRowLimit:number;
}


export class ConcSaveModel extends StatefulModel {

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private saveformat:SaveData.Format;

    private includeHeading:boolean;

    private fromLine:Kontext.FormValue<string>;

    private toLine:Kontext.FormValue<string>;

    private alignKwic:boolean;

    private includeLineNumbers:boolean;

    private concSize:number;

    private saveLinkFn:(filename:string, url:string)=>Promise<boolean>;

    private quickSaveRowLimit:number;

    constructor({dispatcher, layoutModel, concSize, quickSaveRowLimit, saveLinkFn}:ConcSaveModelArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.saveformat = SaveData.Format.CSV;
        this.fromLine = {value: '1', isInvalid: false, isRequired: true};
        this.toLine = {value: `${concSize}`, isInvalid: false, isRequired: true};
        this.alignKwic = false;
        this.includeLineNumbers = false;
        this.includeHeading = false;
        this.concSize = concSize;
        this.saveLinkFn = saveLinkFn;
        this.quickSaveRowLimit = quickSaveRowLimit;

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
            case 'MAIN_MENU_SHOW_SAVE_FORM':
                this.formIsActive = true;
                this.emitChange();
            break;
            case 'MAIN_MENU_DIRECT_SAVE':
                if (window.confirm(this.layoutModel.translate(
                        'global__quicksave_limit_warning_{format}{lines}',
                        {format: action.payload['saveformat'], lines: this.quickSaveRowLimit}
                ))) {
                    this.saveformat = action.payload['saveformat'];
                    const tmp = this.toLine;
                    this.toLine.value = String(Math.min(this.quickSaveRowLimit, this.concSize));
                    this.submit();
                    this.toLine = tmp;
                    this.emitChange();
                }
            break;
            case ActionName.ResultCloseSaveForm:
                this.formIsActive = false;
                this.emitChange();
            break;
            case ActionName.SaveFormSetFormat:
                this.saveformat = action.payload['value'];
                this.emitChange();
            break;
            case ActionName.SaveFormSetFromLine:
                 this.fromLine.value = action.payload['value'];
                 this.emitChange();
            break;
            case ActionName.SaveFormSetToLine:
                this.toLine.value = action.payload['value'];
                this.emitChange();
            break;
            case ActionName.SaveFormSetAlignKwic:
                this.alignKwic = action.payload['value'];
                this.emitChange();
            break;
            case ActionName.SaveFormSetInclLineNumbers:
                this.includeLineNumbers = action.payload['value'];
                this.emitChange();
            break;
            case ActionName.SaveFormSetHeading:
                this.includeHeading = action.payload['value'];
                this.emitChange();
            break;
            case 'COLL_SAVE_FORM_SUBMIT':
                const err = this.validateForm();
                if (err) {
                    this.layoutModel.showMessage('error', err);

                } else {
                    this.formIsActive = false;
                    this.submit();
                }
                this.emitChange();
            break;
            }
        });
    }

    private validateForm():Error|null {
        if (validateNumber(this.fromLine.value) && parseInt(this.fromLine.value, 10) >= 1 &&
                parseInt(this.fromLine.value) <= this.concSize) {
            this.fromLine.isInvalid = false;

        } else {
            this.fromLine.isInvalid = true;
            return Error(this.layoutModel.translate('concview__save_form_line_from_err_msg_{value}',
                                {value: this.concSize}));
        }

        if (validateNumber(this.toLine.value) && parseInt(this.toLine.value, 10) > parseInt(this.fromLine.value) &&
                parseInt(this.toLine.value) <= this.concSize) {
            this.toLine.isInvalid = false;

        } else {
            this.toLine.isInvalid = true;
            return Error(this.layoutModel.translate('concview__save_form_line_to_err_msg_{value1}{value2}',
                            {value1: parseInt(this.fromLine.value, 10) + 1, value2: this.concSize}));
        }
    }

    private submit():void {
        const args = this.layoutModel.getConcArgs();
        args.set('saveformat', this.saveformat);
        args.set('from_line', this.fromLine.value);
        args.set('to_line', this.toLine.value);
        args.set('heading', this.includeHeading ? '1' : '0');
        args.set('numbering', this.includeLineNumbers ? '1' : '0');
        args.set('align_kwic', this.alignKwic ? '1' : '0');
        this.saveLinkFn(
            `concordance.${SaveData.formatToExt(this.getSaveFormat())}`,
            this.layoutModel.createActionUrl('saveconc', args.items())
        );
    }


    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getFromLine():Kontext.FormValue<string> {
        return this.fromLine;
    }

    getToLine():Kontext.FormValue<string> {
        return this.toLine;
    }

    getSaveFormat():SaveData.Format {
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
