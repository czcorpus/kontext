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

/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../types/ajaxResponses.d.ts" />

import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';
import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';
import {QueryStore, QueryFormUserEntries} from './main';
import {FilterStore} from './filter';
import {SortStore, MultiLevelSortStore, fetchSortFormArgs, ISubmitableSortStore} from './sort';
import {SampleStore} from './sample';


/**
 * This represent an already encode query
 * operation (i.e. the one without individual
 * form attributes but with encoded q=[...] value
 * understood by Manatee).
 *
 * Please note that these objects are used
 * only marginally and as read-only ones.
 */
export interface QueryOperation {
    op:string;
    opid:string; // an operation type ID (do not confuse with conc_persistence op_key)
    nicearg:string;
    tourl:string;
    arg:string;
    churl:string;
    size:number;
}

export interface ExtendedQueryOperation extends QueryOperation {
    formType:string;
}


function mapOpIdToFormType(opId:string):string {
    /*
        query operation codes:
        q: Query
        a: Query
        r: Random sample
        s: Sort
        f: Shuffle
        n: Negative filter
        N: Negative filter (excluding KWIC)
        p: Positive filter
        P: Positive filter (excluding KWIC)
        x: Switch KWIC
    */
    if (['q', 'a'].indexOf(opId) > -1) {
        return 'query';

    } else if (['n', 'N', 'p', 'P'].indexOf(opId) > -1) {
        return 'filter';

    } else if (opId === 's') {
        return 'sort';

    } else if (opId === 'r') {
        return 'sample';

    } else if (opId === 'f') {
        return 'shuffle';
    }
}


/**
 * Local query form data cache.
 */
export type LocalQueryFormData = {[ident:string]:AjaxResponse.ConcFormArgs};


/**
 * Stores required by QueryReplayStore to operate
 */
export interface ReplayStoreDeps {
    queryStore:QueryStore;
    filterStore:FilterStore;
    sortStore:SortStore;
    mlSortStore:MultiLevelSortStore;
    sampleStore:SampleStore;
}


/**
 * QueryReplayStore reads operations stored in the breadcrumb-like navigation
 * and query operation data stored on server (handled by conc_persistence plug-in)
 * and generates a new query "pipeline" with a single step updated by a user
 * via a respective form (query, filter, sort,...). Then it submits all the
 * server requests one-by-one (while updating query operation ID) and the final
 * request is used to redirect client to see the result.
 */
export class QueryReplayStore extends SimplePageStore {

    private pageModel:PageModel;

    private currEncodedOperations:Immutable.List<ExtendedQueryOperation>;

    private replayOperations:Immutable.List<string>;

    private queryStore:QueryStore;

    private filterStore:FilterStore;

    private sortStore:SortStore;

    private mlSortStore:MultiLevelSortStore;

    private sampleStore:SampleStore;

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

    /**
     * This is a little bit independent from the rest. It just
     * contains data required to render tabular query overview.
     */
    private currentQueryOverview:any;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, replayStoreDeps:ReplayStoreDeps,
            currentOperations:Array<QueryOperation>, concArgsCache:LocalQueryFormData) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.currEncodedOperations = Immutable.List<ExtendedQueryOperation>(currentOperations.map(item => {
            return {
                op: item.op,
                opid: item.opid,
                nicearg: item.nicearg,
                tourl: item.tourl,
                arg: item.arg,
                churl: item.churl,
                size: item.size,
                formType: mapOpIdToFormType(item.opid)
            };
        }));
        this.replayOperations = Immutable.List<string>(currentOperations.map(item => null));
        this.concArgsCache = Immutable.Map<string, AjaxResponse.ConcFormArgs>(concArgsCache);
        this.queryStore = replayStoreDeps.queryStore;
        this.filterStore = replayStoreDeps.filterStore;
        this.sortStore = replayStoreDeps.sortStore;
        this.mlSortStore = replayStoreDeps.mlSortStore;
        this.sampleStore = replayStoreDeps.sampleStore;
        this.branchReplayIsRunning = false;
        this.editedOperationIdx = null;
        this.stopAfterOpIdx = null;
        this.syncCache();
        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
                switch (payload.actionType) {
                    case 'EDIT_QUERY_OPERATION':
                        this.editedOperationIdx = null;
                        this.syncFormData(payload.props['operationIdx']).then(
                            (data) => {
                                this.editedOperationIdx = payload.props['operationIdx'];
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.notifyChangeListeners();
                                this.pageModel.showMessage('error', err);
                            }
                        );
                    break;
                    case 'BRANCH_QUERY':
                        this.editedOperationIdx = null;
                        this.branchQuery(payload.props['operationIdx']).then(
                            (data) => {
                                this.branchReplayIsRunning = false;
                                this.notifyChangeListeners();
                                if (typeof data === 'function') {
                                    data();

                                } else {
                                    throw new Error('Failed to recognize query pipeline result (not a function)');
                                }
                            },
                            (err) => {
                                this.branchReplayIsRunning = false;
                                this.notifyChangeListeners();
                                this.pageModel.showMessage('error', err);
                            }
                        );
                    break;
                    case 'OVERVIEW_SHOW_QUERY_INFO':
                        this.loadQueryOverview().then(
                            (data) => {
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.pageModel.showMessage('error', err);
                            }
                        );
                    break;
                    case 'CLEAR_QUERY_OVERVIEW_DATA':
                        this.currentQueryOverview = null;
                        this.notifyChangeListeners();
                    break;
                    case 'QUERY_SET_STOP_AFTER_IDX':
                        this.stopAfterOpIdx = payload.props['value'];
                        this.notifyChangeListeners();
                    break;
                }
        });
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
    private opIdxToCachedQueryKey(idx:number):string {
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
            formType:string):()=>RSVP.Promise<any> {
        let prepareFormData;
        if (changedOpIdx !== opIdx) {
            prepareFormData = () => this.syncFormData(opIdx);

        } else {
            prepareFormData = () => new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                resolve(null);
            });

        }
        if (opIdx === 0) {
            return () => {
                this.pageModel.replaceConcArg('q', []); // !!! 'q' must be cleared as it contains current encoded query
                return prepareFormData().then(
                    () => {
                        const url = this.queryStore.getSubmitUrl();
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                url,
                                {format: 'json', async: 0}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    this.queryStore.submitQuery();
                                });
                            });
                        }
                    }
                );
            };

        } else if (formType === 'filter') {
            return () => {
                return prepareFormData().then(
                    () => {
                        const url = this.filterStore.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                url,
                                {format: 'json'}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    this.filterStore.submitQuery(opKey);
                                });
                            });
                        }
                    }
                );
            };

        } else if (formType === 'sort') {
            return () => {
                return prepareFormData().then(
                    () => {
                        let activeStore:ISubmitableSortStore;

                        if (this.sortStore.isActiveActionValue(opKey)) {
                            activeStore = this.sortStore;

                        } else if (this.mlSortStore.isActiveActionValue(opKey)) {
                            activeStore = this.mlSortStore;
                        }
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                activeStore.getSubmitUrl(opKey),
                                {format: 'json'}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    activeStore.submit(opKey);
                                });
                            });
                        }
                    }
                );
            };

        } else if (formType === 'sample') {
            return () => {
                return prepareFormData().then(
                    () => {
                        const url = this.sampleStore.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                url,
                                {format: 'json'}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    this.sampleStore.submitQuery(opKey);
                                });
                            });
                        }
                    }
                );
            };

        } else if (formType === 'shuffle') { // please note that shuffle does not have its own store
            return () => {
                const targetUrl = this.pageModel.createActionUrl('shuffle', this.pageModel.getConcArgs().items());
                if (opIdx < numOps - 1) {
                    return this.pageModel.ajax(
                        'GET',
                        targetUrl,
                        {format: 'json'}
                    );

                } else {
                    return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(() => {
                            window.location.href = targetUrl;
                        });
                    });
                }
            };

        } else {
            throw new Error('cannot prepare operation for type ' + formType);
        }
    }

    /**
     * Process a query pipeline with the operation with index [changedOpIdx] updated.
     * The function must load a list of all operations a pipeline is composed of (the
     * pipeline is identified by its last operation ID). Then it generates dynamically
     * a chain of promises based on these stored operations.
     *
     * @param changedOpIdx the last operation of the pipeline
     * @return a promise generated by the last operation in the chain; it can be either
     * an object containing a response of the operation returned by server or a function
     * containing a local action (typically - the last operation contains something
     * like ()=>submit()).
     */
    private branchQuery(changedOpIdx:number):RSVP.Promise<any> {
        this.branchReplayIsRunning = true;
        this.notifyChangeListeners(); // => start the animation "replaying the query"

        const args = this.pageModel.getConcArgs();
        const fetchQueryPipeline:RSVP.Promise<Immutable.List<string>> = this.pageModel.ajax(
            'GET',
            this.pageModel.createActionUrl('load_query_pipeline'),
            args

        ).then(
            (data) => {
                this.replayOperations = Immutable.List<string>(data['ops'].map(item => item['id']));
                this.concArgsCache = Immutable.Map<string, AjaxResponse.ConcFormArgs>(
                            data['ops'].map(item =>[item['id'], item['form_args']]));
                return this.replayOperations;
            }
        );

        return fetchQueryPipeline.then(
            (opList) => {
                const operations = opList.filter((item, i) => i <= this.stopAfterOpIdx || this.stopAfterOpIdx === null);
                return operations.map((opKey, i) => {
                    return this.createOperation(
                        i, opKey, changedOpIdx, operations.size, this.concArgsCache.get(opKey).form_type);
                    }
                ).reduce<RSVP.Promise<any>>(
                    (prev, curr, idx) => {
                        return prev.then(
                            (data) => {
                                if (data !== null && data['Q']) {
                                    const newQVal = data['Q'] || [];
                                    this.pageModel.replaceConcArg('q', newQVal);

                                } else {
                                    this.pageModel.replaceConcArg('q', []);
                                }
                                return curr();
                            }
                        );
                    },
                    new RSVP.Promise((resolve:(d)=>void, reject:(err)=>void) => { resolve(null); })
                );
            }
        );
    }

    /**
     * Synchronize query (= initial) form with position [opIdx] in a
     * respective query pipeline. In fact the query form should have
     * always opIdx = 0 as it is the initial operation but to keep
     * things general the opIdx argument is required and applied.
     *
     * @param opIdx an index of the operation in a respective query pipeline
     * @returns updated query store wrapped in a promise
     */
    private syncQueryForm(opIdx:number):RSVP.Promise<AjaxResponse.QueryFormArgsResponse> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) { // cache hit
            return this.queryStore.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.QueryFormArgs>((resolve:(data)=>void, reject:(err)=>void) => {
                    resolve(this.concArgsCache.get(queryKey));
                });
            });

        } else {
            return this.queryStore.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.QueryFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {last_key: this.getCurrentQueryKey(), idx: opIdx}

                ).then(
                    (data) => {
                        if (!data.contains_errors) {
                            this.concArgsCache = this.concArgsCache.set(
                                data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                            return data;

                        } else {
                            throw new Error(data.messages[0]);
                        }
                    }
                );
            });
        }
    }

    /**
     * Synchronize filter form with position [opIdx] in a
     * respective query pipeline.
     */
    private syncFilterForm(opIdx:number):RSVP.Promise<AjaxResponse.FilterFormArgsResponse> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) { // cache hit
            return this.filterStore.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.FilterFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            });

        } else {
            return this.filterStore.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.FilterFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {last_key: this.getCurrentQueryKey(), idx: opIdx}

                ).then(
                    (data) => {
                        if (!data.contains_errors) {
                            this.concArgsCache = this.concArgsCache.set(
                                data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                            return data;

                        } else {
                            throw new Error(data.messages[0]);
                        }
                    }
                );
            });
        }
    }

    /**
     * @todo
     */
    private syncSortForm(opIdx:number):RSVP.Promise<AjaxResponse.SortFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return this.sortStore.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.SortFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            }).then<AjaxResponse.SortFormArgs>(
                (data) => {
                    return this.mlSortStore.syncFrom(() => {
                        return new RSVP.Promise<AjaxResponse.SortFormArgs>(
                            (resolve:(data)=>void, reject:(err)=>void) => {
                                resolve(data);
                            }
                        );
                    });
                }
            );

        } else {
            return this.sortStore.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.SortFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {last_key: this.getCurrentQueryKey(), idx: opIdx}

                ).then<AjaxResponse.SortFormArgsResponse>(
                    (data) => {
                        if (!data.contains_errors) {
                            this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                            return data;

                        } else {
                            throw new Error(data.messages[0]);
                        }
                    }
                )

            }).then<AjaxResponse.SortFormArgsResponse>(
                (data) => {
                    const queryKey = this.opIdxToCachedQueryKey(opIdx); // now we know queryKey for sure
                    return this.mlSortStore.syncFrom(() => {
                        return new RSVP.Promise<AjaxResponse.SortFormArgs>(
                            (resolve:(data)=>void, reject:(err)=>void) => {
                                resolve(this.concArgsCache.get(queryKey));
                            }
                        );
                    });

                }
            );
        }
    }

    private syncSampleForm(opIdx:number):RSVP.Promise<any> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return this.sampleStore.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.SampleFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            });

        } else {
            return this.sampleStore.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.SampleFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {last_key: this.getCurrentQueryKey(), idx: opIdx}

                ).then(
                    (data) => {
                        if (!data.contains_errors) {
                            this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                            return data;

                        } else {
                            throw new Error(data.messages[0]);
                        }
                    }
                )
            });
        }
    }

    private syncShuffleForm(opIdx:number):RSVP.Promise<any> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return new RSVP.Promise<AjaxResponse.ConcFormArgs>(
                (resolve:(data)=>void, reject:(err)=>void) => {
                    resolve(this.concArgsCache.get(queryKey));
                }
            );

        } else {
            return this.pageModel.ajax<AjaxResponse.ConcFormArgsResponse>(
                'GET',
                this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                {last_key: this.getCurrentQueryKey(), idx: opIdx}

            ).then(
                (data) => {
                    if (!data.contains_errors) {
                        this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                        this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        return data;

                    } else {
                        throw new Error(data.messages[0]);
                    }
                }
            );
        }
    }

    private syncFormData(opIdx:number):RSVP.Promise<any> {
        const opId = this.currEncodedOperations.get(opIdx).opid;
        const formType = this.currEncodedOperations.get(opIdx).formType;

        if (this.concArgsCache.size === 0) {
            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                resolve(null);
            });

        } else if (formType === 'query') {
            return this.syncQueryForm(opIdx);

        } else if (formType === 'filter') {
            return this.syncFilterForm(opIdx);

        } else if (formType === 'sort') {
            return this.syncSortForm(opIdx);

        } else if (formType === 'sample') {
            return this.syncSampleForm(opIdx);

        } else if (formType === 'shuffle') {
            return this.syncShuffleForm(opIdx);
        }
    }

    getCurrEncodedOperations():Immutable.List<QueryOperation> {
        return this.currEncodedOperations;
    }

    getBranchReplayIsRunning():boolean {
        return this.branchReplayIsRunning;
    }


    private loadQueryOverview():RSVP.Promise<any> {
        const args = this.pageModel.getConcArgs();
        return this.pageModel.ajax<any>(
            'GET',
            this.pageModel.createActionUrl('concdesc_json'),
            args,
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.currentQueryOverview = data.Desc;

                } else {
                    throw new Error(this.pageModel.translate('global__failed_to_load_query_overview'));
                }
            }
        );
    }

    getCurrentQueryOverview():any {
        return this.currentQueryOverview;
    }

    getEditedOperationIdx():number {
        return this.editedOperationIdx;
    }

    getRunFullQuery():boolean {
        return this.stopAfterOpIdx === null;
    }
}