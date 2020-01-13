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

import {AjaxResponse} from '../../types/ajaxResponses';
import {Kontext} from '../../types/common';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';

import {PageModel} from '../../app/page';
import {StatefulModel} from '../base';
import { MultiDict } from '../../util';
import { AsyncTaskStatus } from '../asyncTask';
import { Action, IFullActionControl } from 'kombo';



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

export class SubcorpListModel extends StatefulModel {

    private layoutModel:PageModel;

    private lines:Immutable.List<SubcorpListItem>;

    private unfinished:Immutable.List<UnfinishedSubcorp>;

    private relatedCorpora:Immutable.List<string>;

    private sortKey:SortKey;

    private filter:SubcListFilter;

    private isBusy:boolean;

    private actionBoxVisibleRow:number;

    private actionBoxActionType:string;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel,
            data:Array<AjaxResponse.ServerSubcorpListItem>, sortKey:SortKey,
            relatedCorpora:Array<string>,
            unfinished:Array<Kontext.AsyncTaskInfo>,
            initialFilter:SubcListFilter) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.importLines(data);
        this.importProcessed(unfinished);
        this.relatedCorpora = Immutable.List<string>(relatedCorpora);
        this.sortKey = sortKey;
        this.filter = initialFilter || {show_deleted: false, corpname: ''};
        this.actionBoxVisibleRow = -1;
        this.actionBoxActionType = 'pub';

        this.layoutModel.addOnAsyncTaskUpdate((itemList) => {
            const subcTasks = itemList.filter(item => item.category == 'subcorpus');
            if (subcTasks.size > 0) {
                this.layoutModel.showMessage('info',
                    this.layoutModel.translate('task__type_subcorpus_done'));
                this.reloadItems().then(
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

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'SUBCORP_LIST_SORT_LINES':
                    this.sortItems(action.payload['colName'], action.payload['reverse']).then(
                        (data) => {
                            this.emitChange();
                        },
                        (err) => {
                            this.emitChange();
                            this.layoutModel.showMessage('error', err);
                        }
                    )
                break;
                case 'SUBCORP_LIST_DELETE_SUBCORPUS':
                    this.deleteSubcorpus(action.payload['rowIdx']).then(
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
                    );
                break;
                case 'SUBCORP_LIST_UPDATE_FILTER':
                    this.filterItems(<SubcListFilter>action.payload).then(
                        (data) => {
                            this.emitChange();
                        },
                        (err) => {
                            this.emitChange();
                            this.layoutModel.showMessage('error', err);
                        }
                    )
                break;
                case 'SUBCORP_LIST_SHOW_ACTION_WINDOW':
                    this.actionBoxVisibleRow = action.payload['value'];
                    this.actionBoxActionType = action.payload['action'];
                    this.emitChange();
                break;
                case 'SUBCORP_LIST_HIDE_ACTION_WINDOW':
                    this.actionBoxVisibleRow = -1;
                    this.emitChange();
                break;
                case 'SUBCORP_LIST_SET_ACTION_BOX_TYPE':
                    this.actionBoxActionType = action.payload['value'];
                    this.emitChange();
                break;
                case 'SUBCORP_LIST_WIPE_SUBCORPUS':
                    this.wipeSubcorpus(action.payload['idx']).then(
                        (data) => {
                            this.layoutModel.showMessage('info',
                                    this.layoutModel.translate('subclist__subc_wipe_confirm_msg'));
                                    this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        }
                    );
                break;
                case 'SUBCORP_LIST_RESTORE_SUBCORPUS':
                    this.createSubcorpus(action.payload['idx'], true).then(
                        (data) => {
                            this.layoutModel.showMessage('info',
                                    this.layoutModel.translate('subclist__subc_restore_confirm_msg'));
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        }
                    );
                break;
                case 'SUBCORP_LIST_REUSE_QUERY':
                    this.createSubcorpus(action.payload['idx'], false, action.payload['newName'], action.payload['newCql']).then(
                        (data) => {
                            this.layoutModel.showMessage('info',
                                    this.layoutModel.translate('subclist__subc_reuse_confirm_msg'));
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        },
                        (err) => {
                            this.actionBoxVisibleRow = -1;
                            this.layoutModel.showMessage('error', err);
                            this.emitChange();
                        }
                    );
                break;
                case 'SUBCORP_LIST_PUBLISH_SUBCORPUS':
                    this.isBusy = true;
                    this.emitChange();
                    this.publishSubcorpus(
                                action.payload['rowIdx'],
                                action.payload['description']).then(
                        (_) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage(
                                'info',
                                this.layoutModel.translate('subclist__subc_published')
                            );
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage('error', err);
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        }
                    );
                break;
                case 'SUBCORP_LIST_UPDATE_PUBLIC_DESCRIPTION': {
                    try {
                        this.updateSubcDesc(action.payload['rowIdx'], action.payload['description']);

                    } catch (e) {
                        this.layoutModel.showMessage('error', e);
                    }
                    this.emitChange();
                }
                break;
                case 'SUBCORP_LIST_PUBLIC_DESCRIPTION_SUBMIT':
                    this.isBusy = true;
                    this.emitChange();
                    this.updateSubcorpusDescSubmit(
                            action.payload['rowIdx']).then(
                        (_) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage(
                                'info',
                                this.layoutModel.translate('subclist__subc_desc_updated')
                            );
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage('error', err);
                            this.actionBoxVisibleRow = -1;
                            this.emitChange();
                        }
                    );
                break;
            }
        });
    }

    private updateSubcorpusDescSubmit(rowIdx:number):RSVP.Promise<any> {
        const data = this.lines.get(rowIdx);
        const args = new MultiDict();
        args.set('corpname', data.corpname);
        args.set('usesubcorp', data.usesubcorp);
        args.set('description', data.description);

        return this.layoutModel.ajax(
            'POST',
            this.layoutModel.createActionUrl('subcorpus/update_public_desc'),
            args
        );
    }

    private updateSubcDesc(idx:number, desc:string):void {
        const data = this.lines.get(idx);
        if (data.deleted) {
            throw new Error('Cannot change public description of a deleted subcorpus');
        }
        this.lines = this.lines.set(idx, {
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
        });
    }

    private publishSubcorpus(rowIdx:number, description:string):RSVP.Promise<any> {
        const srchIdx = this.lines.findIndex((_, i) => i === this.actionBoxVisibleRow);
        if (srchIdx === -1) {
            throw new Error('Row not found');
        }
        const data = this.lines.get(srchIdx);
        if (data.deleted) {
            return RSVP.reject(new Error('Cannot publish deleted subcorpus'));
        }

        const args = new MultiDict();
        args.set('corpname', data.corpname);
        args.set('subcname', data.usesubcorp);
        args.set('description', description);
        return this.layoutModel.ajax(
            'POST',
            this.layoutModel.createActionUrl('subcorpus/publish_subcorpus'),
            args

        ).then(
            (_) => {
                this.lines = this.lines.set(srchIdx, {
                    name: data.name,
                    corpname: data.corpname,
                    usesubcorp: data.usesubcorp,
                    origSubcName: data.origSubcName,
                    deleted: data.deleted,
                    created: data.created,
                    cql: data.cql,
                    size: data.size,
                    published: true,
                    description: description
                });
            }
        )
    }

    private createSubcorpus(idx:number, removeOrig:boolean, subcname?:string, cql?:string):RSVP.Promise<any> {
        const srcRow = this.lines.get(idx);
        const params = new MultiDict();
        params.set('corpname', srcRow.corpname);
        params.set('subcname', subcname !== undefined ? subcname : srcRow.usesubcorp);
        params.set('publish', '0'); // TODO do we want to user-editable?
        params.set('cql', cql !== undefined ? cql : srcRow.cql);

        return this.layoutModel.ajax<AjaxResponse.CreateSubcorpus>(
            'POST',
            this.layoutModel.createActionUrl('subcorpus/ajax_create_subcorpus'),
            params

        ).then(
            (data) => {
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
                    this.unfinished = this.unfinished.push({
                        ident: item.ident,
                        name: item.label,
                        created: new Date(item.created * 1000),
                        failed: false
                    });
                    if (removeOrig) {
                        this.lines = this.lines.remove(idx);
                    }
                });
                if (data.processed_subc.length > 0) {
                    return new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
                        resolve(null);
                    });

                } else {
                    return this.reloadItems();
                }
            }
        );
    }

    private wipeSubcorpus(lineIdx:number):RSVP.Promise<any> {
        const delRow = this.lines.get(lineIdx);
        return this.layoutModel.ajax(
            'POST',
            this.layoutModel.createActionUrl('subcorpus/ajax_wipe_subcorpus'),
            {
                corpname: delRow.corpname,
                subcname: delRow.usesubcorp
            }

        ).then(
            (data) => {
                this.lines = this.lines.remove(lineIdx);
                return data;
            }
        );
    }

    private importLines(data:Array<AjaxResponse.ServerSubcorpListItem>):void {
        this.lines = Immutable.List<SubcorpListItem>(data.map<SubcorpListItem>(item => {
            return {
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
            }
        }));
    }

    private importProcessed(data:Array<Kontext.AsyncTaskInfo>):void {
        this.unfinished = Immutable.List<UnfinishedSubcorp>(
            data
                .filter(v => v.status !== AsyncTaskStatus.SUCCESS)
                .map<UnfinishedSubcorp>(item => ({
                    ident: item.ident,
                    name: item.label,
                    created: new Date(item.created * 1000),
                    failed: item.status === AsyncTaskStatus.FAILURE
                })));
    }

    private deleteSubcorpus(rowIdx:number):RSVP.Promise<any> {
        const item = this.lines.get(rowIdx);
        if (!item) {
            return RSVP.reject(new Error(`Cannot delete item. Row ${rowIdx} not found.`));
        }
        const args = new MultiDict();
        args.set('corpname', item.corpname);
        args.set('usesubcorp', item.usesubcorp);
        return this.layoutModel.ajax<Kontext.AjaxResponse>(
            'POST',
            this.layoutModel.createActionUrl('subcorpus/delete'),
            args,

        ).then(
            (data) => {
                return this.reloadItems();
            }
        );
    }

    private sortItems(name:string, reverse:boolean):RSVP.Promise<any> {
        const args:{[key:string]:string} = {
            format: 'json',
            sort: (reverse ? '-' : '') + name
        }
        this.mergeFilter(args, this.filter);

        return this.layoutModel.ajax<AjaxResponse.SubcorpList>(
            'GET',
            this.layoutModel.createActionUrl('subcorpus/subcorp_list'),
            args

        ).then(
            (data) => {
                this.importLines(data.subcorp_list);
                this.importProcessed(data.processed_subc);
                this.relatedCorpora = Immutable.List<string>(data.related_corpora);
                this.sortKey = {
                    name: data.sort_key.name,
                    reverse: data.sort_key.reverse
                };
            }
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

    private reloadItems():RSVP.Promise<any> {
        return this.filterItems(this.filter);
    }

    private filterItems(filter:SubcListFilter):RSVP.Promise<any> {
        const args:{[key:string]:string} = {
            format: 'json',
            sort: (this.sortKey.reverse ? '-' : '') + this.sortKey.name,
        }
        this.mergeFilter(args, filter);
        return this.layoutModel.ajax<AjaxResponse.SubcorpList>(
            'GET',
            this.layoutModel.createActionUrl('subcorpus/subcorp_list'),
            args

        ).then(
            (data) => {
                this.importLines(data.subcorp_list);
                this.importProcessed(data.processed_subc);
                this.relatedCorpora = Immutable.List<string>(data.related_corpora);
                for (let p in filter) {
                    if (filter.hasOwnProperty(p)) {
                        this.filter[p] = filter[p];
                    }
                }
            }
        );
    }

    private selectLine(idx:number):void {
        const line = this.lines.get(idx);
        this.lines = this.lines.set(idx, {
            corpname: line.corpname,
            cql: line.cql,
            created: line.created,
            deleted: line.deleted,
            name: line.name,
            size: line.size,
            usesubcorp: line.usesubcorp,
            origSubcName: line.origSubcName,
            published: line.published,
            description: line.description
        });
    }

    getLines():Immutable.List<SubcorpListItem> {
        return this.lines;
    }

    getSortKey():SortKey {
        return this.sortKey;
    }

    getFilter():SubcListFilter {
        return this.filter;
    }

    getUnfinished():Immutable.List<UnfinishedSubcorp> {
        return this.unfinished;
    }

    getRow(num:number):SubcorpListItem {
        return this.lines.get(num);
    }

    getRelatedCorpora():Immutable.List<string> {
        return this.relatedCorpora;
    }

    getActionBoxVisibleRow():number {
        return this.actionBoxVisibleRow;
    }

    getActionBoxActionType():string {
        return this.actionBoxActionType;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getUsesSubcRestore():boolean {
        return this.layoutModel.getConf<boolean>('UsesSubcRestore');
    }
}

