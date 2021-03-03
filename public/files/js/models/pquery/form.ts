/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Dict, HTTP, List, pipe, tuple } from 'cnc-tskit';
import { IActionDispatcher, SEDispatcher, StatelessModel } from 'kombo';
import { Observable, forkJoin } from 'rxjs';
import { PageModel } from '../../app/page';
import { Actions, ActionName } from './actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../query/actions';
import { Actions as ACActions, ActionName as ACActionName } from '../../models/asyncTask/actions';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';
import { Kontext, TextTypes } from '../../types/common';
import { ConcQueryResponse } from '../concordance/common';
import { concatMap, map, tap } from 'rxjs/operators';
import { ConcQueryArgs, QueryContextArgs } from '../query/common';
import { asyncTaskIsPquery, FreqIntersectionArgs, FreqIntersectionResponse, generatePqueryName,
    importTaskInfo, PqueryFormModelState, PquerySubmitArgs, QueryCalcStatus } from './common';


/**
 *
 */
interface HTTPSaveQueryResponse {
    query_id:string;
    messages:Array<[string, string]>;
}

interface PqueryFormModelSwitchPreserve {
    queries:string;
    minFreq:number;
    position:string;
    attr:string;
}

function filterTasks(
    tasks:Array<Kontext.AsyncTaskInfo<unknown>>,
    srcAndConcIds:Array<[string, string]>

):Array<[string, QueryCalcStatus]> {
    const ourTasks:Array<[string, QueryCalcStatus]> = [];
    List.forEach(
        item => {
            if (asyncTaskIsPquery(item) &&
                    List.some(
                        ([,cid]) => cid === item.args.conc_id, srcAndConcIds)) {
                ourTasks.push(importTaskInfo(item));
            }
        },
        tasks,
    );
    return ourTasks;
}


function updateTask(baseTask:QueryCalcStatus, updTask:QueryCalcStatus):QueryCalcStatus {
    return {
        concId: baseTask.concId,
        startTs: baseTask.startTs,
        finishTs: updTask.finishTs,
        error: updTask.error,
        status: updTask.status
    };
}




export class PqueryFormModel extends StatelessModel<PqueryFormModelState> implements IUnregistrable {

    private readonly layoutModel:PageModel;

    constructor(dispatcher:IActionDispatcher, initState:PqueryFormModelState, layoutModel:PageModel) {
        super(dispatcher, initState);
        this.layoutModel = layoutModel;

        this.addActionHandler<Actions.SubmitQuery>(
            ActionName.SubmitQuery,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.submitForm(state, dispatch).subscribe(
                    ([queryId, tasks]) => {
                        dispatch<Actions.SubmitQueryDone>({
                            name: ActionName.SubmitQueryDone,
                            payload: {
                                corpname: state.corpname,
                                usesubcorp: state.usesubcorp,
                                queryId,
                                tasks
                            },
                        });
                    },
                    (error) => {
                        this.layoutModel.showMessage('error', error);
                        dispatch<Actions.SubmitQueryDone>({
                            name: ActionName.SubmitQueryDone,
                            error
                        });
                    }
                )
            }
        );

        this.addActionHandler<Actions.SubmitQueryDone>(
            ActionName.SubmitQueryDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    //state.receivedResults = true;
                    state.queriesCalc = Dict.fromEntries(action.payload.tasks);
                }
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            (state, action) => {
                if (!action.error) {
                    this.deserialize(
                        state,
                        action.payload.data[this.getRegistrationId()] as
                            PqueryFormModelSwitchPreserve,
                        action.payload.corpora
                    );
                }
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            (state, action) => {
                dispatcher.dispatch<GlobalActions.SwitchCorpusReady<
                        PqueryFormModelSwitchPreserve>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(
                            state,
                            action.payload.corpora,
                            action.payload.newPrimaryCorpus
                        )
                    }
                });
            }
        );

        this.addActionHandler<QueryActions.QueryInputSelectSubcorp>(
            QueryActionName.QueryInputSelectSubcorp,
            (state, action) => {
                state.usesubcorp = action.payload.subcorp;
            }
        );

        this.addActionHandler<Actions.AddQueryItem>(
            ActionName.AddQueryItem,
            (state, action) => {
                const size = Dict.size(state.queries);
                state.queries[generatePqueryName(size)] = {
                    corpname: state.corpname,
                    qtype: 'advanced',
                    query: '',
                    queryHtml: '',
                    rawAnchorIdx: 0,
                    rawFocusIdx: 0,
                    parsedAttrs: [],
                    focusedAttr: undefined,
                    pcq_pos_neg: 'pos',
                    include_empty: false,
                    default_attr: null
                }
            }
        );

        this.addActionHandler<Actions.RemoveQueryItem>(
            ActionName.RemoveQueryItem,
            (state, action) => {
                state.queries = Dict.fromEntries(
                    List.reduce((acc, [k, v]) => {
                            if (k !== action.payload.sourceId) {
                                acc.push([generatePqueryName(List.size(acc)), v])
                            }
                            return acc;
                        },
                        [],
                        Dict.toEntries(state.queries)
                    )
                );
            }
        );

        this.addActionHandler<Actions.QueryChange>(
            ActionName.QueryChange,
            (state, action) => {
                state.queries[action.payload.sourceId].query = action.payload.query;
                state.queries[action.payload.sourceId].queryHtml = action.payload.query;
            }
        );

        this.addActionHandler<Actions.FreqChange>(
            ActionName.FreqChange,
            (state, action) => {
                state.minFreq = parseInt(action.payload.value) || state.minFreq;
            }
        );

        this.addActionHandler<Actions.PositionChange>(
            ActionName.PositionChange,
            (state, action) => {
                state.position = action.payload.value;
            }
        );

        this.addActionHandler<Actions.AttrChange>(
            ActionName.AttrChange,
            (state, action) => {
                state.attr = action.payload.value;
            }
        );

        this.addActionHandler<ACActions.AsyncTasksChecked>(
            ACActionName.AsyncTasksChecked,
            (state, action) => {
                const incomingTasks = Dict.fromEntries(filterTasks(
                    action.payload.tasks,
                    pipe(
                        state.queriesCalc,
                        Dict.toEntries(),
                        List.map(
                            ([sourceId, info]) => tuple(sourceId, info.concId)
                        )
                    )
                ));
                state.queriesCalc = Dict.map(
                    (task, sourceId) => {
                        const incoming = incomingTasks[sourceId];
                        if (!incoming) {
                            // ERROR - server ignores one of our tasks?
                            return task;

                        } else {
                            return updateTask(task, incoming);
                        }
                    },
                    state.queriesCalc
                );
            }
        )
    }


    private deserialize(
        state:PqueryFormModelState,
        data:PqueryFormModelSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        state.attrs = this.layoutModel.getConf('AttrList')
        state.structAttrs = this.layoutModel.getConf('StructAttrList')
        state.corpname = corpora[0][1]
        state.receivedResults = false;
        if (data) {
            state.queries = Dict.map(v => {
                v.corpname = state.corpname;
                return v;
            }, JSON.parse(data.queries) as {[sourceId:string]:AdvancedQuery});
            state.minFreq = data.minFreq;
            state.position = data.position;
            state.attr = data.attr;
            state.attr = List.some(v => v.n === data.attr, state.attrs) || List.some(v => v.n === data.attr, state.structAttrs) ?
                         data.attr :
                         state.attrs[0].n
        } else {
            state.attr = state.attrs[0].n
        }
    }

    private serialize(
        state:PqueryFormModelState,
        newCorpora:Array<string>,
        newPrimaryCorpus:string|undefined
    ):PqueryFormModelSwitchPreserve {
        return {
            queries: JSON.stringify(state.queries),
            attr: state.attr,
            minFreq: state.minFreq,
            position: state.position
        };
    }

    private submitForm(state:PqueryFormModelState, dispatch:SEDispatcher):Observable<[string, Array<[string, QueryCalcStatus]>]> {
        return forkJoin(pipe(
            state.queries,
            Dict.toEntries(),
            List.map(
                ([sourceId, query]) => this.layoutModel.ajax$<ConcQueryResponse>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        'query_submit',
                        [tuple('format', 'json')]
                    ),
                    this.createConcSubmitArgs(state, query, false),
                    {contentType: 'application/json'}

                ).pipe(
                    map(resp => tuple(sourceId, resp))
                )
            )
        )).pipe(
            concatMap(
                (concResponses) => {
                    const srcAndConcIds = List.map(
                        ([sourceId, conc]) => tuple(sourceId, conc.conc_persistence_op_id),
                        concResponses
                    );
                    return forkJoin([
                        this.saveQuery(state),
                        this.submitFreqIntersection(
                            state, srcAndConcIds

                        ).pipe(
                            map(resp => tuple(srcAndConcIds, resp))
                        )
                    ]);
                }
            ),
            tap(
                ([queryId, [srcAndConcIds, fiResponse]]) => {
                    List.forEach(
                        task => {
                            dispatch<ACActions.InboxAddAsyncTask>({
                                name: ACActionName.InboxAddAsyncTask,
                                payload: task
                            })
                        },
                        fiResponse.tasks
                    );
                }
            ),
            map(
                ([queryId, [srcAndConcIds, fiResponse]]) => {
                    const ourTasks = filterTasks(fiResponse.tasks, srcAndConcIds);
                    return tuple(queryId, ourTasks);
                }
            )
        );
    }

    private submitFreqIntersection(
        state:PqueryFormModelState,
        srcAndConcIds:Array<[string, string]>
    ):Observable<FreqIntersectionResponse> {

        const args:FreqIntersectionArgs = {
            corpname: state.corpname,
            usesubcorp: state.usesubcorp,
            source__and_conc_ids: srcAndConcIds,
            min_freq: state.minFreq,
            attr: state.attr,
            position: state.position
        };
        return this.layoutModel.ajax$<FreqIntersectionResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'pquery/freq_intersection',
                []
            ),
            args,
            {contentType: 'application/json'}
        );
    }

    /**
     * Save query and return a new ID of the query
     */
    private saveQuery(state:PqueryFormModelState):Observable<string> {
        const args:PquerySubmitArgs = {
            usesubcorp: state.usesubcorp,
            min_freq: state.minFreq,
            position: state.position,
            attr: state.attr,
            queries: pipe(
                state.queries,
                Dict.toEntries(),
                List.map(
                    ([,query]) => ({
                        corpname: state.corpname,
                        qtype: 'advanced',
                        query: query.query,
                        pcq_pos_neg: 'pos',
                        include_empty: false,
                        default_attr: query.default_attr
                    })
                )
            )
        };
        return this.layoutModel.ajax$<HTTPSaveQueryResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('pquery/save_query'),
            args,
            {contentType: 'application/json'}

        ).pipe(
            map(resp => resp.query_id)
        );
    }

    getRegistrationId():string {
        return 'paradigmatic-query-form-model';
    }

    exportQuery(query:AdvancedQuery):AdvancedQuerySubmit {
        return {
            qtype: 'advanced',
            corpname: query.corpname,
            query: query.query.trim().normalize(),
            pcq_pos_neg: query.pcq_pos_neg,
            include_empty: query.include_empty,
            default_attr: !Array.isArray(query.default_attr) ?
                                query.default_attr : ''
        };
    }

    createConcSubmitArgs(state:PqueryFormModelState, query:AdvancedQuery, async:boolean):ConcQueryArgs {

        const currArgs = this.layoutModel.getConcArgs();
        return {
            type: 'concQueryArgs',
            maincorp: state.corpname,
            usesubcorp: state.usesubcorp || null,
            viewmode: 'kwic',
            pagesize: currArgs.pagesize,
            attrs: [],
            attr_vmode: currArgs.attr_vmode,
            base_viewattr: currArgs.base_viewattr,
            ctxattrs: null,
            structs: null,
            refs: null,
            fromp: 0,
            shuffle: 0,
            queries: [this.exportQuery(query)],
            text_types: {} as TextTypes.ExportedSelection,
            context: {} as QueryContextArgs,
            async
        };
    }

}