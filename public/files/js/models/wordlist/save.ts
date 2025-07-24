/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { concatMap, scan } from 'rxjs/operators';

import * as Kontext from '../../types/kontext.js';
import { PageModel, SaveLinkHandler } from '../../app/page.js';
import { Action, IFullActionControl, StatelessModel } from 'kombo';
import { Actions } from './actions.js';
import { Actions as MainMenuActions } from '../mainMenu/actions.js';
import { WordlistSaveArgs, WordlistSubmitArgs } from './common.js';
import { DataSaveFormat } from '../../app/navigation/save.js';
import { Dict } from 'cnc-tskit';


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

        this.addActionHandler(
            Actions.WordlistSaveSetIncludeHeading,
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
                this.waitForAction(
                    {form: false, result: false},
                    (action, syncData) => {
                        switch (action.name) {
                            case Actions.WordlistFormSubmitReady.name:
                                syncData.form = true;
                                break;
                            case Actions.WordlistResultSaveArgs.name:
                                syncData.result = true;
                                break;
                        }
                        return Dict.hasValue(false, syncData) ? syncData : null;
                    }
                ).pipe(
                    scan<Action<{}>, {form:WordlistSubmitArgs|undefined, result:typeof Actions.WordlistResultSaveArgs.payload|undefined}>(
                        (acc, action) => {
                            if (Actions.isWordlistFormSubmitReady(action)) {
                                if (action.payload !== undefined) {
                                    acc.form = action.payload.args;
                                }

                            } else if (Actions.isWordlistResultSaveArgs(action)) {
                                acc.result = action.payload;
                            }
                            return acc;
                        },
                        {form:undefined, result:undefined}
                    ),
                    concatMap(
                        args => {
                            return this.submit(state, args.form, args.result);
                        }
                    ),
                ).subscribe({
                    next: data => {

                    },
                    error: err => {
                        this.layoutModel.showMessage('error', err);
                    }
                });
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
                this.waitForAction(
                    {form: false, result: false},
                    (action, syncData) => {
                        switch (action.name) {
                            case Actions.WordlistFormSubmitReady.name:
                                syncData.form = true;
                                break;
                            case Actions.WordlistResultSaveArgs.name:
                                syncData.result = true;
                                break;
                        }
                        return Dict.hasValue(false, syncData) ? syncData : null;
                    }
                ).pipe(
                    scan<Action<{}>, {form:WordlistSubmitArgs|undefined, result:typeof Actions.WordlistResultSaveArgs.payload|undefined}>(
                        (acc, action) => {
                            if (Actions.isWordlistFormSubmitReady(action)) {
                                acc.form = action.payload.args;

                            } else if (Actions.isWordlistResultSaveArgs(action)) {
                                acc.result = action.payload;
                            }
                            return acc;
                        },
                        {form: undefined, result: undefined}
                    ),
                    concatMap(
                        args => {
                            if (window.confirm(this.layoutModel.translate(
                                    'global__quicksave_limit_warning_{format}{lines}',
                                    {format: action.payload.saveformat, lines: state.quickSaveRowLimit}))) {
                                return this.submit(state, args.form, args.result);

                            } else {
                                return rxOf({});
                            }
                        }
                    ),
                ).subscribe({
                    next: data => {
                    },
                    error: err => {
                        this.layoutModel.showMessage('error', err);
                    }
                });
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

    private submit(state:WordlistSaveModelState, formArgs:WordlistSubmitArgs, resultArgs: typeof Actions.WordlistResultSaveArgs.payload):Observable<{}> {
        const submitArgs:WordlistSaveArgs = {
            q: `~${state.queryId}`,
            from_line: 1,
            to_line: state.toLine ? parseInt(state.toLine.value) : null,
            saveformat: state.saveFormat,
            colheaders: state.includeColHeaders ? 1 : 0,
            heading: state.includeHeading ? 1 : 0,
            wlsort: resultArgs.wlsort,
            reverse: resultArgs.reverse ? 1 : 0,
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