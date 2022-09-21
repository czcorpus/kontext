/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import { CreateSubcorpusArgs, BaseTTSubcorpFormModel } from './common';
import { IFullActionControl } from 'kombo';
import { Actions } from './actions';
import { Actions as QueryActions } from '../query/actions';
import { Actions as TTActions } from '../textTypes/actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions } from '../common/actions';
import { Actions as LiveattrsActions } from '../../types/plugins/liveAttributes';
import { concatMap, map, Observable, throwError } from 'rxjs';
import { HTTP, tuple } from 'cnc-tskit';


export interface QuickSubcorpModelState {
    subcname: string;
    estimatedSubcSize:number|undefined;
    liveAttrsEnabled:boolean;
    isBusy:boolean;
}


export interface CreateSubcorpusDraft extends Kontext.AjaxResponse {
    subc_id:{corpus_name:string, id:string};
}


export class QuickSubcorpModel extends BaseTTSubcorpFormModel<QuickSubcorpModelState> implements IUnregistrable {

    constructor(
        dispatcher:IFullActionControl,
        pageModel:PageModel,
        liveAttrsEnabled:boolean
    ) {
        super(
            dispatcher,
            pageModel,
            {
                subcname: '',
                estimatedSubcSize: undefined,
                isBusy: false,
                liveAttrsEnabled
            },
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            action => {
                dispatcher.dispatch(
                    GlobalActions.SwitchCorpusReady,
                    {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                );
            }
        );

        this.addActionHandler(
            QueryActions.QueryShowQuickSubcorpWidget,
            action => {
                if (this.state.liveAttrsEnabled) {
                    this.changeState(state => {
                        state.isBusy = true;
                    });
                }
            }
        )

        this.addActionHandler(
            TTActions.FilterWholeSelection,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = false;
                        state.estimatedSubcSize = action.payload.poscount;
                    }
                );
            }
        );

        this.addActionHandler(
            LiveattrsActions.RefineCancelled,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = false;
                        state.estimatedSubcSize = action.payload.currentSubcorpSize;
                    }
                );
            }
        )

        this.addActionHandler(
            QueryActions.QueryAddSubcorp,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = false;
                    }
                )
            }
        )

        this.addActionHandler(
            Actions.QuickSubcorpSubmit,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = true;
                    }
                );

                this.suspendWithTimeout(
                    2000,
                    {},
                    (action, syncData) => {
                        if (TTActions.isTextTypesQuerySubmitReady(action)) {
                            return null;
                        }
                        return syncData;
                    }

                ).pipe(
                    concatMap(
                        action => {
                            if (TTActions.isTextTypesQuerySubmitReady(action)) {
                                const args:CreateSubcorpusArgs = {
                                    corpname: pageModel.getNestedConf('corpusIdent', 'id'),
                                    subcname: this.state.subcname,
                                    description: '',
                                    aligned_corpora: pageModel.getConf('alignedCorpora'),
                                    text_types: action.payload.selections,
                                    form_type: 'tt-sel'
                                };
                                return this.submitDraft(args, this.validate);

                            } else {
                                throwError(() => new Error('Invalid action passed through suspend filter'));
                            }
                        }
                    )

                ).subscribe({
                    next: (resp) => {
                        this.pageModel.showMessage('info', this.pageModel.translate('subc__quick_subcorpus_created'));
                        window.location.href = this.pageModel.createActionUrl('subcorpus/new', {corpname: resp.subc_id.corpus_name, usesubcorp: resp.subc_id.id})
                    },
                    error: error => {
                        this.pageModel.showMessage('error', error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.QuickSubcorpChangeName,
            action => {
                this.changeState(state => {
                    state.subcname = action.payload.value;
                });
            }
        );
    }

    validate(args: CreateSubcorpusArgs): Error | null {
        return null;
    }

    getRegistrationId():string {
        return 'quick-subcorpus-model';
    }

    submitDraft(args:CreateSubcorpusArgs, validator: (args) => Error|null):Observable<CreateSubcorpusDraft> {
        const err = validator(args);
        if (!err) {
            return this.pageModel.ajax$<CreateSubcorpusDraft>(
                HTTP.Method.POST,
                this.pageModel.createActionUrl(
                    '/subcorpus/create_draft',
                    {format: 'json'}
                ),
                args,
                {
                    contentType: 'application/json'
                }
            );

        } else {
            return throwError(() => err);
        }
    }
}