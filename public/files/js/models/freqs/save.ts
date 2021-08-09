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
import {MultiDict} from '../../multidict';
import {Freq2DTableModel} from './twoDimension/table2d';
import {Freq2DFlatViewModel} from './twoDimension/flatTable';
import { IFullActionControl, StatefulModel } from 'kombo';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { Actions } from './actions';




export interface FreqResultsSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
}

export interface FreqResultsSaveModelState {
    formIsActive:boolean;
    saveformat:SaveData.Format;
    includeColHeaders:boolean;
    includeHeading:boolean;
    fromLine:Kontext.FormValue<string>;
    toLine:Kontext.FormValue<string>;
    quickSaveRowLimit:number;
}


/**
 *
 */
export class FreqResultsSaveModel extends StatefulModel<FreqResultsSaveModelState> {

    private layoutModel:PageModel;

    private saveLinkFn:(file:string, url:string)=>void;

    constructor({dispatcher, layoutModel, saveLinkFn, quickSaveRowLimit}:FreqResultsSaveModelArgs) {
        super(
            dispatcher,
            {
                formIsActive: false,
                saveformat: SaveData.Format.CSV,
                fromLine: {value: '1', isInvalid: false, isRequired: true},
                toLine: {value: '', isInvalid: false, isRequired: false},
                includeHeading: false,
                includeColHeaders: false,
                quickSaveRowLimit: quickSaveRowLimit
            }
        );

        this.layoutModel = layoutModel;
        this.saveLinkFn = saveLinkFn;

        this.addActionHandler<typeof MainMenuActions.ShowSaveForm>(
            MainMenuActions.ShowSaveForm.name,
            action => {
                this.changeState(state => {
                    state.formIsActive = true;
                    state.toLine.value = '';
                })
            }
        );

        this.addActionHandler<typeof MainMenuActions.DirectSave>(
            MainMenuActions.DirectSave.name,
            action => {
                if (window.confirm(this.layoutModel.translate(
                    'global__quicksave_limit_warning_{format}{lines}',
                    {format: action.payload.saveformat, lines: this.state.quickSaveRowLimit}
                ))) {
                    this.changeState(state => {
                        state.saveformat = action.payload.saveformat,
                        state.toLine.value = `${state.quickSaveRowLimit}`
                    });
                    this.suspend({}, (action, syncData) =>
                        action.name === Actions.ResultPrepareSubmitArgsDone.name ? null : syncData
                    ).subscribe(
                        (action) => {
                            this.submit(
                                (action as typeof Actions.ResultPrepareSubmitArgsDone).payload.data);
                        }
                    )
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultCloseSaveForm>(
            Actions.ResultCloseSaveForm.name,
            action => this.changeState(state => {state.formIsActive = false})
        );

        this.addActionHandler<typeof Actions.SaveFormSetFormat>(
            Actions.SaveFormSetFormat.name,
            action => this.changeState(state => {state.saveformat = action.payload.value})
        );

        this.addActionHandler<typeof Actions.SaveFormSetFromLine>(
            Actions.SaveFormSetFromLine.name,
            action => this.changeState(state => {state.fromLine.value = action.payload.value})
        );

        this.addActionHandler<typeof Actions.SaveFormSetToLine>(
            Actions.SaveFormSetToLine.name,
            action => this.changeState(state => {state.toLine.value = action.payload.value})
        );

        this.addActionHandler<typeof Actions.SaveFormSetIncludeHeading>(
            Actions.SaveFormSetIncludeHeading.name,
            action => this.changeState(state => {state.includeHeading = action.payload.value})
        );

        this.addActionHandler<typeof Actions.SaveFormSetIncludeColHeading>(
            Actions.SaveFormSetIncludeColHeading.name,
            action => this.changeState(state => {state.includeColHeaders = action.payload.value})
        );

        this.addActionHandler<typeof Actions.SaveFormSubmit>(
            Actions.SaveFormSubmit.name,
            action => {
                let err;
                this.changeState(state => {err = this.validateForm(state)});
                if (err) {
                    this.layoutModel.showMessage('error', err);

                } else {
                    this.changeState(state => {state.formIsActive = false});
                    this.suspend({}, (action, syncData) => {
                        return action.name === Actions.ResultPrepareSubmitArgsDone.name ? null : syncData
                    }).subscribe(
                        (action) => {
                            this.submit(
                                (action as typeof Actions.ResultPrepareSubmitArgsDone).payload.data);
                        }
                    )
                }
            }
        );
    }

    private validateForm(state:FreqResultsSaveModelState):Error|null {
        state.fromLine.isInvalid = false;
        state.toLine.isInvalid = false;
        if (!this.validateNumberFormat(state.fromLine.value, false)) {
            state.fromLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (!this.validateNumberFormat(state.toLine.value, true)) {
            state.toLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
        if (parseInt(state.fromLine.value) < 1 || (state.toLine.value !== '' &&
                parseInt(state.fromLine.value) > parseInt(state.toLine.value))) {
            state.fromLine.isInvalid = true;
            return new Error(this.layoutModel.translate('freq__save_form_from_value_err_msg'));
        }
    }

    private validateNumberFormat(v:string, allowEmpty:boolean):boolean {
        if (!isNaN(parseInt(v, 10)) || allowEmpty && v === '') {
            return true;
        }
        return false;
    }

    private submit(dataRowsArgs:MultiDict):void {
        const args = new MultiDict();
        dataRowsArgs.items().forEach(([k, v]) => args.add(k, v));
        args.set('saveformat', this.state.saveformat);
        args.set('colheaders', this.state.includeColHeaders ? '1' : '0');
        args.set('heading', this.state.includeHeading ? '1' : '0');
        args.set('from_line', this.state.fromLine.value);
        args.set('to_line', this.state.toLine.value);
        args.remove('format'); // cannot risk 'json' here
        this.saveLinkFn(
            `frequencies.${SaveData.formatToExt(this.state.saveformat)}`,
            this.layoutModel.createActionUrl('savefreq', args.items())
        );
    }
}


export interface FreqCTResultsSaveModelState {
    saveMode:string;
}

export class FreqCTResultsSaveModel extends StatefulModel<FreqCTResultsSaveModelState> {

    ctTableModel:Freq2DTableModel;

    ctFlatModel:Freq2DFlatViewModel;

    constructor(dispatcher:IFullActionControl, ctTableModel:Freq2DTableModel, ctFlatModel:Freq2DFlatViewModel) {
        super(dispatcher, {saveMode: null});
        this.ctTableModel = ctTableModel;
        this.ctFlatModel = ctFlatModel;

        this.addActionHandler<typeof Actions.SetCtSaveMode>(
            Actions.SetCtSaveMode.name,
            action => this.changeState(state => {state.saveMode = action.payload.value})
        );

        this.addActionHandler<typeof MainMenuActions.DirectSave>(
            MainMenuActions.DirectSave.name,
            action => {
                if (this.state.saveMode === 'table') {
                    this.ctTableModel.submitDataConversion(action.payload.saveformat);

                } else if (this.state.saveMode === 'list') {
                    this.ctFlatModel.submitDataConversion(action.payload.saveformat);
                }
            }
        );
    }

}