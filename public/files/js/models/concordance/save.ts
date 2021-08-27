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

import { IFullActionControl, StatefulModel } from 'kombo';

import * as Kontext from '../../types/kontext';
import { validateNumber } from '../base';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { ConcSaveServerArgs } from './common';
import { DataSaveFormat } from '../../app/navigation/save';



export interface ConcSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    concSize:number;
    saveLinkFn:(filename:string, url:string)=>Promise<boolean>;
    quickSaveRowLimit:number;
}

export interface ConcSaveModelState {
    formIsActive:boolean;
    saveformat:DataSaveFormat;
    includeHeading:boolean;
    fromLine:Kontext.FormValue<string>;
    toLine:Kontext.FormValue<string>;
    alignKwic:boolean;
    includeLineNumbers:boolean;
}


export class ConcSaveModel extends StatefulModel<ConcSaveModelState> {

    private layoutModel:PageModel;

    private concSize:number;

    private saveLinkFn:(filename:string, url:string)=>Promise<boolean>;

    private quickSaveRowLimit:number;

    constructor({dispatcher, layoutModel, concSize, quickSaveRowLimit, saveLinkFn}:ConcSaveModelArgs) {
        super(
            dispatcher,
            {
                formIsActive: false,
                saveformat: 'csv',
                fromLine: {value: '1', isInvalid: false, isRequired: true},
                toLine: {value: `${concSize}`, isInvalid: false, isRequired: true},
                alignKwic: false,
                includeLineNumbers: false,
                includeHeading: false,
            }
        );
        this.layoutModel = layoutModel;
        this.concSize = concSize;
        this.saveLinkFn = saveLinkFn;
        this.quickSaveRowLimit = quickSaveRowLimit;

        this.addActionHandler<typeof MainMenuActions.ShowSaveForm>(
            MainMenuActions.ShowSaveForm.name,
            action => {
                this.changeState(state => {state.formIsActive = true});
            }
        );

        this.addActionHandler<typeof MainMenuActions.DirectSave>(
            MainMenuActions.DirectSave.name,
            action => {
                if (window.confirm(this.layoutModel.translate(
                    'global__quicksave_limit_warning_{format}{lines}',
                    {format: action.payload.saveformat, lines: this.quickSaveRowLimit}
                ))) {
                    const tmp = this.state.toLine;
                    this.changeState(state => {
                        state.saveformat = action.payload.saveformat;
                        state.toLine.value = String(Math.min(this.quickSaveRowLimit, this.concSize));
                    });
                    this.submit();
                    this.changeState(state => {state.toLine = tmp});
                }
            }
        );

        this.addActionHandler<typeof Actions.ResultCloseSaveForm>(
            Actions.ResultCloseSaveForm.name,
            action => {
                this.changeState(state => {state.formIsActive = false});
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetFormat>(
            Actions.SaveFormSetFormat.name,
            action => {
                this.changeState(state => {state.saveformat = action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetFromLine>(
            Actions.SaveFormSetFromLine.name,
            action => {
                this.changeState(state => {state.fromLine.value = action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetToLine>(
            Actions.SaveFormSetToLine.name,
            action => {
                this.changeState(state => {state.toLine.value = action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetAlignKwic>(
            Actions.SaveFormSetAlignKwic.name,
            action => {
                this.changeState(state => {state.alignKwic = action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetInclLineNumbers>(
            Actions.SaveFormSetInclLineNumbers.name,
            action => {
                this.changeState(state => {state.includeLineNumbers = action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSetHeading>(
            Actions.SaveFormSetHeading.name,
            action => {
                this.changeState(state => {state.includeHeading = action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.SaveFormSubmit>(
            Actions.SaveFormSubmit.name,
            action => {
                const err = this.validateForm();
                if (err) {
                    this.layoutModel.showMessage('error', err);

                } else {
                    this.changeState(state => {state.formIsActive = false});
                    this.submit();
                }
                this.emitChange();
            }
        );

        this.addActionHandler<typeof Actions.AsyncCalculationUpdated>(
            Actions.AsyncCalculationUpdated.name,
            action => {
                this.changeState(state => {
                    state.toLine.value = `${action.payload.concsize}`;
                });
            }
        );
    }

    private validateForm():Error|null {
        if (validateNumber(this.state.fromLine.value) && parseInt(this.state.fromLine.value, 10) >= 1 &&
                parseInt(this.state.fromLine.value) <= this.concSize) {
            this.changeState(state => {state.fromLine.isInvalid = false});

        } else {
            this.changeState(state => {state.fromLine.isInvalid = true});
            return Error(this.layoutModel.translate('concview__save_form_line_from_err_msg_{value}',
                                {value: this.concSize}));
        }

        if (validateNumber(this.state.toLine.value) && parseInt(this.state.toLine.value, 10) > parseInt(this.state.fromLine.value) &&
                parseInt(this.state.toLine.value) <= this.concSize) {
            this.changeState(state => {state.toLine.isInvalid = false});

        } else {
            this.changeState(state => {state.toLine.isInvalid = true});
            return Error(this.layoutModel.translate('concview__save_form_line_to_err_msg_{value1}{value2}',
                            {value1: parseInt(this.state.fromLine.value, 10) + 1, value2: this.concSize}));
        }
    }

    private submit():void {
        const args = {
            ...this.layoutModel.getConcArgs(),
            saveformat: this.state.saveformat,
            from_line: this.state.fromLine.value,
            to_line: this.state.toLine.value,
            heading: this.state.includeHeading,
            numbering: this.state.includeLineNumbers,
            align_kwic: this.state.alignKwic
        };
        this.saveLinkFn(
            `concordance.${this.state.saveformat}`,
            this.layoutModel.createActionUrl('saveconc', args)
        );
    }
}
