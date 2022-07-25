/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { tap, concatMap } from 'rxjs/operators';

import * as Kontext from '../../types/kontext';
import { PageModel } from '../../app/page';
import { pipe, List, HTTP } from 'cnc-tskit';
import { Actions } from './actions';
import { ServerSubcorpListItem, SubcorpList } from './common';



export interface SubcListFilter {
    show_archived:boolean;
    corpname:string;
}


export interface SubcorpListItem {
    id:string;
    name:string;
    corpus_name:string;
    archived:Date;
    created:Date;
    size:number;
    public_description:string;
}


export interface UnfinishedSubcorp {
    ident:string;
    name:string;
    created:Date;
    failed:boolean;
}


export interface SortKey {
    name:string;
    reverse:boolean;
}


export interface SubcorpListModelState {
    lines:Array<SubcorpListItem>;
    unfinished:Array<UnfinishedSubcorp>;
    relatedCorpora:Array<string>;
    sortKey:SortKey;
    filter:SubcListFilter;
    isBusy:boolean;
    editWindowSubcorpus:[string,string]|null;
    usesSubcRestore:boolean;
    finishedTasks:{[taskId:string]:boolean};
}

export interface SubcorpListModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    data:Array<ServerSubcorpListItem>;
    sortKey:SortKey;
    relatedCorpora:Array<string>;
    unfinished:Array<Kontext.AsyncTaskInfo>;
    initialFilter:SubcListFilter;
}


export class SubcorpListModel extends StatefulModel<SubcorpListModelState> {

    private layoutModel:PageModel;

    constructor({
        dispatcher,
        layoutModel,
        data,
        sortKey,
        relatedCorpora,
        unfinished,
        initialFilter
    }:SubcorpListModelArgs) {
        super(
            dispatcher,
            {
                lines: [],
                unfinished: [],
                relatedCorpora,
                sortKey,
                filter: initialFilter || {show_archived: false, corpname: ''},
                editWindowSubcorpus: null,
                isBusy: false,
                usesSubcRestore: layoutModel.getConf<boolean>('UsesSubcRestore'),
                finishedTasks: {}
            }
        );
        this.layoutModel = layoutModel;
        this.changeState(state => {
            state.lines = this.importLines(data);
            state.unfinished = this.importProcessed(unfinished);
        })

        this.layoutModel.addOnAsyncTaskUpdate(itemList => {
            const subcTasks = itemList.filter(item => item.category === 'subcorpus');
            if (subcTasks.length > 0) {
                List.forEach(
                    task => {
                        if (task.status === 'FAILURE') {
                            if (!this.state.finishedTasks[task.ident]) {
                                this.layoutModel.showMessage('error',
                                    this.layoutModel.translate('task__type_subcorpus_failed_{subc}',
                                    {subc: task.label}));
                                this.changeState(state => {
                                    state.finishedTasks[task.ident] = true;
                                });
                            }

                        } else {
                            if (!this.state.finishedTasks[task.ident]) {
                                this.layoutModel.showMessage('info',
                                this.layoutModel.translate('task__type_subcorpus_done_{subc}',
                                    {subc: task.label}));
                                this.changeState(state => {
                                    state.finishedTasks[task.ident] = true;
                                });
                            }
                        }
                    },
                    subcTasks
                );
                this.reloadItems().subscribe({
                    next: data => {
                        this.emitChange();
                    },
                    error: error => {
                        this.emitChange();
                        this.layoutModel.showMessage('error', error);
                    }
                });
            }
        });

        this.addActionHandler(
            Actions.SortLines,
            action => this.sortItems(action.payload.colName, action.payload.reverse).subscribe(
                (data) => {
                    this.emitChange();
                },
                (err) => {
                    this.emitChange();
                    this.layoutModel.showMessage('error', err);
                }
            )
        );

        this.addActionHandler(
            Actions.ArchiveSubcorpus,
            action => this.archiveSubcorpus(action.payload.rowIdx).subscribe({
                next: data => {
                    this.emitChange();
                    this.layoutModel.showMessage(
                        'info',
                        this.layoutModel.translate('subclist__subc_archived')
                    );
                },
                error: error => {
                    this.emitChange();
                    this.layoutModel.showMessage('error', error);
                }
            })
        );

        this.addActionHandler(
            Actions.UpdateFilter,
            action => this.filterItems(action.payload).subscribe({
                next: _ => {
                    this.emitChange();
                },
                error: error => {
                    this.emitChange();
                    this.layoutModel.showMessage('error', error);
                }
            })
        );

        this.addActionHandler(
            Actions.ShowSubcEditWindow,
            action => {
                this.changeState(state => {
                    state.editWindowSubcorpus = [action.payload.corpname, action.payload.subcname];
                });
            }
        );

        this.addActionHandler(
            Actions.HideSubcEditWindow,
            action => this.changeState(state => {
                state.editWindowSubcorpus = null;
            })
        );

    }


    private importLines(data:Array<ServerSubcorpListItem>):Array<SubcorpListItem> {
        return List.map(item => ({
            id: item.id,
            name: item.name,
            corpus_name: item.corpus_name,
            size: item.size,
            created: new Date(item.created),
            archived: item.archived ? new Date(item.archived) : undefined,
            selected: false,
            public_description: item.public_description
        }), data);
    }

    private importProcessed(data:Array<Kontext.AsyncTaskInfo>):Array<UnfinishedSubcorp> {
        return pipe(
            data,
            List.filter(v => v.status !== 'SUCCESS'),
            List.map(item => ({
                ident: item.ident,
                name: item.label,
                created: new Date(item.created * 1000),
                failed: item.status === 'FAILURE'
            }))
        )
    }

    private archiveSubcorpus(rowIdx:number):Observable<any> {
        const item = this.state.lines[rowIdx];
        if (!item) {
            return throwError(new Error(`Cannot delete item. Row ${rowIdx} not found.`));
        }
        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/delete'),
            {
                corpname: item.corpus_name,
                usesubcorp: item.name
            },

        ).pipe(
            concatMap(data => this.reloadItems())
        );
    }

    private sortItems(name:string, reverse:boolean):Observable<any> {
        const args:{[key:string]:string} = {
            format: 'json',
            sort: (reverse ? '-' : '') + name
        }
        this.mergeFilter(args, this.state.filter);

        return this.layoutModel.ajax$<SubcorpList>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('subcorpus/list'),
            args

        ).pipe(
            tap((data) => {
                this.changeState(state => {
                    state.lines = this.importLines(data.subcorp_list);
                    state.unfinished = this.importProcessed(data.processed_subc);
                    state.relatedCorpora = data.related_corpora;
                    state.sortKey = {
                        name: data.sort_key.name,
                        reverse: data.sort_key.reverse
                    };
                })
            })
        );
    }

    private mergeFilter(currArgs:{[key:string]:string}, filter:SubcListFilter):void {
        function exportVal(v) {
            if (typeof v === 'boolean') {
                return v ? '1' : '0';
            }
            return String(v);
        }
        for (let p in filter) {
            if (filter.hasOwnProperty(p) && filter[p] !== undefined) {
                currArgs[p] = exportVal(filter[p]);
            }
        }
    }

    private reloadItems():Observable<any> {
        return this.filterItems(this.state.filter);
    }

    private filterItems(filter:SubcListFilter):Observable<any> {
        const args:{[key:string]:string} = {
            format: 'json',
            sort: (this.state.sortKey.reverse ? '-' : '') + this.state.sortKey.name,
        }
        this.mergeFilter(args, filter);
        return this.layoutModel.ajax$<SubcorpList>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('subcorpus/list'),
            args

        ).pipe(
            tap(data => {
                this.changeState(state => {
                    state.lines = this.importLines(data.subcorp_list);
                    state.unfinished = this.importProcessed(data.processed_subc);
                    state.relatedCorpora = data.related_corpora;
                    for (let p in filter) {
                        if (filter.hasOwnProperty(p)) {
                            state.filter[p] = filter[p];
                        }
                    }
                })
            })
        );
    }
}
