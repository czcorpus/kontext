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
import { forkJoin, Observable, of as rxOf } from 'rxjs';
import { Action, IFullActionControl, StatefulModel } from 'kombo';

import * as Kontext from '../../types/kontext';
import { highlightSyntaxStatic } from '../query/cqleditor/parser';
import { List, HTTP, tuple, pipe } from 'cnc-tskit';
import { Actions } from './actions';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { QueryType } from '../query/query';
import { PageModel } from '../../app/page';
import { GetHistoryResponse, SaveItemResponse, SearchHistoryModelState,
    QueryHistoryItem, isConcQueryHistoryItem } from './common';



export interface InputBoxHistoryItem {
    query:string;
    query_type:QueryType;
    created:number;
}


const attachSh = <T extends QueryHistoryItem>(he: Kontext.ComponentHelpers, item:T) => {
    if (item.query_type !== 'simple') {
        [item.query_sh,] = highlightSyntaxStatic({
            query: item.query,
            querySuperType: item.q_supertype,
            he
        });
    }
    return item;
};


export class SearchHistoryModel extends StatefulModel<SearchHistoryModelState> {

    private readonly pageModel:PageModel;

    constructor(
        dispatcher:IFullActionControl,
        pageModel:PageModel,
        offset:number,
        limit:number,
        pageSize:number
    ) {
        super(
            dispatcher,
            {
                corpname: pageModel.getCorpusIdent().id,
                data: [],
                itemsToolbars: [],
                querySupertype: undefined,
                currentCorpusOnly: true,
                offset,
                limit,
                pageSize,
                isBusy: false,
                hasMoreItems: true, // TODO this should be based on initial data (n+1 items)
                archivedOnly: false,
                currentItem: 0,
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler<typeof Actions.SelectItem>(
            Actions.SelectItem.name,
            action => {this.changeState(state => {state.currentItem = action.payload.value})}
        );

        this.addActionHandler<typeof Actions.HistorySetCurrentCorpusOnly>(
            Actions.HistorySetCurrentCorpusOnly.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.currentCorpusOnly = action.payload.value;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<typeof Actions.HistorySetArchivedOnly>(
            Actions.HistorySetArchivedOnly.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.archivedOnly = action.payload.value;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<typeof Actions.HistoryLoadMore>(
            Actions.HistoryLoadMore.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.limit += state.pageSize;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<typeof Actions.ToggleQueryHistoryWidget, typeof MainMenuActions.ShowQueryHistory>(
            [Actions.ToggleQueryHistoryWidget.name, MainMenuActions.ShowQueryHistory.name],
            action => {
                this.changeState(state => {
                    state.isBusy = true
                });
                if (this.isToggleWidgetAction(action)) {
                    this.performLoadAction(true);
                } else {
                    this.performLoadAction();
                }
            }
        );

        this.addActionHandler<typeof Actions.HistoryOpenQueryForm>(
            Actions.HistoryOpenQueryForm.name,
            action => {
                this.openQueryForm(action.payload.idx);
                // page leaves here
            }
        );

        this.addActionHandler<typeof Actions.HistorySetEditedItem>(
            Actions.HistorySetEditedItem.name,
            action => {
                this.changeState(state => {
                    state.itemsToolbars[action.payload.itemIdx] = tuple(true, true);
                    if (!state.data[action.payload.itemIdx].name) {
                        state.data[action.payload.itemIdx].name = '';
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.HistoryCloseEditedItem>(
            Actions.HistoryCloseEditedItem.name,
            action => {
                this.changeState(state => {
                    state.itemsToolbars[action.payload.itemIdx] = tuple(true, false);
                });
            }
        );

        this.addActionHandler<typeof Actions.HistoryEditorSetName>(
            Actions.HistoryEditorSetName.name,
            action => {
                this.changeState(state => {
                    state.data[action.payload.itemIdx].name = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.HistoryDoNotArchive>(
            Actions.HistoryDoNotArchive.name,
            action => {
                this.saveItem(action.payload.itemIdx, null).subscribe(
                    (msg) => {
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                        this.pageModel.showMessage('info', msg);
                    },
                    (err) => {
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                        this.pageModel.showMessage('error', err);
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.HistoryEditorClickSave>(
            Actions.HistoryEditorClickSave.name,
            action => {
                const item = this.state.data[action.payload.itemIdx];
                if (!item.name) {
                    this.pageModel.showMessage('error',
                        this.pageModel.translate('query__save_as_cannot_have_empty_name'));

                } else {
                    this.changeState(state => {state.isBusy = true});
                    this.saveItem(action.payload.itemIdx, item.name).subscribe({
                        next: (msg) => {
                            this.changeState(state => { state.isBusy = false });
                            this.pageModel.showMessage('info', msg);
                        },
                        error: (err) => {
                            this.changeState(state => { state.isBusy = false });
                            this.pageModel.showMessage('error', err);
                        }
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.ToggleRowToolbar>(
            Actions.ToggleRowToolbar.name,
            action => {
                this.changeState(state => {
                    const [status,] = state.itemsToolbars[action.payload.rowIdx];
                    if (status) {
                        state.itemsToolbars[action.payload.rowIdx] = tuple(false, false);

                    } else {
                        state.itemsToolbars[action.payload.rowIdx] = tuple(true, false);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.RemoveItemFromList>(
            Actions.RemoveItemFromList.name,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });

                this.deleteItem(action.payload.itemIdx).subscribe({
                    next: () => this.changeState(state => {state.isBusy = false}),
                    error: error => {
                        this.pageModel.showMessage('error', error);
                        this.changeState(state => { state.isBusy = false });
                    }
                });
            }
        )
    }

    private isToggleWidgetAction(action:Action): action is typeof Actions.ToggleQueryHistoryWidget {
        return action.name === Actions.ToggleQueryHistoryWidget.name
    }

    private openQueryForm(idx:number):void {
        const item = List.find(v => v.idx === idx, this.state.data);
        const actions:{[k in Kontext.QuerySupertype]:string} = {
            conc: 'query',
            pquery: 'pquery/index',
            wlist: 'wordlist/form'
        };
        window.location.href = this.pageModel.createActionUrl(
            actions[item.q_supertype],
            {q: `~${item.query_id}`}
        );
    }

    private performLoadAction(widgetMode: boolean = false): void {
        this.loadData(widgetMode).subscribe({
            next: () => {
                this.changeState(state => {
                    state.isBusy = false
                });
            },
            error: (err) => {
                this.changeState(state => {
                    state.isBusy = false
                });
                this.pageModel.showMessage('error', err);
            },
        });
    }

    private loadData(widgetMode:boolean=false): Observable<GetHistoryResponse> {
        // widget mode loads all history for all corpora
        return this.pageModel.ajax$<GetHistoryResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('user/ajax_query_history'),
            {
                offset: this.state.offset,
                limit: this.state.limit + 1,
                query_supertype: 'conc',
                corpname: !widgetMode && this.state.currentCorpusOnly ?
                    this.pageModel.getCorpusIdent().id : undefined,
                archived_only: !widgetMode && this.state.archivedOnly
            }

        ).pipe(
            tap(data => {
                this.changeState(state => {
                    state.hasMoreItems = data.data.length === state.limit + 1;
                    state.data = pipe(
                        state.hasMoreItems ?
                            data.data.slice(0, data.data.length - 1) :
                            data.data,
                        List.filter(isConcQueryHistoryItem),
                        List.map(
                            item => attachSh(this.pageModel.getComponentHelpers(), item)
                        )
                    );
                    state.itemsToolbars = List.repeat(
                        _ => tuple(false, false),
                        state.data.length
                    );
                })
            })
        );
    }

    private deleteItem(itemIdx:number):Observable<GetHistoryResponse> {
        const item = this.state.data[itemIdx];
        return this.pageModel.ajax$<any>(
            HTTP.Method.POST,
            this.pageModel.createActionUrl('delete_query'),
            {
                query_id: item.query_id,
                created: item.created
            },
            {contentType: 'application/json'}

        ).pipe(
            tap(
                _ => {
                    this.pageModel.showMessage(
                        'info',
                        this.pageModel.translate('qhistory__item_removed')
                    );
                }
            ),
            concatMap(_ => this.loadData())
        );
    }

    private saveItem(itemIdx:number, saveName:string|null):Observable<string> {
        return (() => {
            const item = this.state.data[itemIdx];
            if (saveName) {
                return this.pageModel.ajax$<SaveItemResponse>(
                    HTTP.Method.POST,
                    this.pageModel.createActionUrl('save_query'),
                    {
                        query_id: item.query_id,
                        created: item.created,
                        name: saveName
                    },
                    {contentType: 'application/json'}

                ).pipe(
                    map(resp => tuple(resp, true))
                )

            } else {
                return this.pageModel.ajax$<any>(
                    HTTP.Method.POST,
                    this.pageModel.createActionUrl('unsave_query'),
                    {
                        query_id: item.query_id,
                        created: item.created,
                        name: item.name // sending old name for identification
                    },
                    {contentType: 'application/json'}

                ).pipe(
                    map(resp => tuple(resp, false))
                )
            }

        })().pipe(
            tap(
                _ => {
                    this.changeState(state => {
                        state.itemsToolbars[itemIdx] = tuple(false, false);
                    })
                }
            ),
            concatMap(
                ([, added]) => forkJoin([this.loadData(), rxOf(added)])
            ),
            map(
                ([, added]) => added ?
                    this.pageModel.translate('query__save_as_item_saved') :
                    this.pageModel.translate('query__save_as_item_removed')
            )
        );
    }
}