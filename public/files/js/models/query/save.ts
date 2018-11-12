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

import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {StatelessModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload, SEDispatcher} from '../../app/dispatcher';
import {MultiDict} from '../../util';
import { Kontext } from '../../types/common';


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

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, queryId:string, concTTLDays:number,
            concExplicitPersistenceUI:boolean) {
        super(
            dispatcher,
            {
                name: '',
                isBusy: false,
                queryId: queryId,
                isValidated: false,
                concTTLDays: concTTLDays,
                concIsArchived: false,
                concExplicitPersistenceUI: concExplicitPersistenceUI
            }
        );
        this.layoutModel = layoutModel;
    }

    reduce(state:QuerySaveAsFormModelState, action:ActionPayload):QuerySaveAsFormModelState {
        const newState = this.copyState(state);

        switch (action.actionType) {
            case 'QUERY_SAVE_AS_FORM_SET_NAME':
                newState.isValidated = false;
                newState.name = action.props['value'];
            break;
            case 'QUERY_SAVE_AS_FORM_SUBMIT':
                if (newState.name) {
                    newState.isValidated = true;
                    newState.isBusy = true;

                } else {
                    newState.isValidated = false;
                }
            break;
            case 'QUERY_SAVE_AS_FORM_SUBMIT_DONE':
                newState.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    this.layoutModel.showMessage('info',
                        this.layoutModel.translate('query__save_as_item_saved'));
                }
            break;
            case 'QUERY_GET_CONC_ARCHIVED_STATUS':
                newState.isBusy = true;
            break;
            case 'QUERY_GET_CONC_ARCHIVED_STATUS_DONE':
                newState.isBusy = false;
                newState.concIsArchived = action.props['isArchived'];
            break;
            case 'QUERY_MAKE_CONCORDANCE_PERMANENT':
                newState.isBusy = true;
            break;
            case 'QUERY_MAKE_CONCORDANCE_PERMANENT_DONE':
                newState.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    newState.concIsArchived = !action.props['revoked'];
                    if (action.props['revoked']) {
                        this.layoutModel.showMessage('info',
                                        this.layoutModel.translate('concview__make_conc_link_permanent_revoked'));
                    } else {
                        this.layoutModel.showMessage('info',
                                        this.layoutModel.translate('concview__make_conc_link_permanent_done'));
                    }
                }
            break;
            default:
                return state;
        }
        return newState;
    }

    sideEffects(state:QuerySaveAsFormModelState, action:ActionPayload, dispatch:SEDispatcher):void {
        switch (action.actionType) {
            case 'QUERY_SAVE_AS_FORM_SUBMIT':
                if (!state.isValidated) {
                    this.layoutModel.showMessage('error',
                            this.layoutModel.translate('query__save_as_cannot_have_empty_name'));

                } else {
                    this.submit(state).then(
                        () => {
                            this.layoutModel.resetMenuActiveItemAndNotify();
                            dispatch({
                                actionType: 'QUERY_SAVE_AS_FORM_SUBMIT_DONE',
                                props: {}
                            });
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            dispatch({
                                actionType: 'QUERY_SAVE_AS_FORM_SUBMIT_DONE',
                                props: {}
                            });
                        }
                    );
                }
            break;
            case 'QUERY_MAKE_CONCORDANCE_PERMANENT':
                this.layoutModel.ajax<MakePermanentResponse>(
                    'POST',
                    this.layoutModel.createActionUrl(
                        'archive_concordance',
                        [
                            ['code', state.queryId],
                            ['revoke', action.props['revoke'] ? '1' : '0']
                        ]
                    ),
                    {}

                ).then(
                    (data) => {
                        dispatch({
                            actionType: 'QUERY_MAKE_CONCORDANCE_PERMANENT_DONE',
                            props: {revoked: data.revoked}
                        });

                    },
                    (err) => {
                        dispatch({
                            actionType: 'QUERY_MAKE_CONCORDANCE_PERMANENT_DONE',
                            props: {},
                            error: err
                        });
                    }
                );
            break;
            case 'QUERY_GET_CONC_ARCHIVED_STATUS':
                this.layoutModel.ajax<IsArchivedResponse>(
                    'GET',
                    this.layoutModel.createActionUrl('get_stored_conc_archived_status'),
                    {code: state.queryId}

                ).then(
                    (data) => {
                        dispatch({
                            actionType: 'QUERY_GET_CONC_ARCHIVED_STATUS_DONE',
                            props: {isArchived: data.is_archived}
                        });

                    },
                    (err) => {
                        dispatch({
                            actionType: 'QUERY_GET_CONC_ARCHIVED_STATUS_DONE',
                            props: {},
                            error: err
                        });
                    }
                );
            break;
        }
    }

    private submit(state:QuerySaveAsFormModelState):RSVP.Promise<boolean> {
        const args = new MultiDict();
        args.set('query_id', state.queryId);
        args.set('name', state.name);
        return this.layoutModel.ajax<any>(
            'POST',
            this.layoutModel.createActionUrl('save_query'),
            args
        );
    }

}