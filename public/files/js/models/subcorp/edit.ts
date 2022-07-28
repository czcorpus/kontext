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

import { Observable, tap } from 'rxjs';
import { IActionQueue, SEDispatcher, StatelessModel } from 'kombo';

import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { HTTP } from 'cnc-tskit';
import { CreateSubcorpus, CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, isCQLSelection, isServerWithinSelection, isTTSelection, SubcorpusRecord } from './common';
import { SubcorpusPropertiesResponse } from '../common/layout';



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
                this.loadSubcorpData(state.data.corpname, state.data.usesubcorp, dispatch);
            }
        );

        this.addActionHandler(
            Actions.RestoreSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.layoutModel.ajax$<any>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl('/subcorpus/restore'),
                    {
                        corpname: state.data.corpname,
                        usesubcorp: state.data.usesubcorp,
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
        );

        this.addActionHandler(
            Actions.RestoreSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
                state.data.archived = undefined;
            }
        );

        this.addActionHandler(
            Actions.WipeSubcorpus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.wipeSubcorpus(
                    state

                ).subscribe({
                    next: data => {
                        dispatch(Actions.WipeSubcorpusDone);
                        dispatch(Actions.HideSubcEditWindow);
                        this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_deleted'));
                    },
                    error: error => {
                        this.layoutModel.showMessage('error', error);
                    }
                })
            }
        );

        this.addActionHandler(
            Actions.WipeSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
            }
        )

        this.addActionHandler(
            Actions.ReuseQuery,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.createSubcorpus(state, action.payload.newName).subscribe({
                    next: data => {
                        dispatch(Actions.ReuseQueryDone);
                    },
                    error: error => {
                        dispatch(Actions.ReuseQueryDone, error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ReuseQueryDone,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_reuse_confirm_msg'));

                } else {
                    this.layoutModel.showMessage('error', action.error);
                }
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
        )
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
        newName:string,
    ):Observable<any> {
        let args: CreateSubcorpusArgs|CreateSubcorpusWithinArgs|CreateSubcorpusRawCQLArgs;
        if (isTTSelection(state.data.selections)) {
            args = {
                corpname: state.data.corpname,
                subcname: newName,
                description: '',
                aligned_corpora: [], // TODO
                text_types: state.data.selections,
                form_type: 'tt-sel'
            } as CreateSubcorpusArgs;

        } else if (isServerWithinSelection(state.data.selections)) {
            args = {
                corpname: state.data.corpname,
                subcname: newName,
                description: '',
                aligned_corpora: [], // TODO
                within: state.data.selections,
                form_type: 'within'
            } as CreateSubcorpusWithinArgs;

        } else if (isCQLSelection(state.data.selections)) {
            args = {
                corpname: state.data.corpname,
                subcname: newName,
                description: '',
                aligned_corpora: [], // TODO
                cql: state.data.selections,
                form_type: 'cql'
            } as CreateSubcorpusRawCQLArgs;
        }

        return this.layoutModel.ajax$<CreateSubcorpus>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/ajax_create_subcorpus'),
            args,

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

    private wipeSubcorpus(state:SubcorpusEditModelState):Observable<any> {
        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/delete'),
            {
                corpname: state.data.corpname,
                usesubcorp: state.data.usesubcorp
            }
        );
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
                        data: {
                            corpname: data.data.corpus_name,
                            usesubcorp: data.data.id,
                            name: data.data.name,
                            created: data.data.created,
                            archived: data.data.archived,
                            published: data.data.published,
                            selections: data.data.text_types||data.data.within_cond||data.data.cql,
                            size: data.data.size,
                            description: data.data.public_description,
                            descriptionRaw: data.data.public_description_raw,
                        },
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
}