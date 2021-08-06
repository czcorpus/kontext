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

import { IActionDispatcher, StatelessModel } from 'kombo';
import { PageModel } from '../../app/page';
import { SaveData } from '../../app/navigation';
import { Kontext } from '../../types/common';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';


export interface COllResultsSaveModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
}

export interface CollResultsSaveModelState {
    formIsActive:boolean;
    saveformat:SaveData.Format;
    includeColHeaders:boolean;
    includeHeading:boolean;
    fromLine:Kontext.FormValue<string>;
    toLine:Kontext.FormValue<string>;
    quickSaveRowLimit:number;
    isBusy:boolean;
}


export class CollResultsSaveModel extends StatelessModel<CollResultsSaveModelState> {

    private readonly layoutModel:PageModel;

    private readonly saveLinkFn:(file:string, url:string)=>void;

    constructor({
            dispatcher,
            layoutModel,
            quickSaveRowLimit,
            saveLinkFn
    }:COllResultsSaveModelArgs) {
        super(
            dispatcher,
            {
                formIsActive: false,
                saveformat: SaveData.Format.CSV,
                fromLine: {value: '1', isInvalid: false, isRequired: true},
                toLine: {value: '', isInvalid: false, isRequired: true},
                includeColHeaders: false,
                includeHeading: false,
                quickSaveRowLimit,
                isBusy: false
            }
        );
        this.layoutModel = layoutModel;
        this.saveLinkFn = saveLinkFn;

        this.addActionHandler<typeof MainMenuActions.ShowSaveForm>(
            MainMenuActions.ShowSaveForm.name,
            (state, action) => {
                state.formIsActive = true;
                state.toLine.value = '';
            }
        );

        this.addActionHandler<typeof MainMenuActions.DirectSave>(
            MainMenuActions.DirectSave.name,
            (state, action) => {
                state.saveformat = action.payload.saveformat;
                state.toLine.value = state.quickSaveRowLimit + '';

            },
            (state, action, dispatch) => {
                if (window.confirm(this.layoutModel.translate(
                        'global__quicksave_limit_warning_{format}{lines}',
                        {format: action.payload.saveformat, lines: state.quickSaveRowLimit}))) {
                    this.submit(state);
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultCloseSaveForm>(
            Actions.ResultCloseSaveForm.name,
            (state, action) => {
                state.formIsActive = false;
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetFormat>(
            Actions.SaveFormSetFormat.name,
            (state, action) => {
                state.saveformat = action.payload.value as SaveData.Format; // TODO type
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetFromLine>(
            Actions.SaveFormSetFromLine.name,
            (state, action) => {
                state.fromLine.value = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetToLine>(
            Actions.SaveFormSetToLine.name,
            (state, action) => {
                state.toLine.value = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetIncludeColHeaders>(
            Actions.SaveFormSetIncludeColHeaders.name,
            (state, action) => {
                state.includeColHeaders = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetIncludeHeading>(
            Actions.SaveFormSetIncludeHeading.name,
            (state, action) => {
                state.includeHeading = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSubmit>(
            Actions.SaveFormSubmit.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action) => {
                this.submit(state);
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSubmitDone>(
            Actions.SaveFormSubmitDone.name,
            (state, action) => {
                state.isBusy = false;
                state.formIsActive = false;
            }
        );
    }

    private validateForm(state:CollResultsSaveModelState):Error|null {
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

    private submit(state:CollResultsSaveModelState):void {
        this.suspend({}, (action, syncData) => {
            if (action.name === Actions.FormPrepareSubmitArgsDone.name) {
                return null;
            }
            return syncData;
        }).subscribe(
            action => {
                const args = (action as typeof Actions.FormPrepareSubmitArgsDone).payload.args;
                args.remove('format'); // cannot risk format=json and invalid http resp. headers
                args.set('saveformat', state.saveformat);
                args.set('colheaders', state.includeColHeaders ? '1' : '0');
                args.set('heading', state.includeHeading ? '1' : '0');
                args.set('from_line', parseInt(state.fromLine.value));
                args.set('to_line', state.toLine.value ?
                            parseInt(state.toLine.value) :
                            undefined);
                this.saveLinkFn(
                    `collocation.${SaveData.formatToExt(state.saveformat)}`,
                    this.layoutModel.createActionUrl('savecoll', args.items())
                );
            }
        );
    }

}
