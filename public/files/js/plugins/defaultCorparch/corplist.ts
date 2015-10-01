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

/// <amd-dependency path="./view" name="views" />

import $ = require('jquery');
import util = require('../../util');
import common = require('./common');
declare var views:any;

/**
 * This store handles corplist 'filter' form
 */
export class CorplistFormStore extends util.SimplePageStore {

    private pluginApi:Kontext.PluginApi;

    private selectedKeywords:{[key:string]:boolean};

    private searchedCorpName:string;

    private offset:number;

    private tagPrefix:string;

    private data:any;

    static DispatchToken:string;

    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        var self = this;
        this.pluginApi = pluginApi;
        this.data = {};
        this.selectedKeywords = {};
        this.searchedCorpName = null;
        this.offset = 0;
        this.tagPrefix = this.pluginApi.getConf('pluginData')['corparch']['tag_prefix'];

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
                        CorplistPage.CorplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset);
                        self.notifyChangeListeners();
                        break;
                    case 'KEYWORD_RESET_CLICKED':
                        self.offset = 0;
                        self.selectedKeywords = {};
                        CorplistPage.CorplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset);
                        self.notifyChangeListeners();
                        break;
                    case 'EXPANSION_CLICKED':
                        if (payload.props['offset']) {
                            self.offset = payload.props['offset'];
                        }
                        CorplistPage.CorplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset);
                        self.notifyChangeListeners();
                        break;
                    case 'FILTER_CHANGED':
                        self.offset = 0;
                        if (payload.props.hasOwnProperty('corpusName')) {
                            self.searchedCorpName = payload.props['corpusName'];
                            delete payload.props['corpusName'];
                        }
                        self.updateFilter(payload.props);
                        CorplistPage.CorplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset);
                        self.notifyChangeListeners();
                        break;
                }
                return true;
            });
    }

    private updateFilter(filter:{[key:string]:string}) {
        if (!this.data['filters']) {
            this.data['filters'] = {};
        }
        for (var p in filter) {
            if (filter.hasOwnProperty(p)) {
                this.data['filters'][p] = filter[p];
            }
        }
    }

    public exportFilter() {
        var ans = [];

        if (this.data['filters']) {
            for (var p in this.data['filters']) {
                if (this.data['filters'].hasOwnProperty(p)) {
                    ans.push(p + '=' + encodeURIComponent(this.data['filters'][p]));
                }
            }
        }
        return ans.join('&');
    }

    setData(data:any):void {
        this.data = data;
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
export class CorplistTableStore extends util.SimplePageStore {

    pluginApi:Kontext.PluginApi;

    private data:CorplistData;

    static DispatchToken:string;

    /**
     *
     * @param pluginApi
     */
    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        this.pluginApi = pluginApi;
        var self = this;
        CorplistTableStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                switch (payload.actionType) {
                    case 'LIST_STAR_CLICKED':
                        var prom;
                        var item:common.CorplistItem;
                        var message;

                        if (payload.props['isFav']) {
                            item = common.createEmptyCorplistItem();
                            item.corpus_id = payload.props['corpusId'];
                            item.id = item.corpus_id;
                            item.name = payload.props['corpusName'];
                            item.type = payload.props['type'];
                            prom = $.ajax(self.pluginApi.createActionUrl('user/set_favorite_item'),
                                {
                                    method: 'POST',
                                    dataType: 'json',
                                    data: item
                                }
                            );
                            message = self.pluginApi.translate('item added to favorites');

                        } else {
                            prom = $.ajax(self.pluginApi.createActionUrl('user/unset_favorite_item'),
                                {
                                    method: 'POST',
                                    dataType: 'json',
                                    data: {id: payload.props['corpusId']}
                                }
                            );
                            message = self.pluginApi.translate('item removed from favorites');
                        }
                        prom.then(
                            function (data) {
                                if (!data.error) {
                                    self.updateDataItem(payload.props['corpusId'], {user_item: payload.props['isFav']});
                                    self.notifyChangeListeners();
                                    self.pluginApi.showMessage('info', message);

                                } else {
                                    self.pluginApi.showMessage('error',
                                        self.pluginApi.translate('failed to update item'));
                                    self.notifyChangeListeners(CorplistTableStore.ERROR_EVENT, data.error);
                                }
                            },
                            function (jqXHR, textStatus, errorThrown) {
                                self.pluginApi.showMessage('error',
                                    self.pluginApi.translate('failed to update item'));
                                self.notifyChangeListeners(CorplistTableStore.ERROR_EVENT, errorThrown);
                            }
                        );
                        break;
                }
            }
        );
    }

    public loadData(query:string, filters:string, offset:number):void {
        var self = this;
        var prom = $.ajax(
            this.pluginApi.createActionUrl('corpora/ajax_list_corpora')
            + '?query=' + encodeURIComponent(query)
            + (offset ? '&offset=' + offset : '')
            + (filters ? '&' + filters : ''));
        prom.then(
            function (data) {
                if (offset == 0) {
                    self.setData(data);

                } else {
                    self.extendData(data);
                }
                self.notifyChangeListeners();
            },
            function (err) {
                // TODO error
                console.error(err);
            }
        )
    }

    private updateDataItem(corpusId, data) {
        (this.data.rows || []).forEach(function (item:common.CorplistItem) {
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
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements Customized.CorplistPage {

    components:any;

    pluginApi:Kontext.PluginApi;

    static CorplistFormStore:CorplistFormStore;

    static CorplistTableStore:CorplistTableStore;

    constructor(pluginApi:Kontext.PluginApi) {
        CorplistPage.CorplistFormStore = new CorplistFormStore(pluginApi);
        CorplistPage.CorplistTableStore = new CorplistTableStore(pluginApi);
        this.components = views.init(pluginApi.dispatcher(), pluginApi.exportMixins(),
            pluginApi.getViews(), CorplistPage.CorplistFormStore,
            CorplistPage.CorplistTableStore);
        this.pluginApi = pluginApi;
    }

    createForm(targetElm:HTMLElement, properties:any):void {
        this.pluginApi.renderReactComponent(this.components.FilterForm, targetElm, properties);
    }

    createList(targetElm:HTMLElement, properties:any):void {
        properties['anonymousUser'] = this.pluginApi.getConf('anonymousUser');
        CorplistPage.CorplistTableStore.setData(properties);
        this.pluginApi.renderReactComponent(this.components.CorplistTable, targetElm, properties);
    }
}