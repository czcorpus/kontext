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

import * as Immutable from 'immutable';
import { Observable, of as rxOf } from 'rxjs';
import { concatMap, tap, map, filter } from 'rxjs/operators';
import {AjaxResponse} from '../../../types/ajaxResponses';
import {Kontext} from '../../../types/common';
import {PageModel} from '../../../app/page';
import {FirstQueryFormModel} from '../first';
import {FilterFormModel} from '../filter';
import {ConcSortModel, MultiLevelConcSortModel, ISubmitableConcSortModel} from '../sort';
import {ConcSampleModel} from '../sample';
import {SwitchMainCorpModel} from '../switchmc';
import {TextTypesModel} from '../../textTypes/main';
import {FirstHitsModel} from '../../query/firstHits';
import { IFullActionControl } from 'kombo';
import { QueryInfoModel } from './info';
import { ExtendedQueryOperation, IQueryReplayModel, importEncodedOperations, QueryPipelineResponse, QueryPipelineResponseItem } from './common';


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

/**
 * QueryReplayModel reads operations stored in the breadcrumb-like navigation
 * and query operation data stored on server (handled by conc_persistence plug-in)
 * and generates a new query "pipeline" with a single step updated by a user
 * via a respective form (query, filter, sort,...). Then it submits all the
 * server requests one-by-one (while updating query operation ID) and the final
 * request is used to redirect client to see the result.
 */
export class QueryReplayModel extends QueryInfoModel implements IQueryReplayModel {

    private currEncodedOperations:Immutable.List<ExtendedQueryOperation>;

    private replayOperations:Immutable.List<string>;

    private queryModel:FirstQueryFormModel;

    private filterModel:FilterFormModel;

    private sortModel:ConcSortModel;

    private mlConcSortModel:MultiLevelConcSortModel;

    private sampleModel:ConcSampleModel;

    private switchMcModel:SwitchMainCorpModel;

    private textTypesModel:TextTypesModel;

    private firstHitsModel:FirstHitsModel;

    /**
     * Contains args used by different input forms involved in the current query operations.
     * The used key is the one used by conc_persistence to store operations to db.
     * There are also two special keys:
     * __new__: contains arguments for a form of a new operation which will be submitted
     *          and appended to the current query (e.g. we add a filter/sort/...)
     * __latest__: contains arguments of a just submitted form. Due to the server-side
     *             architecture, the (server) action itself does not know the actual
     *             key yet. But after the action is processed, KonText stores the action
     *             and passes the new ID (key) to response arguments.
     */
    private concArgsCache:Immutable.Map<string, AjaxResponse.ConcFormArgs>;

    private branchReplayIsRunning:boolean;

    private editedOperationIdx:number;

    /**
     * Specifies an operation idx after which the query replay
     * stops. If null then whole pipeline is replayed.
     */
    private stopAfterOpIdx:number;

    private _editIsLocked:boolean;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, replayModelDeps:ReplayModelDeps,
            currentOperations:Array<Kontext.QueryOperation>, concArgsCache:LocalQueryFormData) {
        super(dispatcher, pageModel);
        this.pageModel = pageModel;
        this.currEncodedOperations = importEncodedOperations(currentOperations);
        this.replayOperations = Immutable.List<string>(currentOperations.map(item => null));
        this.concArgsCache = Immutable.Map<string, AjaxResponse.ConcFormArgs>(concArgsCache);
        this.queryModel = replayModelDeps.queryModel;
        this.filterModel = replayModelDeps.filterModel;
        this.sortModel = replayModelDeps.sortModel;
        this.mlConcSortModel = replayModelDeps.mlConcSortModel;
        this.sampleModel = replayModelDeps.sampleModel;
        this.switchMcModel = replayModelDeps.switchMcModel;
        this.textTypesModel = replayModelDeps.textTypesModel;
        this.firstHitsModel = replayModelDeps.firstHitsModel;
        this.branchReplayIsRunning = false;
        this.editedOperationIdx = null;
        this.stopAfterOpIdx = null;
        this.syncCache();

        this._editIsLocked = this.pageModel.getConf<number>('NumLinesInGroups') > 0;
        this.pageModel.addConfChangeHandler<number>('NumLinesInGroups', (v) => {
            this._editIsLocked = v > 0;
        });

        this.dispatcher.registerActionListener(action => {
                switch (action.name) {
                    case 'EDIT_QUERY_OPERATION':
                        this.editedOperationIdx = action.payload['operationIdx'];
                        this.emitChange();
                        this.syncFormData(action.payload['operationIdx']).subscribe(
                            () => {
                                this.emitChange();
                            },
                            (err) => {
                                this.editedOperationIdx = null;
                                this.emitChange();
                                this.pageModel.showMessage('error', err);
                            }
                        );
                    break;
                    case 'BRANCH_QUERY':
                        this.editedOperationIdx = null;
                        this.branchQuery(action.payload['operationIdx']).subscribe(
                            (_) => {
                                this.branchReplayIsRunning = false;
                                this.emitChange();
                            },
                            (err) => {
                                this.branchReplayIsRunning = false;
                                this.emitChange();
                                this.pageModel.showMessage('error', err);
                            }
                        );
                    break;
                    case 'QUERY_SET_STOP_AFTER_IDX':
                        this.stopAfterOpIdx = action.payload['value'];
                        this.emitChange();
                    break;
                    case 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO':
                        this.editedOperationIdx = null;
                        this.emitChange();
                    break;
                }
        });
    }

    private getActualCorpname():string {
        return this.pageModel.getCorpusIdent().id;
    }

    private getCurrentQueryKey():string {
        const compiledQuery = this.pageModel.getConf<Array<string>>('compiledQuery') || [];
        const lastOp = compiledQuery[compiledQuery.length - 1] || '';
        return lastOp.substr(0, 1) === '~' ? lastOp.substr(1) : undefined;
    }

    /**
     * Because server operations do not know a newly created query ID (it is handled
     * in controller's post dispatche when a concrete action is already finished)
     * it uses a special value '__latest__' to mark arguments which have been just created.
     * But unlike the server, we know the ID so we update the '__latest__' pseudo-key by
     * the real one. This makes further processing a little bit easier.
     */
    private syncCache():void {
        const opKey = this.getCurrentQueryKey();
        if (this.concArgsCache.has('__latest__') && opKey !== undefined) {
            const tmp = this.concArgsCache.get('__latest__');
            tmp.op_key = opKey;
            this.concArgsCache = this.concArgsCache.delete('__latest__').set(opKey, tmp);
            this.replayOperations = this.replayOperations.set(this.replayOperations.size - 1, opKey);
        }
    }

    /**
     * Transform query operation idx (i.e. its position in a respective
     * query pipeline) into a related key of stored form data (conc_persistence plug-in).
     */
    opIdxToCachedQueryKey(idx:number):string {
        if (this.replayOperations.get(idx) !== null) {
            return this.replayOperations.get(idx);

        } else {
            return undefined;
        }
    }

    /**
     * Generate a function representing an operation within query pipeline. Such
     * an operation typically consists of:
     * 1) form synchronization from a database (conc_persistence)
     * 2) submitting a respective action to the server (0 up to n-2 are submitted via ajax, n-1th directly)
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
    private createOperation(opIdx:number, opKey:string, changedOpIdx:number, numOps:number,
            formType:string):Observable<Kontext.AjaxConcResponse|null> {
        const prepareFormData:Observable<AjaxResponse.ConcFormArgs|null> = changedOpIdx !== opIdx ? this.syncFormData(opIdx) : rxOf(null);
        if (opIdx === 0) {
            return rxOf([]).pipe(
                tap(
                    (q) => {
                        this.pageModel.replaceConcArg('q', q); // !!! 'q' must be cleared as it contains current encoded query
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
                        const url = this.queryModel.getSubmitUrl();
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
                                url,
                                {
                                    format: 'json',
                                    async: 0
                                }
                            );

                        } else {
                            return rxOf(null).pipe(
                                tap(() => this.queryModel.submitQuery())
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
                                'GET',
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
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
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
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
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

        } else if (formType === Kontext.ConcFormTypes.SHUFFLE) { // please note that shuffle does not have its own store
            return rxOf(this.pageModel.createActionUrl('shuffle', this.pageModel.getConcArgs().items())).pipe(
                concatMap(
                    (targetUrl) => {
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
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
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
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
                        const targetUrl = this.pageModel.createActionUrl('filter_subhits', this.pageModel.getConcArgs().items());
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
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
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
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

        } else if (formType === 'locked') { // locked op uses compiled query (i.e. no form data)
            return new Observable<string>((observer) => {
                    const args = this.pageModel.getConcArgs();
                    args.add('q', this.currEncodedOperations.get(opIdx).opid + this.currEncodedOperations.get(opIdx).arg);
                    observer.next(this.pageModel.createActionUrl('view', args.items()));
                    observer.complete();

            }).pipe(
                concatMap(
                    (targetUrl) => {
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax$<Kontext.AjaxConcResponse>(
                                'GET',
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
     * can be either an object containing a response of the operation returned by server or a function
     * containing a side-effect local action (typically - the last operation contains something
     * like observable.pipe(tap(foo)=>sideEffect(foo)).
     */
    private branchQuery(changedOpIdx:number):Observable<Array<string>> {
        this.branchReplayIsRunning = true;
        this.emitChange(); // => start the animation "replaying the query"

        const args = this.pageModel.getConcArgs();

        return this.pageModel.ajax$<QueryPipelineResponse>(
            'GET',
            this.pageModel.createActionUrl('load_query_pipeline'),
            args

        ).pipe(
            tap(
                (data) => {
                    this.replayOperations = Immutable.List<string>(data.ops.map(item => item.id))
                    this.concArgsCache = Immutable.Map<string, AjaxResponse.ConcFormArgs>(
                                data.ops.map(item =>[item.id, item.form_args]));
                }
            ),
            concatMap(
                (operations) => rxOf(...operations.ops.map<[QueryPipelineResponseItem, number]>(op => [op, operations.ops.length]))
            ),
            filter(
                (_, i) => i <= this.stopAfterOpIdx || this.stopAfterOpIdx === null
            ),
            concatMap(
                ([opItem, numOps], i) => this.createOperation(
                    i, opItem.id, changedOpIdx, numOps, this.concArgsCache.get(opItem.id).form_type)
            ),
            map(
                (data) => data !== null && data.Q ? data.Q || [] : []
            ),
            tap(
                (newQVal) => {
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
    private syncQueryForm(opIdx:number):Observable<AjaxResponse.QueryFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return (queryKey !== undefined ?
            // cache hit
            this.queryModel.syncFrom(rxOf(this.concArgsCache.get(queryKey) as AjaxResponse.QueryFormArgs)) :
            this.queryModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.QueryFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).pipe(
                    tap(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        }
                    )
                )
            )

        ).pipe(
            concatMap(
                (data) => this.textTypesModel.syncFrom(rxOf(data))
            ),
            map(
                (data) => {
                    this.synchronize(
                        'EDIT_QUERY_OPERATION',
                        {
                            sourceId: this.getActualCorpname(),
                            query: data.curr_queries[this.getActualCorpname()],
                            queryType: data.curr_query_types[this.getActualCorpname()]
                        }
                    );
                    return data;
                }
            )
        );
    }

    /**
     * Synchronize filter form with position [opIdx] in a
     * respective query pipeline.
     */
    private syncFilterForm(opIdx:number):Observable<AjaxResponse.FilterFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return (queryKey !== undefined ?
            // cache hit
            this.filterModel.syncFrom(rxOf(this.concArgsCache.get(queryKey) as AjaxResponse.FilterFormArgs)) :
            this.filterModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.FilterFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).pipe(
                    tap(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(
                                data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        }
                    )
                )
            )
        ).pipe(
            tap(
                (data) => {
                    this.synchronize(
                        'EDIT_QUERY_OPERATION',
                        {
                            sourceId: data.op_key,
                            query: data.query,
                            queryType: data.query_type
                        }
                    );
                }
            )
        );
    }

    /**
     * @todo
     */
    private syncSortForm(opIdx:number):Observable<AjaxResponse.SortFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return queryKey !== undefined ?
            this.sortModel.syncFrom(rxOf(this.concArgsCache.get(queryKey) as AjaxResponse.SortFormArgs)).pipe(
                    concatMap(data => this.mlConcSortModel.syncFrom(rxOf(data)))) :
            this.sortModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.SortFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }
                ).pipe(
                    tap(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        }
                    ),
                    concatMap(
                        (data) => {
                            const queryKey = this.opIdxToCachedQueryKey(opIdx); // now we know queryKey for sure
                            return this.mlConcSortModel.syncFrom(rxOf(this.concArgsCache.get(queryKey) as AjaxResponse.SortFormArgs));
                        }
                    )
                ));
    }

    private syncSampleForm(opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return queryKey !== undefined ?
            this.sampleModel.syncFrom(rxOf(this.concArgsCache.get(queryKey) as AjaxResponse.SampleFormArgs)) :
            this.sampleModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.SampleFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).pipe(
                    tap(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        }
                    )
                )
            );
    }

    private syncShuffleForm(opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return queryKey !== undefined ?
            rxOf(this.concArgsCache.get(queryKey)) :
            this.pageModel.ajax$<AjaxResponse.ConcFormArgsResponse>(
                'GET',
                this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                {
                    corpname: this.getActualCorpname(),
                    last_key: this.getCurrentQueryKey(),
                    idx: opIdx
                }

            ).pipe(
                tap(
                    (data) => {
                        this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                        this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                    }
                )
            );
    }

    private syncSubhitsForm(opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return queryKey !== undefined ?
            rxOf(this.concArgsCache.get(queryKey)) :
            this.pageModel.ajax$<AjaxResponse.ConcFormArgsResponse>(
                'GET',
                this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                {
                    corpname: this.getActualCorpname(),
                    last_key: this.getCurrentQueryKey(),
                    idx: opIdx
                }

            ).pipe(
                tap(
                    (data) => {
                        this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                        this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        return data;
                    }
                )
            );
    }

    private syncFirstHitsForm(opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return queryKey !== undefined ?
            this.firstHitsModel.syncFrom(rxOf(this.concArgsCache.get(queryKey) as AjaxResponse.FirstHitsFormArgs)) :
            this.firstHitsModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.FirstHitsFormArgs>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).pipe(
                    tap(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                            return data;
                        }
                    )
                )
            );
    }

    private syncSwitchMcForm(opIdx:number):Observable<AjaxResponse.ConcFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return queryKey !== undefined ?
            this.switchMcModel.syncFrom(rxOf(this.concArgsCache.get(queryKey) as AjaxResponse.SwitchMainCorpArgs)) :
            this.switchMcModel.syncFrom(
                this.pageModel.ajax$<AjaxResponse.SwitchMainCorpArgs>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }
                ).pipe(
                    tap(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        }
                    )
                )
            );
    }

    private syncFormData(opIdx:number):Observable<AjaxResponse.ConcFormArgs|null> {
        const formType = this.currEncodedOperations.get(opIdx).formType;

        if (this.concArgsCache.size === 0) {
            return rxOf(null);

        } else if (formType === Kontext.ConcFormTypes.QUERY) {
            return this.syncQueryForm(opIdx);

        } else if (formType === Kontext.ConcFormTypes.FILTER) {
            return this.syncFilterForm(opIdx);

        } else if (formType === Kontext.ConcFormTypes.SORT) {
            return this.syncSortForm(opIdx);

        } else if (formType === Kontext.ConcFormTypes.SAMPLE) {
            return this.syncSampleForm(opIdx);

        } else if (formType === Kontext.ConcFormTypes.SHUFFLE) {
            return this.syncShuffleForm(opIdx);

        } else if (formType === Kontext.ConcFormTypes.SWITCHMC) {
            return this.syncSwitchMcForm(opIdx);

        } else if (formType === Kontext.ConcFormTypes.SUBHITS) {
            return this.syncSubhitsForm(opIdx);

        } else if (formType === Kontext.ConcFormTypes.FIRSTHITS) {
            return this.syncFirstHitsForm(opIdx);
        }
    }

    getCurrEncodedOperations():Immutable.List<ExtendedQueryOperation> {
        return this.currEncodedOperations;
    }

    getBranchReplayIsRunning():boolean {
        return this.branchReplayIsRunning;
    }

    getEditedOperationIdx():number {
        return this.editedOperationIdx;
    }

    getRunFullQuery():boolean {
        return this.stopAfterOpIdx === null;
    }

    editIsLocked():boolean {
        return this._editIsLocked;
    }

    getNumOperations():number {
        return this.currEncodedOperations.size;
    }
}
