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

import * as Kontext from '../../types/kontext';
import { PageModel, SaveLinkHandler } from '../../app/page';
import { IFullActionControl, StatelessModel } from 'kombo';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { WordlistSaveArgs, WordlistSubmitArgs } from './common';
import { DataSaveFormat } from '../../app/navigation/save';


export interface WordlistSaveModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    quickSaveRowLimit:number;
    queryId:string;
    saveLinkFn:SaveLinkHandler;
}

export interface WordlistSaveModelState {
    queryId:string;
    formIsActive:boolean;
    toLine:Kontext.FormValue<string>;
    saveFormat:DataSaveFormat;
    includeHeading:boolean;
    includeColHeaders:boolean;
    quickSaveRowLimit:number;
}


export class WordlistSaveModel extends StatelessModel<WordlistSaveModelState> {

    private readonly layoutModel:PageModel;

    private readonly saveLinkFn:SaveLinkHandler<WordlistSaveArgs>;


    constructor({dispatcher, layoutModel, quickSaveRowLimit, queryId, saveLinkFn}:WordlistSaveModelArgs) {
        super(
            dispatcher,
            {
                queryId,
                toLine: { value: '', isInvalid: false, isRequired: true },
                saveFormat: 'csv',
                includeHeading: false,
                includeColHeaders: false,
                formIsActive: false,
                quickSaveRowLimit: quickSaveRowLimit
            }
        );
        this.layoutModel = layoutModel;
        this.saveLinkFn = saveLinkFn;

        this.addActionHandler<typeof MainMenuActions.ShowSaveForm>(
            MainMenuActions.ShowSaveForm.name,
            (state, action) => {
                state.formIsActive = true;
            }
        );

        this.addActionHandler<typeof Actions.WordlistSaveFormHide>(
            Actions.WordlistSaveFormHide.name,
            (state, action) => {
                state.formIsActive = false;
            }
        );

        this.addActionHandler<typeof Actions.WordlistSaveFormSetMaxLine>(
            Actions.WordlistSaveFormSetMaxLine.name,
            (state, action) => {
                state.toLine.value = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.WordlistSaveFormSetFormat>(
            Actions.WordlistSaveFormSetFormat.name,
            (state, action) => {
                state.saveFormat = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.WordlistSaveSetIncludeHeading>(
            Actions.WordlistSaveSetIncludeHeading.name,
            (state, action) => {
                state.includeHeading = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.WordlistSaveSetIncludeColHeaders>(
            Actions.WordlistSaveSetIncludeColHeaders.name,
            (state, action) => {
                state.includeColHeaders = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.WordlistSaveFormSubmit>(
            Actions.WordlistSaveFormSubmit.name,
            (state, action) => {
                const err = this.validateForm(state);
                if (!err) {
                    state.formIsActive = false;
                }
            },
            (state, action, dispatch) => {
                this.waitForAction({}, (action, syncData) => {
                    if (action.name === Actions.WordlistFormSubmitReady.name) {
                        return null;
                    }
                    return syncData;
                }).pipe(
                    concatMap(
                        action => {
                            const payload = (action as typeof Actions.WordlistFormSubmitReady).payload;
                            return this.submit(state, payload.args, state.queryId);
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


        this.addActionHandler<typeof Actions.WordlistSaveFormSubmitDone>(
            Actions.WordlistSaveFormSubmitDone.name,
            (state, action) => {
                state.formIsActive = false;
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler<typeof MainMenuActions.DirectSave>(
            MainMenuActions.DirectSave.name,
            (state, action) => {
                state.saveFormat = action.payload.saveformat;
                state.toLine.value = `${state.quickSaveRowLimit}`;
                state.toLine.value = '';
            },
            (state, action, dispatch) => {
                this.waitForAction({}, (action, syncData) => {
                    if (action.name === Actions.WordlistFormSubmitReady.name) {
                        return null;
                    }
                    return syncData;
                }).pipe(
                    concatMap(
                        wAction => {
                            const payload = (wAction as typeof Actions.WordlistFormSubmitReady).payload;
                            if (window.confirm(this.layoutModel.translate(
                                    'global__quicksave_limit_warning_{format}{lines}',
                                    {format: action.payload.saveformat, lines: state.quickSaveRowLimit}))) {
                                return this.submit(state, payload.args, state.queryId);

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

    private submit(state:WordlistSaveModelState, args:WordlistSubmitArgs, queryId:string):Observable<{}> {
        const submitArgs:WordlistSaveArgs = {
            q: `~${state.queryId}`,
            from_line: 1,
            to_line: state.toLine ? parseInt(state.toLine.value) : null,
            saveformat: state.saveFormat,
            colheaders: state.includeColHeaders ? 1 : 0,
            heading: state.includeHeading ? 1 : 0
        };
        if (isNaN(submitArgs.to_line)) {submitArgs.to_line = null}
        if (state.saveFormat === 'csv' || state.saveFormat === 'xlsx') {
            submitArgs.colheaders = state.includeColHeaders ? 1 : 0;
            submitArgs.heading = 0;

        } else {
            submitArgs.heading = state.includeHeading ? 1 : 0;
            submitArgs.colheaders = 1;
        }
        this.saveLinkFn(
            undefined,
            state.saveFormat,
            this.layoutModel.createActionUrl('wordlist/savewl', submitArgs),
        );
        // TODO
        return rxOf({});
    }
}