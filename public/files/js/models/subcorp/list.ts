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

import { IFullActionControl, StatefulModel} from 'kombo';
import { Observable, throwError, of as rxOf } from 'rxjs';
import { tap, concatMap } from 'rxjs/operators';

import { AjaxResponse } from '../../types/ajaxResponses';
import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { AsyncTaskStatus } from '../asyncTask';
import { pipe, List, HTTP } from 'cnc-tskit';
import { Actions, ActionName } from './actions';



export interface SubcListFilter {
    show_deleted:boolean;
    corpname:string;
}


export interface SubcorpListItem {
    name:string;
    corpname:string;
    usesubcorp:string;
    origSubcName:string;
    deleted:boolean;
    created:Date;
    cql:string;
    size:number;
    published:boolean;
    description:string;
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
    actionBoxVisibleRow:number;
    actionBoxActionType:string;
    usesSubcRestore:boolean;
}

export class SubcorpListModel extends StatefulModel<SubcorpListModelState> {

    private layoutModel:PageModel;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel,
            data:Array<AjaxResponse.ServerSubcorpListItem>, sortKey:SortKey,
            relatedCorpora:Array<string>,
            unfinished:Array<Kontext.AsyncTaskInfo>,
            initialFilter:SubcListFilter) {
        super(
            dispatcher,
            {
                lines: [],
                unfinished: [],
                relatedCorpora,
                sortKey,
                filter: initialFilter || {show_deleted: false, corpname: ''},
                actionBoxVisibleRow: -1,
                actionBoxActionType: 'pub',
                isBusy: false,
                usesSubcRestore: layoutModel.getConf<boolean>('UsesSubcRestore')
            }
        );
        this.layoutModel = layoutModel;
        this.changeState(state => {
            state.lines = this.importLines(data);
            state.unfinished = this.importProcessed(unfinished);
        })

        this.layoutModel.addOnAsyncTaskUpdate((itemList) => {
            const subcTasks = itemList.filter(item => item.category === 'subcorpus');
            if (subcTasks.length > 0) {
                this.layoutModel.showMessage('info',
                    this.layoutModel.translate('task__type_subcorpus_done'));
                this.reloadItems().subscribe(
                    (data) => {
                        this.emitChange();
                    },
                    (err) => {
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                )
            }
        });

        this.addActionHandler<Actions.SortLines>(
            ActionName.SortLines,
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

        this.addActionHandler<Actions.DeleteSubcorpus>(
            ActionName.DeleteSubcorpus,
            action => this.deleteSubcorpus(action.payload.rowIdx).subscribe(
                (data) => {
                    this.emitChange();
                    this.layoutModel.showMessage(
                        'info',
                        this.layoutModel.translate('subclist__subc_deleted')
                    );
                },
                (err) => {
                    this.emitChange();
                    this.layoutModel.showMessage('error', err);
                }
            )
        );

        this.addActionHandler<Actions.UpdateFilter>(
            ActionName.UpdateFilter,
            action => this.filterItems(action.payload).subscribe(
                (data) => {
                    this.emitChange();
                },
                (err) => {
                    this.emitChange();
                    this.layoutModel.showMessage('error', err);
                }
            )
        );

        this.addActionHandler<Actions.ShowActionWindow>(
            ActionName.ShowActionWindow,
            action => this.changeState(state => {
                state.actionBoxVisibleRow = action.payload.value;
                state.actionBoxActionType = action.payload.action;
            })
        );

        this.addActionHandler<Actions.HideActionWindow>(
            ActionName.HideActionWindow,
            action => this.changeState(state => {
                state.actionBoxVisibleRow = -1;
            })
        );

        this.addActionHandler<Actions.SetActionBoxType>(
            ActionName.SetActionBoxType,
            action => this.changeState(state => {
                state.actionBoxActionType = action.payload.value;
            })
        );

        this.addActionHandler<Actions.WipeSubcorpus>(
            ActionName.WipeSubcorpus,
            action => this.wipeSubcorpus(action.payload.idx).subscribe(
                (data) => {
                    this.layoutModel.showMessage('info',
                    this.layoutModel.translate('subclist__subc_wipe_confirm_msg'));
                    this.changeState(state => {state.actionBoxVisibleRow = -1});
                },
                (err) => {
                    this.layoutModel.showMessage('error', err);
                    this.changeState(state => {state.actionBoxVisibleRow = -1});
                }
            )
        );

        this.addActionHandler<Actions.RestoreSubcorpus>(
            ActionName.RestoreSubcorpus,
            action => this.createSubcorpus(action.payload.idx, true).subscribe(
                (data) => {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_restore_confirm_msg'));
                    this.changeState(state => {state.actionBoxVisibleRow = -1});
                },
                (err) => {
                    this.layoutModel.showMessage('error', err);
                    this.changeState(state => {state.actionBoxVisibleRow = -1});
                }
            )
        );

        this.addActionHandler<Actions.ReuseQuery>(
            ActionName.ReuseQuery,
            action => this.createSubcorpus(
                action.payload.idx,
                false,
                action.payload.newName,
                action.payload.newCql
            ).subscribe(
                (data) => {
                    this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_reuse_confirm_msg'));
                    this.changeState(state => {state.actionBoxVisibleRow = -1});
                },
                (err) => {
                    this.changeState(state => {state.actionBoxVisibleRow = -1});
                    this.layoutModel.showMessage('error', err);
                }
            )
        );

        this.addActionHandler<Actions.PublishSubcorpus>(
            ActionName.PublishSubcorpus,
            action => {
                this.changeState(state => {state.isBusy = true});
                this.publishSubcorpus(action.payload.rowIdx, action.payload.description).subscribe(
                    (_) => {
                        this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_published'));
                        this.changeState(state => {
                            state.isBusy = false;
                            state.actionBoxVisibleRow = -1;
                        });
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        this.changeState(state => {
                            state.isBusy = false;
                            state.actionBoxVisibleRow = -1;
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.UpdatePublicDescription>(
            ActionName.UpdatePublicDescription,
            action => {
                try {
                    this.updateSubcDesc(action.payload.rowIdx, action.payload.description);

                } catch (e) {
                    this.layoutModel.showMessage('error', e);
                }
            }
        );

        this.addActionHandler<Actions.SubmitPublicDescription>(
            ActionName.SubmitPublicDescription,
            action => {
                this.changeState(state => {state.isBusy = true});
                this.updateSubcorpusDescSubmit(action.payload.rowIdx).subscribe(
                    (_) => {
                        this.layoutModel.showMessage('info', this.layoutModel.translate('subclist__subc_desc_updated'));
                        this.changeState(state => {
                            state.isBusy = false;
                            state.actionBoxVisibleRow = -1;
                        });
                    },
                    (err) => {
                        this.layoutModel.showMessage('error', err);
                        this.changeState(state => {
                            state.isBusy = false;
                            state.actionBoxVisibleRow = -1;
                        });
                    }
                );
            }
        );
    }

    private updateSubcorpusDescSubmit(rowIdx:number):Observable<any> {
        const data = this.state.lines[rowIdx];
        const args = new MultiDict();
        args.set('corpname', data.corpname);
        args.set('usesubcorp', data.usesubcorp);
        args.set('description', data.description);

        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/update_public_desc'),
            args
        );
    }

    private updateSubcDesc(idx:number, desc:string):void {
        const data = this.state.lines[idx];
        if (data.deleted) {
            throw new Error('Cannot change public description of a deleted subcorpus');
        }
        this.changeState(state => {
            state.lines[idx] = {
                name: data.name,
                corpname: data.corpname,
                usesubcorp: data.usesubcorp,
                origSubcName: data.origSubcName,
                deleted: data.deleted,
                created: data.created,
                cql: data.cql,
                size: data.size,
                published: data.published,
                description: desc
            }
        })
    }

    private publishSubcorpus(rowIdx:number, description:string):Observable<any> {
        const srchIdx = List.findIndex(
            (_, i) => i === this.state.actionBoxVisibleRow,
            this.state.lines
        );
        if (srchIdx === -1) {
            throw new Error('Row not found');
        }
        const data = this.state.lines[srchIdx];
        if (data.deleted) {
            return throwError(new Error('Cannot publish deleted subcorpus'));
        }

        const args = new MultiDict();
        args.set('corpname', data.corpname);
        args.set('subcname', data.usesubcorp);
        args.set('description', description);
        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/publish_subcorpus'),
            args

        ).pipe(
            tap((_) => {
                this.changeState(state => {
                    state.lines[srchIdx] = {
                        name: data.name,
                        corpname: data.corpname,
                        usesubcorp: data.usesubcorp,
                        origSubcName: data.origSubcName,
                        deleted: data.deleted,
                        created: data.created,
                        cql: data.cql,
                        size: data.size,
                        published: true,
                        description
                    }
                })
            })
        );
    }

    private createSubcorpus(
        idx:number, removeOrig:boolean, subcname?:string, cql?:string
    ):Observable<any> {

        const srcRow = this.state.lines[idx];
        const params = new MultiDict();
        params.set('corpname', srcRow.corpname);
        params.set('subcname', subcname !== undefined ? subcname : srcRow.usesubcorp);
        params.set('publish', '0'); // TODO do we want to user-editable?
        params.set('cql', cql !== undefined ? cql : srcRow.cql);

        return this.layoutModel.ajax$<AjaxResponse.CreateSubcorpus>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/ajax_create_subcorpus'),
            params

        ).pipe(
            tap((data) => {
                data.processed_subc.forEach(item => {
                    this.layoutModel.registerTask({
                        ident: item.ident,
                        label: item.label,
                        category: item.category,
                        status: item.status,
                        created: item.created,
                        error: item.error,
                        args: item.args
                    });
                    this.changeState(state => {
                        state.unfinished.push({
                            ident: item.ident,
                            name: item.label,
                            created: new Date(item.created * 1000),
                            failed: false
                        });
                        if (removeOrig) {
                            state.lines = List.filter((v, i) => i !== idx, state.lines);
                        }
                    });
                });
            }),
            concatMap((data) => data.processed_subc.length > 0 ?
                    rxOf(null) : this.reloadItems()
            )
        );
    }

    private wipeSubcorpus(lineIdx:number):Observable<any> {
        const delRow = this.state.lines[lineIdx];
        return this.layoutModel.ajax$(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/ajax_wipe_subcorpus'),
            {
                corpname: delRow.corpname,
                subcname: delRow.usesubcorp
            }

        ).pipe(
            tap((_) => {
                this.changeState(state => {
                    state.lines = List.filter((v, i) => i !== lineIdx, state.lines)
                });
            })
        );
    }

    private importLines(data:Array<AjaxResponse.ServerSubcorpListItem>):Array<SubcorpListItem> {
        return List.map(item => ({
            name: decodeURIComponent(item.name),
            corpname: item.corpname,
            usesubcorp: decodeURIComponent(item.usesubcorp),
            origSubcName: decodeURIComponent(item.orig_subcname),
            deleted: item.deleted,
            size: item.size,
            cql: item.cql ? decodeURIComponent(item.cql).trim() : undefined,
            created: new Date(item.created * 1000),
            selected: false,
            published: item.published,
            description: item.description
        }), data);
    }

    private importProcessed(data:Array<Kontext.AsyncTaskInfo>):Array<UnfinishedSubcorp> {
        return pipe(
            data,
            List.filter(v => v.status !== AsyncTaskStatus.SUCCESS),
            List.map(item => ({
                ident: item.ident,
                name: item.label,
                created: new Date(item.created * 1000),
                failed: item.status === AsyncTaskStatus.FAILURE
            }))
        )
    }

    private deleteSubcorpus(rowIdx:number):Observable<any> {
        const item = this.state.lines[rowIdx];
        if (!item) {
            return throwError(new Error(`Cannot delete item. Row ${rowIdx} not found.`));
        }
        const args = new MultiDict();
        args.set('corpname', item.corpname);
        args.set('usesubcorp', item.usesubcorp);
        return this.layoutModel.ajax$<Kontext.AjaxResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl('subcorpus/delete'),
            args,

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

        return this.layoutModel.ajax$<AjaxResponse.SubcorpList>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('subcorpus/subcorp_list'),
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
            if (filter.hasOwnProperty(p)) {
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
        return this.layoutModel.ajax$<AjaxResponse.SubcorpList>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('subcorpus/subcorp_list'),
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
