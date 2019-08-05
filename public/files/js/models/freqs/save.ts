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
import {StatefulModel} from '../../models/base';
import {PageModel} from '../../app/main';
import {MultiDict} from '../../util';
import {Freq2DTableModel} from './ctable';
import {Freq2DFlatViewModel} from './flatCtable';
import { IActionDispatcher, Action } from 'kombo';



export interface FreqResultsSaveModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    freqArgsProviderFn:()=>MultiDict;
    saveLinkFn:(file:string, url:string)=>void;
}


/**
 *
 */
export class FreqResultsSaveModel extends StatefulModel {

    private layoutModel:PageModel;

    private formIsActive:boolean;

    private saveformat:SaveData.Format;

    private includeColHeaders:boolean;

    private includeHeading:boolean;

    private fromLine:Kontext.FormValue<string>;

    private toLine:Kontext.FormValue<string>;

    private saveLinkFn:(file:string, url:string)=>void;

    private freqArgsProviderFn:()=>MultiDict;

    private quickSaveRowLimit:number;

    constructor({
            dispatcher, layoutModel, freqArgsProviderFn, saveLinkFn,
            quickSaveRowLimit}:FreqResultsSaveModelArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.formIsActive = false;
        this.saveformat = SaveData.Format.CSV;
        this.fromLine = {value: '1', isInvalid: false, isRequired: true};
        this.toLine = {value: '', isInvalid: false, isRequired: false};
        this.includeHeading = false;
        this.includeColHeaders = false;
        this.freqArgsProviderFn = freqArgsProviderFn;
        this.saveLinkFn = saveLinkFn;
        this.quickSaveRowLimit = quickSaveRowLimit;

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'MAIN_MENU_SHOW_SAVE_FORM':
                    this.formIsActive = true;
                    this.toLine.value = '';
                    this.emitChange();
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    if (window.confirm(this.layoutModel.translate(
                        'global__quicksave_limit_warning_{format}{lines}',
                        {format: action.payload['saveformat'], lines: this.quickSaveRowLimit}
                    ))) {
                        this.saveformat = action.payload['saveformat'];
                        this.toLine.value = `${this.quickSaveRowLimit}`;
                        this.submit();
                        this.toLine.value = '';
                        this.emitChange();
                    }
                break;
                case 'FREQ_RESULT_CLOSE_SAVE_FORM':
                    this.formIsActive = false;
                    this.emitChange();
                break;
                case 'FREQ_SAVE_FORM_SET_FORMAT':
                    this.saveformat = action.payload['value'];
                    this.emitChange();
                break;
                case 'FREQ_SAVE_FORM_SET_FROM_LINE':
                    this.fromLine.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'FREQ_SAVE_FORM_SET_TO_LINE':
                    this.toLine.value = action.payload['value'];
                    this.emitChange();
                break;
                case 'FREQ_SAVE_FORM_SET_INCLUDE_HEADING':
                    this.includeHeading = action.payload['value'];
                    this.emitChange();
                break;
                case 'FREQ_SAVE_FORM_SET_INCLUDE_COL_HEADERS':
                    this.includeColHeaders = action.payload['value'];
                    this.emitChange();
                break;
                case 'FREQ_SAVE_FORM_SUBMIT':
                    const err = this.validateForm();
                    if (err) {
                        this.layoutModel.showMessage('error', err);

                    } else {
                        this.submit();
                        this.formIsActive = false;
                    }
                    this.emitChange();
                break;
            }
        });
    }

    private validateForm():Error|null {
        this.fromLine.isInvalid = false;
        this.toLine.isInvalid = false;
        if (!this.validateNumberFormat(this.fromLine.value, false)) {
            this.fromLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (!this.validateNumberFormat(this.toLine.value, true)) {
            this.toLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (parseInt(this.fromLine.value) < 1 || (this.toLine.value !== '' &&
                parseInt(this.fromLine.value) > parseInt(this.toLine.value))) {
            this.fromLine.isInvalid = true;
            return new Error(this.layoutModel.translate('freq__save_form_from_value_err_msg'));
        }
    }

    private validateNumberFormat(v:string, allowEmpty:boolean):boolean {
        if (!isNaN(parseInt(v, 10)) || allowEmpty && v === '') {
            return true;
        }
        return false;
    }

    private submit():void {
        const args = this.freqArgsProviderFn();
        args.set('saveformat', this.saveformat);
        args.set('colheaders', this.includeColHeaders ? '1' : '0');
        args.set('heading', this.includeHeading ? '1' : '0');
        args.set('from_line', this.fromLine.value);
        args.set('to_line', this.toLine.value);
        args.remove('format'); // cannot risk 'json' here
        this.saveLinkFn(
            `frequencies.${SaveData.formatToExt(this.saveformat)}`,
            this.layoutModel.createActionUrl('savefreq', args.items())
        );
    }

    getFormIsActive():boolean {
        return this.formIsActive;
    }

    getSaveformat():SaveData.Format {
        return this.saveformat;
    }

    getIncludeColHeaders():boolean {
        return this.includeColHeaders;
    }

    getIncludeHeading():boolean {
        return this.includeHeading;
    }

    getFromLine():Kontext.FormValue<string> {
        return this.fromLine;
    }

    getToLine():Kontext.FormValue<string> {
        return this.toLine;
    }
}



export class FreqCTResultsSaveModel extends StatefulModel {

    ctTableModel:Freq2DTableModel;

    ctFlatModel:Freq2DFlatViewModel;

    saveMode:string;


    constructor(dispatcher:IActionDispatcher, ctTableModel:Freq2DTableModel, ctFlatModel:Freq2DFlatViewModel) {
        super(dispatcher);
        this.ctTableModel = ctTableModel;
        this.ctFlatModel = ctFlatModel;

        dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'FREQ_CT_SET_SAVE_MODE':
                    this.saveMode = action.payload['value'];
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    if (this.saveMode === 'table') {
                        this.ctTableModel.submitDataConversion(action.payload['saveformat']);

                    } else if (this.saveMode === 'list') {
                        this.ctFlatModel.submitDataConversion(action.payload['saveformat']);
                    }
                break;
            }
        });
    }

}