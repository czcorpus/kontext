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

import {PageModel} from '../../app/page';
import {MultiDict} from '../../multidict';
import { Kontext } from '../../types/common';
import { StatelessModel, IActionDispatcher, Action, SEDispatcher } from 'kombo';
import { Observable } from 'rxjs';
import { Actions, ActionName } from './actions';
import { HTTP, tuple } from 'cnc-tskit';


interface IsArchivedResponse extends Kontext.AjaxResponse {
    is_archived:boolean;
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
                concExplicitPersistenceUI
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<Actions.SaveAsFormSetName>(
            ActionName.SaveAsFormSetName,
            (state, action) => {
                state.name = action.payload.value;
            }
        );

        this.addActionHandler<Actions.SaveAsFormSubmit>(
            ActionName.SaveAsFormSubmit,
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
                            dispatch<Actions.SaveAsFormSubmitDone>({
                                name: ActionName.SaveAsFormSubmitDone
                            });
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            dispatch<Actions.SaveAsFormSubmitDone>({
                                name: ActionName.SaveAsFormSubmitDone
                            });
                        }
                    );
                }
            }
        );

        this.addActionHandler<Actions.SaveAsFormSubmitDone>(
            ActionName.SaveAsFormSubmitDone,
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

        this.addActionHandler<Actions.GetConcArchivedStatus>(
            ActionName.GetConcArchivedStatus,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.layoutModel.ajax$<IsArchivedResponse>(
                    HTTP.Method.GET,
                    this.layoutModel.createActionUrl('get_stored_conc_archived_status'),
                    {code: state.queryId}

                ).subscribe(
                    (data) => {
                        dispatch<Actions.GetConcArchivedStatusDone>({
                            name: ActionName.GetConcArchivedStatusDone,
                            payload: {isArchived: data.is_archived}
                        });

                    },
                    (err) => {
                        dispatch<Actions.GetConcArchivedStatusDone>({
                            name: ActionName.GetConcArchivedStatusDone,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.GetConcArchivedStatusDone>(
            ActionName.GetConcArchivedStatusDone,
            (state, action) => {
                state.isBusy = false;
                state.concIsArchived = action.payload.isArchived;
            }
        );

        this.addActionHandler<Actions.MakeConcordancePermanent>(
            ActionName.MakeConcordancePermanent,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.layoutModel.ajax$<MakePermanentResponse>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        'archive_concordance',
                        [
                            tuple('code', state.queryId),
                            tuple('revoke', action.payload.revoke ? '1' : '0')
                        ]
                    ),
                    {}

                ).subscribe(
                    (data) => {
                        dispatch<Actions.MakeConcordancePermanentDone>({
                            name: ActionName.MakeConcordancePermanentDone,
                            payload: {revoked: data.revoked}
                        });

                    },
                    (err) => {
                        dispatch<Actions.MakeConcordancePermanentDone>({
                            name: ActionName.MakeConcordancePermanentDone,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.MakeConcordancePermanentDone>(
            ActionName.MakeConcordancePermanentDone,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    state.concIsArchived = !action.payload.revoked;
                    if (action.payload.revoked) {
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
    }

    private submit(state:QuerySaveAsFormModelState):Observable<boolean> {
        const args = new MultiDict();
        args.set('query_id', state.queryId);
        args.set('name', state.name);
        return this.layoutModel.ajax$<any>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('save_query'),
            args
        );
    }

}