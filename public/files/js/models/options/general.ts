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

import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { IFullActionControl, StatelessModel } from 'kombo';
import { HTTP, List } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { Actions, ActionName } from './actions';
import { ViewOptsResponse } from './common';


interface GeneralOptionsArgsSubmit {
    pagesize:number;
    newctxsize:number;
    ctxunit:string;
    line_numbers:boolean;
    shuffle:boolean;
    wlpagesize:number;
    fmaxitems:number;
    citemsperpage:number;
    pqueryitemsperpage:number;
    rich_query_editor:boolean;
}

export interface GeneralViewOptionsModelState {

    pageSize:Kontext.FormValue<number>;

    newCtxSize:Kontext.FormValue<number>;

    wlpagesize:Kontext.FormValue<number>;

    fmaxitems:Kontext.FormValue<number>;

    citemsperpage:Kontext.FormValue<number>;

    pqueryitemsperpage:Kontext.FormValue<number>;

    ctxUnit:string;

    lineNumbers:boolean;

    shuffle:boolean;

    useRichQueryEditor:boolean;

    isBusy:boolean;

    loaded:boolean;

    userIsAnonymous:boolean;
}


export class GeneralViewOptionsModel extends StatelessModel<GeneralViewOptionsModelState> {

    private static readonly MAX_ITEMS_PER_PAGE = 500;

    private static readonly MAX_CTX_SIZE = 100;

    private readonly layoutModel:PageModel;

    private readonly submitResponseHandlers:Array<(store:GeneralViewOptionsModel)=>void>;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel, userIsAnonymous:boolean) {
        super(
            dispatcher,
            {
                userIsAnonymous,
                pageSize: Kontext.newFormValue(0, true),
                newCtxSize: Kontext.newFormValue(0, true),
                ctxUnit: '',
                lineNumbers: false,
                shuffle: false,
                useRichQueryEditor: false,
                wlpagesize: Kontext.newFormValue(0, true),
                fmaxitems: Kontext.newFormValue(0, true),
                citemsperpage: Kontext.newFormValue(0, true),
                pqueryitemsperpage: Kontext.newFormValue(0, true),
                isBusy: false,
                loaded: false,
            }
        );
        this.layoutModel = layoutModel;
        this.submitResponseHandlers = [];

        this.addActionHandler<MainMenuActions.ShowGeneralViewOptions>(
            MainMenuActionName.ShowGeneralViewOptions,
            (state, action) => {
                state.isBusy = true;
                state.loaded = false;
            },
            (state, action, dispatch) => {
                this.loadData().subscribe(
                    (data) => {
                        dispatch<Actions.GeneralInitalDataLoaded>({
                            name: ActionName.GeneralInitalDataLoaded,
                            payload: {
                                data: data
                            }
                        });
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        dispatch<Actions.GeneralInitalDataLoaded>({
                            name: ActionName.GeneralInitalDataLoaded,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.GeneralInitalDataLoaded>(
            ActionName.GeneralInitalDataLoaded,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.loaded = true;
                    state.pageSize = {value: action.payload.data.pagesize, isInvalid: false, isRequired: true};
                    state.newCtxSize = {value: action.payload.data.newctxsize, isInvalid: false, isRequired: true};
                    state.ctxUnit = action.payload.data.ctxunit;
                    state.lineNumbers = action.payload.data.line_numbers;
                    state.shuffle = action.payload.data.shuffle;
                    state.wlpagesize = {value: action.payload.data.wlpagesize, isInvalid: false, isRequired: true};
                    state.fmaxitems = {value: action.payload.data.fmaxitems, isInvalid: false, isRequired: true};
                    state.citemsperpage = {value: action.payload.data.citemsperpage, isInvalid: false, isRequired: true};
                    state.pqueryitemsperpage = {value: action.payload.data.pqueryitemsperpage, isInvalid: false, isRequired: true};
                    state.useRichQueryEditor = action.payload.data.rich_query_editor;
                }
            }
        );

        this.addActionHandler<Actions.GeneralSetPageSize>(
            ActionName.GeneralSetPageSize,
            (state, action) => {
                state.pageSize.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetContextSize>(
            ActionName.GeneralSetContextSize,
            (state, action) => {
                state.newCtxSize.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetLineNums>(
            ActionName.GeneralSetLineNums,
            (state, action) => {
                state.lineNumbers = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetShuffle>(
            ActionName.GeneralSetShuffle,
            (state, action) => {
                state.shuffle = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetUseRichQueryEditor>(
            ActionName.GeneralSetUseRichQueryEditor,
            (state, action) => {
                state.useRichQueryEditor = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetWlPageSize>(
            ActionName.GeneralSetWlPageSize,
            (state, action) => {
                state.wlpagesize.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetFmaxItems>(
            ActionName.GeneralSetFmaxItems,
            (state, action) => {
                state.fmaxitems.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetCitemsPerPage>(
            ActionName.GeneralSetCitemsPerPage,
            (state, action) => {
                state.citemsperpage.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSetPQueryitemsPerPage>(
            ActionName.GeneralSetPQueryitemsPerPage,
            (state, action) => {
                state.pqueryitemsperpage.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.GeneralSubmit>(
            ActionName.GeneralSubmit,
            (state, action) => {
                state.isBusy = true;
                this.validateForm(state);
            },
            (state, action, dispatch) => {
                if (this.hasErrorInputs(state)) {
                    const err = new Error(this.layoutModel.translate('global__the_form_contains_errors_msg'));
                    this.layoutModel.showMessage('error', err);
                    dispatch<Actions.GeneralSubmitDone>({
                        name: ActionName.GeneralSubmitDone,
                        error: err
                    });

                } else {
                    this.submit(state).subscribe(
                        () => {
                            dispatch<Actions.GeneralSubmitDone>({
                                name: ActionName.GeneralSubmitDone,
                                payload: {
                                    showLineNumbers: state.lineNumbers,
                                    pageSize: state.pageSize.value,
                                    newCtxSize: state.newCtxSize.value,
                                    wlpagesize: state.wlpagesize.value,
                                    fmaxitems: state.fmaxitems.value,
                                    citemsperpage: state.citemsperpage.value,
                                    pqueryitemsperpage: state.pqueryitemsperpage.value
                                }
                            });
                            List.forEach(fn => fn(this), this.submitResponseHandlers);
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            dispatch<Actions.GeneralSubmitDone>({
                                name: ActionName.GeneralSubmitDone,
                                error: err
                            });
                        }
                    );
                }
            }
        );

        this.addActionHandler<Actions.GeneralSubmitDone>(
            ActionName.GeneralSubmitDone,
            (state, action) => {
                state.isBusy = false;
            }
        );
    }

    private testMaxPageSize(v:number):boolean {
        return v <= GeneralViewOptionsModel.MAX_ITEMS_PER_PAGE;
    }

    private testMaxCtxSize(v:number):boolean {
        return v <= GeneralViewOptionsModel.MAX_CTX_SIZE;
    }

    private hasErrorInputs(state:GeneralViewOptionsModelState):boolean {
        return List.some(
            x => x.isInvalid,
            [state.pageSize, state.newCtxSize, state.wlpagesize, state.citemsperpage, state.newCtxSize]
        );
    }

    private validateForm(state:GeneralViewOptionsModelState):void {
        List.forEach(
            val => {
                if (Kontext.isFormValue(val)) {
                    if (!this.testMaxPageSize(val.value)) {
                        val.isInvalid = true;
                        val.errorDesc = this.layoutModel.translate('options__max_items_per_page_exceeded_{num}',
                                            {num: GeneralViewOptionsModel.MAX_ITEMS_PER_PAGE});

                    } else {
                        val.isInvalid = false;
                        val.errorDesc = undefined;
                    }
                }
            },
            [state.pageSize, state.newCtxSize, state.wlpagesize, state.citemsperpage]
        );

        if (!this.testMaxCtxSize(state.newCtxSize.value)) {
            state.newCtxSize.isInvalid = true;
            state.newCtxSize.errorDesc = this.layoutModel.translate('options__max_context_exceeded_{num}',
                    {num: GeneralViewOptionsModel.MAX_CTX_SIZE});

        } else {
            state.newCtxSize.isInvalid = false;
            state.newCtxSize.errorDesc = undefined;
        }
    }

    addOnSubmitResponseHandler(fn:(model:GeneralViewOptionsModel)=>void):void {
        this.submitResponseHandlers.push(fn);
    }

    loadData():Observable<ViewOptsResponse> {
        return this.layoutModel.ajax$<ViewOptsResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('options/viewopts'),
            {}
        );
    }

    private serialize(state:GeneralViewOptionsModelState):GeneralOptionsArgsSubmit {
        return {
            pagesize: state.pageSize.value,
            newctxsize: state.newCtxSize.value,
            ctxunit: state.ctxUnit,
            line_numbers: state.lineNumbers,
            shuffle: state.shuffle,
            wlpagesize: state.wlpagesize.value,
            fmaxitems: state.fmaxitems.value,
            citemsperpage: state.citemsperpage.value,
            pqueryitemsperpage: state.pqueryitemsperpage.value,
            rich_query_editor: state.useRichQueryEditor
        };
    }

    private submit(state:GeneralViewOptionsModelState):Observable<Kontext.AjaxResponse> {
        const args = this.serialize(state);
        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('options/viewoptsx'),
            args,
            {contentType: 'application/json'}

        ).pipe(
            tap(d => {
                this.layoutModel.replaceConcArg('pagesize', [`${state.pageSize.value}`]);
            })
        );
    }
}
