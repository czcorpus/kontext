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

import { tap, concatMap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Action, StatefulModel } from 'kombo';

import { Kontext } from '../../types/common';
import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { AjaxResponse } from '../../types/ajaxResponses';
import { MultiDict } from '../../multidict';
import { highlightSyntaxStatic } from '../../models/query/cqleditor/parser';
import { List, pipe, Dict } from 'cnc-tskit';
import { QueryType } from '../../models/query/common';



export interface InputBoxHistoryItem {
    query:string;
    query_type:QueryType;
    created:number;
}


const attachSh = (he:Kontext.ComponentHelpers, item:Kontext.QueryHistoryItem) => {
    if (item.query_type === 'cql' || item.query_type === 'word' ||
            item.query_type === 'phrase' || item.query_type === 'lemma') {
        item.query_sh = highlightSyntaxStatic(item.query, item.query_type, he);
    }
    return item;
};

/**
 *
 */
export interface QueryStorageModelState {
    data:Array<Kontext.QueryHistoryItem>;
    offset:number;
    limit:number;
    queryType:string;
    currentCorpusOnly:boolean;
    isBusy:boolean;
    pageSize:number;
    hasMoreItems:boolean;
    archivedOnly:boolean;
    editingQueryId:string;
    editingQueryName:string;
}

export class QueryStorageModel extends StatefulModel<QueryStorageModelState> implements PluginInterfaces.QueryStorage.IModel {

    private pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi, offset:number, limit:number, pageSize:number, initialData:Array<Kontext.QueryHistoryItem>) {
        super(
            pluginApi.dispatcher(),
            {
                data: initialData,
                queryType: '',
                currentCorpusOnly: false,
                offset: offset,
                limit: limit,
                pageSize: pageSize,
                isBusy: false,
                hasMoreItems: true, // TODO this should be based on initial data (n+1 items)
                archivedOnly: false,
                editingQueryId: null,
                editingQueryName: null, // null is ok here, a value is attached once the editor is opened
            }
        );
        this.pluginApi = pluginApi;

        this.onAction((action:Action) => {
            switch (action.name) {
                case 'QUERY_STORAGE_SET_QUERY_TYPE':
                    this.changeState(state => {
                        state.isBusy = true;
                        state.queryType = action.payload['value'];
                    });
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_SET_CURRENT_CORPUS_ONLY':
                    this.changeState(state => {
                        state.isBusy = true;
                        state.currentCorpusOnly = action.payload['value'];
                    });
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_SET_ARCHIVED_ONLY':
                    this.changeState(state => {
                        state.isBusy = true;
                        state.archivedOnly = action.payload['value'];
                    });
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_LOAD_MORE':
                    this.changeState(state => {
                        state.isBusy = true;
                        state.limit += state.pageSize;
                    });
                    this.performLoadAction();

                break;
                case 'QUERY_STORAGE_LOAD_HISTORY':
                    this.changeState(state => {state.isBusy = true});
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_OPEN_QUERY_FORM':
                    this.openQueryForm(action.payload['idx']);
                    // page leaves here
                break;
                case 'QUERY_STORAGE_SET_EDITING_QUERY_ID':
                    this.changeState(state => {
                        state.editingQueryId = action.payload['value'];
                        const srch = List.find(v => v.query_id === state.editingQueryId, state.data);
                        if (srch) {
                            state.editingQueryName = srch.name ? srch.name : '';
                        }
                    });
                break;
                case 'QUERY_STORAGE_CLEAR_EDITING_QUERY_ID':
                    this.changeState(state => {
                        state.editingQueryId = null;
                        state.editingQueryName = null;
                    });
                break;
                case 'QUERY_STORAGE_EDITOR_SET_NAME':
                    this.changeState(state => {
                        state.editingQueryName = action.payload['value'];
                    });
                break;
                case 'QUERY_STORAGE_DO_NOT_ARCHIVE':
                    this.saveItem(action.payload['queryId'], null).subscribe(
                        (msg) => {
                            this.changeState(state => {state.isBusy = false});
                            this.pluginApi.showMessage('info', msg);
                        },
                        (err) => {
                            this.changeState(state => {state.isBusy = false});
                            this.pluginApi.showMessage('error', err);
                        }
                    );
                break;
                case 'QUERY_STORAGE_EDITOR_CLICK_SAVE':
                    if (!this.state.editingQueryName) {
                        this.pluginApi.showMessage('error',
                            this.pluginApi.translate('query__save_as_cannot_have_empty_name'));

                    } else {
                        this.changeState(state => {state.isBusy = true});
                        this.saveItem(this.state.editingQueryId, this.state.editingQueryName).subscribe(
                            (msg) => {
                                this.changeState(state => {state.isBusy = false});
                                this.pluginApi.showMessage('info', msg);
                            },
                            (err) => {
                                this.changeState(state => {state.isBusy = false});
                                this.pluginApi.showMessage('error', err);
                            }
                        );
                    }
                break;
            }
        });
    }

    unregister() {}

    private openQueryForm(idx:number):void {
        const item = List.find(v => v.idx === idx, this.state.data);
        const args = new MultiDict();
        args.set('corpname', item.corpname);
        args.set('usesubcorp', item.subcorpname);
        args.set(item.query_type, item.query);
        args.set('queryselector', item.query_type + 'row');
        args.replace('align', List.map(v => v.corpname, item.aligned));
        args.set('lpos', item.lpos);
        args.set('qmcase', item.qmcase ? '1' : '0');
        args.set('default_attr', item.default_attr);
        args.set('pcq_pos_neg', item.pcq_pos_neg);
        List.forEach(v => {
            args.set(`${v.query_type}_${v.corpname}`, v.query);
            args.set(`queryselector_${v.corpname}`, v.query_type + 'row');
            args.set(`lpos_${v.corpname}`, v.lpos);
            args.set(`qmcase_${v.corpname}`, v.qmcase ? '1' : '0');
            args.set(`default_attr_${v.corpname}`, v.default_attr);
            args.set(`pcq_pos_neg_${v.corpname}`, v.pcq_pos_neg);
        }, item.aligned);
        Dict.forEach((v, k) => {
            args.replace(`sca_${k}`, item.selected_text_types[k]);
        }, item.selected_text_types);
        window.location.href = this.pluginApi.createActionUrl('first_form', args);
    }

    private performLoadAction():void {
        this.loadData().subscribe(
            () => {
                this.changeState(state => {state.isBusy = false})
            },
            (err) => {
                this.changeState(state => {state.isBusy = false})
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    private loadData():Observable<any> {
        const args = new MultiDict();
        args.set('corpname', this.pluginApi.getCorpusIdent().id);
        args.set('offset', this.state.offset);
        args.set('limit', this.state.limit + 1);
        args.set('query_type', this.state.queryType);
        args.set('current_corpus', this.state.currentCorpusOnly ? '1' : '0');
        args.set('archived_only', this.state.archivedOnly ? '1' : '0');
        return this.pluginApi.ajax$<AjaxResponse.QueryHistory>(
            'GET',
            this.pluginApi.createActionUrl('user/ajax_query_history'),
            args

        ).pipe(
            tap((data) => {this.changeState(state => {
                state.hasMoreItems = data.data.length === state.limit + 1;
                state.data = state.hasMoreItems ?
                        List.map(
                            attachSh.bind(null, this.pluginApi.getComponentHelpers()),
                            data.data.slice(0, data.data.length - 1)
                        ) :
                        List.map(
                            attachSh.bind(null, this.pluginApi.getComponentHelpers()),
                            data.data
                        );
            })})
        );
    }

    private saveItem(queryId:string, name:string):Observable<string> {
        return (() => {
            const args = new MultiDict();
            args.set('query_id', queryId);
            args.set('name', name);
            if (name) {
                return this.pluginApi.ajax$<any>(
                    'POST',
                    this.pluginApi.createActionUrl('save_query'),
                    args

                );

            } else {
                const args = new MultiDict();
                args.set('query_id', queryId);
                return this.pluginApi.ajax$<any>(
                    'POST',
                    this.pluginApi.createActionUrl('delete_query'),
                    args
                );
            }

        })().pipe(
            tap((data) => {this.changeState(state => {
                state.editingQueryId = null;
                state.editingQueryName = null;
            })}),
            concatMap((_) => this.loadData()),
            map(() => name ?
                    this.pluginApi.translate('query__save_as_item_saved') :
                    this.pluginApi.translate('query__save_as_item_removed')
            )
        );
    }

    getData():Array<Kontext.QueryHistoryItem> {
        return this.state.data;
    }

    getFlatData():Array<InputBoxHistoryItem> {
        return List.flatMap(
            v => [{query: v.query, query_type: v.query_type, created: v.created}]
                .concat(
                    pipe(
                        v.aligned,
                        List.filter(v2 => !!v2.query),
                        List.map(v2 => ({query: v2.query, query_type: v2.query_type, created: v.created}))
                    )
            ),
            this.state.data
        );
    }

    getOffset():number {
        return this.state.offset;
    }

    getLimit():number {
        return this.state.limit;
    }

    getQueryType():string {
        return this.state.queryType;
    }

    getCurrentCorpusOnly():boolean {
        return this.state.currentCorpusOnly;
    }

    getIsBusy():boolean {
        return this.state.isBusy;
    }

    getHasMoreItems():boolean {
        return this.state.hasMoreItems;
    }

    getArchivedOnly():boolean {
        return this.state.archivedOnly;
    }

    getEditingQueryId():string {
        return this.state.editingQueryId;
    }

    getEditingQueryName():string {
        return this.state.editingQueryName;
    }
}