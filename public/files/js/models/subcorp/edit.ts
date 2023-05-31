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
import { Action, IActionQueue, SEDispatcher, StatelessModel } from 'kombo';

import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { Actions as TTActions } from '../textTypes/actions';
import { Actions as ATActions } from '../asyncTask/actions';
import { HTTP, List, pipe, tuple } from 'cnc-tskit';
import {
    archiveSubcorpora,
    CreateSubcorpus,
    CreateSubcorpusArgs,
    CreateSubcorpusDraft,
    CreateSubcorpusRawCQLArgs,
    CreateSubcorpusWithinArgs,
    isCQLSelection,
    SubcorpusPropertiesResponse,
    SubcorpusRecord,
    subcServerRecord2SubcorpusRecord,
    wipeSubcorpora } from './common';
import * as PluginInterfaces from '../../types/plugins';


export interface SubcorpusEditModelState {
    isBusy:boolean;
    data:SubcorpusRecord|undefined;
    liveAttrsEnabled:boolean;
    liveAttrsInitialized:boolean;
    previewEnabled:boolean;
    prevRawDescription:string|undefined;
}

type PayloadType<T> = T extends Action<infer P> ? P : never;

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
            ATActions.AsyncTasksChecked,
            (state, action) => {
                if (state.data) { // only if the model is active (i.e. currently editing something)
                    const idx = List.findIndex(task =>
                        task.category === 'subcorpus' &&
                        task.status === 'SUCCESS' &&
                        task.args['corpname'] === state.data.corpname &&
                        task.args['usesubcorp'] === state.data.usesubcorp,
                        action.payload.tasks,
                    );
                    if (idx !== -1) {
                        // TODO `ATActions.AsyncTasksChecked` is already side effect action
                        // cannot use SEDispatcher
                        this.layoutModel.dispatcher.dispatch(
                            Actions.LoadSubcorpus,
                            {
                                corpname: state.data.corpname,
                                usesubcorp: initialState.data.usesubcorp,
                            }
                        );
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.LoadSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.loadSubcorpData(action.payload?.corpname, action.payload?.usesubcorp, dispatch);
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
                if (!action.error && state.data) {
                    state.data.archived = action.payload.archived[0].archived;
                }
            }
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
                this.waitForActionWithTimeout(
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
                        readyAction => {
                            let args: CreateSubcorpusArgs |
                                CreateSubcorpusWithinArgs |
                                CreateSubcorpusRawCQLArgs;
                            if (TTActions.isTextTypesQuerySubmitReady(readyAction)) {
                                args = {
                                    corpname: state.data.corpname,
                                    subcname: action.payload.newName,
                                    description: state.data.descriptionRaw,
                                    aligned_corpora: state.data.aligned,
                                    text_types: readyAction.payload.selections,
                                    form_type: 'tt-sel',
                                    usesubcorp: action.payload.usesubcorp,
                                };

                            } else if (Actions.isFormWithinSubmitArgsReady(readyAction)) {
                                args = {
                                    corpname: state.data.corpname,
                                    subcname: action.payload.newName,
                                    description: state.data.descriptionRaw,
                                    within: readyAction.payload.data,
                                    form_type: 'within',
                                    usesubcorp: action.payload.usesubcorp,
                                };

                            } else if (Actions.isReuseQueryEmptyReady(readyAction)) {
                                args = {
                                    corpname: state.data.corpname,
                                    subcname: action.payload.newName,
                                    description: state.data.descriptionRaw,
                                    cql: isCQLSelection(state.data.selections) ?
                                        state.data.selections :
                                        '',
                                    aligned_corpora: [],
                                    form_type: 'cql'
                                }
                            }

                            if (args) {
                                if (action.payload.asDraft) {
                                    return this.saveDraft(state, args).pipe(
                                        map(resp => tuple(args, resp))
                                    )
                                }

                                return this.createSubcorpus(args, dispatch).pipe(
                                    map(resp => tuple(args, resp))
                                )
                            }

                            return throwError(() => new Error('Invalid action passed through suspend filter'));
                        }
                    )

                ).subscribe({
                    next: ([args, resp]) => {
                        dispatch(Actions.ReuseQueryDone);
                        if (action.payload.asDraft) {
                            this.layoutModel.showMessage(
                                'info',
                                this.layoutModel.translate('subclist__subc_save_draft_confirm_msg')
                            );

                        } else {
                            this.layoutModel.showMessage(
                                'info',
                                this.layoutModel.translate('subclist__subc_reuse_confirm_msg')
                            );
                        }
                        // reload imediately in case the subcorpus is created without receiving task
                        this.loadSubcorpData(state.data.corpname, state.data.usesubcorp, dispatch);
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
            Actions.SubmitNameAndPublicDescription,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.updateSubcorpusNameAndDescSubmit(state, false, dispatch);
            }
        );

        this.addActionHandler(
            Actions.SubmitNameAndPublicDescriptionDone,
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
            Actions.UpdateSubcName,
            (state, action) => {
                state.data.name = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.TogglePublicDescription,
            (state, action) => {
                state.previewEnabled = !state.previewEnabled;
            },
            (state, action, dispatch) => {
                if (state.previewEnabled && state.prevRawDescription !== state.data.descriptionRaw) {
                    this.updateSubcorpusNameAndDescSubmit(state, true, dispatch);
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

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.RefineClicked,
            (state, action) => {
                state.liveAttrsInitialized = true;
            }
        );

        this.addActionHandler(
            Actions.HideSubcEditWindow,
            (state, action) => {
                state.liveAttrsInitialized = false;
            }
        );
    }

    private updateSubcorpusNameAndDescSubmit(
        state:SubcorpusEditModelState,
        previewOnly:boolean,
        dispatch:SEDispatcher
    ):void {
        this.layoutModel.ajax$<{preview:string; saved:boolean}>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'subcorpus/update_name_and_public_desc',
                {'preview-only': previewOnly ? previewOnly : undefined}
            ),
            {
                corpname: state.data.corpname,
                usesubcorp: state.data.usesubcorp,
                subcname: state.data.name,
                description: state.data.descriptionRaw
            }
        ).subscribe({
            next: resp => {
                dispatch(
                    Actions.SubmitNameAndPublicDescriptionDone,
                    {
                        name: state.data.name,
                        preview: resp.preview,
                        saved: resp.saved
                    }
                );

            },
            error: error => {
                dispatch(
                    Actions.SubmitNameAndPublicDescriptionDone,
                    error
                )
            }
        });
    }

    private saveDraft(
        state:SubcorpusEditModelState,
        args:CreateSubcorpusArgs|CreateSubcorpusWithinArgs|CreateSubcorpusRawCQLArgs,
    ):Observable<CreateSubcorpusDraft> {
        return this.layoutModel.ajax$<CreateSubcorpusDraft>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/create_draft'),
            args,
            {
                contentType: 'application/json'
            }

        );
    }

    private createSubcorpus(
        args:CreateSubcorpusArgs|CreateSubcorpusWithinArgs|CreateSubcorpusRawCQLArgs,
        dispatch:SEDispatcher,
    ):Observable<CreateSubcorpus> {
        return this.layoutModel.ajax$<CreateSubcorpus>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/create'),
            args,
            {
                contentType: 'application/json'
            }

        ).pipe(
            tap((data) => {
                data.processed_subc.forEach(
                    task => {
                        dispatch(
                            ATActions.InboxAddAsyncTask,
                            {
                                ident: task.ident,
                                label: task.label,
                                category: task.category,
                                status: task.status,
                                created: task.created,
                                error: task.error,
                                args: task.args,
                                url: undefined
                            } as PayloadType<typeof ATActions.InboxAddAsyncTask>
                        );
                        if ((args.form_type === 'tt-sel' || args.form_type === 'within') &&
                                args.usesubcorp) {
                            this.layoutModel.dispatcher.dispatch(
                                Actions.AttachTaskToSubcorpus,
                                {
                                    subcorpusId: args.usesubcorp,
                                    task
                                }
                            );
                        }
                    }
                );
            })
        );
    }

    private wipeSubcorpus(state:SubcorpusEditModelState, dispatch: SEDispatcher) {
        return wipeSubcorpora(
            this.layoutModel,
            [{corpname: state.data.corpname, subcname: state.data.usesubcorp}]
        ).subscribe({
            next: data => {
                dispatch(
                    Actions.WipeSubcorpusDone,
                    {
                        numWiped: data.num_wiped
                    }
                );
                dispatch(Actions.HideSubcEditWindow);
            },
            error: error => {
                this.layoutModel.showMessage('error', error);
            }
        });
    }

    private loadSubcorpData(corpname: string, subcname: string, dispatch: SEDispatcher) {
        this.layoutModel.ajax$<SubcorpusPropertiesResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('subcorpus/properties'),
            {
                corpname,
                usesubcorp: subcname,
            }

        ).subscribe({
            next: (data) => {
                const alignedSelection = pipe(
                    data.availableAligned,
                    List.map(item => ({
                        label: item.label,
                        value: item.n,
                        selected: data.data.aligned ? data.data.aligned.includes(item.n) : false,
                        locked: false,
                    })),
                );
                dispatch(
                    Actions.LoadSubcorpusDone,
                    {
                        corpname,
                        subcname,
                        // TODO improve data SubcorpusRecord type
                        data: subcServerRecord2SubcorpusRecord(data.data),
                        textTypes: data.textTypes,
                        structsAndAttrs: data.structsAndAttrs,
                        liveAttrsEnabled: data.liveAttrsEnabled,
                        alignedSelection,
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
        return archiveSubcorpora(
            this.layoutModel,
            [{corpname, subcname}]
        ).subscribe({
            next: resp => {
                dispatch(
                    Actions.ArchiveSubcorpusDone,
                    {archived: resp.archived},
                )
            },
            error: error => {
                dispatch(
                    Actions.ArchiveSubcorpusDone,
                    error,
                )
            }
        });
    }

    private restoreSubcorpus(corpname:string, subcname:string, dispatch: SEDispatcher) {
        this.layoutModel.ajax$<{}>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('/subcorpus/restore'),
            {
                corpname,
                usesubcorp: subcname,
            }
        ).subscribe({
            next: data => {
                dispatch(
                    Actions.RestoreSubcorpusDone
                );
            },
            error: error => {
                dispatch(
                    Actions.RestoreSubcorpusDone,
                    error,
                );
            }
        });
    }
}