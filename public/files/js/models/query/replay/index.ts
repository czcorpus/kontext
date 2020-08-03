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

import { Observable, of as rxOf } from 'rxjs';
import { concatMap, tap, map } from 'rxjs/operators';
import { SEDispatcher, IActionDispatcher } from 'kombo';
import { List, Dict, pipe, tuple, HTTP } from 'cnc-tskit';

import { AjaxResponse } from '../../../types/ajaxResponses';
import { Kontext } from '../../../types/common';
import { PageModel } from '../../../app/page';
import { FirstQueryFormModel } from '../first';
import { FilterFormModel } from '../filter';
import { ConcSampleModel } from '../sample';
import { SwitchMainCorpModel } from '../switchmc';
import { TextTypesModel } from '../../textTypes/main';
import { FirstHitsModel } from '../../query/firstHits';
import { QueryInfoModel } from './info';
import { Actions, ActionName } from '../actions';
import { Actions as ConcActions, ActionName as ConcActionName } from '../../concordance/actions';
import { ExtendedQueryOperation, importEncodedOperations, QueryPipelineResponse } from './common';
import { AjaxConcResponse } from '../../concordance/common';
import { QueryContextArgs } from '../common';
import { ConcSortModel } from '../sort/single';
import { MultiLevelConcSortModel } from '../sort/multi';
import { ISubmitableConcSortModel } from '../sort/common';


/*
Important note regarding variable naming conventions:

opKey (operationKey): a hash representing stored query args or string '__new__' when appending
                         a new operation
opId (operationId): a general manatee operation type identifier (e.g. 's' - sample, 'q' - query)

opIdx (operationIdx): an index of an operation within query pipeline (starting from zero).

In general, client knows by default opId and opIdx when a page is loaded. Operation key 'opKey'
may or may not be available without additional AJAX request.
*/


/**
 * Local query form data cache.
 */
export type LocalQueryFormData = {[ident:string]:AjaxResponse.ConcFormArgs};


/**
 * Models required by QueryReplayModel to operate
 */
export interface ReplayModelDeps {
    queryModel:FirstQueryFormModel;
    filterModel:FilterFormModel;
    sortModel:ConcSortModel;
    mlConcSortModel:MultiLevelConcSortModel;
    sampleModel:ConcSampleModel;
    textTypesModel:TextTypesModel;
    switchMcModel:SwitchMainCorpModel;
    firstHitsModel:FirstHitsModel;
}

export interface QueryReplayModelState {

    currentQueryOverview:Array<Kontext.QueryOperation>|null;

    currEncodedOperations:Array<ExtendedQueryOperation>;

    replayOperations:Array<string>;

    /**
     * Contains args used by different input forms involved in the current query operations.
     * The used key is the one used by conc_persistence to store operations to db.
     * There are also two special keys:
     * __new__: contains arguments for a form of a new operation which will be submitted
     *          and appended to the current query (e.g. we add a filter/sort/...)
     */
    concArgsCache:{[key:string]:AjaxResponse.ConcFormArgs};

    branchReplayIsRunning:boolean;

    editedOperationIdx:number;

    /**
     * Specifies an operation idx after which the query replay
     * stops. If null then whole pipeline is replayed.
     */
    stopAfterOpIdx:number|null;

    editIsLocked:boolean;

    overviewVisible:boolean;
}

function getCurrentQueryKey(pageModel:PageModel):string {
    const compiledQuery = pageModel.getConf<Array<string>>('compiledQuery') || [];
    const lastOp = compiledQuery[compiledQuery.length - 1] || '';
    return lastOp.substr(0, 1) === '~' ? lastOp.substr(1) : undefined;
}

export interface QueryReplayModelArgs {
    dispatcher:IActionDispatcher;
    pageModel:PageModel;
    replayModelDeps:ReplayModelDeps;
    currentOperations:Array<Kontext.QueryOperation>;
    concArgsCache:LocalQueryFormData;
}

interface CreateOperationArgs {
    state:QueryReplayModelState;
    queryContext:QueryContextArgs;
    opIdx:number;
    opKey:string;
    changedOpIdx:number;
    numOps:number;
    formType:string;
}

/**
 * QueryReplayModel reads operations stored in the breadcrumb-like navigation
 * and query operation data stored on server (handled by conc_persistence plug-in)
 * and generates a new query "pipeline" with a single step updated by a user
 * via a respective form (query, filter, sort,...). Then it submits all the
 * server requests one-by-one (while updating query operation ID) and the final
 * request is used to redirect client to see the result.
 */
export class QueryReplayModel extends QueryInfoModel<QueryReplayModelState> {

    private readonly queryModel:FirstQueryFormModel;

    private readonly filterModel:FilterFormModel;

    private readonly sortModel:ConcSortModel;

    private readonly mlConcSortModel:MultiLevelConcSortModel;

    private readonly sampleModel:ConcSampleModel;

    private readonly switchMcModel:SwitchMainCorpModel;

    private readonly textTypesModel:TextTypesModel;

    private readonly firstHitsModel:FirstHitsModel;


    constructor({dispatcher, pageModel, replayModelDeps, currentOperations,
                concArgsCache}:QueryReplayModelArgs) {
        super(
            dispatcher,
            pageModel,
            {
                currentQueryOverview: null,
                currEncodedOperations: importEncodedOperations(currentOperations),
                replayOperations: List.map(_ => null, currentOperations),
                concArgsCache: {...concArgsCache},
                branchReplayIsRunning: false,
                editedOperationIdx: null,
                stopAfterOpIdx: null,
                editIsLocked: pageModel.getConf<number>('NumLinesInGroups') > 0,
                overviewVisible: false
            }
        );
        this.queryModel = replayModelDeps.queryModel;
        this.filterModel = replayModelDeps.filterModel;
        this.sortModel = replayModelDeps.sortModel;
        this.mlConcSortModel = replayModelDeps.mlConcSortModel;
        this.sampleModel = replayModelDeps.sampleModel;
        this.switchMcModel = replayModelDeps.switchMcModel;
        this.textTypesModel = replayModelDeps.textTypesModel;
        this.firstHitsModel = replayModelDeps.firstHitsModel;

        this.addActionHandler<ConcActions.MarkLinesDone>(
            ConcActionName.MarkLinesDone,
            (state, action) => {
                state.editIsLocked = true;
            }
        );

        this.addActionHandler<ConcActions.LineSelectionResetOnServerDone>(
            ConcActionName.LineSelectionResetOnServerDone,
            (state, action) => {
                state.editIsLocked = false;
            }
        );

        this.addActionHandler<Actions.EditQueryOperation>(
            ActionName.EditQueryOperation,
            (state, action) => {
                state.editedOperationIdx = action.payload.operationIdx;
            },
            (state, action, dispatch) => {
                this.syncFormData(state, action.payload.operationIdx).subscribe(
                    ([data, sourceId]) => {
                        dispatch<Actions.EditQueryOperationDone>({
                            name: ActionName.EditQueryOperationDone,
                            payload: {
                                operationIdx: action.payload.operationIdx,
                                sourceId,
                                data
                            }
                        });
                    },
                    (err) => {
                        dispatch<Actions.EditQueryOperationDone>({
                            name: ActionName.EditQueryOperationDone,
                            error: err
                        });
                        this.pageModel.showMessage('error', err);
                    }
                );
            }
        );


        this.addActionHandler<Actions.EditLastQueryOperation>(
            ActionName.EditLastQueryOperation,
            (state, action) => {
                state.editedOperationIdx = state.currEncodedOperations.length - 1;
            },
            (state, action, dispatch) => {
                this.syncFormData(state, state.currEncodedOperations.length - 1).subscribe(
                    ([data, sourceId]) => {
                        dispatch<Actions.EditQueryOperationDone>({
                            name: ActionName.EditQueryOperationDone,
                            payload: {
                                operationIdx: state.currEncodedOperations.length - 1,
                                sourceId,
                                data
                            }
                        });
                    },
                    (err) => {
                        dispatch<Actions.EditQueryOperationDone>({
                            name: ActionName.EditQueryOperationDone,
                            error: err
                        });
                        this.pageModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<Actions.EditQueryOperationDone>(
            ActionName.EditQueryOperationDone,
            (state, action) => {
                if (action.error) {
                    state.editedOperationIdx = null;

                } else {
                    state.concArgsCache[action.payload.data.op_key] = action.payload.data;
                    state.replayOperations[action.payload.operationIdx] =
                        action.payload.data.op_key;
                }
            }
        );

        this.addActionHandler<Actions.BranchQuery>(
            ActionName.BranchQuery,
            (state, action) => {
                state.editedOperationIdx = null;
                state.branchReplayIsRunning = true;
            },
            (state, action, dispatch) => {
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.QueryContextFormPrepareArgsDone ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        (wAction:Actions.QueryContextFormPrepareArgsDone) => this.branchQuery(
                            state,
                            wAction.payload.data,
                            action.payload.operationIdx,
                            dispatch
                        )
                    )

                ).subscribe(
                    null,
                    err => {
                        this.pageModel.showMessage('error', err);
                        dispatch<Actions.BranchQueryDone>({
                            name: ActionName.BranchQueryDone,
                            error: err
                        });
                    }
                )
            }
        );

        this.addActionHandler<Actions.BranchQueryDone>(
            ActionName.BranchQueryDone,
            (state, action) => {
                state.branchReplayIsRunning = false;
                state.replayOperations = action.payload.replayOperations;
                state.concArgsCache = action.payload.concArgsCache;
            }
        );

        this.addActionHandler<Actions.TrimQuery>(
            ActionName.TrimQuery,
            (state, action) => {
                state.branchReplayIsRunning = true;
            },
            (state, action, dispatch) => {
                const args = this.pageModel.getConcArgs();
                return this.pageModel.ajax$<QueryPipelineResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('load_query_pipeline'),
                    args

                ).pipe(
                    tap(
                        data => {
                            if (state.stopAfterOpIdx === null) {
                                this.pageModel.showMessage(
                                    'info',
                                    this.pageModel.translate('query__chain_no_op_msg')
                                );

                            } else {
                                window.location.href = this.pageModel.createActionUrl(
                                    'view',
                                    [['q', '~' + data.ops[action.payload.operationIdx].id]]
                                );
                            }
                        }
                    )

                ).subscribe(
                    data => {
                        dispatch<Actions.QueryOverviewEditorClose>({
                            name: ActionName.QueryOverviewEditorClose
                        });
                    },
                    err => {
                        this.pageModel.showMessage('error', err);
                        dispatch<Actions.QueryOverviewEditorClose>({
                            name: ActionName.QueryOverviewEditorClose,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.QuerySetStopAfterIdx>(
            ActionName.QuerySetStopAfterIdx,
            (state, action) => {
                state.stopAfterOpIdx = action.payload.value
            }
        );

        this.addActionHandler<Actions.QueryOverviewEditorClose>(
            ActionName.QueryOverviewEditorClose,
            (state, action) => {
                state.editedOperationIdx = null;
                state.branchReplayIsRunning = false;
                state.currentQueryOverview = null;
            }
        );
    }

    private getActualCorpname():string {
        return this.pageModel.getCorpusIdent().id;
    }

    /**
     * Transform query operation idx (i.e. its position in a respective
     * query pipeline) into a related key of stored form data (conc_persistence plug-in).
     */
    private opIdxToCachedQueryKey(replayOps:Array<string>, idx:number):string|undefined {
        return replayOps[idx] || undefined;
    }

    /**
     * Generate a function representing an operation within query pipeline. Such
     * an operation typically consists of:
     * 1) form synchronization from a database (conc_persistence)
     * 2) submitting a respective action to the server (0 up to n-2 are submitted via ajax,
     *    n-1th directly)
     *
     * In case of just updated form (i.e. the operation user just changed) the synchronization
     * is an empty operation.
     *
     * @param opIdx operation index in a respective query pipeline
     * @param opKey operation key used to store it on server (see q=~[opKey])
     * @param changeOpIdx an index of an operation which was changed by user
     * @param numOps a total number of operations in the query pipeline
     * @param formType a form type used to enter data to this operation (query, filter, sort)
     */
    private createOperation({state, queryContext, opIdx, opKey, changedOpIdx,
            numOps, formType}:CreateOperationArgs):Observable<AjaxConcResponse|null> {
        const prepareFormData:Observable<AjaxResponse.ConcFormArgs|null> = changedOpIdx !== opIdx ?
                this.syncFormData(state, opIdx) : rxOf(null);
        if (opIdx === 0) {
            return rxOf([]).pipe(
                tap(
                    (q) => {
                        // !!! 'q' must be cleared as it contains current encoded query
                        this.pageModel.replaceConcArg('q', q);
                    }
                ),
                concatMap(
                    () => prepareFormData
                ),
                tap(
                    () => {
                        // no implicit shuffle during replay as optional shuffle
                        // is already "materialized" as a separate operation here
                        // and we don't want a double shuffle
                        this.queryModel.disableDefaultShuffling();
                    }
                ),
                concatMap(
                    () => {
                        const url = this.queryModel.getSubmitUrl(queryContext);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                url,
                                {
                                    format: 'json',
                                    async: 0
                                }
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(() => this.queryModel.submitQuery(queryContext))
                            );
                        }
                    }
                )
            );

        } else if (formType === Kontext.ConcFormTypes.FILTER) {
            return prepareFormData.pipe(
                concatMap(
                    () => {
                        const url = this.filterModel.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$(
                                HTTP.Method.GET,
                                url,
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(
                                    () => this.filterModel.submitQuery(opKey)
                                )
                            );
                        }
                    }
                )
            );

        } else if (formType === Kontext.ConcFormTypes.SORT) {
            return prepareFormData.pipe(
                concatMap(
                    () => {
                        let activeModel:ISubmitableConcSortModel;

                        if (this.sortModel.isActiveActionValue(opKey)) {
                            activeModel = this.sortModel;

                        } else if (this.mlConcSortModel.isActiveActionValue(opKey)) {
                            activeModel = this.mlConcSortModel;
                        }
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                activeModel.getSubmitUrl(opKey),
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(() => activeModel.submit(opKey))
                            );
                        }
                    }
                )
            );

        } else if (formType === Kontext.ConcFormTypes.SAMPLE) {
            return prepareFormData.pipe(
                concatMap(
                    () => {
                        const url = this.sampleModel.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                url,
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(
                                    (_) => this.sampleModel.submitQuery(opKey)
                                )
                            );
                        }
                    }
                )
            );

        // please note that shuffle does not have its own store
        } else if (formType === Kontext.ConcFormTypes.SHUFFLE) {
            return rxOf(this.pageModel.createActionUrl(
                    'shuffle', this.pageModel.getConcArgs().items())).pipe(
                concatMap(
                    (targetUrl) => {
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                targetUrl,
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(
                                    () => {
                                        window.location.href = targetUrl;
                                    }
                                )
                            );
                        }
                    }
                )
            );

        } else if (formType === Kontext.ConcFormTypes.SWITCHMC) {
            return rxOf(this.switchMcModel.getSubmitUrl(opKey)).pipe(
                concatMap(
                    (url) => {
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                url,
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(
                                    () => {
                                        window.location.href = url;
                                    }
                                )
                            );
                        }
                    }
                )
            );

        } else if (formType === Kontext.ConcFormTypes.SUBHITS) {
            return prepareFormData.pipe(
                concatMap(
                    () => {
                        const targetUrl = this.pageModel.createActionUrl(
                            'filter_subhits',
                            this.pageModel.getConcArgs().items()
                        );
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                targetUrl,
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(
                                    () => {
                                        window.location.href = targetUrl;
                                    }
                                )
                            );
                        }
                    }
                )
            );

        } else if (formType === Kontext.ConcFormTypes.FIRSTHITS) {
            return prepareFormData.pipe(
                concatMap(
                    () => {
                        const targetUrl = this.firstHitsModel.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                targetUrl,
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(
                                    () => {
                                        this.firstHitsModel.submitForm(opKey);
                                    }
                                )
                            );
                        }
                    }
                )
            );

        } else if (formType === Kontext.ConcFormTypes.LOCKED) {
            return new Observable<string>((observer) => {
                    const args = this.pageModel.getConcArgs();
                    args.add(
                        'q',
                        state.currEncodedOperations[opIdx].opid +
                            state.currEncodedOperations[opIdx].arg
                    );
                    observer.next(this.pageModel.createActionUrl('view', args.items()));
                    observer.complete();

            }).pipe(
                concatMap(
                    (targetUrl) => {
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<AjaxConcResponse>(
                                HTTP.Method.GET,
                                targetUrl,
                                {format: 'json'}
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(
                                    () => {
                                        window.location.href = targetUrl;
                                    }
                                )
                            );
                        }
                    }
                )
            );

        } else {
            throw new Error('cannot prepare operation for type ' + formType);
        }
    }

    /**
     * Process a query pipeline with the operation with index [changedOpIdx] updated.
     * The function must load a list of all operations a pipeline is composed of (the
     * pipeline is identified by its last operation ID). Then it generates dynamically
     * a chain of Observables based on these stored operations.
     *
     * @param changedOpIdx the last operation of the pipeline
     * @return an observable containing all the operations of the chain; an item of the chain
     * can be either an object containing a response of the operation returned by server or a
     * function containing a side-effect local action (typically - the last operation contains
     * something like observable.pipe(tap(foo)=>sideEffect(foo)).
     */
    private branchQuery(state:QueryReplayModelState, queryContext:QueryContextArgs,
                changedOpIdx:number, dispatch:SEDispatcher):Observable<AjaxConcResponse|null> {
        const args = this.pageModel.getConcArgs();
        return this.pageModel.ajax$<QueryPipelineResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('load_query_pipeline'),
            args

        ).pipe(
            map(
                (data) => {
                    const newCache = pipe(
                        data.ops,
                        List.map(item =>tuple(item.id, item.form_args)),
                        Dict.fromEntries()
                    );
                    return tuple(data, newCache);
                }
            ),
            tap(
                // now we store some stuff to the state but we cannot
                // use the values within the stream!
                ([data, newCache]) => {
                    dispatch<Actions.BranchQueryDone>({
                        name: ActionName.BranchQueryDone,
                        payload: {
                            replayOperations: List.map(item => item.id, data.ops),
                            concArgsCache: newCache
                        }
                    });
                }
            ),
            concatMap(
                ([data, newCache]) => {
                    const appliedOps = List.filter(
                        (_, i) => i <= state.stopAfterOpIdx || state.stopAfterOpIdx === null,
                        data.ops
                    );
                    return rxOf(
                        ...List.map(op => tuple(op, appliedOps.length, newCache), appliedOps)
                    )
                }
            ),
            concatMap(
                ([opItem, numOps, newCache], opIdx) => this.createOperation({
                    state,
                    opIdx,
                    opKey: opItem.id,
                    changedOpIdx,
                    queryContext,
                    numOps,
                    formType: newCache[opItem.id].form_type
                })
            ),
            tap(
                (data:AjaxConcResponse|null) => {
                    const newQVal = data !== null && data.Q ? data.Q || [] : [];
                    this.pageModel.replaceConcArg('q', newQVal);
                }
            )
        );
    }

    /**
     * Synchronize search query (= initial) form with position [opIdx] in a
     * respective query pipeline. In fact the search query form should have
     * always opIdx = 0 as it is the initial operation but to keep
     * things general the opIdx argument is required and applied.
     *
     * @param opIdx an index of the operation in a respective query pipeline
     * @returns updated query store wrapped in a promise
     */
    private syncQueryForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.QueryFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return (queryKey !== undefined ?
            // cache hit
            this.queryModel.syncFrom(
                rxOf(state.concArgsCache[queryKey] as AjaxResponse.QueryFormArgs)
            ) :
            this.queryModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.QueryFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: getCurrentQueryKey(this.pageModel),
                        idx: opIdx
                    }
                )
            )

        ).pipe(
            concatMap(
                (data) => this.textTypesModel.syncFrom(rxOf(data))
            )
        );
    }

    /**
     * Synchronize filter form with position [opIdx] in a
     * respective query pipeline.
     */
    private syncFilterForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.FilterFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return (queryKey !== undefined ?
            // cache hit
            this.filterModel.syncFrom(
                rxOf(state.concArgsCache[queryKey] as AjaxResponse.FilterFormArgs)
            ) :
            this.filterModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.FilterFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: getCurrentQueryKey(this.pageModel),
                        idx: opIdx
                    }
                )
            )
        );
    }

    private syncSortForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.SortFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return queryKey !== undefined ?
            this.sortModel.syncFrom(
                rxOf(state.concArgsCache[queryKey] as AjaxResponse.SortFormArgs)).pipe(
                    concatMap(data => this.mlConcSortModel.syncFrom(rxOf(data)))
            ) :
            this.sortModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.SortFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: getCurrentQueryKey(this.pageModel),
                        idx: opIdx
                    }
                ).pipe(
                    concatMap(
                        data => this.mlConcSortModel.syncFrom(
                            rxOf(data as AjaxResponse.SortFormArgs)
                        )
                    )
                ));
    }

    private syncSampleForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return queryKey !== undefined ?
            this.sampleModel.syncFrom(
                rxOf(state.concArgsCache[queryKey] as AjaxResponse.SampleFormArgs)
            ) :
            this.sampleModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.SampleFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: getCurrentQueryKey(this.pageModel),
                        idx: opIdx
                    }
                )
            );
    }

    private syncShuffleForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return queryKey !== undefined ?
            rxOf(state.concArgsCache[queryKey]) :
            this.pageModel.ajax$<AjaxResponse.ConcFormArgsResponse>(
                HTTP.Method.GET,
                this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                {
                    corpname: this.getActualCorpname(),
                    last_key: getCurrentQueryKey(this.pageModel),
                    idx: opIdx
                }

            );
    }

    private syncSubhitsForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return queryKey !== undefined ?
            rxOf(state.concArgsCache[queryKey]) :
            this.pageModel.ajax$<AjaxResponse.ConcFormArgsResponse>(
                HTTP.Method.GET,
                this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                {
                    corpname: this.getActualCorpname(),
                    last_key: getCurrentQueryKey(this.pageModel),
                    idx: opIdx
                }
            );
    }

    private syncFirstHitsForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return queryKey !== undefined ?
            this.firstHitsModel.syncFrom(
                rxOf(state.concArgsCache[queryKey] as AjaxResponse.FirstHitsFormArgs)
            ) :
            this.firstHitsModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.FirstHitsFormArgs>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: getCurrentQueryKey(this.pageModel),
                        idx: opIdx
                    }

                )
            );
    }

    private syncSwitchMcForm(state:QueryReplayModelState,
            opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(state.replayOperations, opIdx);
        return queryKey !== undefined ?
            this.switchMcModel.syncFrom(
                rxOf(state.concArgsCache[queryKey] as AjaxResponse.SwitchMainCorpArgs)
            ) :
            this.switchMcModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.SwitchMainCorpArgs>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: getCurrentQueryKey(this.pageModel),
                        idx: opIdx
                    }
                )
            );
    }

    private syncFormData(state:QueryReplayModelState,
            opIdx:number):Observable<[AjaxResponse.ConcFormArgs|null, string]> {
        const formType = state.currEncodedOperations[opIdx].formType;

        if (Dict.size(state.concArgsCache) === 0) {
            return rxOf(null);

        } else if (formType === Kontext.ConcFormTypes.QUERY) {
            return this.syncQueryForm(state, opIdx).pipe(
                map(v => tuple(v, this.getActualCorpname()))
            );

        } else if (formType === Kontext.ConcFormTypes.FILTER) {
            return this.syncFilterForm(state, opIdx).pipe(map(v => tuple(v, v.op_key)));

        } else if (formType === Kontext.ConcFormTypes.SORT) {
            return this.syncSortForm(state, opIdx).pipe(map(v => tuple(v, '')));

        } else if (formType === Kontext.ConcFormTypes.SAMPLE) {
            return this.syncSampleForm(state, opIdx).pipe(map(v => tuple(v, '')));

        } else if (formType === Kontext.ConcFormTypes.SHUFFLE) {
            return this.syncShuffleForm(state, opIdx).pipe(map(v => tuple(v, '')));

        } else if (formType === Kontext.ConcFormTypes.SWITCHMC) {
            return this.syncSwitchMcForm(state, opIdx).pipe(map(v => tuple(v, '')));

        } else if (formType === Kontext.ConcFormTypes.SUBHITS) {
            return this.syncSubhitsForm(state, opIdx).pipe(map(v => tuple(v, '')));

        } else if (formType === Kontext.ConcFormTypes.FIRSTHITS) {
            return this.syncFirstHitsForm(state, opIdx).pipe(map(v => tuple(v, '')));
        }
    }
}
