/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import { HTTP, List } from 'cnc-tskit';
import { IActionDispatcher, SEDispatcher, StatelessModel } from 'kombo';
import { PageModel } from '../../app/page';
import { IUnregistrable } from '../common/common';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../common/actions';
import { Actions as CorparchActions } from '../../types/plugins/corparch';
import { Actions as ATActions } from '../../models/asyncTask/actions';
import { KeywordsSubmitArgs, KeywordsSubmitResponse } from './common';
import { WlnumsTypes } from '../wordlist/common';
import { AsyncTaskInfo } from '../../types/kontext';


export type ScoreType = null|'logL'|'chi2';

export interface KeywordsFormState {
    isBusy:boolean;
    refCorp:string;
    refSubcorp:string;
    attr:string;
    pattern:string;
    scoreType:ScoreType;
    precalcTasks:Array<AsyncTaskInfo<{}>>;
}

export interface KeywordsFormCorpSwitchPreserve {
    refCorp:string;
    refSubcorp:string;
    attr:string;
    pattern:string;
    scoreType:ScoreType;
}

export interface KeywordsFormModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    refWidgetId:string;
    initialArgs:{
        ref_corpname:string;
        ref_usesubcorp:string;
        wlattr:string;
        wlpat:string;
        score_type:ScoreType;
    };
}

/**
 *
 */
export class KeywordsFormModel extends StatelessModel<KeywordsFormState> implements IUnregistrable {

    private readonly layoutModel:PageModel;

    private readonly refWidgetId:string;

    constructor({
        dispatcher,
        layoutModel,
        initialArgs,
        refWidgetId,
    }:KeywordsFormModelArgs) {
        super(
            dispatcher,
            {
                isBusy: false,
                refCorp: initialArgs ? initialArgs.ref_corpname : layoutModel.getNestedConf('refCorpusIdent', 'name'),
                refSubcorp: initialArgs ? initialArgs.ref_usesubcorp : layoutModel.getNestedConf('refCorpusIdent', 'usesubcorp'),
                attr: initialArgs ? initialArgs.wlattr : 'lemma',
                pattern: initialArgs ? initialArgs.wlpat : '.*',
                scoreType: initialArgs ? initialArgs.score_type : 'logL',
                precalcTasks: []
            }
        );
        this.layoutModel = layoutModel;
        this.refWidgetId = refWidgetId;

        this.addActionHandler(
            GlobalActions.CorpusSwitchModelRestore,
            (state, action)  => {
                if (!action.error) {
                    this.deserialize(
                        state,
                        action.payload.data[this.getRegistrationId()] as KeywordsFormCorpSwitchPreserve,
                        action.payload.corpora,
                    );
                }
            }
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            (state, action) => {
                dispatcher.dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(state)
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.SetAttr,
            (state, action) => {
                state.attr = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.SetPattern,
            (state, action) => {
                state.pattern = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.SetScoreType,
            (state, action) => {
                state.scoreType = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.SubmitQuery,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.submitRequest(state, dispatch);
            }
        );

        this.addActionHandler(
            Actions.SubmitQueryDone,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionSubtypeHandler(
            CorparchActions.WidgetCorpusChange,
            action => action.payload.widgetId === this.refWidgetId,
            (state, action) => {
                state.refCorp = action.payload.corpusIdent.id;
                state.refSubcorp = action.payload.corpusIdent.usesubcorp;
            }
        );

        this.addActionHandler(
            Actions.RegisterPrecalcTasks,
            (state, action) => {
                state.precalcTasks = action.payload.tasks;
            }
        );

        this.addActionHandler(
            ATActions.AsyncTasksChecked,
            (state, action) => {
                if (!List.empty(state.precalcTasks)) {
                    const updated:Array<AsyncTaskInfo<{}>> = [];
                    List.forEach(
                        (ourTask, i) => {
                            const srch = List.find(t => t.ident === ourTask.ident, action.payload.tasks);
                            updated.push(srch ? srch : ourTask);
                        },
                        state.precalcTasks
                    );
                    state.precalcTasks = updated;
                    if (!List.some(t => t.status === 'PENDING' || t.status === 'STARTED', state.precalcTasks)) {
                        state.isBusy = false;
                    }
                }
            },
            (state, action, dispatch) => {
                if (List.empty(state.precalcTasks)) {
                    return;

                } else if (List.every(t => t.status === 'SUCCESS' || t.status === 'FAILURE', state.precalcTasks)) {

                    if (List.every(t => t.status === 'SUCCESS', state.precalcTasks)) {
                        this.submitRequest(state, dispatch);

                    } else {
                        this.layoutModel.showMessage(
                            'error', this.layoutModel.translate('wordlist__failed_to_precalculate')
                        );
                    }
                }
            }
        );
    }

    getRegistrationId():string {
        return 'KeywordsFormModel';
    }

    private serialize(state:KeywordsFormState):KeywordsFormCorpSwitchPreserve {
        return {
            refCorp: state.refCorp,
            refSubcorp: state.refSubcorp,
            attr: state.attr,
            pattern: state.pattern,
            scoreType: state.scoreType,
        };
    }

    private deserialize(
        state:KeywordsFormState,
        data:KeywordsFormCorpSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        if (data) {
            state.refCorp = data.refCorp;
            state.refSubcorp = data.refSubcorp;
            state.attr = data.attr;
            state.pattern = data.pattern;
            state.scoreType = data.scoreType;
        }
    }

    createKeywordsArgs(state:KeywordsFormState, corpname:string, subcorp:string):KeywordsSubmitArgs {
        return {
            corpname: corpname,
            usesubcorp: subcorp,
            ref_corpname: state.refCorp,
            ref_usesubcorp: state.refSubcorp,
            include_nonwords: false,
            wlattr: state.attr,
            wlminfreq: 5,
            wlnums: WlnumsTypes.FRQ,
            wlpat: state.pattern,
            wltype: 'simple',
            score_type: state.scoreType,
        }
    }

    submitRequest(state:KeywordsFormState, dispatch:SEDispatcher) {
        const corp = this.layoutModel.getCorpusIdent();
        this.layoutModel.ajax$<KeywordsSubmitResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'keywords/submit',
                {format: 'json'}
            ),
            this.createKeywordsArgs(state, corp.name, corp.usesubcorp),
            {contentType: 'application/json'}

        ).subscribe({
            next: (resp) => {
                dispatch(Actions.SubmitQueryDone);

                if (resp.freq_files_avail) {
                    window.location.href = this.layoutModel.createActionUrl(
                        'keywords/result',
                        {
                            corpname: corp.name,
                            usesubcorp: corp.usesubcorp,
                            q: `~${resp.kw_query_id}`,
                        }
                    );

                } else {
                    this.layoutModel.showMessage(
                        'info',
                        this.layoutModel.translate('wordlist__aux_data_must_be_precalculated')
                    );
                    if (!List.empty(resp.subtasks)) {
                        List.forEach(
                            payload => {
                                dispatch<typeof ATActions.InboxAddAsyncTask>({
                                    name: ATActions.InboxAddAsyncTask.name,
                                    payload
                                })
                            },
                            resp.subtasks
                        );
                        dispatch<typeof Actions.RegisterPrecalcTasks>({
                            name: Actions.RegisterPrecalcTasks.name,
                            payload: {
                                tasks: resp.subtasks
                            }
                        });
                    }
                }
            },
            error: (err) => {
                dispatch(Actions.SubmitQueryDone, err);
            }
        });
    }

}