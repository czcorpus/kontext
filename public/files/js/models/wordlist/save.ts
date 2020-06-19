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
import { Observable, of as rxOf } from 'rxjs';
import { concatMap } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { SaveData } from '../../app/navigation';
import { PageModel } from '../../app/page';
import { Action, IFullActionControl, StatelessModel } from 'kombo';
import { Actions, ActionName } from '../wordlist/actions';
import { MultiDict } from '../../multidict';


export interface WordlistSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    saveLinkFn:(file:string, url:string)=>void;
}

export interface WordlistSaveModelState {
    formIsActive:boolean;
    toLine:Kontext.FormValue<string>;
    saveFormat:SaveData.Format;
    includeHeading:boolean;
    includeColHeaders:boolean;
    quickSaveRowLimit:number;
}


export class WordlistSaveModel extends StatelessModel<WordlistSaveModelState> {

    private readonly layoutModel:PageModel;

    private readonly saveLinkFn:(file:string, url:string)=>void;


    constructor({dispatcher, layoutModel, quickSaveRowLimit, saveLinkFn}:WordlistSaveModelArgs) {
        super(
            dispatcher,
            {
                toLine: {value: '', isInvalid: false, isRequired: true},
                saveFormat: SaveData.Format.CSV,
                includeHeading: false,
                includeColHeaders: false,
                formIsActive: false,
                quickSaveRowLimit: quickSaveRowLimit
            }
        );
        this.layoutModel = layoutModel;
        this.saveLinkFn = saveLinkFn;

        this.addActionHandler(
            'MAIN_MENU_SHOW_SAVE_FORM',
            (state, action) => {
                state.formIsActive = true;
            }
        );

        this.addActionHandler<Actions.WordlistSaveFormHide>(
            ActionName.WordlistSaveFormHide,
            (state, action) => {
                state.formIsActive = false;
            }
        );

        this.addActionHandler<Actions.WordlistSaveFormSetMaxLine>(
            ActionName.WordlistSaveFormSetMaxLine,
            (state, action) => {
                state.toLine.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistSaveFormSetFormat>(
            ActionName.WordlistSaveFormSetFormat,
            (state, action) => {
                state.saveFormat = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistSaveSetIncludeHeading>(
            ActionName.WordlistSaveSetIncludeHeading,
            (state, action) => {
                state.includeHeading = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistSaveSetIncludeColHeaders>(
            ActionName.WordlistSaveSetIncludeColHeaders,
            (state, action) => {
                state.includeColHeaders = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistSaveFormSubmit>(
            ActionName.WordlistSaveFormSubmit,
            (state, action) => {

            },
            (state, action, dispatch) => {
                const err = this.validateForm(state);
                this.suspend({}, (action, syncData) => {
                    if (action.name === ActionName.WordlistFormSubmitReady) {
                        return null;
                    }
                    return syncData;
                }).pipe(
                    concatMap(
                        action => {
                            const payload = (action as Actions.WordlistFormSubmitReady).payload;
                            return this.submit(state, payload.args);
                        }
                    )
                ).subscribe(
                    data => {

                    },
                    err => {
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );


        this.addActionHandler<Actions.WordlistSaveFormSubmitDone>(
            ActionName.WordlistSaveFormSubmitDone,
            (state, action) => {
                state.formIsActive = false;
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            'MAIN_MENU_DIRECT_SAVE',
            (state, action) => {
                state.saveFormat = action.payload['saveformat'];
                state.toLine.value = `${state.quickSaveRowLimit}`;
                state.toLine.value = '';
            },
            (state, action, dispatch) => {
                this.suspend({}, (action, syncData) => {
                    if (action.name === ActionName.WordlistFormSubmitReady) {
                        return null;
                    }
                    return syncData;
                }).pipe(
                    concatMap(
                        action => {
                            const payload = (action as Actions.WordlistFormSubmitReady).payload;
                            if (window.confirm(this.layoutModel.translate(
                                    'global__quicksave_limit_warning_{format}{lines}',
                                    {format: action.payload['saveformat'], lines: state.quickSaveRowLimit}))) {
                                return this.submit(state, payload.args);

                            } else {
                                return rxOf({});
                            }
                        }
                    )
                ).subscribe(
                    data => {
                    },
                    err => {
                        this.layoutModel.showMessage('error', err);
                    }
                );
            }
        );
    }

    private validateForm(state:WordlistSaveModelState):Error|null {
        if (state.toLine.value === '' || !isNaN(parseInt(state.toLine.value))) {
            state.toLine.isInvalid = false;
            return null;

        } else {
            state.toLine.isInvalid = true;
            return new Error(this.layoutModel.translate('global__invalid_number_format'));
        }
    }

    private submit(state:WordlistSaveModelState, submitArgs:MultiDict):Observable<{}> {
        submitArgs.remove('format');
        submitArgs.set('saveformat', state.saveFormat);
        submitArgs.set('from_line', '1');
        submitArgs.set('to_line', state.toLine.value);
        if (state.saveFormat === SaveData.Format.CSV || state.saveFormat === SaveData.Format.XLSX) {
            submitArgs.set('colheaders', state.includeColHeaders ? '1' : '0');
            submitArgs.remove('heading');

        } else {
            submitArgs.set('heading', state.includeHeading ? '1' : '0');
            submitArgs.remove('colheaders');
        }
        this.saveLinkFn(
            `word-list.${SaveData.formatToExt(state.saveFormat)}`,
            this.layoutModel.createActionUrl('wordlist/savewl', submitArgs.items())
        );
        // TODO
        return rxOf({});
    }
}