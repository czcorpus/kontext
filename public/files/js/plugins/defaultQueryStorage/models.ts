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

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {AjaxResponse} from '../../types/ajaxResponses';
import {StatefulModel} from '../../models/base';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';
import {MultiDict} from '../../util';
import {highlightSyntaxStatic} from '../../models/query/cqleditor/parser';
import { Action } from 'kombo';


export interface InputBoxHistoryItem {
    query:string;
    query_type:string;
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
export class QueryStorageModel extends StatefulModel implements PluginInterfaces.QueryStorage.IModel {

    private pluginApi:IPluginApi;

    private data:Immutable.List<Kontext.QueryHistoryItem>;

    private offset:number;

    private limit:number;

    private queryType:string;

    private currentCorpusOnly:boolean;

    private isBusy:boolean;

    private pageSize:number;

    private hasMoreItems:boolean;

    private archivedOnly:boolean;

    private editingQueryId:string;

    private editingQueryName:string;

    constructor(pluginApi:IPluginApi, offset:number, limit:number, pageSize:number) {
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        this.data = Immutable.List<Kontext.QueryHistoryItem>();
        this.queryType = '';
        this.currentCorpusOnly = false;
        this.offset = offset;
        this.limit = limit;
        this.pageSize = pageSize;
        this.isBusy = false;
        this.hasMoreItems = true; // TODO this should be based on initial data (n+1 items)
        this.archivedOnly = false;
        this.editingQueryId = null;
        this.editingQueryName = null; // null is ok here, a value is attached once the editor is opened

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'QUERY_STORAGE_SET_QUERY_TYPE':
                    this.queryType = action.payload['value'];
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_SET_CURRENT_CORPUS_ONLY':
                    this.currentCorpusOnly = action.payload['value'];
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_SET_ARCHIVED_ONLY':
                    this.archivedOnly = action.payload['value'];
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_LOAD_MORE':
                    this.limit += this.pageSize;
                    this.performLoadAction();

                break;
                case 'QUERY_STORAGE_LOAD_HISTORY':
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_OPEN_QUERY_FORM':
                    this.openQueryForm(action.payload['idx']);
                    // page leaves here
                break;
                case 'QUERY_STORAGE_SET_EDITING_QUERY_ID':
                    this.editingQueryId = action.payload['value'];
                    const srch = this.data.find(v => v.query_id === this.editingQueryId);
                    if (srch) {
                        this.editingQueryName = srch.name ? srch.name : '';
                    }
                    this.emitChange();
                break;
                case 'QUERY_STORAGE_CLEAR_EDITING_QUERY_ID':
                    this.editingQueryId = null;
                    this.editingQueryName = null;
                    this.emitChange();
                break;
                case 'QUERY_STORAGE_EDITOR_SET_NAME':
                    this.editingQueryName = action.payload['value'];
                    this.emitChange();
                break;
                case 'QUERY_STORAGE_DO_NOT_ARCHIVE':
                    this.saveItem(action.payload['queryId'], null).then(
                        (msg) => {
                            this.isBusy = false;
                            this.emitChange();
                            this.pluginApi.showMessage('info', msg);
                        },
                        (err) => {
                            this.isBusy = false;
                            this.emitChange();
                            this.pluginApi.showMessage('error', err);
                        }
                    );
                break;
                case 'QUERY_STORAGE_EDITOR_CLICK_SAVE':
                    if (!this.editingQueryName) {
                        this.pluginApi.showMessage('error',
                            this.pluginApi.translate('query__save_as_cannot_have_empty_name'));
                        this.emitChange();

                    } else {
                        this.isBusy = true;
                        this.emitChange();/*
                        * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
                        *                    Institute of the Czech National Corpus
                        * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
                        this.saveItem(this.editingQueryId, this.editingQueryName).then(
                            (msg) => {
                                this.isBusy = false;
                                this.emitChange();
                                this.pluginApi.showMessage('info', msg);
                            },
                            (err) => {
                                this.isBusy = false;
                                this.emitChange();
                                this.pluginApi.showMessage('error', err);
                            }
                        );
                    }
                break;
            }
        });
    }

    private openQueryForm(idx:number):void {
        const item = this.data.find(v => v.idx === idx);
        const args = new MultiDict();
        args.set('corpname', item.corpname);
        args.set('usesubcorp', item.subcorpname);
        args.set(item.query_type, item.query);
        args.set('queryselector', item.query_type + 'row');
        args.replace('align', item.aligned.map(v => v.corpname));
        args.set('lpos', item.lpos);
        args.set('qmcase', item.qmcase ? '1' : '0');
        args.set('default_attr', item.default_attr);
        args.set('pcq_pos_neg', item.pcq_pos_neg);
        item.aligned.forEach(v => {
            args.set(`${v.query_type}_${v.corpname}`, v.query);
            args.set(`queryselector_${v.corpname}`, v.query_type + 'row');
            args.set(`lpos_${v.corpname}`, v.lpos);
            args.set(`qmcase_${v.corpname}`, v.qmcase ? '1' : '0');
            args.set(`default_attr_${v.corpname}`, v.default_attr);
            args.set(`pcq_pos_neg_${v.corpname}`, v.pcq_pos_neg);
        });
        Object.keys(item.selected_text_types).forEach(k => {
            args.replace(`sca_${k}`, item.selected_text_types[k]);
        });
        window.location.href = this.pluginApi.createActionUrl('first_form', args);
    }

    private performLoadAction():void {
        this.isBusy = true;
        this.emitChange();
        this.loadData().then(
            () => {
                this.isBusy = false;
                this.emitChange();
            },
            (err) => {
                this.isBusy = false;
                this.pluginApi.showMessage('error', err);
                this.emitChange();
            }
        );
    }

    private loadData():RSVP.Promise<any> {
        const args = new MultiDict();
        args.set('corpname', this.pluginApi.getCorpusIdent().id);
        args.set('offset', this.offset);
        args.set('limit', this.limit + 1);
        args.set('query_type', this.queryType);
        args.set('current_corpus', this.currentCorpusOnly ? '1' : '0');
        args.set('archived_only', this.archivedOnly ? '1' : '0');
        return this.pluginApi.ajax(
            'GET',
            this.pluginApi.createActionUrl('user/ajax_query_history'),
            args

        ).then(
            (data:AjaxResponse.QueryHistory) => {
                this.hasMoreItems = data.data.length === this.limit + 1;
                this.data = this.hasMoreItems ?
                    Immutable.List<Kontext.QueryHistoryItem>(
                        data.data.slice(0, data.data.length - 1)
                            .map(attachSh.bind(null, this.pluginApi.getComponentHelpers()))) :
                    Immutable.List<Kontext.QueryHistoryItem>(data.data
                            .map(attachSh.bind(null, this.pluginApi.getComponentHelpers())));
            }
        );
    }

    private saveItem(queryId:string, name:string):RSVP.Promise<string> {
        return (() => {
            const args = new MultiDict();
            args.set('query_id', queryId);
            args.set('name', name);
            if (name) {
                return this.pluginApi.ajax<any>(
                    'POST',
                    this.pluginApi.createActionUrl('save_query'),
                    args

                );

            } else {
                const args = new MultiDict();
                args.set('query_id', queryId);
                return this.pluginApi.ajax<any>(
                    'POST',
                    this.pluginApi.createActionUrl('delete_query'),
                    args
                );
            }
        })().then(
            (data) => {
                this.editingQueryId = null;
                this.editingQueryName = null;
                return this.loadData();
            }

        ).then(
            () => {
                return name ?
                    this.pluginApi.translate('query__save_as_item_saved') :
                    this.pluginApi.translate('query__save_as_item_removed');
            }
        );
    }

    importData(data:Array<Kontext.QueryHistoryItem>):void {
        this.data = Immutable.List<Kontext.QueryHistoryItem>(data
                        .map(attachSh.bind(null, this.pluginApi.getComponentHelpers())));
    }

    getData():Immutable.List<Kontext.QueryHistoryItem> {
        return this.data;
    }

    getFlatData():Immutable.List<InputBoxHistoryItem> {
        return this.data.flatMap(v => {
            return Immutable.List<InputBoxHistoryItem>()
                .push({query: v.query, query_type: v.query_type, created: v.created})
                .concat(v.aligned
                        .filter(v2 => !!v2.query)
                        .map(v2 => ({query: v2.query, query_type: v2.query_type, created: v.created})));
        }).toList();
    }

    getOffset():number {
        return this.offset;
    }

    getLimit():number {
        return this.limit;
    }

    getQueryType():string {
        return this.queryType;
    }

    getCurrentCorpusOnly():boolean {
        return this.currentCorpusOnly;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getHasMoreItems():boolean {
        return this.hasMoreItems;
    }

    getArchivedOnly():boolean {
        return this.archivedOnly;
    }

    getEditingQueryId():string {
        return this.editingQueryId;
    }

    getEditingQueryName():string {
        return this.editingQueryName;
    }
}