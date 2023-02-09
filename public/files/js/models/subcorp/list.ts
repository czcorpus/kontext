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
import { Observable, of, Subject } from 'rxjs';
import { concatMap, delay, switchMap, tap } from 'rxjs/operators';

import * as Kontext from '../../types/kontext';
import { PageModel } from '../../app/page';
import { pipe, List, HTTP } from 'cnc-tskit';
import { Actions } from './actions';
import { Actions as GlobalOptionsActions } from '../options/actions';
import { archiveSubcorpora, splitSelectId, importServerSubcList, SubcorpList, SubcorpusServerRecord, wipeSubcorpora } from './common';
import { validateGzNumber } from '../base';



export interface SubcListFilter {
    show_archived:boolean;
    corpname:string;
    pattern:string;
    page:string;
    pagesize:number;
}


export interface SubcorpListItem {
    id:string;
    name:string;
    corpus_name:string;
    archived:Date;
    author_fullname: string;
    created:Date;
    published:Date;
    size:number;
    is_draft:boolean;
    public_description:string;
    info?:string;
}


export interface UnfinishedSubcorp {
    subcorpusId?:string;
    name:string;
    taskId:string;
    corpusName:string;
    created:Date;
    finished:boolean;
    error?:Error;
}


export interface SortKey {
    name:string;
    reverse:boolean;
}


interface currSubcorpusProps {
    subcorpusId:string;
    subcorpusName:string;
    corpusName:string;
}


export interface SubcorpListModelState {
    userId:number;
    lines:Array<SubcorpListItem>;
    processedItems:Array<UnfinishedSubcorp>;
    relatedCorpora:Array<string>;
    sortKey:SortKey;
    filter:SubcListFilter;
    isBusy:boolean;
    editWindowSubcorpus:currSubcorpusProps|null;
    totalPages:number;
    selectedItems:Array<string>;
}

export interface SubcorpListModelArgs {
    dispatcher:IFullActionControl;
    layoutModel:PageModel;
    data:Array<SubcorpusServerRecord>;
    sortKey:SortKey;
    relatedCorpora:Array<string>;
    unfinished:Array<Kontext.AsyncTaskInfo>;
    initialFilter:SubcListFilter;
}


export class SubcorpListModel extends StatefulModel<SubcorpListModelState> {

    private PATTERN_INPUT_WRITE_THROTTLE_INTERVAL_MS = 500;

    private layoutModel:PageModel;

    private readonly filterSubject$:Subject<typeof Actions.UpdateFilter>;

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
                processedItems: [],
                relatedCorpora,
                sortKey,
                filter: initialFilter ?
                    initialFilter :
                    {
                        show_archived: false,
                        corpname: '',
                        page: '1',
                        pattern: '',
                        pagesize: 20
                    },
                editWindowSubcorpus: null,
                isBusy: false,
                totalPages: layoutModel.getConf<number>('SubcTotalPages'),
                userId: layoutModel.getConf<number>('userId'),
                selectedItems: [],
            }
        );
        this.layoutModel = layoutModel;
        this.layoutModel.getHistory().replaceState('subcorpus/list', {});
        this.changeState(state => {
            state.lines = this.importAndProcessServerSubcList(data);
            state.processedItems = this.importProcessed(unfinished);
        })

        this.filterSubject$ = new Subject();
        this.filterSubject$.pipe(
            tap(action => {
                this.changeState(state => {
                    for (let p in action.payload.filter) {
                        if (action.payload.filter.hasOwnProperty(p)) {
                            state.filter[p] = action.payload.filter[p];
                        }
                    }
                })
            }),
            switchMap(action => {
                if (action.payload.debounced) {
                    return of(action).pipe(delay(this.PATTERN_INPUT_WRITE_THROTTLE_INTERVAL_MS));
                }
                return of(action);
            }),
            tap(_ => {
                this.changeState(state => {state.isBusy = true})
            }),
            concatMap(action => this.filterItems(action.payload.filter)),
        ).subscribe({
            next: _ => {
                this.emitChange();
            },
            error: error => {
                this.emitChange();
                this.layoutModel.showMessage('error', error);
            }
        });

        this.layoutModel.addOnAsyncTaskUpdate(itemList => {
            const subcTasks = itemList.filter(item => item.category === 'subcorpus');
            if (subcTasks.length > 0) {
                this.changeState(
                    state => {
                        List.forEach(
                            task => {
                                const lastStatus = this.updateProcessedSubcorp(state, task);
                                if (!lastStatus) {
                                    throw new Error('unknown task for subc'); // TODO !!!

                                } else if (lastStatus.error) {
                                    this.layoutModel.showMessage('error',
                                        this.layoutModel.translate('task__type_subcorpus_failed_{subc}',
                                        {subc: task.label}));

                                } else if (lastStatus.finished) {
                                        this.layoutModel.showMessage('info',
                                        this.layoutModel.translate('task__type_subcorpus_done_{subc}',
                                            {subc: task.label}));
                                }
                            },
                            subcTasks
                        );
                    }
                );
                /* TODO this causes the "pending error" */
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
            Actions.AttachTaskToSubcorpus,
            action => {
                const srchIdx = List.findIndex(
                    x => x.subcorpusId === action.payload.subcorpusId,
                    this.state.processedItems
                );
                this.changeState(
                    state => {
                        if (srchIdx > -1) {
                            state.processedItems[srchIdx].taskId = action.payload.task.ident;

                        } else {
                            const procItem = List.find(
                                x => x.id === action.payload.subcorpusId,
                                this.state.lines
                            );
                            if (procItem) {
                                List.push(
                                    {
                                        subcorpusId: action.payload.subcorpusId,
                                        name: procItem.name,
                                        taskId: action.payload.task.ident,
                                        corpusName: procItem.corpus_name,
                                        created: new Date(1000 * action.payload.task.created),
                                        finished: action.payload.task.status === 'FAILURE' ||
                                            action.payload.task.status === 'SUCCESS',
                                        error: action.payload.task.error ?
                                                new Error(action.payload.task.error) : undefined
                                    },
                                    state.processedItems
                                );

                            } else {
                                throw new Error(
                                    `Failed to find subcorpus attached to task ${action.payload.task}`
                                );
                            }
                        }
                    }
                );
            }
        )

        this.addActionHandler(
            Actions.SortLines,
            action => {
                this.changeState(state => {state.isBusy = true});
                this.sortItems(action.payload.colName, action.payload.reverse, this.state.filter.page, this.state.filter.page).subscribe({
                    next: (data) => {
                        this.emitChange();
                    },
                    error: (err) => {
                        this.emitChange();
                        this.layoutModel.showMessage('error', err);
                    }
                })
            }
        );

        this.addActionHandler(
            Actions.UpdateFilter,
            action => {
                if (action.payload.filter.corpname !== this.state.filter.corpname) {
                    this.layoutModel.getHistory().replaceState(
                        'subcorpus/list',
                        action.payload.filter.corpname ? {corpname: action.payload.filter.corpname} : {}
                    )
                }
                this.filterSubject$.next(action);
            }
        );

        this.addActionHandler(
            Actions.ShowSubcEditWindow,
            action => {
                this.changeState(state => {
                    state.editWindowSubcorpus = {
                        corpusName: action.payload.corpusName,
                        subcorpusId: action.payload.subcorpusId,
                        subcorpusName: action.payload.subcorpusName
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.HideSubcEditWindow,
            action => this.changeState(state => {
                state.editWindowSubcorpus = null;
            })
        );

        this.addActionHandler(
            Actions.LoadSubcorpusDone,
            action => this.changeState(state => {
                if (action.error) {
                    state.editWindowSubcorpus = null;
                    this.layoutModel.showMessage('error', action.error);
                }
            })
        );

        this.addActionHandler(
            [
                Actions.WipeSubcorpusDone,
                Actions.RestoreSubcorpusDone,
                Actions.ReuseQueryDone,
                Actions.ArchiveSubcorpusDone,
                GlobalOptionsActions.GeneralSubmitDone,
                Actions.SubmitNameAndPublicDescriptionDone,
            ],
            action => {
                if (action.name === GlobalOptionsActions.GeneralSubmitDone.name) {
                    if (action.payload['subcpagesize'] === this.state.filter.pagesize) return;
                    this.changeState(state => {
                        state.filter.page = '1';
                        state.filter.pagesize = action.payload['subcpagesize'];
                    });

                } else if (
                    action.name === Actions.WipeSubcorpusDone.name ||
                    action.name === Actions.ArchiveSubcorpusDone.name ||
                    action.name === Actions.RestoreSubcorpusDone.name
                ) {
                    this.changeState(state => {
                        state.selectedItems = [];
                    });

                    if (action.error) {
                        this.layoutModel.showMessage('error', action.error);

                    } else {
                        if (action.name === Actions.WipeSubcorpusDone.name) {
                            this.layoutModel.showMessage(
                                'info',
                                action.payload['numWiped'] > 1 ?
                                    this.layoutModel.translate('subclist__multi_subc_deleted') :
                                    this.layoutModel.translate('subclist__subc_deleted')
                            );

                        } else if (action.name === Actions.ArchiveSubcorpusDone.name) {
                            this.layoutModel.showMessage(
                                'info',
                                List.size(action.payload['archived']) > 1 ?
                                    this.layoutModel.translate('subclist__multi_subc_archived') :
                                    this.layoutModel.translate('subclist__subc_archived')
                            );

                        } else {
                            this.layoutModel.showMessage(
                                'info',
                                this.layoutModel.translate('subclist__subc_restored')
                            );
                        }
                    }

                } else if (action.name === Actions.SubmitNameAndPublicDescriptionDone.name) {
                    this.changeState(state => {
                        state.editWindowSubcorpus.subcorpusName = action.payload['name'];
                    });
                }

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
        );

        this.addActionHandler(
            Actions.SetPage,
            action => {
                if (validateGzNumber(action.payload.page)) {
                    this.changeState(state => {
                        if (parseInt(action.payload.page) > this.state.totalPages) {
                            state.filter.page = `${state.totalPages}`;
                        } else {
                            state.filter.page = action.payload.page;
                        }
                        state.isBusy = true;
                    });

                    this.reloadItems().subscribe({
                        next: (data) => {
                            this.emitChange();
                        },
                        error: (err) => {
                            this.emitChange();
                            this.layoutModel.showMessage('error', err);
                        }
                    })

                } else {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('freq__page_invalid_val'));
                }
            }
        );

        this.addActionHandler(
            Actions.ToggleSelectLine,
            action => {
                if (this.state.selectedItems.includes(action.payload.selectId)) {
                    this.changeState(state => {
                        state.selectedItems = List.removeValue(action.payload.selectId, state.selectedItems);
                    });

                } else {
                    this.changeState(state => {
                        state.selectedItems = List.push(action.payload.selectId, state.selectedItems);
                    });
                }
            }
        );

        this.addActionHandler(
            Actions.ArchiveSelectedLines,
            action => {
                archiveSubcorpora(
                    this.layoutModel,
                    pipe(
                        Array.from(this.state.selectedItems),
                        List.map(v => {
                            const [corpus_name, id] = splitSelectId(v);
                            return {
                                corpname: corpus_name,
                                subcname: id
                            }
                        })
                    )
                ).subscribe({
                    next: data => {
                        this.dispatchSideEffect(
                            Actions.ArchiveSubcorpusDone,
                            {
                                archived: data.archived
                            }
                        );
                    },
                    error: error => {
                        this.dispatchSideEffect(
                            Actions.ArchiveSubcorpusDone,
                            error
                        );
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.DeleteSelectedLines,
            action => {
                wipeSubcorpora(
                    this.layoutModel,
                    pipe(
                        Array.from(this.state.selectedItems),
                        List.map(v => {
                            const [corpus_name, id] = splitSelectId(v);
                            return {
                                corpname: corpus_name,
                                subcname: id
                            }
                        })
                    )
                ).subscribe({
                    next: data => {
                        this.dispatchSideEffect(
                            Actions.WipeSubcorpusDone,
                            {
                                numWiped: data.num_wiped
                            }
                        );
                    },
                    error: error => {
                        this.dispatchSideEffect(
                            Actions.WipeSubcorpusDone,
                            error
                        );
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ClearSelectedLines,
            action => {
                this.changeState(state => {
                    state.selectedItems = [];
                });
            }
        );
    }

    private getUnfinishedSubcByTask(taskId:string):UnfinishedSubcorp|undefined {
        return List.find(
            x => x.taskId === taskId,
            this.state.processedItems
        );
    }

    /**
     * Based on task attachments in state.processedItems,
     * use provided 'task' to update respective item and return
     * the new value. In case there is nothing to update,
     * return undefined.
     */
    private updateProcessedSubcorp(
        state:SubcorpListModelState,
        task:Kontext.AsyncTaskInfo
    ):UnfinishedSubcorp|undefined {
        const srchIdx = List.findIndex(x => x.taskId === task.ident, this.state.processedItems);
        if (srchIdx > -1) {
            state.processedItems[srchIdx] = List.head(this.importProcessed([task]));
            return state.processedItems[srchIdx];
        }
        return undefined;
    }

    private importProcessed(data:Array<Kontext.AsyncTaskInfo>):Array<UnfinishedSubcorp> {
        return pipe(
            data,
            List.filter(v => v.status !== 'SUCCESS'),
            List.map(item => ({
                taskId: item.ident,
                subcorpusId: item.args['usesubcorp'],
                name: item.label,
                corpusName: item.args['corpname'],
                created: new Date(item.created * 1000),
                error: item.status === 'FAILURE' ? new Error(item.error) : undefined,
                finished: item.status === 'FAILURE' || item.status === 'SUCCESS'
            }))
        );
    }

    private sortItems(name:string, reverse:boolean, page:string, pattern:string):Observable<SubcorpList> {
        const args:{[key:string]:string} = {
            format: 'json',
            sort: (reverse ? '-' : '') + name,
            pattern: pattern,
            page: page,
        }
        this.mergeFilter(args, this.state.filter);

        return this.layoutModel.ajax$<SubcorpList>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('subcorpus/ajax_list'),
            args

        ).pipe(
            tap((data) => {
                this.changeState(state => {
                    state.lines = this.importAndProcessServerSubcList(data.subcorp_list);
                    state.processedItems = this.importProcessed(data.processed_subc);
                    state.relatedCorpora = data.related_corpora;
                    state.totalPages = data.total_pages;
                    state.sortKey = {
                        name: data.sort_key.name,
                        reverse: data.sort_key.reverse
                    };
                    state.isBusy = false;
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

    private reloadItems():Observable<SubcorpList> {
        return this.filterItems(this.state.filter);
    }

    private filterItems(filter:SubcListFilter):Observable<SubcorpList> {
        const args:{[key:string]:string} = {
            format: 'json',
            sort: (this.state.sortKey.reverse ? '-' : '') + this.state.sortKey.name,
            pattern: filter.pattern,
            page: filter.page,
            pagesize: filter.pagesize.toString(),
        }
        this.mergeFilter(args, filter);

        return this.layoutModel.ajax$<SubcorpList>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('subcorpus/ajax_list'),
            args

        ).pipe(
            tap((data) => {
                this.changeState(state => {
                    state.lines = this.importAndProcessServerSubcList(data.subcorp_list);
                    state.processedItems = this.importProcessed(data.processed_subc);
                    state.relatedCorpora = data.related_corpora;
                    state.totalPages = data.total_pages;
                    state.isBusy = false;
                })
            })
        );
    }

    private importAndProcessServerSubcList(
        data:Array<SubcorpusServerRecord>
    ):Array<SubcorpListItem> {
        return pipe(
            data,
            importServerSubcList,
            List.map(v => {
                if (this.state.filter.pattern && !v.name.includes(this.state.filter.pattern) && v.public_description.includes(this.state.filter.pattern)) {
                    v.info = this.layoutModel.translate('subclist__pattern_in_description');
                }
                return v
            })
        );
    }
}
