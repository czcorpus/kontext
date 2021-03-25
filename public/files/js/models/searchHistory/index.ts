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
import { IFullActionControl, StatefulModel } from 'kombo';

import { Kontext } from '../../types/common';
import { MultiDict } from '../../multidict';
import { highlightSyntaxStatic } from '../query/cqleditor/parser';
import { List, HTTP, tuple } from 'cnc-tskit';
import { Actions, ActionName } from './actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { QueryType } from '../query/query';
import { PageModel } from '../../app/page';
import { GetHistoryResponse, QueryHistoryItem, ModelState } from './common';



export interface InputBoxHistoryItem {
    query:string;
    query_type:QueryType;
    created:number;
}


const attachSh = (he:Kontext.ComponentHelpers, item:QueryHistoryItem) => {
    if (item.query_type === 'advanced') {
        [item.query_sh,] = highlightSyntaxStatic(item.query, item.query_type, he);
    }
    return item;
};


export class SearchHistoryModel extends StatefulModel<ModelState> {

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
                data: [],
                querySupertype: undefined,
                currentCorpusOnly: true,
                offset,
                limit,
                pageSize,
                isBusy: false,
                hasMoreItems: true, // TODO this should be based on initial data (n+1 items)
                archivedOnly: false,
                editedItem: undefined,
                currentItem: 0,
            }
        );
        this.pageModel = pageModel;

        this.addActionHandler<Actions.SelectItem>(
            ActionName.SelectItem,
            action => {this.changeState(state => {state.currentItem = action.payload.value})}
        );

        this.addActionHandler<Actions.HistorySetCurrentCorpusOnly>(
            ActionName.HistorySetCurrentCorpusOnly,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.currentCorpusOnly = action.payload.value;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<Actions.HistorySetQuerySupertype>(
            ActionName.HistorySetQuerySupertype,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.querySupertype = action.payload.value || undefined;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<Actions.HistorySetArchivedOnly>(
            ActionName.HistorySetArchivedOnly,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.archivedOnly = action.payload.value;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<Actions.HistoryLoadMore>(
            ActionName.HistoryLoadMore,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                    state.limit += state.pageSize;
                });
                this.performLoadAction();
            }
        );

        this.addActionHandler<Actions.ToggleQueryHistoryWidget, MainMenuActions.ShowQueryHistory>(
            [ActionName.ToggleQueryHistoryWidget, MainMenuActionName.ShowQueryHistory],
            action => {
                this.changeState(state => {
                    state.isBusy = true
                });
                this.performLoadAction(action.name === ActionName.ToggleQueryHistoryWidget);
            }
        );

        this.addActionHandler<Actions.HistoryOpenQueryForm>(
            ActionName.HistoryOpenQueryForm,
            action => {
                this.openQueryForm(action.payload.idx);
                // page leaves here
            }
        );

        this.addActionHandler<Actions.HistorySetEditedItem>(
            ActionName.HistorySetEditedItem,
            action => {
                this.changeState(state => {
                    state.editedItem = action.payload.itemIdx;
                    if (!state.data[state.editedItem].name) {
                        state.data[state.editedItem].name= '';
                    }
                });
            }
        );

        this.addActionHandler<Actions.HistoryCloseEditedItem>(
            ActionName.HistoryCloseEditedItem,
            action => {
                this.changeState(state => {
                    state.editedItem = undefined;
                });
            }
        );

        this.addActionHandler<Actions.HistoryEditorSetName>(
            ActionName.HistoryEditorSetName,
            action => {
                this.changeState(state => {
                    const item = state.data[state.editedItem];
                    item.name = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.HistoryDoNotArchive>(
            ActionName.HistoryDoNotArchive,
            action => {
                this.changeState(state => {
                    state.data[action.payload.itemIdx].name = null;
                });
                this.saveItem(action.payload.itemIdx).subscribe(
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

        this.addActionHandler<Actions.HistoryEditorClickSave>(
            ActionName.HistoryEditorClickSave,
            action => {
                const item = this.state.data[this.state.editedItem];
                if (!item.name) {
                    this.pageModel.showMessage('error',
                        this.pageModel.translate('query__save_as_cannot_have_empty_name'));

                } else {
                    this.changeState(state => {state.isBusy = true});
                    this.saveItem(this.state.editedItem).subscribe(
                        (msg) => {
                            this.changeState(state => {state.isBusy = false});
                            this.pageModel.showMessage('info', msg);
                        },
                        (err) => {
                            this.changeState(state => {state.isBusy = false});
                            this.pageModel.showMessage('error', err);
                        }
                    );
                }
            }
        );
    }

    private openQueryForm(idx:number):void { // TODO this does not work
        const item = List.find(v => v.idx === idx, this.state.data);
        switch (item.q_supertype) {
            case 'conc':
                window.location.href = this.pageModel.createActionUrl(
                    'query',
                    [
                        tuple('corpname', item.corpname),
                        tuple('usesubcorp', item.subcorpname),
                        tuple('qkey', `${item.query_id}:${item.created}`)
                    ]
                );
                break;
            case 'pquery':
                window.location.href = this.pageModel.createActionUrl(
                    'pquery/index',
                    [
                        tuple('corpname', item.corpname),
                        tuple('usesubcorp', item.subcorpname),
                        tuple('query_id', item.query_id)
                    ]
                );
                break;
            case 'wlist':
                // TODO
                break;
        }
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
                this.pageModel.showMessage('error', err);
            }
        );
    }

    private loadData(widgetMode:boolean=false):Observable<any> {
        const args = new MultiDict();
        args.set('offset', this.state.offset);
        args.set('limit', this.state.limit + 1);
        args.set('query_supertype', this.state.querySupertype);
        if (!widgetMode && this.state.currentCorpusOnly) {
            args.set('corpname', this.pageModel.getCorpusIdent().id);
        }
        args.set('archived_only', widgetMode || !this.state.archivedOnly ? '0' : '1');
        return this.pageModel.ajax$<GetHistoryResponse>(
            HTTP.Method.GET,
            this.pageModel.createActionUrl('user/ajax_query_history'),
            args

        ).pipe(
            tap(data => {
                this.changeState(state => {
                    state.editedItem = undefined;
                    state.hasMoreItems = data.data.length === state.limit + 1;
                    state.data = state.hasMoreItems ?
                        List.map(
                            attachSh.bind(null, this.pageModel.getComponentHelpers()),
                            data.data.slice(0, data.data.length - 1)
                        ) :
                        List.map(
                            attachSh.bind(null, this.pageModel.getComponentHelpers()),
                            data.data
                        );
                })
            })
        );
    }

    private saveItem(itemIdx:number):Observable<string> {
        return (() => {
            const item = this.state.data[itemIdx];
            const args = new MultiDict();
            args.set('query_id', item.query_id);
            args.set('name', item.name);
            if (item.name) {
                return this.pageModel.ajax$<any>(
                    HTTP.Method.POST,
                    this.pageModel.createActionUrl('save_query'),
                    args

                ).pipe(
                    map(resp => tuple(resp, true))
                )

            } else {
                const args = new MultiDict();
                args.set('query_id', item.query_id);
                return this.pageModel.ajax$<any>(
                    HTTP.Method.POST,
                    this.pageModel.createActionUrl('delete_query'),
                    args

                ).pipe(
                    map(resp => tuple(resp, false))
                )
            }

        })().pipe(
            tap(
                _ => {
                    this.changeState(state => {
                        state.editedItem = undefined;
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