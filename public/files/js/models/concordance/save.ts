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
import {validateNumber} from '../base';
import {PageModel} from '../../app/page';
import {IFullActionControl, StatefulModel} from 'kombo';
import {Actions, ActionName} from './actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';



export interface ConcSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    concSize:number;
    saveLinkFn:(filename:string, url:string)=>Promise<boolean>;
    quickSaveRowLimit:number;
}

export interface ConcSaveModelState {
    formIsActive:boolean;
    saveformat:SaveData.Format;
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
                saveformat: SaveData.Format.CSV,
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

        this.addActionHandler<MainMenuActions.ShowSaveForm>(
            MainMenuActionName.ShowSaveForm,
            action => {
                this.changeState(state => {state.formIsActive = true});
                this.emitChange();
            }
        );

        this.addActionHandler<MainMenuActions.DirectSave>(
            MainMenuActionName.DirectSave,
            action => {
                if (window.confirm(this.layoutModel.translate(
                    'global__quicksave_limit_warning_{format}{lines}',
                    {format: action.payload['saveformat'], lines: this.quickSaveRowLimit}
                ))) {
                    const tmp = this.state.toLine;
                    this.changeState(state => {
                        state.saveformat = action.payload.saveformat;
                        state.toLine.value = String(Math.min(this.quickSaveRowLimit, this.concSize));
                    });
                    this.submit();
                    this.changeState(state => {state.toLine = tmp});
                    this.emitChange();
                }
            }
        );

        this.addActionHandler<Actions.ResultCloseSaveForm>(
            ActionName.ResultCloseSaveForm,
            action => {
                this.changeState(state => {state.formIsActive = false});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.SaveFormSetFormat>(
            ActionName.SaveFormSetFormat,
            action => {
                this.changeState(state => {state.saveformat = action.payload.value});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.SaveFormSetFromLine>(
            ActionName.SaveFormSetFromLine,
            action => {
                this.changeState(state => {state.fromLine.value = action.payload.value});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.SaveFormSetToLine>(
            ActionName.SaveFormSetToLine,
            action => {
                this.changeState(state => {state.toLine.value = action.payload.value});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.SaveFormSetAlignKwic>(
            ActionName.SaveFormSetAlignKwic,
            action => {
                this.changeState(state => {state.alignKwic = action.payload.value});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.SaveFormSetInclLineNumbers>(
            ActionName.SaveFormSetInclLineNumbers,
            action => {
                this.changeState(state => {state.includeLineNumbers = action.payload.value});
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.SaveFormSetHeading>(
            ActionName.SaveFormSetHeading,
            action => {
                this.changeState(state => {state.includeHeading = action.payload.value});
                this.emitChange();
            }
        );

        this.addActionHandler(
            'COLL_SAVE_FORM_SUBMIT',
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
    }

    unregister = () => {}

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
        const args = this.layoutModel.getConcArgs();
        args.set('saveformat', this.state.saveformat);
        args.set('from_line', this.state.fromLine.value);
        args.set('to_line', this.state.toLine.value);
        args.set('heading', this.state.includeHeading ? '1' : '0');
        args.set('numbering', this.state.includeLineNumbers ? '1' : '0');
        args.set('align_kwic', this.state.alignKwic ? '1' : '0');
        this.saveLinkFn(
            `concordance.${SaveData.formatToExt(this.state.saveformat)}`,
            this.layoutModel.createActionUrl('saveconc', args.items())
        );
    }
}
