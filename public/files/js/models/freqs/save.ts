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

import * as Immutable from 'immutable';
import {StatefulModel} from '../../models/base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {MultiDict} from '../../util';
import {Freq2DTableModel} from './ctable';
import {Freq2DFlatViewModel} from './flatCtable';



export interface FreqResultsSaveModelArgs {
    dispatcher:ActionDispatcher;
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

    private saveformat:string;

    private includeColHeaders:boolean;

    private includeHeading:boolean;

    private fromLine:string;

    private fromLineValidation:boolean;

    private toLine:string;

    private toLineValidation:boolean;

    private saveLinkFn:(file:string, url:string)=>void;

    private freqArgsProviderFn:()=>MultiDict;

    private quickSaveRowLimit:number;

    constructor({
            dispatcher, layoutModel, freqArgsProviderFn, saveLinkFn,
            quickSaveRowLimit}:FreqResultsSaveModelArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.formIsActive = false;
        this.saveformat = 'csv';
        this.fromLine = '1';
        this.fromLineValidation = true;
        this.toLine = '';
        this.toLineValidation = true;
        this.includeHeading = false;
        this.includeColHeaders = false;
        this.freqArgsProviderFn = freqArgsProviderFn;
        this.saveLinkFn = saveLinkFn;

        dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'MAIN_MENU_SHOW_SAVE_FORM':
                    this.formIsActive = true;
                    this.toLine = '';
                    this.notifyChangeListeners();
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    this.saveformat = payload.props['saveformat'];
                    this.toLine = `${this.quickSaveRowLimit}`;
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
                    const err = this.validateForm();
                    if (err) {
                        this.layoutModel.showMessage('error', err);

                    } else {
                        this.submit();
                        this.formIsActive = false;
                    }
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private validateForm():Error|null {
        this.fromLineValidation = true;
        this.toLineValidation = true;
        if (!this.validateNumberFormat(this.fromLine, false)) {
            this.fromLineValidation = false;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (!this.validateNumberFormat(this.toLine, false)) {
            this.toLineValidation = false;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (parseInt(this.fromLine) < 1 || (this.toLine !== '' &&
                parseInt(this.fromLine) > parseInt(this.toLine))) {
            this.fromLineValidation = false;
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
        args.set('from_line', this.fromLine);
        args.set('to_line', this.toLine);
        args.remove('format'); // cannot risk 'json' here
        this.saveLinkFn(
            `frequencies.${this.saveformat}`,
            this.layoutModel.createActionUrl('savefreq', args.items())
        );
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

    getFromLineValidation():boolean {
        return this.fromLineValidation;
    }

    getToLine():string {
        return this.toLine;
    }

    getToLineValidation():boolean {
        return this.toLineValidation;
    }
}



export class FreqCTResultsSaveModel extends StatefulModel {

    ctTableModel:Freq2DTableModel;

    ctFlatModel:Freq2DFlatViewModel;

    saveMode:string;


    constructor(dispatcher:ActionDispatcher, ctTableModel:Freq2DTableModel, ctFlatModel:Freq2DFlatViewModel) {
        super(dispatcher);
        this.ctTableModel = ctTableModel;
        this.ctFlatModel = ctFlatModel;

        dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'FREQ_CT_SET_SAVE_MODE':
                    this.saveMode = payload.props['value'];
                break;
                case 'MAIN_MENU_DIRECT_SAVE':
                    if (this.saveMode === 'table') {
                        this.ctTableModel.submitDataConversion(payload.props['saveformat']);

                    } else if (this.saveMode === 'list') {
                        this.ctFlatModel.submitDataConversion(payload.props['saveformat']);
                    }
                break;
            }
        });
    }

}