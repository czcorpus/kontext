/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/// <reference path="../../types/ajaxResponses.d.ts" />
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/react.d.ts" />

import {SimplePageStore} from '../../stores/base';
import * as util from '../../util';
import * as common from './common';


/**
 * A general store for processing corpus listing queries
 */
export class QueryProcessingStore extends SimplePageStore {

    protected tagPrefix:string;

    protected data:{rows:Array<common.CorplistItem>; filters:any};

    protected selectedKeywords:{[key:string]:boolean};

    protected searchedCorpName:string;

    protected pluginApi:Kontext.PluginApi;

    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        this.data = {rows: [], filters: []};
        this.selectedKeywords = {};
        this.searchedCorpName = null;
        this.tagPrefix = this.pluginApi.getConf('pluginData')['corparch']['tag_prefix'];
    }

    public exportFilter():{[key:string]:string} {
        var ans = <{[key:string]:string}>{};

        if (this.data['filters']) {
            for (var p in this.data['filters']) {
                if (this.data['filters'].hasOwnProperty(p)) {
                    ans[p] = this.data['filters'][p];
                }
            }
        }
        return ans;
    }

    protected updateFilter(filter:{[key:string]:string}) {
        if (!this.data['filters']) {
            this.data['filters'] = {};
        }
        for (var p in filter) {
            if (filter.hasOwnProperty(p)) {
                this.data['filters'][p] = filter[p];
            }
        }
    }

    exportQuery():string {
        var q = [];
        for (var p in this.selectedKeywords) {
            if (this.selectedKeywords[p] === true) {
                q.push(this.tagPrefix + p);
            }
        }
        if (this.searchedCorpName) {
            q.push(this.searchedCorpName);
        }
        return q.join(' ');
    }

    getKeywordState(keyword:string):boolean {
        return this.selectedKeywords[keyword];
    }

    setData(data:any):void {
        this.data = data;
    }
}

/**
 * This store handles corplist 'filter' form
 */
export class CorplistFormStore extends QueryProcessingStore {

    protected corplistTableStore:CorplistTableStore;

    protected offset:number;

    static DispatchToken:string;

    constructor(pluginApi:Kontext.PluginApi, corplistTableStore:CorplistTableStore) {
        super(pluginApi);
        var self = this;
        this.corplistTableStore = corplistTableStore;
        this.offset = 0;

        CorplistFormStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                switch (payload.actionType) {
                    case 'KEYWORD_CLICKED':
                        self.offset = 0;
                        if (!payload.props['ctrlKey']) {
                            self.selectedKeywords = {};
                        }
                        self.selectedKeywords[payload.props['keyword']] =
                            !self.selectedKeywords[payload.props['keyword']];
                        self.corplistTableStore.loadData(self.exportQuery(), self.exportFilter(),
                            self.offset).then(
                                (data) => {
                                    self.corplistTableStore.notifyChangeListeners();
                                    self.notifyChangeListeners();
                                },
                                (err) => {
                                    self.pluginApi.showMessage('error', err);
                                }
                            );
                    break;
                    case 'KEYWORD_RESET_CLICKED':
                        self.offset = 0;
                        self.selectedKeywords = {};
                        self.corplistTableStore.loadData(self.exportQuery(), self.exportFilter(),
                            self.offset).then(
                                (data) => {
                                    self.corplistTableStore.notifyChangeListeners();
                                    self.notifyChangeListeners();
                                },
                                (err) => {
                                    console.error(err);
                                    self.pluginApi.showMessage('error', err);
                                }
                            );
                    break;
                    case 'EXPANSION_CLICKED':
                        if (payload.props['offset']) {
                            self.offset = payload.props['offset'];
                        }
                        self.corplistTableStore.loadData(self.exportQuery(), self.exportFilter(),
                            self.offset).then(
                                (data) => {
                                    self.corplistTableStore.notifyChangeListeners();
                                    self.notifyChangeListeners();
                                },
                                (err) => {
                                    self.pluginApi.showMessage('error', err);
                                }
                            );
                    break;
                    case 'FILTER_CHANGED':
                        self.offset = 0;
                        if (payload.props.hasOwnProperty('corpusName')) {
                            self.searchedCorpName = payload.props['corpusName'];
                            delete payload.props['corpusName'];
                        }
                        self.updateFilter(payload.props);
                        self.corplistTableStore.loadData(self.exportQuery(), self.exportFilter(),
                            self.offset).then(
                                (data) => {
                                    self.corplistTableStore.notifyChangeListeners();
                                    self.notifyChangeListeners();
                                },
                                (err) => {
                                    self.pluginApi.showMessage('error', err);
                                }
                            );
                    break;
                }
                return true;
            });
    }
}


export interface CorplistData {
    contains_errors:boolean;
    filters:{[name:string]:any};
    keywords:Array<string>;
    messages:any;
    nextOffset:number;
    query:string;
    rows:Array<any>; // TODO
}


/**
 * This store handles table dataset
 */
export class CorplistTableStore extends SimplePageStore {

    protected pluginApi:Kontext.PluginApi;

    protected data:CorplistData;

    protected detailData:AjaxResponse.CorpusInfo;

    static DispatchToken:string;

    /**
     *
     * @param pluginApi
     */
    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        CorplistTableStore.DispatchToken = this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
                switch (payload.actionType) {
                    case 'LIST_STAR_CLICKED':
                        this.changeFavStatus(payload.props['corpusId'], payload.props['corpusName'],
                            payload.props['type'], payload.props['isFav']).then(
                                (message) => {
                                    this.notifyChangeListeners();
                                    this.pluginApi.showMessage('info', message);
                                },
                                (err) => {
                                    this.pluginApi.showMessage('error', err);
                                }
                            );
                    break;
                    case 'CORPARCH_CORPUS_INFO_REQUIRED':
                        this.loadCorpusInfo(payload.props['corpusId']).then(
                            (data) => {
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.pluginApi.showMessage('message', err);
                            }
                        )
                    break;
                    case 'CORPARCH_CORPUS_INFO_CLOSED':
                        this.detailData = null;
                        this.notifyChangeListeners();
                    break;
                }
            }
        );
    }

    private changeFavStatus(corpusId:string, corpusName:string, itemType:string,
            isFav:boolean):RSVP.Promise<string> {
        return (() => {
            if (isFav) {
                const item:common.GeneratedFavListItem = {
                    subcorpus_id: null,
                    corpora:[corpusId]
                };
                return this.pluginApi.ajax<any>(
                    'POST',
                    this.pluginApi.createActionUrl('user/set_favorite_item'),
                    item
                );

            } else {
                return this.pluginApi.ajax<any>(
                    'POST',
                    this.pluginApi.createActionUrl('user/unset_favorite_item'),
                    {id: corpusId}
                );
            }

        })().then(
            (data) => {
                if (!data.error) {
                    this.updateDataItem(corpusId, {user_item: isFav});
                    return isFav ? this.pluginApi.translate('defaultCorparch__item_added_to_fav') :
                        this.pluginApi.translate('defaultCorparch__item_removed_from_fav');

                } else {
                    throw new Error(this.pluginApi.translate('failed to update item'));
                }
            }
        );
    }

    private loadCorpusInfo(corpusId:string):RSVP.Promise<AjaxResponse.CorpusInfo> {
        return this.pluginApi.ajax<AjaxResponse.CorpusInfo>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
            {
                corpname: corpusId
            },
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
    }

    public loadData(query:string, filters:{[key:string]:string}, offset:number, limit?:number):RSVP.Promise<any> {
        const args = {query: query};
        if (offset) {
            args['offset'] = offset;
        }
        if (limit) {
            args['limit'] = limit;
        }
        if (filters) {
            for (let p in filters) {
                args[p] = filters[p];
            }
        }
        return this.pluginApi.ajax<any>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_list_corpora'),
            args,
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        ).then(
            (data) => {
                if (offset === 0) {
                this.setData(data);

                } else {
                    this.extendData(data);
                }
            }
        );
    }

    protected updateDataItem(corpusId, data) {
        (this.data.rows || []).forEach((item:common.CorplistItem) => {
            if (item.id === corpusId) {
                for (var p in data) {
                    if (data.hasOwnProperty(p)) {
                        item[p] = data[p];
                    }
                }
            }
        });
    }

    isFav(corpusId:string):boolean {
        return this.data.rows.some(function (item:common.CorplistItem) {
            if (item.id === corpusId) {
                return item.user_item;
            }
            return false;
        });
    }

    setData(data:CorplistData):void {
        this.data = data;
    }

    extendData(data:CorplistData):void {
        if (!this.data) {
            this.setData(data);

        } else {
            this.data.filters = data.filters;
            this.data.keywords = data.keywords;
            this.data.nextOffset = data.nextOffset;
            this.data.query = data.query;
            this.data.rows = this.data.rows.concat(data.rows);
        }
    }

    getData():any {
        return this.data;
    }

    getDetail():AjaxResponse.CorpusInfo {
        return this.detailData;
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements PluginInterfaces.ICorplistPage  {

    components:any;

    pluginApi:Kontext.PluginApi;

    protected corplistFormStore:CorplistFormStore;

    protected corplistTableStore:CorplistTableStore;

    constructor(pluginApi:Kontext.PluginApi, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corplistTableStore = new CorplistTableStore(pluginApi.dispatcher(), pluginApi);
        this.corplistFormStore = new CorplistFormStore(pluginApi, this.corplistTableStore);
        this.components = viewsInit(this.corplistFormStore, this.corplistTableStore);
    }

    setData(data:any):void { // TODO type
        this.corplistTableStore.setData(data);
    }

    getForm():React.Component {
        return this.components.FilterForm;
    }

    getList():React.Component {
        return this.components.CorplistTable;
    }
}