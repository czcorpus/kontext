/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as Kontext from '../../types/kontext';
import { PageModel } from '../../app/page';
import { IFullActionControl, StatefulModel } from 'kombo';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { Actions } from './actions';
import { DataSaveFormat } from '../../app/navigation/save';




export interface PqueryResultsSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
}

export interface PqueryResultsSaveModelState {
    formIsActive:boolean;
    saveformat:DataSaveFormat;
    includeColHeaders:boolean;
    includeHeading:boolean;
    fromLine:Kontext.FormValue<string>;
    toLine:Kontext.FormValue<string>;
    quickSaveRowLimit:number;
}


/**
 *
 */
export class PqueryResultsSaveModel extends StatefulModel<PqueryResultsSaveModelState> {

    private layoutModel:PageModel;

    private saveLinkFn:(file:string, url:string)=>void;

    constructor({dispatcher, layoutModel, saveLinkFn, quickSaveRowLimit}:PqueryResultsSaveModelArgs) {
        super(
            dispatcher,
            {
                formIsActive: false,
                saveformat: 'csv',
                fromLine: { value: '1', isInvalid: false, isRequired: true },
                toLine: { value: '', isInvalid: false, isRequired: false },
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
                        {format: action.payload.saveformat, lines: this.state.quickSaveRowLimit}))) {

                    this.changeState(state => {
                        state.saveformat = action.payload.saveformat,
                        state.toLine.value = `${state.quickSaveRowLimit}`
                    });
                    this.suspend({}, (action, syncData) =>
                        action.name === Actions.SaveFormPrepareSubmitArgsDone.name ? null : syncData

                    ).subscribe(
                        (action) => {
                            this.submit(
                                (action as typeof Actions.SaveFormPrepareSubmitArgsDone).payload
                            );
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
                        return action.name === Actions.SaveFormPrepareSubmitArgsDone.name ? null : syncData
                    }).subscribe(
                        (action) => {
                            this.submit(
                                (action as typeof Actions.SaveFormPrepareSubmitArgsDone).payload);
                        }
                    )
                }
            }
        );
    }

    private validateForm(state:PqueryResultsSaveModelState):Error|null {
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

    private submit(pqueryResultArgs:{queryId:string; sort:string; reverse:number}):void {
        this.saveLinkFn(
            `pquery.${this.state.saveformat}`,
            this.layoutModel.createActionUrl(
                'pquery/download',
                {
                    q: '~' + pqueryResultArgs.queryId,
                    sort: pqueryResultArgs.sort,
                    reverse: pqueryResultArgs.reverse,
                    saveformat: this.state.saveformat,
                    colheaders: this.state.includeColHeaders,
                    heading: this.state.includeHeading,
                    from_line: this.state.fromLine.value,
                    to_line: isNaN(parseInt(this.state.toLine.value)) ? '' : this.state.toLine.value
                }
            )
        );
    }
}
