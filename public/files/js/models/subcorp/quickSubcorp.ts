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
import { TextTypesModel } from '../../models/textTypes/main';
import { CreateSubcorpusArgs, BaseTTSubcorpFormModel } from './common';
import { IFullActionControl } from 'kombo';
import { Actions } from './actions';
import { Actions as QueryActions } from '../query/actions';
import { Actions as TTActions } from '../textTypes/actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions } from '../common/actions';


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
        textTypesModel:TextTypesModel,
        liveAttrsEnabled:boolean
    ) {
        super(
            dispatcher,
            pageModel,
            textTypesModel,
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
                )
                const args:CreateSubcorpusArgs = {
                    corpname: pageModel.getNestedConf('corpusIdent', 'id'),
                    subcname: this.state.subcname,
                    publish: false,
                    description: '',
                    aligned_corpora: pageModel.getConf('alignedCorpora'),
                    text_types: this.textTypesModel.UNSAFE_exportSelections(false),
                    form_type: 'tt-sel'
                };
                this.submit(args, this.validate).subscribe({
                    next: data => {
                        this.pageModel.showMessage('info', this.pageModel.translate('subc__quick_subcorpus_created'));
                        this.dispatchSideEffect<typeof QueryActions.QueryAddSubcorp>({
                            name: QueryActions.QueryAddSubcorp.name,
                            payload: {
                                n: args.subcname,
                                v: args.subcname,
                                pub: null,
                            }
                        });
                    },
                    error: error => this.pageModel.showMessage('error', error)
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

}