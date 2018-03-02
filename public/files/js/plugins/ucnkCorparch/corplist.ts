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

/// <reference path="../../types/plugins.d.ts" />

import RSVP from 'rsvp';
import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {StatefulModel} from '../../models/base';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import * as common from './common';
import * as corplistDefault from '../defaultCorparch/corplist';

/**
 * This model handles corplist 'filter' form
 */
export class CorplistFormModel extends corplistDefault.QueryProcessingModel {

    protected corplistTableModel:CorplistTableModel;

    protected offset:number;

    private initialKeywords:Array<string>;


    constructor(pluginApi:IPluginApi, corplistTableModel:CorplistTableModel) {
        super(pluginApi);
        const self = this;
        this.corplistTableModel = corplistTableModel;
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
                        self.corplistTableModel.loadData(self.exportQuery(), self.exportFilter(),
                            self.offset).then(
                                (data) => {
                                    self.corplistTableModel.notifyChangeListeners();
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
                        self.corplistTableModel.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset).then(
                                (data) => {
                                    self.corplistTableModel.notifyChangeListeners();
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
                        self.corplistTableModel.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset,
                            CorplistTableModel.LoadLimit).then(
                                (data) => {
                                    self.corplistTableModel.notifyChangeListeners();
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
                        self.corplistTableModel.loadData(
                            self.exportQuery(), self.exportFilter(), self.offset).then(
                                (data) => {
                                    self.corplistTableModel.notifyChangeListeners();
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
 * This model handles table dataset
 */
export class CorplistTableModel extends corplistDefault.CorplistTableModel {


    static DispatchToken:string;

    static LoadLimit:number = 5000;

    /**
     *
     */
    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher, pluginApi);
    }
}

export class CorpusAccessRequestModel extends StatefulModel {

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

    protected corpusAccessRequestModel:CorpusAccessRequestModel;

    protected corplistFormModel:CorplistFormModel;

    protected corplistTableModel:CorplistTableModel;

    constructor(pluginApi:IPluginApi, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corpusAccessRequestModel = new CorpusAccessRequestModel(pluginApi.dispatcher(), pluginApi);
        this.corplistTableModel = new CorplistTableModel(pluginApi.dispatcher(), pluginApi);
        this.corplistFormModel = new CorplistFormModel(pluginApi, this.corplistTableModel);
        this.components = viewsInit(this.corplistFormModel, this.corplistTableModel);
    }

    getForm():React.ComponentClass {
        return this.components.FilterForm;
    }

    getList():React.ComponentClass {
        return this.components.CorplistTable;
    }

    setData(data:any):void { // TODO type
        this.corplistTableModel.setData(data);
    }
}