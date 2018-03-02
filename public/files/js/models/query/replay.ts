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

import {AjaxResponse} from '../../types/ajaxResponses';
import {Kontext} from '../../types/common';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {SynchronizedModel} from '../base';
import {PageModel} from '../../app/main';
import {QueryModel, QueryFormUserEntries} from './main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {FilterModel} from './filter';
import {ConcSortModel, MultiLevelConcSortModel, fetchSortFormArgs, ISubmitableConcSortModel} from './sort';
import {ConcSampleModel} from './sample';
import {SwitchMainCorpModel} from './switchmc';
import {TextTypesModel} from '../textTypes/attrValues';
import {FirstHitsModel} from '../query/firstHits';


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
 *
 */
export interface ExtendedQueryOperation extends Kontext.QueryOperation {
    formType:string;
}

/**
 *
 */
function mapOpIdToFormType(opId:string):string {
    /*
        query operation codes:
        q: Query
        a: Query
        r: Random sample
        s: Sort
        f: Shuffle
        D: Remove nested matches
        F: First hits in documents
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

    } else if (opId === 'x') {
        return 'switchmc';

    } else if (opId === 'D') {
        return 'subhits';

    } else if (opId === 'F') {
        return 'firsthits';
    }
}


/**
 * Local query form data cache.
 */
export type LocalQueryFormData = {[ident:string]:AjaxResponse.ConcFormArgs};


/**
 * Models required by QueryReplayModel to operate
 */
export interface ReplayModelDeps {
    queryModel:QueryModel;
    filterModel:FilterModel;
    sortModel:ConcSortModel;
    mlConcSortModel:MultiLevelConcSortModel;
    sampleModel:ConcSampleModel;
    textTypesModel:TextTypesModel;
    switchMcModel:SwitchMainCorpModel;
    firstHitsModel:FirstHitsModel;
}


function importEncodedOperations(currentOperations:Array<Kontext.QueryOperation>):Immutable.List<ExtendedQueryOperation> {
    return Immutable.List<ExtendedQueryOperation>(currentOperations.map(item => {
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
}

/**
 * This is a basic variant of query info/replay store which
 * can only fetch query overview info without any edit
 * functions. It is typically used on pages where an active
 * concordance exists but it is not visible at the moment
 * (e.g. freq. & coll. pages). In such case it is typically
 * extended further (see IndirectQueryReplayModel) to allow
 * returning to the 'view' page in case user wants to use
 * some of its functions.
 */
export class QueryInfoModel extends SynchronizedModel {

    /**
     * This is a little bit independent from the rest. It just
     * contains data required to render tabular query overview.
     */
    private currentQueryOverview:any;

    protected pageModel:PageModel;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'CLEAR_QUERY_OVERVIEW_DATA':
                    this.currentQueryOverview = null;
                    this.notifyChangeListeners();
                break;
                case 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO':
                    this.loadQueryOverview().then(
                        (data) => {
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                        }
                    );
            break;
            }
        });
    }

    private loadQueryOverview():RSVP.Promise<any> {
        const args = this.pageModel.getConcArgs();
        return this.pageModel.ajax<any>(
            'GET',
            this.pageModel.createActionUrl('concdesc_json'),
            args,
            {}
        ).then(
            (data) => {
                this.currentQueryOverview = data.Desc;
            }
        );
    }

    getCurrentQueryOverview():any {
        return this.currentQueryOverview;
    }
}


/**
 * QueryReplayModel reads operations stored in the breadcrumb-like navigation
 * and query operation data stored on server (handled by conc_persistence plug-in)
 * and generates a new query "pipeline" with a single step updated by a user
 * via a respective form (query, filter, sort,...). Then it submits all the
 * server requests one-by-one (while updating query operation ID) and the final
 * request is used to redirect client to see the result.
 */
export class QueryReplayModel extends QueryInfoModel {

    private currEncodedOperations:Immutable.List<ExtendedQueryOperation>;

    private replayOperations:Immutable.List<string>;

    private queryModel:QueryModel;

    private filterModel:FilterModel;

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

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, replayModelDeps:ReplayModelDeps,
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

        this.dispatcher.register(payload => {
                switch (payload.actionType) {
                    case 'EDIT_QUERY_OPERATION':
                        this.editedOperationIdx = payload.props['operationIdx'];
                        this.notifyChangeListeners();
                        this.syncFormData(payload.props['operationIdx']).catch(
                            (err) => {
                                this.editedOperationIdx = null;
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
                    case 'QUERY_SET_STOP_AFTER_IDX':
                        this.stopAfterOpIdx = payload.props['value'];
                        this.notifyChangeListeners();
                    break;
                    case 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO':
                        this.editedOperationIdx = null;
                        this.notifyChangeListeners();
                    break;
                }
        });
    }

    private getActualCorpname():string {
        return this.pageModel.getConf<string>('corpname');
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
                        // no implicit shuffle during replay as optional shuffle
                        // is already "materialized" as a separate operation here
                        // and we don't want a double shuffle
                        this.queryModel.disableDefaultShuffling();
                        const url = this.queryModel.getSubmitUrl();
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                url,
                                {
                                    format: 'json',
                                    async: 0
                                }
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    this.queryModel.submitQuery();
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
                        const url = this.filterModel.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                url,
                                {format: 'json'}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    this.filterModel.submitQuery(opKey);
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
                        let activeModel:ISubmitableConcSortModel;

                        if (this.sortModel.isActiveActionValue(opKey)) {
                            activeModel = this.sortModel;

                        } else if (this.mlConcSortModel.isActiveActionValue(opKey)) {
                            activeModel = this.mlConcSortModel;
                        }
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                activeModel.getSubmitUrl(opKey),
                                {format: 'json'}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    activeModel.submit(opKey);
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
                        const url = this.sampleModel.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                url,
                                {format: 'json'}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    this.sampleModel.submitQuery(opKey);
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

        } else if (formType === 'switchmc') {
            return () => {
                const url = this.switchMcModel.getSubmitUrl(opKey);
                if (opIdx < numOps - 1) {
                    return this.pageModel.ajax(
                        'GET',
                        url,
                        {format: 'json'}
                    );

                } else {
                    return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                        resolve(() => {
                            window.location.href = url;
                        });
                    });
                }
            };

        } else if (formType === 'subhits') {
            return () => {
                return prepareFormData().then(
                    () => {
                        const targetUrl = this.pageModel.createActionUrl('filter_subhits', this.pageModel.getConcArgs().items());
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
                    }
                );
            };

        } else if (formType === 'firsthits') {
            return () => {
                return prepareFormData().then(
                    () => {
                        const targetUrl = this.firstHitsModel.getSubmitUrl(opKey);
                        if (opIdx < numOps - 1) {
                            return this.pageModel.ajax(
                                'GET',
                                targetUrl,
                                {format: 'json'}
                            );

                        } else {
                            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                                resolve(() => {
                                    this.firstHitsModel.submitForm(opKey);
                                });
                            });
                        }
                    }
                );
            };

        } else if (formType === 'locked') { // locked op uses compiled query (i.e. no form data)
            return () => {
                const args = this.pageModel.getConcArgs();
                args.add('q', this.currEncodedOperations.get(opIdx).opid + this.currEncodedOperations.get(opIdx).arg);
                const targetUrl = this.pageModel.createActionUrl('view', args.items());
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
    private syncQueryForm(opIdx:number):RSVP.Promise<AjaxResponse.QueryFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return (() => {
            if (queryKey !== undefined) { // cache hit
                return this.queryModel.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.QueryFormArgs>((resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    });
                });

            } else {
                return this.queryModel.syncFrom(() => {
                    return this.pageModel.ajax<AjaxResponse.QueryFormArgsResponse>(
                        'GET',
                        this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                        {
                            corpname: this.getActualCorpname(),
                            last_key: this.getCurrentQueryKey(),
                            idx: opIdx
                        }

                    ).then(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(
                                data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                            return data;
                        }

                    ).then(
                        (data) => {
                            // syncFrom
                            return this.textTypesModel.syncFrom(() => {
                                return new RSVP.Promise<AjaxResponse.QueryFormArgs>(
                                    (resolve:(d)=>void, reject:(err)=>void) => {
                                        resolve(data);
                                    }
                                );
                            });
                        }
                    );
                });
            }
        })().then(
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
        );
    }

    /**
     * Synchronize filter form with position [opIdx] in a
     * respective query pipeline.
     */
    private syncFilterForm(opIdx:number):RSVP.Promise<AjaxResponse.FilterFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return (() => {
            if (queryKey !== undefined) { // cache hit
                return this.filterModel.syncFrom(() => {
                    return new RSVP.Promise<AjaxResponse.FilterFormArgs>(
                        (resolve:(data)=>void, reject:(err)=>void) => {
                            resolve(this.concArgsCache.get(queryKey));
                        }
                    );
                });

            } else {
                return this.filterModel.syncFrom(() => {
                    return this.pageModel.ajax<AjaxResponse.FilterFormArgsResponse>(
                        'GET',
                        this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                        {
                            corpname: this.getActualCorpname(),
                            last_key: this.getCurrentQueryKey(),
                            idx: opIdx
                        }

                    ).then(
                        (data) => {
                            this.concArgsCache = this.concArgsCache.set(
                                data.op_key, data);
                            this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                            return data;
                        }
                    )
                });
            }
        })().then(
            (data) => {
                this.synchronize(
                    'EDIT_QUERY_OPERATION',
                    {
                        sourceId: data.op_key,
                        query: data.query,
                        queryType: data.query_type
                    }
                );
                return data;
            }
        );
    }

    /**
     * @todo
     */
    private syncSortForm(opIdx:number):RSVP.Promise<AjaxResponse.SortFormArgs> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return this.sortModel.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.SortFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            }).then<AjaxResponse.SortFormArgs>(
                (data) => {
                    return this.mlConcSortModel.syncFrom(() => {
                        return new RSVP.Promise<AjaxResponse.SortFormArgs>(
                            (resolve:(data)=>void, reject:(err)=>void) => {
                                resolve(data);
                            }
                        );
                    });
                }
            );

        } else {
            return this.sortModel.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.SortFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).then<AjaxResponse.SortFormArgsResponse>(
                    (data) => {
                        this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                        this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        return data;
                    }
                );

            }).then<AjaxResponse.SortFormArgs>(
                (data) => {
                    const queryKey = this.opIdxToCachedQueryKey(opIdx); // now we know queryKey for sure
                    return this.mlConcSortModel.syncFrom(() => {
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
            return this.sampleModel.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.SampleFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            });

        } else {
            return this.sampleModel.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.SampleFormArgsResponse>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).then(
                    (data) => {
                        this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                        this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        return data;
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
                {
                    corpname: this.getActualCorpname(),
                    last_key: this.getCurrentQueryKey(),
                    idx: opIdx
                }

            ).then(
                (data) => {
                    this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                    this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                    return data;
                }
            );
        }
    }

    private syncSubhitsForm(opIdx:number):RSVP.Promise<any> {
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
                {
                    corpname: this.getActualCorpname(),
                    last_key: this.getCurrentQueryKey(),
                    idx: opIdx
                }

            ).then(
                (data) => {
                    this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                    this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                    return data;
                }
            );
        }
    }

    private syncFirstHitsForm(opIdx:number):RSVP.Promise<any> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return this.firstHitsModel.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.FirstHitsFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            });

        } else {
            return this.firstHitsModel.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.FirstHitsFormArgs>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).then(
                    (data) => {
                        this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                        this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        return data;
                    }
                );
            });
        }
    }

    private syncSwitchMcForm(opIdx:number):RSVP.Promise<any> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return this.switchMcModel.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.SwitchMainCorpArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            });

        } else {
            return this.switchMcModel.syncFrom(() => {
                return this.pageModel.ajax<AjaxResponse.SwitchMainCorpArgs>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {
                        corpname: this.getActualCorpname(),
                        last_key: this.getCurrentQueryKey(),
                        idx: opIdx
                    }

                ).then(
                    (data) => {
                        this.concArgsCache = this.concArgsCache.set(data.op_key, data);
                        this.replayOperations = this.replayOperations.set(opIdx, data.op_key);
                        return data;
                    }
                );
            });
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

        } else if (formType === 'switchmc') {
            return this.syncSwitchMcForm(opIdx);

        } else if (formType === 'subhits') {
            return this.syncSubhitsForm(opIdx);

        } else if (formType === 'firsthits') {
            return this.syncFirstHitsForm(opIdx);
        }
    }

    getCurrEncodedOperations():Immutable.List<Kontext.QueryOperation> {
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



/**
 * IndirectQueryReplayModel is a replacement for QueryReplayModel
 * on pages where query editation forms (and most of related data)
 * are not available but we still want to display operations
 * description (aka breadcrumb navigation) and redirect to the
 * 'view' page and open a respective operation form in case
 * user clicks a item.
 */
export class IndirectQueryReplayModel extends QueryInfoModel {

    private currEncodedOperations:Immutable.List<ExtendedQueryOperation>;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel,
            currentOperations:Array<Kontext.QueryOperation>) {
        super(dispatcher, pageModel);
        this.pageModel = pageModel;
        this.currEncodedOperations = importEncodedOperations(currentOperations);

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'REDIRECT_TO_EDIT_QUERY_OPERATION':
                    window.location.replace(
                        this.pageModel.createActionUrl(
                            'view',
                            this.pageModel.getConcArgs().items()
                        ) + '#edit_op/operationIdx=' + payload.props['operationIdx']
                    );
                break;
            }
        });
    }

    getCurrEncodedOperations():Immutable.List<Kontext.QueryOperation> {
        return this.currEncodedOperations;
    }

}