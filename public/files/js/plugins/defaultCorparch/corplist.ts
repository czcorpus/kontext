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

import { Observable, Subject, debounceTime } from 'rxjs';
import { map } from 'rxjs/operators';
import { StatelessModel, IActionDispatcher, SEDispatcher } from 'kombo';
import { List, HTTP, pipe, tuple, Dict } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as PluginInterfaces from '../../types/plugins';
import { CorpusInfo, CorpusInfoType, CorpusInfoResponse } from '../../models/common/layout';
import { Actions } from './actions';
import { CorplistItem, Filters, CorplistDataResponse, validateSizeSpec, ConfPluginData } from './common';
import { IPluginApi } from '../../types/plugins/common';


interface SetFavItemResponse extends Kontext.AjaxResponse {

    /**
     * An id of a newly created favorite item
     */
    id:string;
}


type DebouncedActions = typeof Actions.FilterChanged;


export interface CorplistServerData {
    rows:Array<CorplistItem>;
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

export interface KeywordInfo {
    ident:string;
    label:string;
    color:string;
    visible:boolean;
    selected:boolean;
}

const importKeywordInfo = (preselected:Array<string>) =>
        (v:[string, string, boolean, string]):KeywordInfo => ({
    ident: v[0],
    label: v[1],
    color: v[3],
    visible: true,
    selected: preselected.indexOf(v[0]) > -1
});


export interface CorplistTableModelState {

    filters:Filters;
    favouritesOnly:boolean;
    keywords:Array<KeywordInfo>;
    detailData:CorpusInfo|null;
    isBusy:boolean;
    offset:number;
    nextOffset:number;
    limit:number;
    rows:Array<CorplistItem>;
    anonymousUser:boolean;
}


/**
 * This model handles table dataset
 */
export class CorplistTableModel extends StatelessModel<CorplistTableModelState> {

    protected readonly pluginApi:IPluginApi;

    protected readonly tagPrefix:string;

    private readonly debouncedAction$:Subject<DebouncedActions>;

    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, initialData:CorplistServerData,
            preselectedKeywords:Array<string>) {
        super(
            dispatcher,
            {
                filters: {
                    maxSize: Kontext.newFormValue('', false),
                    minSize: Kontext.newFormValue('', false),
                    name: Kontext.newFormValue('', false)
                },
                favouritesOnly: false,
                keywords: List.map(
                    importKeywordInfo(preselectedKeywords),
                    initialData.search_params.keywords
                ),
                detailData: null,
                isBusy: false,
                offset: 0,
                limit: pluginApi.getConf<{corparch:ConfPluginData}>('pluginData')['corparch'].max_page_size,
                nextOffset: initialData.nextOffset,
                rows: [...initialData.rows],
                anonymousUser: pluginApi.getConf<boolean>('anonymousUser'),
            }
        );
        this.pluginApi = pluginApi;
        this.tagPrefix = this.pluginApi.getConf<{corparch:ConfPluginData}>('pluginData')['corparch'].tag_prefix;
        this.debouncedAction$ = new Subject();
        this.debouncedAction$.pipe(
            debounceTime(Kontext.TEXT_INPUT_WRITE_THROTTLE_INTERVAL_MS)

        ).subscribe({
            next: value => {
                dispatcher.dispatch({
                    ...value,
                    payload: {...value.payload, debounced: true}
                });
            }
        });

        this.addActionHandler(
            Actions.LoadDataDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    this.importData(state, action.payload.data);
                }
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.LoadExpansionDataDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    this.extendData(state, action.payload.data);
                }
            },
            (state, action) => {
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.KeywordClicked,
            (state, action) => {
                state.offset = 0;
                if (!action.payload.attachToCurrent) {
                    state.favouritesOnly = false;
                    state.keywords = List.map(
                        v => ({...v, selected: false}),
                        state.keywords
                    );
                }
                if (action.payload.keywordId === 'favourites') {
                    state.favouritesOnly = !state.favouritesOnly;

                } else {
                    const idx = List.findIndex(
                        v => v.ident === action.payload.keywordId,
                        state.keywords
                    );
                    state.keywords[idx] = {
                        ...state.keywords[idx],
                        selected: !state.keywords[idx].selected
                    };
                }
                state.isBusy = true;
            },
            (state, action, dispatch) => {

            }
        );

        this.addActionHandler(
            Actions.KeywordResetClicked,
            (state, action) => {
                state.offset = 0;
                state.favouritesOnly = false;
                state.keywords = List.map(
                    v => ({...v, selected: false}),
                    state.keywords
                );
                state.isBusy = true;
            },
            (state, action, dispatcher) => {
                this.loadDataAction(state, dispatcher);
            }
        );

        this.addActionHandler(
            Actions.ExpansionClicked,
            (state, action) => {
                if (action.payload.offset) {
                    state.offset = action.payload.offset;
                }
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.loadData(this.exportQuery(state), this.exportFilter(state),
                state.offset, undefined, state.favouritesOnly).subscribe(
                    (data) => {
                        dispatch<typeof Actions.LoadExpansionDataDone>({
                            name: Actions.LoadExpansionDataDone.name,
                            payload: {data}
                        });
                    },
                    (err) => {
                        dispatch<typeof Actions.LoadExpansionDataDone>({
                            name: Actions.LoadExpansionDataDone.name,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler(
            Actions.FilterChanged,
            (state, action) => {
                state.filters.maxSize = action.payload.maxSize;
                state.filters.minSize = action.payload.minSize;
                state.filters.name = action.payload.name;
                if (action.payload.debounced) {
                    state.offset = 0;
                    if (!validateSizeSpec(state.filters.maxSize.value)) {
                        state.filters.maxSize = Kontext.updateFormValue(
                            state.filters.maxSize,
                            {
                                isInvalid: true,
                                errorDesc: this.pluginApi.translate('defaultCorparch__invalid_size_format')
                            }
                        );
                    }
                    if (!validateSizeSpec(state.filters.minSize.value)) {
                        state.filters.minSize = Kontext.updateFormValue(
                            state.filters.minSize,
                            {
                                isInvalid: true,
                                errorDesc: this.pluginApi.translate('defaultCorparch__invalid_size_format')
                            }
                        );
                    }
                    if (this.allInputsValid(state)) {
                        state.isBusy = true;
                    }

                } else {
                    this.debouncedAction$.next(action);
                }
            },
            (state, action, dispatch) => {
                if (action.payload.debounced && this.allInputsValid(state)) {
                    this.loadDataAction(state, dispatch);
                }
            }
        );

        this.addActionHandler(
            Actions.ListStarClicked,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.changeFavStatus(action.payload.corpusId, action.payload.favId).subscribe({
                    next: ([itemId, itemAction]) => {
                        if (itemAction === 'add') {
                            this.pluginApi.showMessage('info',
                                this.pluginApi.translate('defaultCorparch__item_added_to_fav'));

                        } else {
                            this.pluginApi.showMessage('info',
                            this.pluginApi.translate('defaultCorparch__item_removed_from_fav'));
                        }
                        dispatch<typeof Actions.ListStarClickedDone>({
                            name: Actions.ListStarClickedDone.name,
                            payload: {
                                corpusId: action.payload.corpusId,
                                newId: itemId,
                                action: itemAction
                            }
                        });
                    },
                    error: error => {
                        this.pluginApi.showMessage('error', error);
                        dispatch<typeof Actions.ListStarClickedDone>({
                            name: Actions.ListStarClickedDone.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ListStarClickedDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    if (action.payload.action === 'add') {
                        this.updateDataItem(
                            state,
                            action.payload.corpusId,
                            action.payload.newId
                        );

                    } else {
                        if (state.favouritesOnly) {
                            state.rows = List.filter(
                                value => value.corpus_id !== action.payload.corpusId,
                                state.rows
                            );

                        } else {
                            this.updateDataItem(
                                state,
                                action.payload.corpusId,
                                null
                            );
                        }
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.CorpusInfoRequired,
            (state, action) => {
                state.isBusy = true;
                state.detailData = this.createEmptyDetail(); // to force view to show detail box
            },
            (state, action, dispatch) => {
                this.loadCorpusInfo(action.payload.corpusId).subscribe({
                    next: data => {
                        dispatch<typeof Actions.CorpusInfoLoaded>({
                            name: Actions.CorpusInfoLoaded.name,
                            payload: {data: {...data, type: CorpusInfoType.CORPUS}}
                        });
                    },
                    error: error => {
                        this.pluginApi.showMessage('error', error);
                        dispatch<typeof Actions.CorpusInfoLoaded>({
                            name: Actions.CorpusInfoLoaded.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.CorpusInfoLoaded,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    state.detailData = null;

                } else {
                    state.detailData = action.payload.data;
                }
            }
        );

        this.addActionHandler(
            Actions.CorpusInfoClosed,
            (state, action) => {
                state.detailData = null;
            }
        );
    }

    exportFilter(state:CorplistTableModelState):Filters {
        return state.filters;
    }

    private allInputsValid(state:CorplistTableModelState):boolean {
        return !state.filters.maxSize.isInvalid && !state.filters.minSize.isInvalid;
    }

    private loadDataAction(state:CorplistTableModelState, dispatch:SEDispatcher):void {
        this.loadData(
            this.exportQuery(state),
            this.exportFilter(state),
            state.offset,
            undefined,
            state.favouritesOnly
        ).subscribe({
            next: data => {
                dispatch(
                    Actions.LoadDataDone,
                    {data}
                );
            },
            error: error => {
                dispatch(
                    Actions.LoadDataDone,
                    error
                );
            }
        });
    }

    exportQuery(state:CorplistTableModelState):string {
        const q = pipe(
            state.keywords,
            List.filter(v => v.selected && v.visible),
            List.map(v => this.tagPrefix + v.ident)
        );
        if (state.filters.name.value) {
            return List.push(state.filters.name.value, q).join(' ');
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
            citationInfo: {
                type: CorpusInfoType.CITATION,
                corpname: null,
                article_ref: [],
                default_ref: null,
                other_bibliography: null
            },
            corpname: null,
            description: null,
            size: null,
            webUrl: null,
            keywords: []
        };
    }

    private changeFavStatus(corpusId:string, favId:string):Observable<[string, 'add'|'remove']> {
        return favId ?
            this.pluginApi.ajax$<SetFavItemResponse>(
                HTTP.Method.POST,
                this.pluginApi.createActionUrl('user/unset_favorite_item'),
                {id: favId}

            ).pipe(map(v => tuple(v.id, 'remove'))) :
            this.pluginApi.ajax$<SetFavItemResponse>(
                HTTP.Method.POST,
                this.pluginApi.createActionUrl('user/set_favorite_item'),
                {
                    subcorpus_id: null,
                    subcorpus_orig_id: null,
                    corpora:[corpusId]
                }
            ).pipe(map(v => tuple(v.id, 'add')));
    }

    private loadCorpusInfo(corpusId:string):Observable<CorpusInfoResponse> {
        return this.pluginApi.ajax$<CorpusInfoResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
            {
                corpname: corpusId
            }
        );
    }

    private loadData(
        query:string,
        filters:Filters,
        offset:number,
        limit?:number,
        favOnly?:boolean
    ):Observable<CorplistDataResponse> {
        const args = {
            query,
            offset,
            limit,
            favOnly,
            requestable: true,
            ...pipe(
                filters,
                Dict.map(v => v.value),
            )
        };
        return this.pluginApi.ajax$<CorplistDataResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('corpora/ajax_list_corpora'),
            args
        );
    }

    protected updateDataItem(state:CorplistTableModelState, corpusId:string,
            favId:string|null):void {
        const srch = List.find(v => v.corpus_id === corpusId, state.rows);
        if (srch) {
            srch.fav_id = favId;
        }
    }

    isFav(state:CorplistTableModelState, corpusId:string):boolean {
        return state.rows.some((item:CorplistItem) => {
            if (item.id === corpusId) {
                return !!item.fav_id;
            }
            return false;
        });
    }

    private importData(state:CorplistTableModelState, inData:CorplistDataResponse):void {
        state.rows = inData.rows;
        state.keywords = List.map(
            v => ({...v, visible: true}),
            state.keywords
        );
        state.nextOffset = inData.nextOffset;
        state.filters = {
            maxSize: Kontext.newFormValue(inData.filters.maxSize || '', false),
            minSize: Kontext.newFormValue(inData.filters.minSize || '', false),
            name: Kontext.newFormValue(inData.filters.name || '', false)
        };
    }

    private extendData(state:CorplistTableModelState, data:CorplistDataResponse):void {
        state.filters = {
            maxSize: Kontext.newFormValue(data.filters.maxSize || '', false),
            minSize: Kontext.newFormValue(data.filters.minSize || '', false),
            name: Kontext.newFormValue(data.filters.name || '', false)
        };
        state.nextOffset = data.nextOffset;
        state.rows = state.rows.concat(data.rows);
    }
}

/**
 * Corplist page 'model'.
 */
export class CorplistPage implements PluginInterfaces.Corparch.ICorplistPage  {

    components:any;

    private pluginApi:IPluginApi;

    protected corplistTableModel:CorplistTableModel;

    constructor(pluginApi:IPluginApi, initialData:CorplistServerData,
            viewsInit:((...args:any[])=>any)) {
        this.pluginApi = pluginApi;
        this.corplistTableModel = new CorplistTableModel(
            pluginApi.dispatcher(),
            pluginApi,
            initialData,
            []
        );
        this.components = viewsInit(this.corplistTableModel);
    }

    getForm():React.ComponentClass {
        return this.components.FilterForm;
    }

    getList():React.ComponentClass {
        return this.components.CorplistTable;
    }
}