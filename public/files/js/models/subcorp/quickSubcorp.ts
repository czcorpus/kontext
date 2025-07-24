/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { PageModel } from '../../app/page.js';
import { CreateSubcorpusArgs, BaseTTSubcorpFormModel } from './common.js';
import { IFullActionControl } from 'kombo';
import { Actions } from './actions.js';
import { Actions as QueryActions } from '../query/actions.js';
import { Actions as TTActions } from '../textTypes/actions.js';
import { IUnregistrable } from '../common/common.js';
import { Actions as GlobalActions } from '../common/actions.js';
import { Actions as LiveattrsActions } from '../../types/plugins/liveAttributes.js';
import { concatMap, throwError } from 'rxjs';


export interface QuickSubcorpModelState {
    subcname: string;
    estimatedSubcSize:number|undefined;
    liveAttrsEnabled:boolean;
    isBusy:boolean;
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
        );

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
        );

        this.addActionHandler(
            Actions.QuickSubcorpSubmit,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = true;
                    }
                );

                this.waitForActionWithTimeout(
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
                                    corpname: pageModel.getCorpusIdent().id,
                                    subcname: this.state.subcname,
                                    size: this.state.estimatedSubcSize,
                                    description: '',
                                    aligned_corpora: pageModel.getConf('alignedCorpora'),
                                    text_types: action.payload.selections,
                                    form_type: 'tt-sel'
                                };
                                return this.submit(args, true, this.validate);

                            } else {
                                throwError(() => new Error('Invalid action passed through suspend filter'));
                            }
                        }
                    )

                ).subscribe({
                    next: (resp) => {
                        this.pageModel.showMessage('info', this.pageModel.translate('subc__quick_subcorpus_created'));
                        this.dispatchSideEffect(
                            Actions.QuickSubcorpSubmitDone
                        );
                    },
                    error: error => {
                        this.pageModel.showMessage('error', error);
                        this.dispatchSideEffect(
                            Actions.QuickSubcorpSubmitDone,
                            error
                        );
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.QuickSubcorpSubmitDone,
            action => {
                this.changeState(
                    state => {
                        state.isBusy = false;
                    }
                );
            }
        )

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
}