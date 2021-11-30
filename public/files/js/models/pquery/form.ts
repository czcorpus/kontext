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
import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, forkJoin, of as rxOf } from 'rxjs';
import { PageModel } from '../../app/page';
import { Actions } from './actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions } from '../common/actions';
import { Actions as QueryActions } from '../query/actions';
import { Actions as ATActions } from '../../models/asyncTask/actions';
import { AdvancedQuery, AdvancedQuerySubmit } from '../query/query';
import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { ConcQueryResponse } from '../concordance/common';
import { catchError, concatMap, map, reduce, tap } from 'rxjs/operators';
import { ConcQueryArgs, QueryContextArgs } from '../query/common';
import {
    AsyncTaskArgs, FreqIntersectionArgs, FreqIntersectionResponse, createSourceId,
    PqueryFormModelState, PqueryAlignTypes, ParadigmaticQuery, SubsetComplementsAndRatio,
    SupersetAndRatio, ParadigmaticPartialQuery, splitFullQuery, joinPartialQueries, ConcStatus
} from './common';
import { highlightSyntax, ParsedAttr, ParsedPQItem } from '../query/cqleditor/parser';
import { AttrHelper } from '../query/cqleditor/attrs';
import { AlignTypes } from '../freqs/twoDimension/common';
import { AjaxError } from 'rxjs/ajax';


interface PqueryFormModelSwitchPreserve {
    queries:string;
    minFreq:Kontext.FormValue<string>;
    attr:string;
    posLeft:number;
    posRight:number;
    posAlign:AlignTypes|PqueryAlignTypes;
}

interface HistoryState {
    onPopStateAction:typeof Actions.PopHistory;
}


export class PqueryFormModel extends StatefulModel<PqueryFormModelState> implements IUnregistrable {

    private readonly layoutModel:PageModel;

    private readonly attrHelper:AttrHelper;

    constructor(
        dispatcher:IFullActionControl,
        initState:PqueryFormModelState,
        layoutModel:PageModel,
        attrHelper:AttrHelper
    ) {
        super(dispatcher, initState);
        this.layoutModel = layoutModel;
        this.attrHelper = attrHelper;

        this.addActionHandler(
            Actions.SubmitQuery,
            action => {
                const validationErr = this.validateQueries();
                if (validationErr) {
                    this.layoutModel.showMessage('error', validationErr);
                    return;
                }
                const partialQueries = this.partializeQueries(this.state);
                this.changeState(state => {
                    state.isBusy = true;
                    state.calcProgress = 0;
                    state.concWait = Dict.map(_ => 'running', partialQueries);
                });

                this.submitForm(this.state, partialQueries).subscribe({
                    next: task => {
                        this.dispatchSideEffect(
                            Actions.SubmitQueryDone,
                            {
                                corpname: this.state.corpname,
                                usesubcorp: this.state.usesubcorp,
                                task
                            },
                        );
                    },
                    error: (error:Error) => {
                        this.layoutModel.showMessage('error', error);
                        this.dispatchSideEffect(
                            Actions.SubmitQueryDone,
                            error
                        );
                    }
                })
            }
        );

        this.addActionHandler(
            Actions.ChangePQueryType,
            action => {
                this.changeState(
                    state => {
                        if (action.payload.qtype === 'split') {
                            state.pqueryType = 'split';
                            state.queries = splitFullQuery(state.queries, state.corpname);
                            state.concWait = pipe(
                                state.queries,
                                Dict.forEach(
                                    (query, sourceId) => {
                                    this.setRawQuery(
                                        state,
                                        query,
                                        sourceId,
                                        query.query,
                                        null
                                    );
                                }),
                                Dict.map(() => 'none' as ConcStatus),
                            );
                            // parse query and fill in all the particular data

                        } else {
                            state.pqueryType = 'full';
                            const fullQuery = joinPartialQueries(state.queries, state.corpname);
                            state.queries = {full: fullQuery};
                            state.concWait = {full: 'none'};
                            this.setRawQuery(
                                state,
                                fullQuery,
                                'full',
                                fullQuery.query,
                                null
                            );
                        }
                    }
                )
            }
        );

        this.addActionHandler(
            Actions.SubmitQueryDone,
            action => {
                this.changeState(state => {
                    if (action.error) {
                        state.isBusy = false;

                    } else {
                        state.task = action.payload.task;
                    }
                });
            }
        );

        this.addActionHandler<typeof GlobalActions.CorpusSwitchModelRestore>(
            GlobalActions.CorpusSwitchModelRestore.name,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.deserialize(
                            state,
                            action.payload.data[this.getRegistrationId()] as
                                PqueryFormModelSwitchPreserve,
                            action.payload.corpora
                        );
                    });
                }
            }
        );

        this.addActionHandler<typeof GlobalActions.SwitchCorpus>(
            GlobalActions.SwitchCorpus.name,
            action => {
                dispatcher.dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(
                            this.state,
                            action.payload.corpora,
                            action.payload.newPrimaryCorpus
                        )
                    }
                });
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputSelectSubcorp>(
            QueryActions.QueryInputSelectSubcorp.name,
            action => {
                this.changeState(state => {
                    state.usesubcorp = action.payload.subcorp;
                });
            }
        );

        this.addActionHandler(
            QueryActions.QueryInputSetQuery,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];

                    if (action.payload.rawAnchorIdx !== undefined &&
                            action.payload.rawFocusIdx !== undefined) {
                        queryObj.rawAnchorIdx = action.payload.rawAnchorIdx ||
                            action.payload.query.length;
                            queryObj.rawFocusIdx = action.payload.rawFocusIdx ||
                            action.payload.query.length;
                    }
                    this.setRawQuery(
                        state,
                        queryObj,
                        action.payload.sourceId,
                        action.payload.query,
                        action.payload.insertRange
                    );
                });
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputMoveCursor>(
            QueryActions.QueryInputMoveCursor.name,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    queryObj.rawAnchorIdx = action.payload.rawAnchorIdx;
                    queryObj.rawFocusIdx = action.payload.rawFocusIdx;
                });
            }
        );

        this.addActionHandler<typeof Actions.AddQueryItem>(
            Actions.AddQueryItem.name,
            action => {
                this.changeState(state => this.addSpecificationQueryItem(state));
            }
        );

        this.addActionHandler<typeof Actions.RemoveQueryItem>(
            Actions.RemoveQueryItem.name,
            action => {
                this.changeState(state => {
                    state.queries = this.removeItem(state.queries, action.payload.sourceId);
                    state.concWait = this.removeItem(state.concWait, action.payload.sourceId);
                    if (!Dict.some((v, _) => v.type === 'partial-query'
                            && v.expressionRole.type === 'specification', state.queries)) {
                        this.addSpecificationQueryItem(state);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.FreqChange>(
            Actions.FreqChange.name,
            action => {
                this.changeState(state => {
                    state.minFreq.value = action.payload.value;
                    const tst = new Number(state.minFreq.value);
                    state.minFreq.isInvalid = isNaN(tst.valueOf()) || tst.valueOf() !== parseInt(state.minFreq.value);
                });
            }
        );

        this.addActionHandler<typeof Actions.SetPositionIndex>(
            Actions.SetPositionIndex.name,
            action => {
                this.changeState(state => {
                    state.posLeft = action.payload.valueLeft;
                    state.posRight = action.payload.valueRight;
                });
            }
        );

        this.addActionHandler<typeof Actions.SetAlignType>(
            Actions.SetAlignType.name,
            action => {
                this.changeState(state => {
                    state.posAlign = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.AttrChange>(
            Actions.AttrChange.name,
            action => {
                this.changeState(state => {
                    state.attr = action.payload.value;
                    state.posRangeNotSupported = action.payload.value.includes('.')
                });
            }
        );

        this.addActionHandler<typeof Actions.StatePushToHistory>(
            Actions.StatePushToHistory.name,
            action => {
                this.pushStateToHistory(this.state, action.payload.queryId);
            }
        );

        this.addActionHandler<typeof Actions.PopHistory>(
            Actions.PopHistory.name,
            action => {
                console.log('pop history: ', action);
            }
        );

        this.addActionHandler<typeof Actions.ToggleModalForm>(
            Actions.ToggleModalForm.name,
            action => {
                this.changeState(state => {
                    state.modalVisible = action.payload.visible;
                });
            }
        );

        this.addActionHandler<typeof Actions.ParamsToggleForm>(
            Actions.ParamsToggleForm.name,
            action => {
                this.changeState(state => {
                    state.paramsVisible = !state.paramsVisible;
                });
            }
        );

        this.addActionHandler<typeof ATActions.AsyncTasksChecked>(
            ATActions.AsyncTasksChecked.name,
            action => {
                if (this.state.task) {
                    const task = List.find(
                        t => t.ident === this.state.task.ident,
                        action.payload.tasks
                    );
                    if (!task) {
                        // TODO cleanup
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                        layoutModel.showMessage('error', 'Paradigmatic query task not found!');

                    } else {
                        const pqTask = task as Kontext.AsyncTaskInfo<AsyncTaskArgs>; // TODO type
                        if (pqTask.status === 'SUCCESS') {
                            this.changeState(state => {
                                state.task = pqTask;
                                state.isBusy = false;
                                state.calcProgress = 100;
                            });
                            window.location.href = this.layoutModel.createActionUrl(
                                'pquery/result',
                                {q: `~${this.state.task.args.query_id}`}
                            );

                        } else if (pqTask.status === 'FAILURE') {
                            this.changeState(state => {
                                state.task = pqTask;
                                state.isBusy = false;
                                state.calcProgress = 100;
                            });
                            this.layoutModel.showMessage(
                                'error',
                                `Paradigmatic query task failed: ${this.state.task.error}`
                            );
                        }
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.ConcordanceReady,
            action => {
                this.changeState(state => {
                    if (action.error) {
                        state.concWait[action.payload.sourceId] = 'failed';

                    } else {
                        state.concWait[action.payload.sourceId] = 'finished';
                    }
                    state.calcProgress += 100 * 1 / (Dict.size(state.concWait) + 1); // +1 for the freq merge op
                });
            }
        );

        this.addActionHandler<typeof Actions.SetExpressionRoleType>(
            Actions.SetExpressionRoleType.name,
            action => {
                if (action.payload.value !== 'specification' &&
                        Dict.some(
                            (v, _) => v.type === 'partial-query' && v.expressionRole.type === action.payload.value, this.state.queries
                        )) {
                    const type = action.payload.value === 'subset' ?
                            this.layoutModel.translate('pquery__condition_never') :
                            this.layoutModel.translate('pquery__condition_always');
                    this.layoutModel.showMessage(
                        'warning', this.layoutModel.translate('pquery__only_one_field_can_be_of_{type}', {type}))

                } else {
                    this.changeState(state => {
                        const query = state.queries[action.payload.sourceId];
                        if (query.type === 'partial-query') {
                            query.expressionRole.type = action.payload.value
                        }
                        if (!Dict.some((v, _) => v.type === 'partial-query' &&
                                v.expressionRole.type === 'specification', state.queries)) {
                            this.addSpecificationQueryItem(state);
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.SetExpressionRoleRatio>(
            Actions.SetExpressionRoleRatio.name,
            action => {
                this.changeState(state => {
                    const query = state.queries[action.payload.sourceId];
                    if (query.type === 'partial-query') {
                        query.expressionRole.maxNonMatchingRatio.value = action.payload.value;
                        const tst = new Number(action.payload.value);
                        query.expressionRole.maxNonMatchingRatio.isInvalid = isNaN(tst.valueOf());

                    } else {
                        throw new Error(`Expecting partial query for ${action.payload.sourceId}`);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.ResultApplyQuickFilter>(
            Actions.ResultApplyQuickFilter.name,
            action => {
                action.payload.concId
                this.state.queries
                this.dispatchSideEffect<typeof Actions.ResultApplyQuickFilterArgsReady>({
                    name: Actions.ResultApplyQuickFilterArgsReady.name,
                    payload: {
                        attr: this.state.attr,
                        posAlign: this.state.posAlign,
                        posLeft: this.state.posLeft,
                        posRight: this.state.posRight,
                    }
                })
            }
        );
    }

    private getPositionRange(state:PqueryFormModelState): string {
        if (state.posRangeNotSupported) {
            return '0'
        }

        switch (state.posAlign) {
            case AlignTypes.LEFT:
                return `${state.posLeft}<0~${state.posRight}<0`
            case AlignTypes.RIGHT:
                return `${state.posLeft}>0~${state.posRight}>0`
            case PqueryAlignTypes.WHOLE_KWIC:
                return `${state.posLeft}<0~${state.posRight}>0`
        }
    }

    private removeItem(data:{[sourceId:string]:any}, removeId:string):{[sourceId:string]:any} {
        return pipe(
            data,
            Dict.toEntries(),
            List.reduce((acc, [k, v]) => {
                if (k !== removeId) {
                    acc.push([createSourceId(List.size(acc)), v])
                }
                return acc;
            }, []),
            Dict.fromEntries()
        );
    }

    private validateQueries():Error|undefined {
        const empty = Dict.find(q => q.query.trim() === '', this.state.queries);
        return empty ? new Error(this.layoutModel.translate('pquery__all_the_queries_must_be_filled')) : undefined;
    }

    private deserialize(
        state:PqueryFormModelState,
        data:PqueryFormModelSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        state.attrs = this.layoutModel.getConf('AttrList')
        state.structAttrs = this.layoutModel.getConf('StructAttrList')
        state.corpname = corpora[0][1]
        if (data) {
            state.queries = Dict.map(v => {
                v.corpname = state.corpname;
                return v;
            }, JSON.parse(data.queries) as {[sourceId:string]:ParadigmaticQuery});
            state.minFreq = data.minFreq;
            state.posLeft = data.posLeft;
            state.posRight = data.posRight;
            state.posAlign = data.posAlign;
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
            posLeft: state.posLeft,
            posRight: state.posRight,
            posAlign: state.posAlign
        };
    }

    private mkSubsetStream(
        subcorp:string|undefined,
        partialQueries:{[sourceId:string]:ParadigmaticPartialQuery}
    ):Observable<[ConcQueryResponse, number]> {

        if (Dict.some(v => v.type === 'partial-query' && v.expressionRole.type === 'subset', partialQueries)) {
            const [subsetSourceId, subsetQuery] = Dict.find(
                v => v.type === 'partial-query' && v.expressionRole.type === 'subset', partialQueries);
            return this.layoutModel.ajax$<ConcQueryResponse>(
                HTTP.Method.POST,
                this.layoutModel.createActionUrl(
                    'query_submit',
                    {format: 'json'}
                ),
                this.createConcSubmitArgs(subcorp, subsetQuery, false),
                {contentType: 'application/json'}
            ).pipe(
                tap( _ => {
                    this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                        name: Actions.ConcordanceReady.name,
                        payload: {sourceId: subsetSourceId}
                    })
                }),
                concatMap(
                    concSubsetResponse => {
                        const query = partialQueries[subsetSourceId];
                        if (query.type === 'partial-query') {
                            return rxOf(tuple(
                                concSubsetResponse,
                                parseFloat(query.expressionRole.maxNonMatchingRatio.value)
                            ));
                        }
                        throw new Error(`Expecting partial query for ${subsetSourceId}`);
                    }
                )
            )

        } else {
            return rxOf(tuple(null, 0));
        }
    }

    private mkSupersetStream(
        subcorp:string|undefined,
        partialQueries:{[sourceId:string]:ParadigmaticPartialQuery}
    ):Observable<[ConcQueryResponse, number]> {

        if (Dict.some(v => v.type === 'partial-query' && v.expressionRole.type === 'superset', partialQueries)) {
            const [sourceId, supersetQuery] = Dict.find(
                v => v.type === 'partial-query' && v.expressionRole.type === 'superset', partialQueries);
            return this.layoutModel.ajax$<ConcQueryResponse>(
                    HTTP.Method.POST,
                    this.layoutModel.createActionUrl(
                        'query_submit',
                        {format: 'json'}
                    ),
                    this.createConcSubmitArgs(subcorp, supersetQuery, false),
                    {contentType: 'application/json'}

            ).pipe(
                map(
                    v => tuple<ConcQueryResponse, Error>(v, null)
                ),
                catchError(
                    err => rxOf(tuple<ConcQueryResponse, Error>(null, err))
                ),
                tap(
                    ([,error]) => {
                        if (error) {
                            this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                                name: Actions.ConcordanceReady.name,
                                payload: {sourceId},
                                error
                            });

                        } else {
                            this.dispatchSideEffect<typeof Actions.ConcordanceReady>({
                                name: Actions.ConcordanceReady.name,
                                payload: {sourceId}
                            });
                        }
                    }
                ),
                map(
                    ([resp, error]) => {
                        if (error) {
                            throw error;
                        }
                        const query = partialQueries[sourceId];
                        if (query.type === 'partial-query') {
                            return tuple(
                                resp,
                                parseFloat(query.expressionRole.maxNonMatchingRatio.value)
                            );

                        } else {
                            throw new Error(`Expecting partial query for ${sourceId}`);
                        }
                    }
                )
            );

        } else {
            return rxOf([null, 0]);
        }
    }

    private partializeQueries(state:PqueryFormModelState):{[sourceId:string]:ParadigmaticPartialQuery} {
        return state.pqueryType === 'split' ?
            Dict.filter(v => v.type === 'partial-query', state.queries) as {[sourceId:string]:ParadigmaticPartialQuery} :
            splitFullQuery(state.queries, state.corpname);
    }

    private submitForm(
        state:PqueryFormModelState,
        partialQueries:{[sourceId:string]:ParadigmaticPartialQuery}
    ):Observable<Kontext.AsyncTaskInfo<AsyncTaskArgs>> {
        return forkJoin([
            rxOf(...pipe(
                partialQueries,
                Dict.toEntries(),
                List.filter(([_, query]) => query.expressionRole.type === 'specification')

            )).pipe(
                concatMap(
                    ([sourceId, specQuery]) => this.layoutModel.ajax$<ConcQueryResponse>(
                        HTTP.Method.POST,
                        this.layoutModel.createActionUrl(
                            'query_submit',
                            {format: 'json'}
                        ),
                        this.createConcSubmitArgs(state.usesubcorp, specQuery, false),
                        {contentType: 'application/json'}

                    ).pipe(
                        map(
                            resp => tuple<string, ConcQueryResponse, Error>(sourceId, resp, undefined)
                        ),
                        catchError(
                            err => {
                                return rxOf(tuple<string, ConcQueryResponse, Error>(sourceId, undefined, err))
                            }
                        )
                    )
                ),
                tap(
                    ([sourceId,, error]) => {
                        if (error) {
                            this.dispatchSideEffect(
                                Actions.ConcordanceReady,
                                {sourceId},
                                error
                            );

                        } else {
                            this.dispatchSideEffect(
                                Actions.ConcordanceReady,
                                {sourceId}
                            );
                        }
                    }
                ),
                reduce(
                    (acc, data) => List.push(data, acc),
                    [] as Array<[string, ConcQueryResponse, Error]>
                )
            ),
            this.mkSubsetStream(state.usesubcorp, partialQueries),
            this.mkSupersetStream(state.usesubcorp, partialQueries)

        ]).pipe(
            concatMap(
                ([
                    specification,
                    [subsetResponse, subsetMNMRatio],
                    [supersetResponse, supersetsMNMRatio]
                ]) => {
                    const firstErrData = List.find(([,,err]) => !!err, specification);
                    if (firstErrData) {
                        const [,,err] = firstErrData;
                        if (err instanceof AjaxError) {
                            throw new Error(err.response['messages'][0][1]);
                        }
                        throw new Error(err.message);
                    }
                    return this.submitFreqIntersection(
                        state,
                        List.map(
                            ([,spec,]) => spec.conc_persistence_op_id,
                            specification
                        ),
                        subsetResponse ?
                            {
                                conc_ids: [subsetResponse.conc_persistence_op_id],
                                max_non_matching_ratio: subsetMNMRatio
                            } :
                            null,
                        supersetResponse ?
                            {
                                conc_id: supersetResponse.conc_persistence_op_id,
                                max_non_matching_ratio: supersetsMNMRatio
                            } :
                            null
                    );
                }
            ),
            tap(
                fiResponse => {
                    this.dispatchSideEffect({
                        name: ATActions.InboxAddAsyncTask.name,
                        payload: fiResponse.task
                    });
                }
            ),
            map(
                fiResponse => fiResponse.task as Kontext.AsyncTaskInfo<AsyncTaskArgs>
            )
        );
    }

    private submitFreqIntersection(
        state:PqueryFormModelState,
        concIds:Array<string>,
        concSubsetComplements:SubsetComplementsAndRatio|null,
        concSuperset:SupersetAndRatio|null
    ):Observable<FreqIntersectionResponse> {

        const args:FreqIntersectionArgs = {
            corpname: state.corpname,
            usesubcorp: state.usesubcorp,
            conc_ids: concIds,
            pquery_type: state.pqueryType,
            conc_subset_complements: concSubsetComplements,
            conc_superset: concSuperset,
            min_freq: parseInt(state.minFreq.value),
            attr: state.attr,
            pos_left: state.posLeft,
            pos_right: state.posRight,
            pos_align: state.posAlign,
            position: this.getPositionRange(state)
        };
        return this.layoutModel.ajax$<FreqIntersectionResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(
                'pquery/freq_intersection',
                {}
            ),
            args,
            {contentType: 'application/json'}
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

    createConcSubmitArgs(subcorp:string|undefined, query:AdvancedQuery, async:boolean):ConcQueryArgs {

        const currArgs = this.layoutModel.getConcArgs();
        return {
            type: 'concQueryArgs',
            usesubcorp: subcorp || null,
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
            async,
            no_query_history: true
        };
    }

    /**
     *
     * @todo duplicated code (models/query/common)
     */
    private findFocusedAttr(queryObj:AdvancedQuery):ParsedAttr|undefined {
        return List.find(
            (v, i) => v.rangeAll[0] <= queryObj.rawFocusIdx && (
                queryObj.rawFocusIdx <= v.rangeAll[1]),
            queryObj.parsedAttrs
        );
    }

    /**
     *
     * @todo partially duplicated code (models/query/common)
     */
    private reparseAdvancedQuery(
        state:PqueryFormModelState,
        queryObj:ParadigmaticQuery|ParadigmaticPartialQuery,
        sourceId:string,
        updateCurrAttrs:boolean
    ):void {
        const [queryHtml, newAttrs, pqItems, syntaxErr] = highlightSyntax({
            query: queryObj.query,
            querySuperType: state.pqueryType === 'full' ? 'pquery' : 'conc',
            he: this.layoutModel.getComponentHelpers(),
            attrHelper: this.attrHelper,
            wrapRange: (startIdx, endIdx) => {
                const matchingAttr = updateCurrAttrs ?
                    undefined :
                    List.find(
                        attr => attr.rangeVal[0] === startIdx && attr.rangeVal[1] === endIdx,
                        queryObj.parsedAttrs
                    );
                if (matchingAttr && matchingAttr.suggestions) {
                    const activeSugg = List.find(s => s.isActive, matchingAttr.suggestions.data);
                    return tuple(
                        `<a class="sugg" data-type="sugg" data-leftIdx="${startIdx}" data-rightIdx="${endIdx}" data-providerId="${activeSugg.providerId}">`, '</a>'
                    )
                }
                return tuple(null, null);
            }
        });
        queryObj.queryHtml = queryHtml;
        queryObj.focusedAttr = this.findFocusedAttr(queryObj);

        if (updateCurrAttrs) {
            queryObj.parsedAttrs = newAttrs;
            if (queryObj.type === 'full-query') {
                queryObj.pqItems = pqItems;
            }
        }
        this.validateSemantics(state, sourceId, newAttrs, pqItems);
        if (syntaxErr) {
            state.cqlEditorMessages[sourceId].push(syntaxErr);
        }
    }

    /**
     *
     * @todo duplicated code (models/query/common)
     */
    private shouldDownArrowTriggerHistory(queryObj:AdvancedQuery):boolean {
        if (queryObj.rawAnchorIdx === queryObj.rawFocusIdx) {
            return queryObj.query.substr(queryObj.rawAnchorIdx+1).search(/[\n\r]/) === -1;

        } else {
            return false;
        }
    }

    private validateSemantics(
        state:PqueryFormModelState,
        sourceId:string,
        attrs:Array<ParsedAttr>,
        pqItems:Array<ParsedPQItem>
    ):void {
        state.cqlEditorMessages[sourceId] = pipe(
            attrs,
            List.map(
                ({name, type,}) => {
                    if (type === 'posattr' && !this.attrHelper.attrExists(name)) {
                        return `${this.layoutModel.translate('query__attr_does_not_exist')}: <strong>${name}</strong>`;
                    }

                    if (type === 'structattr' && !this.attrHelper.structAttrExists(name, '0' /* TODO */)) {
                        return `${this.layoutModel.translate('query__structattr_does_not_exist')}: <strong>${name}.${name}</strong>`;
                    }

                    if (type === 'struct' && !this.attrHelper.structExists(name)) {
                        return `${this.layoutModel.translate('query__struct_does_not_exist')}: <strong>${name}</strong>`;
                    }
                    return null;
                }
            ),
            List.filter(v => v !== null)
        );
        state.cqlEditorMessages[sourceId] = List.concat(
            pipe(
                pqItems,
                List.foldl(
                    (acc, {type}) => {
                        if (type === 'superset') {
                            return {...acc, numSuperset: acc.numSuperset + 1};

                        } else if (type === 'subset') {
                            return {...acc, numSubset: acc.numSubset + 1};
                        }
                        return acc
                    },
                    {numSubset: 0, numSuperset: 0}
                ),
                ({numSubset, numSuperset}) => {
                    const ans:Array<string> = [];
                    if (numSubset > 1) {
                        const type = this.layoutModel.translate('pquery__condition_never');
                        ans.push(this.layoutModel.translate('pquery__only_one_field_can_be_of_{type}', {type}));
                    }
                    if (numSuperset > 1) {
                        const type = this.layoutModel.translate('pquery__condition_always');
                        ans.push(this.layoutModel.translate('pquery__only_one_field_can_be_of_{type}', {type}));
                    }
                    return ans;
                }
            ),
            state.cqlEditorMessages[sourceId]
        )

        // TODO calculate num of "always" / "never" and report possible errors too
    }

    /**
     * @param range in case we want to insert a CQL snippet into an existing code;
     *              if undefined then whole query is replaced
     *
     * @todo partially duplicated code (models/query/common)
     */
    protected setRawQuery(
        state:PqueryFormModelState,
        queryObj:ParadigmaticPartialQuery|ParadigmaticQuery,
        sourceId:string,
        query:string,
        insertRange:[number, number]|null

    ):void {
        if (insertRange !== null) {
            queryObj.query = queryObj.query.substring(0, insertRange[0]) + query +
                    queryObj.query.substr(insertRange[1]);

        } else {
            queryObj.query = query;
        }

        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(queryObj);

        this.reparseAdvancedQuery(state, queryObj, sourceId, true);
    }

    private pushStateToHistory(state:PqueryFormModelState, queryId:string):void {
        this.layoutModel.getHistory().pushState<{}, HistoryState>(
            'pquery/result',
            {q: `~${queryId}`},
            {
                onPopStateAction: {
                    name: Actions.PopHistory.name,
                    payload: {
                        corpname: state.corpname,
                        usesubcorp: state.usesubcorp,
                        page: 1, // TODO
                        queryId,
                        sort: undefined // this concerns the result model
                    }
                }
            },
            window.document.title
        )
    }

    private addSpecificationQueryItem(state:PqueryFormModelState) {
        const size = Dict.size(state.queries);
        state.concWait[createSourceId(size)] = 'none';
        state.queries[createSourceId(size)] = {
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
            default_attr: null,
            last_attr: null,
            expressionRole: {
                type: 'specification',
                maxNonMatchingRatio: Kontext.newFormValue('0', true)
            },
            type: 'partial-query'
        }
    }
}