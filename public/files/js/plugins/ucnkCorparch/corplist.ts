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

/// <reference path="../../vendor.d.ts/react.d.ts" />
/// <reference path="../../types/plugins.d.ts" />

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {StatefulModel} from '../../stores/base';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import * as common from './common';
import * as corplistDefault from '../defaultCorparch/corplist';

/**
 * This store handles corplist 'filter' form
 */
export class CorplistFormStore extends corplistDefault.QueryProcessingStore {

    protected corplistTableStore:CorplistTableStore;

    protected offset:number;

    private initialKeywords:Array<string>;


    constructor(pluginApi:IPluginApi, corplistTableStore:CorplistTableStore) {
        super(pluginApi);
        const self = this;
        this.corplistTableStore = corplistTableStore;
        this.offset = 0;
        this.tagPrefix = this.pluginApi.getConf('pluginData')['corparch']['tag_prefix'];
        (this.pluginApi.getConf('pluginData')['corparch']['initial_keywords'] || []).forEach(function (item) {
            self.selectedKeywords[item] = true;
        });
        this.dispatcher.register(
            function (payload:ActionPayload) {
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
    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher, pluginApi);
    }
}

export class CorpusAccessRequestStore extends StatefulModel {

    private pluginApi:IPluginApi;

    static DispatchToken:string;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(pluginApi.dispatcher());
        const self = this;
        this.pluginApi = pluginApi;
        this.dispatcher.register(
            function (payload:ActionPayload) {
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
            data
        );
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements PluginInterfaces.ICorplistPage {

    components:any;

    pluginApi:IPluginApi;

    protected corpusAccessRequestStore:CorpusAccessRequestStore;

    protected corplistFormStore:CorplistFormStore;

    protected corplistTableStore:CorplistTableStore;

    constructor(pluginApi:IPluginApi, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corpusAccessRequestStore = new CorpusAccessRequestStore(pluginApi.dispatcher(), pluginApi);
        this.corplistTableStore = new CorplistTableStore(pluginApi.dispatcher(), pluginApi);
        this.corplistFormStore = new CorplistFormStore(pluginApi, this.corplistTableStore);
        this.components = viewsInit(this.corplistFormStore, this.corplistTableStore);
    }

    getForm():React.ComponentClass {
        return this.components.FilterForm;
    }

    getList():React.ComponentClass {
        return this.components.CorplistTable;
    }

    setData(data:any):void { // TODO type
        this.corplistTableStore.setData(data);
    }
}