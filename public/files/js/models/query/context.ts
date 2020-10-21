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

import { IFullActionControl, StatelessModel } from 'kombo';
import { Actions, ActionName } from './actions';
import { CtxLemwordType } from './common';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { AjaxResponse } from '../../types/ajaxResponses';



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


export class QueryContextModel extends StatelessModel<QueryContextModelState>
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

        this.addActionHandler<Actions.QueryInputSelectContextFormItem>(
            ActionName.QueryInputSelectContextFormItem,
            (state, action) => {
                state.formData[action.payload.name] = action.payload.value;
            }
        );

        this.addActionHandler<Actions.QuerySubmit>(
            ActionName.QuerySubmit,
            null,
            (state, action, dispatch) => {
                dispatch<Actions.QueryContextFormPrepareArgsDone>({
                    name: ActionName.QueryContextFormPrepareArgsDone,
                    payload: {
                        data: {
                            fc_lemword_wsize: state.formData.fc_lemword_wsize,
                            fc_lemword: state.formData.fc_lemword,
                            fc_lemword_type: state.formData.fc_lemword_type,
                            fc_pos_wsize: state.formData.fc_pos_wsize,
                            fc_pos: state.formData.fc_pos,
                            fc_pos_type: state.formData.fc_pos_type
                        }
                    }
                });
            }
        ).sideEffectAlsoOn(
            ActionName.BranchQuery
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch<GlobalActions.SwitchCorpusReady<{}>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'query-context-model';
    }
}