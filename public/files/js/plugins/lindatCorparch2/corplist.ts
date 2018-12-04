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

import RSVP from 'rsvp';
import * as Immutable from 'immutable';
import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {StatelessModel} from '../../models/base';
import {ActionDispatcher, Action, SEDispatcher} from '../../app/dispatcher';
import {MultiDict} from '../../util';
import * as common from './common';
import {CorpusInfo, CorpusInfoType, CorpusInfoResponse} from '../../models/common/layout';
import { init } from '../../views/query/input';


interface SetFavItemResponse extends Kontext.AjaxResponse {

    /**
     * An id of a newly created favorite item
     */
    id:string;
}


export interface Filters {
    maxSize:string;
    minSize:string;
    name:string;
    query?:string;
}

export interface CorplistServerData {
    rows:Array<common.CorplistItem>;
    search_params:{
        filters:Filters;
        keywords:Array<[string, string, boolean, string]>;
    };
    nextOffset:number;
    filters:Filters;
    keywords:Array<string>;
    query:string;
    current_keywords:any;
}

export interface CorplistDataResponse extends Kontext.AjaxResponse {
    nextOffset:number;
    current_keywords:Array<string>;
    filters:Filters;
    keywords:Array<string>;
    rows:Array<common.CorplistItem>;
}


export interface KeywordInfo {
    ident:string;
    label:string;
    color:string;
    visible:boolean;
    selected:boolean;
}

const importKeywordInfo = (preselected:Array<string>) => (v:[string, string, boolean, string]):KeywordInfo => {
    return {
        ident: v[0],
        label: v[1],
        color: v[3],
        visible: true,
        selected: preselected.indexOf(v[0]) > -1
    };
}


export interface CorplistTableModelState {

    filters:Filters;

    keywords:Immutable.List<KeywordInfo>;

    detailData:CorpusInfo;

    isBusy:boolean;

    searchedCorpName:string;

    offset:number;

    nextOffset:number;

    limit:number;

    rows:Immutable.List<common.CorplistItem>;
}


/**
 * This model handles table dataset
 */
export class CorplistTableModel extends StatelessModel<CorplistTableModelState> {

    protected pluginApi:IPluginApi;

    protected tagPrefix:string;

    /**
     *
     * @param pluginApi
     */
    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi, initialData:CorplistServerData, preselectedKeywords:Array<string>) {
        super(
            dispatcher,
            {
                filters: { maxSize: '', minSize: '', name: '' },
                keywords: Immutable.List<KeywordInfo>(initialData.search_params.keywords.map(importKeywordInfo(preselectedKeywords))),
                detailData: null,
                isBusy: false,
                offset: 0,
                limit: pluginApi.getConf('pluginData')['corparch']['max_page_size'],
                searchedCorpName: '',
                nextOffset: initialData.nextOffset,
                rows: Immutable.List<common.CorplistItem>(initialData.rows)
            }
        );
        this.pluginApi = pluginApi;
        this.tagPrefix = this.pluginApi.getConf('pluginData')['corparch']['tag_prefix'];
    }

    reduce(state:CorplistTableModelState, action:Action):CorplistTableModelState {
        const newState = this.copyState(state);
        switch (action.actionType) {
            case 'LOAD_DATA_DONE':
                newState.isBusy = false;
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);

                } else {
                    this.importData(newState, action.props['data']);
                }
            break;
            case 'LOAD_EXPANSION_DATA_DONE':
                newState.isBusy = false;
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);

                } else {
                    this.extendData(newState, action.props['data']);
                }
            break;
            case 'KEYWORD_CLICKED': {
                newState.offset = 0;
                if (!action.props['ctrlKey']) {
                    newState.keywords = newState.keywords.map(v => ({
                        ident: v.ident,
                        label: v.label,
                        color: v.color,
                        visible: v.visible,
                        selected: false
                    })).toList();
                }
                const idx = newState.keywords.findIndex(v => v.ident === action.props['keyword']);
                const v = newState.keywords.get(idx);
                newState.keywords = newState.keywords.set(idx, {
                    ident: v.ident,
                    label: v.label,
                    color: v.color,
                    visible: v.visible,
                    selected: !v.selected
                });
                newState.isBusy = true;
            }
            break;
            case 'KEYWORD_RESET_CLICKED':
                newState.offset = 0;
                newState.keywords = newState.keywords.map(v => ({
                    ident: v.ident,
                    label: v.label,
                    color: v.color,
                    visible: v.visible,
                    selected: false
                })).toList();
                newState.isBusy = true;
            break;
            case 'EXPANSION_CLICKED':
                if (action.props['offset']) {
                    newState.offset = action.props['offset'];
                }
                newState.isBusy = true;
            break;
            case 'FILTER_CHANGED':
                newState.offset = 0;
                if (action.props.hasOwnProperty('corpusName')) {
                    newState.searchedCorpName = action.props['corpusName'];
                    delete action.props['corpusName']; // TODO no mutations
                }
                this.updateFilter(newState, action.props as Filters);
                newState.isBusy = true;
            break;
            case 'LIST_STAR_CLICKED':
                newState.isBusy = true;
            break;
            case 'LIST_STAR_CLICKED_DONE':
                newState.isBusy = false;
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);

                } else {
                    this.pluginApi.showMessage('info', action.props['message']);
                }
            break;
            case 'CORPARCH_CORPUS_INFO_REQUIRED':
                newState.isBusy = true;
                newState.detailData = this.createEmptyDetail(); // to force view to show detail box
            break;
            case 'CORPARCH_CORPUS_INFO_LOADED':
                newState.isBusy = false;
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);

                } else {
                    newState.detailData = action.props as CorpusInfo;
                }
            break;
            case 'CORPARCH_CORPUS_INFO_CLOSED':
                newState.detailData = null;
            break;
            default:
                return state;
        }
        return newState;
    }

    sideEffects(state:CorplistTableModelState, action:Action, dispatch:SEDispatcher):void {
        switch (action.actionType) {
            case 'KEYWORD_CLICKED':
            case 'KEYWORD_RESET_CLICKED':
            case 'FILTER_CHANGED':
                this.loadData(this.exportQuery(state), this.exportFilter(state),
                        state.offset).then(
                    (data) => {
                        dispatch({
                            actionType: 'LOAD_DATA_DONE',
                            props: {data: data}
                        });
                    },
                    (err) => {
                        dispatch({
                            actionType: 'LOAD_DATA_DONE',
                            error: err,
                            props: {}
                        });
                    }
                );
            break;
            case 'EXPANSION_CLICKED':
                this.loadData(this.exportQuery(state), this.exportFilter(state),
                        state.offset).then(
                    (data) => {
                        dispatch({
                            actionType: 'LOAD_EXPANSION_DATA_DONE',
                            props: {data: data}
                        });
                    },
                    (err) => {
                        dispatch({
                            actionType: 'LOAD_EXPANSION_DATA_DONE',
                            error: err,
                            props: {}
                        });
                    }
                );
            break;
            case 'LIST_STAR_CLICKED':
                this.changeFavStatus(state, action.props['corpusId'], action.props['favId']).then(
                    (message) => {
                        dispatch({
                            actionType: 'LIST_STAR_CLICKED_DONE',
                            props: {message: message}
                        });
                    },
                    (err) => {
                        dispatch({
                            actionType: 'LIST_STAR_CLICKED_DONE',
                            props: {},
                            error: err
                        });
                    }
                );
            break;
            case 'CORPARCH_CORPUS_INFO_REQUIRED':
                this.loadCorpusInfo(action.props['corpusId']).then(
                    (data) => {
                        dispatch({
                            actionType: 'CORPARCH_CORPUS_INFO_LOADED',
                            props: {...data, type: CorpusInfoType.CORPUS}
                        });
                    },
                    (err) => {
                        dispatch({
                            actionType: 'CORPARCH_CORPUS_INFO_LOADED',
                            props: {},
                            error: err
                        });
                    }
                );
            break;
        }
    };

    public exportFilter(state:CorplistTableModelState):Filters {
        return state.filters;
    }

    protected updateFilter(state:CorplistTableModelState, filter:Filters):void {
        for (var p in filter) {
            if (filter.hasOwnProperty(p)) {
                state.filters[p] = filter[p];
            }
        }
    }

    exportQuery(state:CorplistTableModelState):string {
        const q = state.keywords.filter(v => v.selected && v.visible).map(v => this.tagPrefix + v.ident).toList();
        if (state.searchedCorpName) {
            return q.concat(state.searchedCorpName).join(' ');
        }
        return q.join(' ');
    }

    getKeywordState(state:CorplistTableModelState, keyword:string):boolean {
        return state.keywords.find(v => v.ident === keyword) !== undefined;
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

    private changeFavStatus(state:CorplistTableModelState, corpusId:string, favId:string):RSVP.Promise<string> {
        if (favId === null) {
            const item:common.GeneratedFavListItem = {
                subcorpus_id: null,
                subcorpus_orig_id: null,
                corpora:[corpusId]
            };
            return this.pluginApi.ajax<SetFavItemResponse>(
                'POST',
                this.pluginApi.createActionUrl('user/set_favorite_item'),
                item

            ).then(
                (data) => {
                    this.updateDataItem(state, corpusId, {fav_id: data.id});
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
                    this.updateDataItem(state, corpusId, {fav_id: null});
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

    private loadData(query:string, filters:Filters, offset:number, limit?:number):RSVP.Promise<CorplistDataResponse> {
        const args = new MultiDict();
        args.set('query', query);
        args.set('offset', offset);
        if (limit !== undefined) {
            args.set('limit', limit);
        }
        if (filters) {
            for (let p in filters) {
                args.set(p, filters[p]);
            }
        }
        args.set('requestable', '1');
        return this.pluginApi.ajax<CorplistDataResponse>(
            'GET',
            this.pluginApi.createActionUrl('corpora/ajax_list_corpora'),
            args
        );
    }

    protected updateDataItem(state:CorplistTableModelState, corpusId, data):void {
        state.rows.forEach((item:common.CorplistItem) => {
            if (item.id === corpusId) {
                for (var p in data) {
                    if (data.hasOwnProperty(p)) {
                        item[p] = data[p];
                    }
                }
            }
        });
    }

    isFav(state:CorplistTableModelState, corpusId:string):boolean {
        return state.rows.some((item:common.CorplistItem) => {
            if (item.id === corpusId) {
                return item.fav_id !== null;
            }
            return false;
        });
    }

    private importData(state:CorplistTableModelState, inData:CorplistDataResponse):void {
        state.rows = Immutable.List<common.CorplistItem>(inData.rows);
        state.keywords = state.keywords.map<KeywordInfo>(v => ({
            ident: v.ident,
            label: v.label,
            color: v.color,
            visible: true, // currently we do not make visual taglist filtering
            selected: v.selected
        })).toList();
        state.nextOffset = inData.nextOffset;
        state.filters = {
            maxSize: inData.filters.maxSize,
            minSize: inData.filters.minSize,
            name: inData.filters.name
        };
    }

    private extendData(state:CorplistTableModelState, data:CorplistDataResponse):void {
        state.filters = {
            maxSize: data.filters.maxSize,
            minSize: data.filters.minSize,
            name: data.filters.name
        };
        state.nextOffset = data.nextOffset;
        state.rows = state.rows.concat(data.rows).toList();
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements PluginInterfaces.Corparch.ICorplistPage  {

    components:any;

    private pluginApi:IPluginApi;

    protected corplistTableModel:CorplistTableModel;

    constructor(pluginApi:IPluginApi, initialData:CorplistServerData, viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corplistTableModel = new CorplistTableModel(pluginApi.dispatcher(), pluginApi, initialData, []);
        this.components = viewsInit(this.corplistTableModel);
    }

    getForm():React.ComponentClass {
        return this.components.FilterForm;
    }

    getList():React.ComponentClass {
        return this.components.CorplistTable;
    }
}