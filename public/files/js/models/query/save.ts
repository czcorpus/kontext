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

import { PageModel } from '../../app/page';
import * as Kontext from '../../types/kontext';
import { StatelessModel, IActionDispatcher, SEDispatcher } from 'kombo';
import { concatMap, map, Observable } from 'rxjs';
import { Actions } from './actions';
import { Actions as ConcActions } from '../concordance/actions';
import { HTTP } from 'cnc-tskit';
import { SaveItemResponse } from '../searchHistory/common';


interface IsArchivedResponse extends Kontext.AjaxResponse {
    is_archived:boolean;
    will_be_archived:boolean;
}

interface MakePermanentResponse extends Kontext.AjaxResponse {
    revoked:boolean;
}

export interface QuerySaveAsFormModelState {

    queryId:string;
    name:string;
    isBusy:boolean;
    isValidated:boolean;
    concTTLDays:number;
    concIsArchived:boolean;
    willBeArchived:boolean;
    concExplicitPersistenceUI:boolean;
}

/**
 *
 */
export class QuerySaveAsFormModel extends StatelessModel<QuerySaveAsFormModelState> {

    private layoutModel:PageModel;

    constructor(
        dispatcher:IActionDispatcher,
        layoutModel:PageModel,
        queryId:string,
        concTTLDays:number,
        concExplicitPersistenceUI:boolean
    ) {
        super(
            dispatcher,
            {
                name: '',
                isBusy: false,
                queryId,
                isValidated: false,
                concTTLDays,
                concIsArchived: false,
                willBeArchived: false,
                concExplicitPersistenceUI
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<typeof Actions.SaveAsFormSetName>(
            Actions.SaveAsFormSetName.name,
            (state, action) => {
                state.name = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.SaveAsFormSubmit>(
            Actions.SaveAsFormSubmit.name,
            (state, action) => {
                if (state.name) {
                    state.isValidated = true;
                    state.isBusy = true;

                } else {
                    state.isValidated = false;
                }
            },
            (state, action, dispatch) => {
                if (!state.isValidated) {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate('query__save_as_cannot_have_empty_name'));

                } else {
                    this.submit(state).subscribe(
                        () => {
                            this.layoutModel.resetMenuActiveItemAndNotify();
                            dispatch<typeof Actions.SaveAsFormSubmitDone>({
                                name: Actions.SaveAsFormSubmitDone.name
                            });
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            dispatch<typeof Actions.SaveAsFormSubmitDone>({
                                name: Actions.SaveAsFormSubmitDone.name
                            });
                        }
                    );
                }
            }
        );

        this.addActionHandler<typeof Actions.SaveAsFormSubmitDone>(
            Actions.SaveAsFormSubmitDone.name,
            (state, action) => {
                state.isBusy = false;
                // TODO these are side-effects actually
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    this.layoutModel.showMessage('info',
                        this.layoutModel.translate('query__save_as_item_saved'));
                }
            }
        );

        this.addActionHandler<typeof Actions.GetConcArchivedStatus>(
            Actions.GetConcArchivedStatus.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.loadStatus(state.queryId, dispatch).subscribe({
                    next: data => {
                        dispatch<typeof Actions.GetConcArchivedStatusDone>({
                            name: Actions.GetConcArchivedStatusDone.name,
                            payload: {
                                willBeArchived: data.will_be_archived,
                                isArchived: data.is_archived
                            }
                        });

                    },
                    error: error => {
                        dispatch<typeof Actions.GetConcArchivedStatusDone>({
                            name: Actions.GetConcArchivedStatusDone.name,
                            error
                        });
                    }
                })
            }
        );

        this.addActionHandler<typeof Actions.GetConcArchivedStatusDone>(
            Actions.GetConcArchivedStatusDone.name,
            (state, action) => {
                state.isBusy = false;
                state.concIsArchived = action.payload.isArchived;
                state.willBeArchived = action.payload.willBeArchived;
            }
        );

        this.addActionHandler<typeof Actions.MakeConcordancePermanent>(
            Actions.MakeConcordancePermanent.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.layoutModel.ajax$<MakePermanentResponse>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        'archive_concordance',
                        {
                            code: state.queryId,
                            revoke: action.payload.revoke
                        }
                    ),
                    {}

                ).pipe(
                    concatMap(_ => this.loadStatus(state.queryId, dispatch))

                ).subscribe({
                    next: data => {
                        dispatch<typeof Actions.MakeConcordancePermanentDone>({
                            name: Actions.MakeConcordancePermanentDone.name,
                            payload: {
                                willBeArchived: data.will_be_archived,
                                isArchived: data.is_archived
                            }
                        });

                    },
                    error: error => {
                        dispatch<typeof Actions.MakeConcordancePermanentDone>({
                            name: Actions.MakeConcordancePermanentDone.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.MakeConcordancePermanentDone>(
            Actions.MakeConcordancePermanentDone.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    state.concIsArchived = action.payload.isArchived;
                    state.willBeArchived = action.payload.willBeArchived;
                    if (!action.payload.isArchived && !action.payload.willBeArchived) {
                        this.layoutModel.showMessage(
                            'info',
                            this.layoutModel.translate('concview__make_conc_link_permanent_revoked')
                        );

                    } else {
                        this.layoutModel.showMessage(
                            'info',
                            this.layoutModel.translate('concview__make_conc_link_permanent_done')
                        );
                    }
                }
            }
        );

        this.addActionHandler(
            ConcActions.AddedNewOperation,
            (state, action) => {
                state.concIsArchived = false;
                state.willBeArchived = false;
                state.queryId = action.payload?.concId;
            }
        );
    }

    private loadStatus(queryId:string, dispatch:SEDispatcher):Observable<IsArchivedResponse> {
        return this.layoutModel.ajax$<IsArchivedResponse>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('get_stored_conc_archived_status'),
            {code: queryId}

        );
    }

    private submit(state:QuerySaveAsFormModelState):Observable<boolean> {
        return this.layoutModel.ajax$<SaveItemResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('save_query'),
            {
                query_id: state.queryId,
                name: state.name
            },
            {contentType: 'application/json'}

        ).pipe(
            map(
                resp => resp.saved
            )
        );
    }
}
