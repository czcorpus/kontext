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
import { StatefulModel } from 'kombo';

import { Kontext } from '../../types/common';
import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { AjaxResponse } from '../../types/ajaxResponses';
import { MultiDict } from '../../multidict';
import { highlightSyntaxStatic } from '../../models/query/cqleditor/parser';
import { List, HTTP } from 'cnc-tskit';
import { Actions, ActionName } from './actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../../models/query/actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../../models/mainMenu/actions';
import { QueryType } from '../../models/query/query';



export interface InputBoxHistoryItem {
    query:string;
    query_type:QueryType;
    created:number;
}


const attachSh = (he:Kontext.ComponentHelpers, item:Kontext.QueryHistoryItem) => {
    if (item.query_type === 'advanced') {
        [item.query_sh,] = highlightSyntaxStatic(item.query, item.query_type, he);
    }
    return item;
};


export class QueryStorageModel extends StatefulModel<PluginInterfaces.QueryStorage.ModelState> {

    private pluginApi:IPluginApi;

    constructor(
        pluginApi:IPluginApi,
        offset:number,
        limit:number,
        pageSize:number
    ) {
        super(
            pluginApi.dispatcher(),
            {
                data: [],
                queryType: '',
                currentCorpusOnly: true,
                offset,
                limit,
                pageSize,
                isBusy: false,
                hasMoreItems: true, // TODO this should be based on initial data (n+1 items)
                archivedOnly: false,
                editingQueryId: null,
                // null is ok here, a value is attached once the editor is opened
                editingQueryName: null,
                currentItem: 0,
            }
        );
        this.pluginApi = pluginApi;

        this.addActionHandler<Actions.SelectItem>(
            ActionName.SelectItem,
            action => {this.changeState(state => {state.currentItem = action.payload.value})}
        );

        this.addActionHandler<QueryActions.StorageSetCurrentCorpusOnly>(
            QueryActionName.StorageSetCurrentCorpusOnly,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.currentCorpusOnly = action.payload.value;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<QueryActions.StorageSetQueryType>(
            QueryActionName.StorageSetQueryType,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.queryType = action.payload.value;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<QueryActions.StorageSetArchivedOnly>(
            QueryActionName.StorageSetArchivedOnly,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.archivedOnly = action.payload.value;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<QueryActions.StorageLoadMore>(
            QueryActionName.StorageLoadMore,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.limit += state.pageSize;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<QueryActions.ToggleQueryHistoryWidget, MainMenuActions.ShowQueryHistory>(
            [QueryActionName.ToggleQueryHistoryWidget, MainMenuActionName.ShowQueryHistory],
            action => {
                this.changeState(state => {
                    state.isBusy = true
                });
                this.performLoadAction(action.name === QueryActionName.ToggleQueryHistoryWidget);
            }
        );

        this.addActionHandler<QueryActions.StorageOpenQueryForm>(
            QueryActionName.StorageOpenQueryForm,
            action => {
                this.openQueryForm(action.payload.idx);
                // page leaves here
            }
        );

        this.addActionHandler<QueryActions.StorageSetEditingQueryId>(
            QueryActionName.StorageSetEditingQueryId,
            action => {
                this.changeState(state => {
                    state.editingQueryId = action.payload.value;
                    const srch = List.find(v => v.query_id === state.editingQueryId, state.data);
                    if (srch) {
                        state.editingQueryName = srch.name ? srch.name : '';
                    }
                });
            }
        );

        this.addActionHandler<QueryActions.StorageClearEditingQueryID>(
            QueryActionName.StorageClearEditingQueryID,
            action => {
                this.changeState(state => {
                    state.editingQueryId = null;
                    state.editingQueryName = null;
                });
            }
        );

        this.addActionHandler<QueryActions.StorageEditorSetName>(
            QueryActionName.StorageEditorSetName,
            action => {this.changeState(state => {state.editingQueryName = action.payload.value})}
        );

        this.addActionHandler<QueryActions.StorageDoNotArchive>(
            QueryActionName.StorageDoNotArchive,
            action => {
                this.saveItem(action.payload.queryId, null).subscribe(
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
        );

        this.addActionHandler<QueryActions.StorageEditorClickSave>(
            QueryActionName.StorageEditorClickSave,
            action => {
                if (!this.state.editingQueryName) {
                    this.pluginApi.showMessage('error',
                        this.pluginApi.translate('query__save_as_cannot_have_empty_name'));

                } else {
                    this.changeState(state => {state.isBusy = true});
                    this.saveItem(
                        this.state.editingQueryId,
                        this.state.editingQueryName

                    ).subscribe(
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
            }
        );
    }

    private openQueryForm(idx:number):void { // TODO this does not work
        const item = List.find(v => v.idx === idx, this.state.data);
        window.location.href = this.pluginApi.createActionUrl(
            'query',
            [
                ['corpname', item.corpname],
                ['usesubcorp', item.subcorpname],
                ['qkey', `${item.query_id}:${item.created}`]
            ]
        );
    }

    private performLoadAction(widgetMode:boolean=false):void {
        this.loadData(widgetMode).subscribe(
            () => {
                this.changeState(state => {
                    state.isBusy = false
                });
            },
            (err) => {
                this.changeState(state => {
                    state.isBusy = false
                });
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    private loadData(widgetMode:boolean=false):Observable<any> {
        const args = new MultiDict();
        args.set('offset', this.state.offset);
        args.set('limit', this.state.limit + 1);
        args.set('query_type', this.state.queryType);
        if (!widgetMode && this.state.currentCorpusOnly) {
            args.set('corpname', this.pluginApi.getCorpusIdent().id);
        }
        args.set('archived_only', widgetMode || !this.state.archivedOnly ? '0' : '1');
        return this.pluginApi.ajax$<AjaxResponse.QueryHistory>(
            HTTP.Method.GET,
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
                    HTTP.Method.POST,
                    this.pluginApi.createActionUrl('save_query'),
                    args

                );

            } else {
                const args = new MultiDict();
                args.set('query_id', queryId);
                return this.pluginApi.ajax$<any>(
                    HTTP.Method.POST,
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
}