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
import { concatMap, tap, map, reduce } from 'rxjs/operators';
import { SEDispatcher, IActionDispatcher, Action } from 'kombo';
import { List, Dict, pipe, tuple, HTTP } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext.js';
import { PageModel } from '../../../app/page.js';
import { FirstQueryFormModel } from '../first.js';
import { FilterFormModel } from '../filter.js';
import { ConcSampleModel } from '../sample.js';
import { SwitchMainCorpModel } from '../switchmc.js';
import { TextTypesModel } from '../../textTypes/main.js';
import { FirstHitsModel } from '../../query/firstHits.js';
import { QueryInfoModel } from './info.js';
import { Actions } from '../actions.js';
import { Actions as ConcActions } from '../../concordance/actions.js';
import { Actions as MainMenuActions } from '../../mainMenu/actions.js';
import { Actions as TTActions } from '../../textTypes/actions.js';
import { Actions as QueryActions } from '../../query/actions.js';
import {
    PersistentQueryOperation, importEncodedOperation, QueryPipelineResponse,
    QueryPipelineResponseItem,
    exportDecodedOperation,
    NormalizeConcFormArgsResp} from './common.js';
import { AjaxConcResponse, ConcQueryResponse } from '../../concordance/common.js';
import { QueryContextArgs } from '../common.js';
import { ConcSortModel } from '../sort/single.js';
import { MultiLevelConcSortModel } from '../sort/multi.js';
import {
    ConcFormArgs, ConcFormArgsResponse, FilterFormArgs, FilterFormArgsResponse, FirstHitsFormArgs,
    QueryFormArgs, QueryFormArgsResponse, SampleFormArgs, SampleFormArgsResponse, SortFormArgs,
    SortFormArgsResponse, SwitchMainCorpArgs
} from '../formArgs.js';
import { ExportedSelection } from '../../../types/textTypes.js';


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
export type LocalQueryFormData = {[ident:string]:ConcFormArgs};


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

    /**
     * This property contains a query operations pipeline. The last item
     * should be always the one user sees on the concordance view page.
     */
    operations:Array<PersistentQueryOperation>;

    /**
     * Contains args used by different input forms involved in the current query operations.
     * The used key is the one used by conc_persistence to store operations to db.
     * There is also a special key __new__ which contains arguments for a form of a new
     * operation which will be submitted and appended to the current query (e.g. we add a
     * filter/sort/...)
     */
    concFormsCache:{[key:string]:ConcFormArgs};

    branchReplayIsRunning:boolean;

    editedOperationIdx:number;

    /**
     * Specifies an operation idx after which the query replay
     * stops. If null then whole pipeline is replayed.
     */
    stopAfterOpIdx:number|null;

    groupsSelected:boolean;

    overviewVisible:boolean;
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
    baseOnConcId:string;
    queryContext:QueryContextArgs;
    op:Kontext.QueryOperation;
    pipeOp:QueryPipelineResponseItem;
    opIdx:number;
    changedOpIdx:number;
    numOps:number;
    ttSelection:ExportedSelection;
    dispatch:SEDispatcher;
}

type OperationChainArgs = [
    Kontext.QueryOperation,
    QueryPipelineResponseItem,
    number,
    {[k:string]:ConcFormArgs}
];

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


    constructor({
        dispatcher,
        pageModel,
        replayModelDeps,
        currentOperations,
        concArgsCache
    }:QueryReplayModelArgs) {
        super(
            dispatcher,
            pageModel,
            {
                operations: List.map(importEncodedOperation, currentOperations),
                concFormsCache: {...concArgsCache},
                branchReplayIsRunning: false,
                editedOperationIdx: null,
                stopAfterOpIdx: null,
                groupsSelected: pageModel.getConf<number>('NumLinesInGroups') > 0,
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

        this.addActionHandler(
            ConcActions.AddedNewOperation,
            (state, action) => {
                state.branchReplayIsRunning = false;
                if (!action.error) {
                    state.operations = List.map(
                        importEncodedOperation, action.payload.data.query_overview);
                    state.concFormsCache = {};
                }
            },
            (state, action, dispatch) => {
                const numVariants = pipe(
                    state.operations,
                    List.unique(x => x.isRegisteredAuthor),
                    List.size()
                );
                if (numVariants > 1) {
                    this.pageModel.ajax$<NormalizeConcFormArgsResp>(
                        HTTP.Method.POST,
                        this.pageModel.createActionUrl(
                            'normalize_conc_form_args_arch',
                            {
                                last_id: List.last(state.operations).concPersistenceId,
                                corpname: this.getActualCorpname()
                            }
                        ),
                        {}

                    ).subscribe({
                        next: (resp) => {
                            dispatch(
                                ConcActions.ConcFormArgsNormalizationDone,
                                {
                                    authorId: resp.author_id
                                }
                            );
                        },
                        error: (error) => {
                            dispatch(
                                ConcActions.ConcFormArgsNormalizationDone,
                                error
                            );
                        }
                    });
                }
            }
        );

        this.addActionHandler(
            ConcActions.ConcFormArgsNormalizationDone,
            (state, action) => {
                state.operations = List.map(
                    item => ({...item, isRegisteredAuthor: true}),
                    state.operations
                )
            }
        );

        this.addActionHandler(
            ConcActions.MarkLinesDone,
            (state, action) => {
                state.groupsSelected = true;
            },
            (state, action, dispatch) => {
                dispatch<typeof MainMenuActions.ToggleDisabled>({
                    name: MainMenuActions.ToggleDisabled.name,
                    payload: {
                        items: [
                            {menuId: 'menu-filter', disabled: true},
                            {menuId: 'menu-concordance', submenuId: 'shuffle', disabled: true},
                            {menuId: 'menu-concordance', submenuId: 'sorting', disabled: true},
                            {menuId: 'menu-concordance', submenuId: 'sample', disabled: true}
                        ]
                    }
                })
            }
        );

        this.addActionHandler(
            ConcActions.LineSelectionResetOnServerDone,
            (state, action) => {
                state.groupsSelected = false;
            },
            (state, action, dispatch) => {
                dispatch<typeof MainMenuActions.ToggleDisabled>({
                    name: MainMenuActions.ToggleDisabled.name,
                    payload: {
                        items: [
                            {menuId: 'menu-filter', disabled: true},
                            {menuId: 'menu-concordance', submenuId: 'shuffle', disabled: false},
                            {menuId: 'menu-concordance', submenuId: 'sorting', disabled: false},
                            {menuId: 'menu-concordance', submenuId: 'sample', disabled: false}
                        ]
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.EditQueryOperation,
            (state, action) => {
                // here we just reset the edited op idx as any non-null value is interpreted
                // by a respective component as "open the form with respective data"
                // but we have no data yet
                state.editedOperationIdx = null;
            },
            (state, action, dispatch) => {
                this.syncFormData(state, action.payload.operationIdx).subscribe({
                    next: ([data, sourceId]) => {
                        dispatch<typeof Actions.EditQueryOperationDone>({
                            name: Actions.EditQueryOperationDone.name,
                            payload: {
                                operationIdx: action.payload.operationIdx,
                                sourceId,
                                data
                            }
                        });
                    },
                    error: error => {
                        dispatch<typeof Actions.EditQueryOperationDone>({
                            name: Actions.EditQueryOperationDone.name,
                            error
                        });
                        this.pageModel.showMessage('error', error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.EditLastQueryOperation,
            (state, action) => {
                // see EditQueryOperation and EditQueryOperationDone
                // for an explanation why 'null' here
                state.editedOperationIdx = null;
            },
            (state, action, dispatch) => {
                this.syncFormData(state, state.operations.length - 1).subscribe({
                    next: ([data, sourceId]) => {
                        dispatch<typeof Actions.EditQueryOperationDone>({
                            name: Actions.EditQueryOperationDone.name,
                            payload: {
                                operationIdx: state.operations.length - 1,
                                sourceId,
                                data
                            }
                        });
                    },
                    error: error => {
                        dispatch<typeof Actions.EditQueryOperationDone>({
                            name: Actions.EditQueryOperationDone.name,
                            error
                        });
                        this.pageModel.showMessage('error', error);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.EditQueryOperationDone,
            (state, action) => {
                if (action.error) {
                    state.editedOperationIdx = null;

                } else {
                    state.editedOperationIdx = action.payload.operationIdx;
                    state.concFormsCache[action.payload.data.op_key] = action.payload.data;
                    state.operations[action.payload.operationIdx].concPersistenceId =
                        action.payload.data.op_key;
                }
            }
        );

        this.addActionHandler(
            Actions.BranchQuery,
            (state, action) => {
                state.editedOperationIdx = null;
                state.branchReplayIsRunning = true;
            },
            (state, action, dispatch) => {
                this.waitForActionWithTimeout(
                    2000,
                    {ttSelections: false, contextData: false},
                    (action, syncData) => {
                        if (Actions.isQueryContextFormPrepareArgsDone(action)) {
                            return syncData.ttSelections ? null : {...syncData, contextData: true};

                        } else if (TTActions.isTextTypesQuerySubmitReady(action)) {
                            return syncData.contextData ? null : {...syncData, ttSelections: true};
                        }
                        return syncData;
                    }
                ).pipe(
                    reduce<Action<{}>, {contextData:QueryContextArgs, ttData:ExportedSelection}>(
                        (acc, curr) => {
                            if (Actions.isQueryContextFormPrepareArgsDone(curr)) {
                                return {...acc, contextData: curr.payload.data};

                            } else if (TTActions.isTextTypesQuerySubmitReady(curr)) {
                                return {...acc, ttData: curr.payload.selections};
                            }
                            return acc;
                        },
                        {ttData: undefined, contextData: undefined}
                    ),
                    concatMap(
                        ({ ttData, contextData }) => this.branchQuery(
                            state,
                            contextData,
                            action.payload.operationIdx,
                            ttData,
                            dispatch
                        )
                    )

                ).subscribe({
                    next: data => {
                        if (data) { // if false then probably window.location.href has been set
                            dispatch<typeof ConcActions.AddedNewOperation>({
                                name: ConcActions.AddedNewOperation.name,
                                payload: {
                                    concId: data.conc_persistence_op_id,
                                    data: data
                                }
                            });
                        }
                    },
                    error: error => {
                        this.pageModel.showMessage('error', error);
                        dispatch<typeof ConcActions.AddedNewOperation>({
                            name: ConcActions.AddedNewOperation.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.TrimQuery,
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
                                    {q: '~' + data.ops[action.payload.operationIdx].id}
                                );
                            }
                        }
                    )

                ).subscribe({
                    next: data => {
                        dispatch<typeof Actions.QueryOverviewEditorClose>({
                            name: Actions.QueryOverviewEditorClose.name
                        });
                    },
                    error: error => {
                        this.pageModel.showMessage('error', error);
                        dispatch<typeof Actions.QueryOverviewEditorClose>({
                            name: Actions.QueryOverviewEditorClose.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.UpdateOperations,
            (state, action) => {
                state.operations = List.map(importEncodedOperation, action.payload.operations);
            }
        );

        this.addActionHandler(
            Actions.QuerySetStopAfterIdx,
            (state, action) => {
                state.stopAfterOpIdx = action.payload.value
            }
        );

        this.addActionHandler(
            Actions.QueryOverviewEditorClose,
            (state, action) => {
                state.editedOperationIdx = null;
                state.branchReplayIsRunning = false;
            }
        );

        this.addActionHandler(
            ConcActions.ReloadConc,
            null,
            (state, action, dispatch) => {
                const args = {
                    ...this.pageModel.getConcArgs(),
                    q: '~' + action.payload.concId
                };
                const opIdx = List.findIndex(
                    x => x.concPersistenceId === action.payload.concId,
                    state.operations
                );
                (
                    this.allOperationsInCache(state) && opIdx > -1 ?
                        this.loadQeryPipelineFromCache(state) :
                    this.pageModel.ajax$<QueryPipelineResponse>(
                        HTTP.Method.GET,
                        this.pageModel.createActionUrl('load_query_pipeline'),
                        args

                    )
                ).subscribe(
                    resp => {
                        dispatch(
                            Actions.UpdateOperations,
                            {
                                operations: this.insertOperationKeys(
                                    resp.query_overview,
                                    resp.ops
                                )
                            }
                        )
                    }
                );
            }
        );

        this.addActionHandler(
            ConcActions.AsyncCalculationUpdated,
            (state, action) => {
                List.last(state.operations).size = action.payload.concsize;
                List.last(state.operations).fullSize = action.payload.fullsize;
            }
        );

        this.addMultiActionHandler(
            [
                QueryActions.ApplyFilter,
                QueryActions.FilterFirstHitsSubmit,
                QueryActions.SampleFormSubmit,
                QueryActions.ShuffleFormSubmit,
                QueryActions.SortFormSubmit,
                QueryActions.MLSortFormSubmit
            ],
            null,
            (state, action, dispatch) => {
                dispatch(
                    ConcActions.ReadyToAddNewOperation,
                    {
                        lastConcId: this.getLastOperationId(state)
                    }
                )
            }

        )
    }

    private getActualCorpname():string {
        return this.pageModel.getCorpusIdent().id;
    }

    /**
     * Return cache key (= concID) of an operation indexed by its
     * order in the pipeline. In case the index is off or the operation
     * is not cached, undefined is returned.
     */
    private getOpCacheKey(
        state:QueryReplayModelState,
        idx:number
    ):string|undefined {
        if (state.operations[idx]) {
            const key = state.operations[idx].concPersistenceId;
            return state.concFormsCache[key] ? key : undefined;
        }
        return undefined;
    }

    private getLastOperationId(state:QueryReplayModelState):string {
        return List.last(state.operations).concPersistenceId;
    }

    /**
     * Update conc_persistence_op_id properties within
     * the array of QueryOperation instances based on
     * conc ID (= opKeys) from the 'pipeline'.
     */
    private insertOperationKeys(
        opList:Array<Kontext.QueryOperation>,
        pipeline:Array<QueryPipelineResponseItem>
    ):Array<Kontext.QueryOperation> {
        return pipe(
            opList,
            List.zipAll(pipeline),
            List.map(
                ([op, pipeOp]) => ({
                    ...op,
                    conc_persistence_op_id: pipeOp.id
                })
            )
        );
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
    private createOperation({
        state,
        baseOnConcId,
        queryContext,
        opIdx,
        changedOpIdx,
        numOps,
        op,
        pipeOp,
        ttSelection
    }:CreateOperationArgs):Observable<AjaxConcResponse|null> {

        const prepareFormData:Observable<[ConcFormArgs|null, string]> = changedOpIdx !== opIdx ?
                this.syncFormData(state, opIdx) : rxOf(null);
        if (opIdx === 0) {
            return rxOf([]).pipe(
                tap(
                    (q) => {
                        // !!! 'q' must be cleared as it contains current encoded query
                        this.pageModel.updateConcPersistenceId(q);
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
                        if (opIdx < numOps - 1) {
                            const args = this.queryModel.createSubmitArgs({
                                contextFormArgs: queryContext,
                                async: false,
                                ttSelection
                            });
                            const url = this.pageModel.createActionUrl(
                                'query_submit',
                                {format: 'json'}
                            );
                            return this.pageModel.ajax$<ConcQueryResponse>(
                                HTTP.Method.POST,
                                url,
                                args,
                                {contentType: 'application/json'}

                            ).pipe(
                                map(
                                    response => ({
                                        response,
                                        messages: response.messages || []
                                    })
                                )
                            )

                        } else {
                            return this.queryModel.submitQuery(
                                queryContext, false, ttSelection, true);
                        }
                    }
                ),
                concatMap(
                    ({response}) => this.pageModel.ajax$<AjaxConcResponse>(
                        HTTP.Method.GET,
                        this.queryModel.createViewUrl(
                            response.conc_persistence_op_id,
                            response.conc_args,
                            true,
                            false
                        ),
                        {}
                    )
                )
            );

        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.FILTER) {
            return prepareFormData.pipe(
                concatMap(
                    () => this.filterModel.submitQuery(pipeOp.id, baseOnConcId)
                )
            );

        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.SORT) {
            return prepareFormData.pipe(
                concatMap(
                    () => {
                        if (this.sortModel.isActiveActionValue(pipeOp.id)) {
                            return this.sortModel.submitQuery(pipeOp.id, baseOnConcId);

                        } else if (this.mlConcSortModel.isActiveActionValue(pipeOp.id)) {
                            return this.mlConcSortModel.submitQuery(pipeOp.id, baseOnConcId);

                        } else {
                            throw new Error('No sorting model set as active.');
                        }
                    }
                )
            );

        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.SAMPLE) {
            return prepareFormData.pipe(
                concatMap(
                    () => this.sampleModel.submitQuery(pipeOp.id, baseOnConcId)
                )
            );

        // please note that shuffle does not have its own store
        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.SHUFFLE) {
            const args = {
                ...this.pageModel.getConcArgs(),
                q: '~' + baseOnConcId
            };
            return rxOf(this.pageModel.createActionUrl('shuffle', args)).pipe(
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
                                    (data) => {
                                        window.location.href = targetUrl;
                                    }
                                )
                            );
                        }
                    }
                )
            );

        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.SWITCHMC) {
            return prepareFormData.pipe(
                concatMap(
                    () => this.switchMcModel.submitQuery(pipeOp.id, baseOnConcId)
                )
            );

        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.SUBHITS) {
            const args = {
                ...this.pageModel.getConcArgs(),
                q: '~' + baseOnConcId
            };
            return prepareFormData.pipe(
                concatMap(
                    () => {
                        const targetUrl = this.pageModel.createActionUrl(
                            'filter_subhits',
                            args
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

        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.FIRSTHITS) {
            return prepareFormData.pipe(
                concatMap(
                    () => this.firstHitsModel.submitForm(pipeOp.id, baseOnConcId)
                )
            );

        } else if (pipeOp.form_args.form_type === Kontext.ConcFormTypes.LOCKED) {
            return new Observable<string>((observer) => {
                    const args = {
                        ...this.pageModel.getConcArgs(),
                        q: [
                            '~' + baseOnConcId,
                            op ? `${op.opid}${op.args}` : ''
                        ]
                    };
                    observer.next(this.pageModel.createActionUrl('view', args));
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
            throw new Error('cannot prepare operation for type ' + pipeOp.form_args.form_type);
        }
    }

    private allOperationsInCache(state:QueryReplayModelState):boolean {
        return List.every(
            x =>  Dict.hasKey(x.concPersistenceId, state.concFormsCache),
            state.operations
        );
    }

    private loadQeryPipelineFromCache(state:QueryReplayModelState):Observable<QueryPipelineResponse> {
        return rxOf<{
            messages: [],
            ops:Array<QueryPipelineResponseItem>;
            query_overview:Array<Kontext.QueryOperation>;
        }>({
            messages: [],
            ops: pipe(
                state.operations,
                List.map(op => ({
                    form_args: state.concFormsCache[op.concPersistenceId],
                    id: op.concPersistenceId
                }))
            ),
            query_overview: pipe(
                state.operations,
                List.map(exportDecodedOperation)
            )
        });
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
    private branchQuery(
        state:QueryReplayModelState,
        queryContext:QueryContextArgs,
        changedOpIdx:number,
        ttSelection:ExportedSelection,
        dispatch:SEDispatcher
    ):Observable<AjaxConcResponse> {
        const args = {
            ...this.pageModel.getConcArgs(),
            q: '~' + this.getLastOperationId(state)
        };

        return (
            this.allOperationsInCache(state) ?
                this.loadQeryPipelineFromCache(state) :
                this.pageModel.ajax$<QueryPipelineResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('load_query_pipeline'),
                    args
                )
        ).pipe(
            map(
                (data:QueryPipelineResponse) => {
                    const newCache = pipe(
                        data.ops,
                        List.map(item =>tuple(item.id, item.form_args)),
                        Dict.fromEntries()
                    );
                    return tuple(data, newCache);
                }
            ),
            concatMap(
                ([data, newCache]) => {
                    const appliedOps = pipe(
                        data.ops,
                        List.zipAll(data.query_overview),
                        List.filter(
                            (_, i) => i <= state.stopAfterOpIdx || state.stopAfterOpIdx === null
                        ),
                        List.map(
                            v => v
                        )
                    );
                    return rxOf(
                        ...List.map(([pipeOp, op]) => tuple(op, pipeOp, appliedOps.length, newCache), appliedOps)
                    )
                }
            ),
            reduce<OperationChainArgs, Observable<AjaxConcResponse>>(
                (prev:Observable<AjaxConcResponse|null>, [op, pipeOp, numOps, newCache], opIdx) => {
                    return prev.pipe(
                        concatMap(
                            (data) => this.createOperation({
                                baseOnConcId: data ? data.conc_persistence_op_id : null,
                                state,
                                opIdx,
                                numOps,
                                changedOpIdx,
                                queryContext,
                                op,
                                pipeOp,
                                ttSelection,
                                dispatch
                            })
                        )
                    );
                },
                rxOf(null)
            ),
            concatMap(
                last => last
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
    private syncQueryForm(
        state:QueryReplayModelState,
        opIdx:number
    ):Observable<QueryFormArgs> {
        const queryKey = this.getOpCacheKey(state, opIdx);
        return (queryKey !== undefined ?
            // cache hit
            this.queryModel.syncFrom(
                rxOf(state.concFormsCache[queryKey] as QueryFormArgs)
            ) :
            this.queryModel.syncFrom(
                this.pageModel.ajax$<QueryFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getLastOperationId(state),
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
    private syncFilterForm(
        state:QueryReplayModelState,
        opIdx:number
    ):Observable<FilterFormArgs> {
        const queryKey = this.getOpCacheKey(state, opIdx);
        return (queryKey !== undefined ?
            // cache hit
            this.filterModel.syncFrom(
                rxOf(state.concFormsCache[queryKey] as FilterFormArgs)
            ) :
            this.filterModel.syncFrom(
                this.pageModel.ajax$<FilterFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getLastOperationId(state),
                        idx: opIdx
                    }
                )
            )
        );
    }

    private syncSortForm(state:QueryReplayModelState,
            opIdx:number):Observable<SortFormArgs> {
        const queryKey = this.getOpCacheKey(state, opIdx);
        return queryKey !== undefined ?
            this.sortModel.syncFrom(
                rxOf(state.concFormsCache[queryKey] as SortFormArgs)).pipe(
                    concatMap(data => this.mlConcSortModel.syncFrom(rxOf(data)))
            ) :
            this.sortModel.syncFrom(
                this.pageModel.ajax$<SortFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getLastOperationId(state),
                        idx: opIdx
                    }
                ).pipe(
                    concatMap(
                        data => this.mlConcSortModel.syncFrom(
                            rxOf(data as SortFormArgs)
                        )
                    )
                ));
    }

    private syncSampleForm(state:QueryReplayModelState,
            opIdx:number):Observable<ConcFormArgs> {
        const queryKey = this.getOpCacheKey(state, opIdx);
        return queryKey !== undefined ?
            this.sampleModel.syncFrom(
                rxOf(state.concFormsCache[queryKey] as SampleFormArgs)
            ) :
            this.sampleModel.syncFrom(
                this.pageModel.ajax$<SampleFormArgsResponse>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getLastOperationId(state),
                        idx: opIdx
                    }
                )
            );
    }

    private syncShuffleForm(state:QueryReplayModelState,
            opIdx:number):Observable<ConcFormArgs> {
        const queryKey = this.getOpCacheKey(state, opIdx);
        return queryKey !== undefined ?
            rxOf(state.concFormsCache[queryKey]) :
            this.pageModel.ajax$<ConcFormArgsResponse>(
                HTTP.Method.GET,
                this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                {
                    corpname: this.getActualCorpname(),
                    last_key: this.getLastOperationId(state),
                    idx: opIdx
                }

            );
    }

    private syncSubhitsForm(state:QueryReplayModelState,
            opIdx:number):Observable<ConcFormArgs> {
        const queryKey = this.getOpCacheKey(state, opIdx);
        return queryKey !== undefined ?
            rxOf(state.concFormsCache[queryKey]) :
            this.pageModel.ajax$<ConcFormArgsResponse>(
                HTTP.Method.GET,
                this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                {
                    corpname: this.getActualCorpname(),
                    last_key: this.getLastOperationId(state),
                    idx: opIdx
                }
            );
    }

    private syncFirstHitsForm(state:QueryReplayModelState,
            opIdx:number):Observable<ConcFormArgs> {
        const queryKey = this.getOpCacheKey(state, opIdx);
        return queryKey !== undefined ?
            this.firstHitsModel.syncFrom(
                rxOf(state.concFormsCache[queryKey] as FirstHitsFormArgs)
            ) :
            this.firstHitsModel.syncFrom(
                this.pageModel.ajax$<FirstHitsFormArgs>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getLastOperationId(state),
                        idx: opIdx
                    }
                )
            );
    }

    private syncSwitchMcForm(
        state:QueryReplayModelState,
        opIdx:number
    ):Observable<ConcFormArgs> {

        const queryKey = this.getOpCacheKey(state, opIdx);
        return queryKey !== undefined ?
            this.switchMcModel.syncFrom(
                rxOf(state.concFormsCache[queryKey] as SwitchMainCorpArgs)
            ) :
            this.switchMcModel.syncFrom(
                this.pageModel.ajax$<SwitchMainCorpArgs>(
                    HTTP.Method.GET,
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getLastOperationId(state),
                        idx: opIdx
                    }
                )
            );
    }

    private syncFormData(
        state:QueryReplayModelState,
        opIdx:number
    ):Observable<[ConcFormArgs|null, string]> {
        const formType = state.operations[opIdx].formType;
        if (formType === Kontext.ConcFormTypes.QUERY) {
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
