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

import $ = require('jquery');
import util = require('../../util');
import common = require('./common');
import corplistDefault = require('../defaultCorparch/corplist');

/**
 * This store handles corplist 'filter' form
 */
export class CorplistFormStore extends corplistDefault.QueryProcessingStore {

    protected corplistTableStore:CorplistTableStore;

    protected offset:number;

    static DispatchToken:string;

    private initialKeywords:Array<string>;


    constructor(pluginApi:Kontext.PluginApi, corplistTableStore:CorplistTableStore) {
        super(pluginApi);
        let self = this;
        this.corplistTableStore = corplistTableStore;
        this.offset = 0;
        this.tagPrefix = this.pluginApi.getConf('pluginData')['corparch']['tag_prefix'];
        (this.pluginApi.getConf('pluginData')['corparch']['initial_keywords'] || []).forEach(function (item) {
            self.selectedKeywords[item] = true;
        });
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
                        self.corplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset);
                        self.notifyChangeListeners();
                        break;
                    case 'KEYWORD_RESET_CLICKED':
                        self.offset = 0;
                        self.selectedKeywords = {};
                        self.corplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset);
                        self.notifyChangeListeners();
                        break;
                    case 'EXPANSION_CLICKED':
                        if (payload.props['offset']) {
                            self.offset = payload.props['offset'];
                        }
                        self.corplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset, CorplistTableStore.LoadLimit);
                        self.notifyChangeListeners();
                        break;
                    case 'FILTER_CHANGED':
                        self.offset = 0;
                        if (payload.props.hasOwnProperty('corpusName')) {
                            self.searchedCorpName = payload.props['corpusName'];
                            delete payload.props['corpusName'];
                        }
                        self.updateFilter(payload.props);
                        self.corplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset);
                        self.notifyChangeListeners();
                        break;
                }
                return true;
            }
       );
    }
}

/**
 * This store handles table dataset
 */
export class CorplistTableStore extends corplistDefault.CorplistTableStore {


    static DispatchToken:string;

    static LoadLimit:number = 5000;

    /**
     *
     * @param pluginApi
     */
    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi);
    }
}

export class CorpusAccessRequestStore extends util.SimplePageStore {

    private pluginApi:Kontext.PluginApi;

    static DispatchToken:string;

    private sendRequest(data):JQueryXHR {
        return $.ajax(this.pluginApi.createActionUrl('user/ask_corpus_access'),
            {
                method: 'POST',
                dataType: 'json',
                data: data
            }
        );
    }

    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        var self = this;
        this.pluginApi = pluginApi;
        CorpusAccessRequestStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                switch (payload.actionType) {
                    case 'CORPUS_ACCESS_REQ_SUBMITTED':
                        var prom = self.sendRequest(payload.props);
                        prom.then(
                            function (ans) {
                                if (!ans.error) {
                                    self.pluginApi.showMessage('info',
                                        self.pluginApi.translate('ucnkCorparch__your_message_sent'));
                                    self.notifyChangeListeners();

                                } else {
                                    self.pluginApi.showMessage('error', ans.error);
                                    self.notifyChangeListeners(CorpusAccessRequestStore.ERROR_EVENT, ans.error);
                                }
                            },
                            function (jqXHR, textStatus, errorThrown) {
                                self.pluginApi.showMessage('error',
                                    self.pluginApi.translate('ucnkCorparch__your_message_failed'));
                                self.notifyChangeListeners(CorpusAccessRequestStore.ERROR_EVENT, errorThrown);
                            }
                        );
                        break;
                }
            }
        );
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements Customized.CorplistPage {

    components:any;

    pluginApi:Kontext.PluginApi;

    protected corpusAccessRequestStore:CorpusAccessRequestStore;

    protected corplistFormStore:CorplistFormStore;

    protected corplistTableStore:CorplistTableStore;

    constructor(pluginApi:Kontext.PluginApi, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corpusAccessRequestStore = new CorpusAccessRequestStore(pluginApi);
        this.corplistTableStore = new CorplistTableStore(pluginApi);
        this.corplistFormStore = new CorplistFormStore(pluginApi, this.corplistTableStore);
        this.components = viewsInit(pluginApi.dispatcher(), pluginApi.exportMixins(),
                pluginApi.getViews(), this.corplistFormStore, this.corplistTableStore);
    }

    createForm(targetElm:HTMLElement, properties:any):void {
        this.pluginApi.renderReactComponent(this.components.FilterForm, targetElm, properties);
        this.corplistFormStore.notifyChangeListeners('KEYWORD_UPDATED');
    }

    createList(targetElm:HTMLElement, properties:any):void {
        properties['anonymousUser'] = this.pluginApi.getConf('anonymousUser');
        this.corplistTableStore.setData(properties);
        this.pluginApi.renderReactComponent(this.components.CorplistTable, targetElm, properties);
    }
}