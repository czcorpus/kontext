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


export interface QueryOperation {
    op:string;
    opid:string;
    nicearg:string;
    tourl:string;
    arg:string;
    churl:string;
    size:number;
}

export type LocalQueryFormData = {[ident:string]:AjaxResponse.ConcFormArgs};


export interface ReplayStoreDeps {
    queryStore:QueryStore;
    filterStore:FilterStore;
}


export class QueryReplayStore extends SimplePageStore {

    private pageModel:PageModel;

    private currEncodedOperations:Immutable.List<QueryOperation>;

    private replayOperations:Immutable.List<string>;

    private queryStore:QueryStore;

    private filterStore:FilterStore;

    private concArgsCache:Immutable.Map<string, AjaxResponse.ConcFormArgs>;

    private branchReplayIsRunning:boolean;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, replayStoreDeps:ReplayStoreDeps,
            currentOperations:Array<QueryOperation>, concArgsCache:LocalQueryFormData) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.currEncodedOperations = Immutable.List<QueryOperation>(currentOperations);
        this.replayOperations = Immutable.List<string>();
        this.concArgsCache = Immutable.Map<string, AjaxResponse.ConcFormArgs>(concArgsCache);
        this.queryStore = replayStoreDeps.queryStore;
        this.filterStore = replayStoreDeps.filterStore;
        this.branchReplayIsRunning = false;
        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
                switch (payload.actionType) {
                    case 'EDIT_QUERY_OPERATION':
                        this.syncFormData(payload.props['operationIdx']).then(
                            (data) => {
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.pageModel.showMessage('error', err);
                            }
                        )
                    break;
                    case 'BRANCH_QUERY':
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
                                this.pageModel.showMessage('error', err);
                            }
                        );
                    break;
                }
        });
    }

    private getCurrentQueryKey():string {
        const qArgs = this.pageModel.getConcArgs().getList('q');
        return qArgs[0].indexOf('~') === 0 ? qArgs[0].substr(1) : undefined;
    }

    private opIdxToCachedQueryKey(idx:number):string {
        if (this.replayOperations.size > 0) {
            return this.replayOperations.get(idx);

        } else if (this.concArgsCache.has('__new__') && idx === this.currEncodedOperations.size - 1) {
            return '__new__';

        } else {
            // no local data about idx->key mapping
            // but we can still succeed in case of the most current op
            const currKey = this.getCurrentQueryKey();
            if (currKey !== undefined && idx === this.currEncodedOperations.size - 1) {
                return currKey;

            } else {
                return undefined;
            }
        }
    }

    /**
     * Generate a function representing an operation within query pipeline.
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
            }

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

        } else {
            throw new Error('cannot prepare operation for type ' + formType);
        }
    }

    /**
     * Process a query pipeline with the operation with index [changedOpIdx] updated.
     * Once all done a string containing a URL KonText should
     * reload to is returned wrapped in a promise.
     */
    private branchQuery(changedOpIdx:number):RSVP.Promise<any> {
        this.branchReplayIsRunning = true;
        this.notifyChangeListeners(); // => start the animation "replaying the query"

        const args = this.pageModel.getConcArgs();
        const fetchQueryPipeline:RSVP.Promise<Immutable.List<string>> = this.pageModel.ajax(
            'POST',
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
                const operations = opList.map((opKey, i) => {
                    return this.createOperation(
                        i, opKey, changedOpIdx, opList.size, this.concArgsCache.get(opKey).form_type);
                });
                return operations.reduce<RSVP.Promise<any>>(
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
     *
     */
    private syncQueryForm(opIdx:number):RSVP.Promise<any> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return this.queryStore.syncFrom(() => {
                return new RSVP.Promise<AjaxResponse.QueryFormArgs>((resolve:(data)=>void, reject:(err)=>void) => {
                    resolve(this.concArgsCache.get(queryKey));
                });
            });

        } else {
            return this.queryStore.syncFrom(() => {
                return this.pageModel.ajax<any>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {last_key: this.getCurrentQueryKey(), idx: opIdx}
                );
            });
        }
    }

    /**
     *
     */
    private syncFilterForm(opIdx:number):RSVP.Promise<any> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        if (queryKey !== undefined) {
            return this.filterStore.syncFrom(queryKey, () => {
                return new RSVP.Promise<AjaxResponse.FilterFormArgs>(
                    (resolve:(data)=>void, reject:(err)=>void) => {
                        resolve(this.concArgsCache.get(queryKey));
                    }
                );
            });

        } else {
            return this.queryStore.syncFrom(() => {
                return this.pageModel.ajax<any>(
                    'GET',
                    this.pageModel.createActionUrl('ajax_fetch_conc_form_args'),
                    {last_key: this.getCurrentQueryKey(), idx: opIdx}
                );
            });
        }
    }

    /**
     * @todo
     */
    private syncSortForm(opIdx:number):RSVP.Promise<any> {
        const queryKey = this.opIdxToCachedQueryKey(opIdx);
        return new RSVP.Promise((resolve:(v:any)=>void, reject:(err:any)=>void) => {
            resolve(`sync sort done, idx: ${opIdx}, key: ${queryKey}`); // TODO !!!
        });
    }

    private operationIsQuery(opIdx:number):boolean {
        return this.currEncodedOperations.get(opIdx).opid === 'q' || this.currEncodedOperations.get(opIdx).opid === 'a';
    }

    private operationIsFilter(opIdx:number):boolean {
        return ['n', 'N', 'p', 'P'].indexOf(this.currEncodedOperations.get(opIdx).opid) > -1;
    }

    private operationIsSort(opIdx:number):boolean {
        return this.currEncodedOperations.get(opIdx).opid === 's';
    }

    private syncFormData(opIdx:number):RSVP.Promise<any> {
        /*
            query codes:
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
        if (this.operationIsQuery(opIdx)) {
            return this.syncQueryForm(opIdx);

        } else if (this.operationIsFilter(opIdx)) {
            return this.syncFilterForm(opIdx);

        } else if (this.operationIsSort(opIdx)) {
            return this.syncSortForm(opIdx);
        }
    }

    getCurrEncodedOperations():Immutable.List<QueryOperation> {
        return this.currEncodedOperations;
    }

    getBranchReplayIsRunning():boolean {
        return this.branchReplayIsRunning;
    }
}