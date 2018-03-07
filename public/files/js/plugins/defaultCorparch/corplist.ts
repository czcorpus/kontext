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
import {AjaxResponse} from '../../types/ajaxResponses';
import {StatefulModel} from '../../models/base';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {MultiDict} from '../../util';
import * as common from './common';
import {CorpusInfo, CorpusInfoType, CorpusInfoResponse} from '../../models/common/layout';


interface SetFavItemResponse extends Kontext.AjaxResponse {

    /**
     * An id of a newly created favorite item
     */
    id:string;
}


/**
 * A general model for processing corpus listing queries
 */
export class QueryProcessingModel extends StatefulModel {

    protected tagPrefix:string;

    protected data:{rows:Array<common.CorplistItem>; filters:any};

    protected selectedKeywords:{[key:string]:boolean};

    protected searchedCorpName:string;

    protected pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi) {
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
 * This model handles corplist 'filter' form
 */
export class CorplistFormModel extends QueryProcessingModel {

    protected corplistTableModel:CorplistTableModel;

    protected offset:number;

    static DispatchToken:string;

    constructor(pluginApi:IPluginApi, corplistTableModel:CorplistTableModel) {
        super(pluginApi);
        var self = this;
        this.corplistTableModel = corplistTableModel;
        this.offset = 0;

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
                        self.corplistTableModel.loadData(self.exportQuery(), self.exportFilter(),
                            self.offset).then(
                                (data) => {
                                    self.corplistTableModel.notifyChangeListeners();
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
                    case 'FILTER_CHANGED':
                        self.offset = 0;
                        if (payload.props.hasOwnProperty('corpusName')) {
                            self.searchedCorpName = payload.props['corpusName'];
                            delete payload.props['corpusName'];
                        }
                        self.updateFilter(payload.props);
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
                }
                return true;
            });
    }
}


export interface CorplistData {
    filters:{[name:string]:any};
    keywords:Array<string>;
    nextOffset:number;
    query:string;
    rows:Array<common.CorplistItem>;
}

export interface CorplistDataResponse extends Kontext.AjaxResponse, CorplistData {
}


/**
 * This model handles table dataset
 */
export class CorplistTableModel extends StatefulModel {

    protected pluginApi:IPluginApi;

    protected data:CorplistData;

    protected detailData:CorpusInfo;

    static DispatchToken:string;

    protected _isBusy:boolean;

    /**
     *
     * @param pluginApi
     */
    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this._isBusy = false;
        this.dispatcher.register((payload:ActionPayload) => {
                switch (payload.actionType) {
                    case 'LIST_STAR_CLICKED':
                        this.changeFavStatus(payload.props['corpusId'], payload.props['corpusName'],
                            payload.props['type'], payload.props['favId']).then(
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
                        this._isBusy = true;
                        this.detailData = this.createEmptyDetail(); // to force view to show detail box
                        this.notifyChangeListeners();
                        this.loadCorpusInfo(payload.props['corpusId']).then(
                            (data) => {
                                this.detailData = {...data, type: CorpusInfoType.CORPUS};
                                this._isBusy = false;
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.detailData = null;
                                this._isBusy = false;
                                this.notifyChangeListeners();
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

    private createEmptyDetail():CorpusInfo {
        return {
            type: CorpusInfoType.CORPUS,
            attrlist: [],
            structlist: [],
            citation_info: {
                type: CorpusInfoType.CITATION,
                corpname: null,
                article_ref: [],
                default_ref: null,
                other_bibliography: null
            },
            corpname: null,
            description: null,
            size: null,
            web_url: null
        };
    }

    private changeFavStatus(corpusId:string, corpusName:string, itemType:string,
            favId:string):RSVP.Promise<string> {
        if (favId === null) {
            const item:common.GeneratedFavListItem = {
                subcorpus_id: null,
                corpora:[corpusId]
            };
            return this.pluginApi.ajax<SetFavItemResponse>(
                'POST',
                this.pluginApi.createActionUrl('user/set_favorite_item'),
                item

            ).then(
                (data) => {
                    this.updateDataItem(corpusId, {fav_id: data.id});
                    return this.pluginApi.translate('defaultCorparch__item_added_to_fav');
                }
            );

        } else {
            return this.pluginApi.ajax<SetFavItemResponse>(
                'POST',
                this.pluginApi.createActionUrl('user/unset_favorite_item'),
                {id: favId}

            ).then(
                (data) => {
                    this.updateDataItem(corpusId, {fav_id: null});
                    return this.pluginApi.translate('defaultCorparch__item_removed_from_fav');
                }
            )
        }
    }

    private loadCorpusInfo(corpusId:string):RSVP.Promise<CorpusInfoResponse> {
        return this.pluginApi.ajax<CorpusInfoResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
            {
                corpname: corpusId
            }
        );
    }

    public loadData(query:string, filters:{[key:string]:string}, offset:number, limit?:number):RSVP.Promise<any> {
        const args = new MultiDict();
        args.set('query', query);
        if (offset) {
            args.set('offset', offset);
        }
        if (limit) {
            args.set('limit', limit);
        }
        if (filters) {
            for (let p in filters) {
                args.set(p, filters[p]);
            }
        }
        return this.pluginApi.ajax<CorplistDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_list_corpora'),
            args
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
        return this.data.rows.some((item:common.CorplistItem) => {
            if (item.id === corpusId) {
                return item.fav_id !== null;
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

    getData():CorplistData {
        return this.data;
    }

    getDetail():CorpusInfo {
        return this.detailData;
    }

    isBusy():boolean {
        return this._isBusy;
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements PluginInterfaces.ICorplistPage  {

    components:any;

    pluginApi:IPluginApi;

    protected corplistFormModel:CorplistFormModel;

    protected corplistTableModel:CorplistTableModel;

    constructor(pluginApi:IPluginApi, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corplistTableModel = new CorplistTableModel(pluginApi.dispatcher(), pluginApi);
        this.corplistFormModel = new CorplistFormModel(pluginApi, this.corplistTableModel);
        this.components = viewsInit(this.corplistFormModel, this.corplistTableModel);
    }

    setData(data:any):void { // TODO type
        this.corplistTableModel.setData(data);
    }

    getForm():React.ComponentClass {
        return this.components.FilterForm;
    }

    getList():React.ComponentClass {
        return this.components.CorplistTable;
    }
}