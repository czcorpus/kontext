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

import * as $ from 'jquery';
import {SimplePageStore} from '../../stores/base';
import * as common from './common';
import * as corplistDefault from '../defaultCorparch/corplist';

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
        const self = this;
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
                        self.corplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset).then(
                                (data) => {
                                    self.corplistTableStore.notifyChangeListeners();
                                    self.notifyChangeListeners();
                                },
                                (err) => {
                                    self.pluginApi.showMessage('error', err);
                                }
                            );
                    break;
                    case 'EXPANSION_CLICKED':
                        if (payload.props['offset']) {
                            self.offset = payload.props['offset'];
                        }
                        self.corplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset,
                            CorplistTableStore.LoadLimit).then(
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
                        self.corplistTableStore.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset).then(
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
     */
    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher, pluginApi);
    }
}

export class CorpusAccessRequestStore extends SimplePageStore {

    private pluginApi:Kontext.PluginApi;

    static DispatchToken:string;

    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        const self = this;
        this.pluginApi = pluginApi;
        CorpusAccessRequestStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                switch (payload.actionType) {
                    case 'CORPUS_ACCESS_REQ_SUBMITTED':
                        self.askForAccess(payload.props).then(
                            (ans) => {
                                self.pluginApi.showMessage('info',
                                    self.pluginApi.translate('ucnkCorparch__your_message_sent'));
                                    self.notifyChangeListeners();
                            },
                            (error) => {
                                self.pluginApi.showMessage('error',
                                    self.pluginApi.translate('ucnkCorparch__your_message_failed'));
                                console.error(error);
                            }
                        );
                        break;
                }
            }
        );
    }

    private askForAccess(data:{[key:string]:string}):RSVP.Promise<any> {
        return this.pluginApi.ajax<any>(
            'POST',
            this.pluginApi.createActionUrl('user/ask_corpus_access'),
            data,
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    return data;

                } else {
                    throw new Error(data.messages[0]);
                }
            }
        );
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements CorplistPage {

    components:any;

    pluginApi:Kontext.PluginApi;

    protected corpusAccessRequestStore:CorpusAccessRequestStore;

    protected corplistFormStore:CorplistFormStore;

    protected corplistTableStore:CorplistTableStore;

    constructor(pluginApi:Kontext.PluginApi, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corpusAccessRequestStore = new CorpusAccessRequestStore(pluginApi.dispatcher(), pluginApi);
        this.corplistTableStore = new CorplistTableStore(pluginApi.dispatcher(), pluginApi);
        this.corplistFormStore = new CorplistFormStore(pluginApi, this.corplistTableStore);
        this.components = viewsInit(this.corplistFormStore, this.corplistTableStore);
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