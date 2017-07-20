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


import {SimplePageStore} from '../../stores/base';
import * as Immutable from 'vendor/immutable';
import {MultiDict} from '../../util';


export class QueryStorageStore extends SimplePageStore implements PluginInterfaces.IQueryStorageStore {

    private pluginApi:Kontext.PluginApi;

    private data:Immutable.List<Kontext.QueryHistoryItem>;

    private offset:number;

    private limit:number;

    private queryType:string;

    private currentCorpusOnly:boolean;

    private isBusy:boolean;

    private pageSize:number;

    constructor(pluginApi:Kontext.PluginApi, offset:number, limit:number, pageSize:number) {
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        this.data = Immutable.List<Kontext.QueryHistoryItem>();
        this.queryType = '';
        this.currentCorpusOnly = false;
        this.offset = offset;
        this.limit = limit;
        this.pageSize = pageSize;
        this.isBusy = false;

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'QUERY_STORAGE_SET_QUERY_TYPE':
                    this.queryType = payload.props['value'];
                    this.performLoadAction();
                break;
                case 'QUERY_STORAGE_SET_CURRENT_CORPUS_ONLY':
                    this.currentCorpusOnly = payload.props['value'];
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
                    this.openQueryForm(
                        payload.props['corpusId'],
                        payload.props['queryType'],
                        payload.props['query']
                    );
                    // page leaves here
                break;
            }
        });
    }

    private openQueryForm(corpusId:string, queryType:string, query:string):void {
        const args = new MultiDict();
        args.set('corpname', corpusId);
        args.set(queryType, query);
        args.set('queryselector', queryType + 'row');
        window.location.href = this.pluginApi.createActionUrl('first_form', args);
    }

    private performLoadAction():void {
        this.isBusy = true;
        this.notifyChangeListeners();
        this.loadData().then(
            () => {
                this.isBusy = false;
                this.notifyChangeListeners();
            },
            (err) => {
                this.isBusy = false;
                this.pluginApi.showMessage('error', err);
                this.notifyChangeListeners();
            }
        );
    }

    private loadData():RSVP.Promise<any> {
        const args = new MultiDict();
        args.set('corpname', this.pluginApi.getConf('corpname'));
        args.set('offset', this.offset);
        args.set('limit', this.limit);
        args.set('query_type', this.queryType);
        args.set('current_corpus', this.currentCorpusOnly ? '1' : '0');
        return this.pluginApi.ajax(
            'GET',
            this.pluginApi.createActionUrl('user/ajax_query_history'),
            args

        ).then(
            (data:AjaxResponse.QueryHistory) => {
                this.data = Immutable.List<Kontext.QueryHistoryItem>(data.data);
            }
        );
    }

    importData(data:Array<Kontext.QueryHistoryItem>):void {
        this.data = Immutable.List<Kontext.QueryHistoryItem>(data);
    }

    getData():Immutable.List<Kontext.QueryHistoryItem> {
        return this.data;
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

}