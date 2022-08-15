/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { concatMap, map, Observable, tap, throwError } from 'rxjs';
import { IActionQueue, SEDispatcher, StatelessModel } from 'kombo';

import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { Actions as TTActions } from '../textTypes/actions';
import { HTTP, tuple } from 'cnc-tskit';
import {
    CreateSubcorpus, CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs,
    CreateSubcorpusWithinArgs, isCQLSelection, SubcorpusPropertiesResponse, SubcorpusRecord, subcServerRecord2SubcorpusRecord } from './common';



export interface DerivedSubcorp {
    cql:string|undefined;
    published:boolean;
    description:string|undefined;
}


export interface SubcorpusEditModelState {
    isBusy:boolean;
    data:SubcorpusRecord|undefined;
    derivedSubc:DerivedSubcorp|undefined;
    liveAttrsEnabled:boolean;
    previewEnabled:boolean;
    prevRawDescription:string|undefined;
}


export class SubcorpusEditModel extends StatelessModel<SubcorpusEditModelState> {

    readonly layoutModel:PageModel;

    constructor(
        dispatcher:IActionQueue,
        initialState:SubcorpusEditModelState,
        layoutModel:PageModel
    ) {
        super(dispatcher, initialState);
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.LoadSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.loadSubcorpData(action.payload?.corpname, action.payload?.subcname, dispatch);
            }
        );

        this.addActionHandler(
            Actions.LoadSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.data = action.payload?.data;
                    state.liveAttrsEnabled = action.payload.liveAttrsEnabled;
                    state.prevRawDescription = state.data.descriptionRaw;
                }
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.ArchiveSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.archiveSubcorpus(action.payload.corpname, action.payload.subcname, dispatch);
            }
        );

        this.addActionHandler(
            Actions.ArchiveSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.data.archived = action.payload.archived;
                }
            },
        );

        this.addActionHandler(
            Actions.RestoreSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.restoreSubcorpus(state.data.corpname, state.data.usesubcorp, dispatch);
            }
        );

        this.addActionHandler(
            Actions.RestoreSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.data.archived = undefined;
                }
            }
        );

        this.addActionHandler(
            Actions.WipeSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.wipeSubcorpus(state, dispatch);
            }
        );

        this.addActionHandler(
            Actions.WipeSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler(
            Actions.ReuseQuery,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                const newName = action.payload.newName;
                this.suspendWithTimeout(
                    500,
                    {},
                    (sAction, syncData) => {
                        if (action.payload.selectionType === 'tt-sel' && TTActions.isTextTypesQuerySubmitReady(sAction)) {
                            return null;

                        } else if (action.payload.selectionType === 'within' && Actions.isFormWithinSubmitArgsReady(sAction)) {
                            return null;

                        } else if (action.payload.selectionType === 'cql' && Actions.isReuseQueryEmptyReady(sAction)) {
                            return null;
                        }
                        return syncData;
                    }

                ).pipe(
                    concatMap(
                        action => {
                            let args: CreateSubcorpusArgs |
                                CreateSubcorpusWithinArgs |
                                CreateSubcorpusRawCQLArgs;
                            if (TTActions.isTextTypesQuerySubmitReady(action)) {
                                args = {
                                    corpname: state.data.corpname,
                                    subcname: newName,
                                    description: '',
                                    aligned_corpora: [], // TODO what to do with this?
                                    text_types: action.payload.selections,
                                    form_type: 'tt-sel'
                                };

                            } else if (Actions.isFormWithinSubmitArgsReady(action)) {
                                args = {
                                    corpname: state.data.corpname,
                                    subcname: newName,
                                    description: '',
                                    within: action.payload.data,
                                    form_type: 'within'
                                };

                            } else if (Actions.isReuseQueryEmptyReady(action)) {
                                args = {
                                    corpname: state.data.corpname,
                                    subcname: newName,
                                    description: '',
                                    cql: isCQLSelection(state.data.selections) ?
                                        state.data.selections :
                                        '',
                                    aligned_corpora: [],
                                    form_type: 'cql'
                                }
                            }

                            if (args) {
                                return this.createSubcorpus(state, args).pipe(
                                    map(resp => tuple(args, resp))
                                )
                            }

                            return throwError(() => new Error('Invalid action passed through suspend filter'));
                        }
                    )

                ).subscribe({
                    next: ([args, resp]) => {
                        dispatch(Actions.ReuseQueryDone);
                        this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_reuse_confirm_msg'));
                    },
                    error: error => {
                        dispatch(Actions.ReuseQueryDone, error);
                        this.layoutModel.showMessage('error', action.error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ReuseQueryDone,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler(
            Actions.SubmitPublicDescription,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.updateSubcorpusDescSubmit(state, false, dispatch);
            }
        );

        this.addActionHandler(
            Actions.SubmitPublicDescriptionDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.data.description = action.payload.preview;
                    if (action.payload.saved) {
                        state.prevRawDescription = state.data.descriptionRaw;
                    }
                }
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else if (action.payload.saved) {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_desc_updated'));
                }
            }
        )

        this.addActionHandler(
            Actions.UpdatePublicDescription,
            (state, action) => {
                state.data.descriptionRaw = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.TogglePublicDescription,
            (state, action) => {
                state.previewEnabled = !state.previewEnabled;
            },
            (state, action, dispatch) => {
                if (state.previewEnabled && state.prevRawDescription !== state.data.descriptionRaw) {
                    this.updateSubcorpusDescSubmit(state, true, dispatch);
                }
            }
        );

        this.addActionHandler(
            Actions.FormRawCQLSetValue,
            (state, action) => {
                if (isCQLSelection(state.data.selections)) {
                    state.data.selections = action.payload.value;
                }
            }
        );
    }

    private updateSubcorpusDescSubmit(
        state:SubcorpusEditModelState,
        previewOnly:boolean,
        dispatch:SEDispatcher
    ):void {
        this.layoutModel.ajax$<{preview:string; saved:boolean}>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'subcorpus/update_public_desc',
                {'preview-only': previewOnly ? previewOnly : undefined}
            ),
            {
                corpname: state.data.corpname,
                usesubcorp: state.data.usesubcorp,
                description: state.data.descriptionRaw
            }
        ).subscribe({
            next: resp => {
                dispatch(
                    Actions.SubmitPublicDescriptionDone,
                    {
                        preview: resp.preview,
                        saved: resp.saved
                    }
                );

            },
            error: error => {
                dispatch(
                    Actions.SubmitPublicDescriptionDone,
                    error
                )
            }
        });
    }

    private createSubcorpus(
        state:SubcorpusEditModelState,
        args:CreateSubcorpusArgs|CreateSubcorpusWithinArgs|CreateSubcorpusRawCQLArgs,
    ):Observable<any> {
        return this.layoutModel.ajax$<CreateSubcorpus>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/ajax_create_subcorpus'),
            args,
            {
                contentType: 'application/json'
            }

        ).pipe(
            tap((data) => {
                data.processed_subc.forEach(item => {
                    this.layoutModel.registerTask({
                        ident: item.ident,
                        label: item.label,
                        category: item.category,
                        status: item.status,
                        created: item.created,
                        error: item.error,
                        args: item.args,
                        url: undefined
                    });

                });
            })
        );
    }

    private wipeSubcorpus(state:SubcorpusEditModelState, dispatch: SEDispatcher) {
        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/delete'),
            {
                corpname: state.data.corpname,
                usesubcorp: state.data.usesubcorp
            }
        ).subscribe({
            next: data => {
                dispatch(Actions.WipeSubcorpusDone);
                dispatch(Actions.HideSubcEditWindow);
                this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_deleted'));
            },
            error: error => {
                this.layoutModel.showMessage('error', error);
            }
        });
    }

    private loadSubcorpData(corpname: string, subcname: string, dispatch: SEDispatcher) {
        this.layoutModel.ajax$<SubcorpusPropertiesResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('/subcorpus/properties'),
            {
                corpname: corpname,
                usesubcorp: subcname,
            }

        ).subscribe({
            next: (data) => {
                dispatch(
                    Actions.LoadSubcorpusDone,
                    {
                        corpname: corpname,
                        subcname: subcname,
                        // TODO improve data SubcorpusRecord type
                        data: subcServerRecord2SubcorpusRecord(data.data),
                        textTypes: data.textTypes,
                        structsAndAttrs: data.structsAndAttrs,
                        liveAttrsEnabled: data.liveAttrsEnabled,
                    }
                );
            },
            error: (error) => {
                dispatch(
                    Actions.LoadSubcorpusDone,
                    error
                );
            }
        })
    }

    private archiveSubcorpus(corpname:string, subcname:string, dispatch: SEDispatcher) {
        return this.layoutModel.ajax$<{archived: number}>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/archive'),
            {
                corpname: corpname,
                usesubcorp: subcname
            },
        ).subscribe({
            next: resp => {
                dispatch(
                    Actions.ArchiveSubcorpusDone,
                    {archived: resp.archived},
                )
                this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_archived'));
            },
            error: error => {
                dispatch(
                    Actions.ArchiveSubcorpusDone,
                    error,
                )
                this.layoutModel.showMessage('error', error);
            }
        });
    }

    private restoreSubcorpus(corpname:string, subcname:string, dispatch: SEDispatcher) {
        this.layoutModel.ajax$<{}>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('/subcorpus/restore'),
            {
                corpname: corpname,
                usesubcorp: subcname,
            }
        ).subscribe({
            next: data => {
                dispatch(Actions.RestoreSubcorpusDone);
                this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_restored'));
            },
            error: error => {
                this.layoutModel.showMessage('error', error);
            }
        });
    }
}