/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Actions } from './actions';
import { CtxLemwordType } from './common';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { AjaxResponse } from '../../types/ajaxResponses';
import { List } from 'cnc-tskit';



export interface FormData {
    fc_lemword_wsize:[number, number];
    fc_lemword:string;
    fc_lemword_type:CtxLemwordType;
    fc_pos_wsize:[number, number];
    fc_pos:Array<string>;
    fc_pos_type:CtxLemwordType;
}


export interface QueryContextModelState {
    formData:FormData;
}


export class QueryContextModel extends StatefulModel<QueryContextModelState>
    implements IUnregistrable {

    constructor(dispatcher:IFullActionControl, values:AjaxResponse.QueryFormArgs) {
        super(dispatcher, {
            formData: {
                fc_lemword_wsize: values.fc_lemword_wsize,
                fc_lemword: values.fc_lemword,
                fc_lemword_type: values.fc_lemword_type,
                fc_pos_wsize: values.fc_pos_wsize,
                fc_pos: values.fc_pos,
                fc_pos_type: values.fc_pos_type
            }
        });

        this.addActionHandler<typeof Actions.QueryContextSetLemwordWsize>(
            Actions.QueryContextSetLemwordWsize.name,
            action => {
                this.changeState(state => {
                    state.formData.fc_lemword_wsize = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.QueryContextSetLemword>(
            Actions.QueryContextSetLemword.name,
            action => {
                this.changeState(state => {
                    state.formData.fc_lemword = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.QueryContextSetLemwordType>(
            Actions.QueryContextSetLemwordType.name,
            action => {
                this.changeState(state => {
                    state.formData.fc_lemword_type = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.QueryContextSetPosWsize>(
            Actions.QueryContextSetPosWsize.name,
            action => {
                this.changeState(state => {
                    state.formData.fc_pos_wsize = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.QueryContextSetPos>(
            Actions.QueryContextSetPos.name,
            action => {
                this.changeState(state => {
                    console.log('action.payload.checked: ', action.payload.checked)
                    if (action.payload.checked) {
                        state.formData.fc_pos = List.addUnique(action.payload.value, state.formData.fc_pos);

                    } else {
                        state.formData.fc_pos = List.removeValue(action.payload.value, state.formData.fc_pos);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.QueryContextSetPosType>(
            Actions.QueryContextSetPosType.name,
            action => {
                this.changeState(state => {
                    state.formData.fc_pos_type = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.QuerySubmit>(
            Actions.QuerySubmit.name,
            action => {
                this.dispatchSubmitReady();
            }
        );

        this.addActionHandler<typeof Actions.BranchQuery>(
            Actions.BranchQuery.name,
            action => {
                this.dispatchSubmitReady();
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            action => {
                dispatcher.dispatch<GlobalActions.SwitchCorpusReady<{}>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    private dispatchSubmitReady():void {
        this.dispatchSideEffect<typeof Actions.QueryContextFormPrepareArgsDone>({
            name: Actions.QueryContextFormPrepareArgsDone.name,
            payload: {
                data: {
                    fc_lemword_wsize: this.state.formData.fc_lemword_wsize,
                    fc_lemword: this.state.formData.fc_lemword,
                    fc_lemword_type: this.state.formData.fc_lemword_type,
                    fc_pos_wsize: this.state.formData.fc_pos_wsize,
                    fc_pos: this.state.formData.fc_pos,
                    fc_pos_type: this.state.formData.fc_pos_type
                }
            }
        });
    }

    getRegistrationId():string {
        return 'query-context-model';
    }
}