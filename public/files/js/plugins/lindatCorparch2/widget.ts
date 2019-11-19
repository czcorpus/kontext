/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import { timer as rxTimer, Observable } from 'rxjs';
import {Kontext} from '../../types/common';
import * as common from './common';
import {IPluginApi, PluginInterfaces} from '../../types/plugins';
import * as Immutable from 'immutable';
import {SearchEngine, SearchKeyword, SearchResultRow} from './search';
import { IActionDispatcher, StatelessModel, Action, SEDispatcher } from 'kombo';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

/**
 *
 */
export interface Options  {

    /**
     * Handles click on favorite/featured/searched item.
     *
     * Using custom action disables implicit form submission (or location.href update)
     * which means formTarget and submitMethod options have no effect unless you use
     * them directly in some way.
     */
    itemClickAction?:Kontext.CorplistItemClick;
}

/**
 *
 */
export interface FavListItem extends common.ServerFavlistItem {
    trashTTL:number;
}

/**
 * An alias to shorten type def of user's favorite items
 */
type FavitemsList = Array<common.CorplistItem>;

/**
 *
 */
interface SetFavItemResponse extends Kontext.AjaxResponse {
    id:string;
    name:string;
    size:number;
    size_info:string;
    corpora:Array<string>;
    subcorpus_id:string;
}


const importServerFavitem = (item:common.ServerFavlistItem):FavListItem => {
    return {
        id: item.id,
        name: item.name,
        subcorpus_id: item.subcorpus_id,
        size: item.size,
        size_info: item.size_info,
        corpora: item.corpora,
        description: item.description,
        trashTTL: null
    };
};

const importServerFavitems = (items:Array<common.ServerFavlistItem>):Immutable.List<FavListItem> => {
    return Immutable.List<FavListItem>(items.map(importServerFavitem));
};


/**
 * Finds a matching favorite item based on currently selected
 * corpora and subcorpus.
 *
 * @param item
 * @returns an ID if the current item is set as favorite else undefined
 */
const findCurrFavitemId = (dataFav:Immutable.List<FavListItem>, item:common.GeneratedFavListItem):string => {
    const normalize = (v:string) => v ? v : '';
    const srch = dataFav.filter(x => x.trashTTL === null).find(x => {
            return normalize(x.subcorpus_id) === normalize(item.subcorpus_id) &&
                item.corpora.join('') === x.corpora.map(x => x.id).join('');
    });
    return srch ? srch.id : undefined;
}


export interface CorpusSwitchPreserved {
    dataFav:Immutable.List<FavListItem>;
}


/**
 *
 */
export interface CorplistWidgetModelState {
    isVisible:boolean;
    activeTab:number;
    activeListItem:[number, number];
    corpusIdent:Kontext.FullCorpusIdent;
    dataFav:Immutable.List<FavListItem>;
    dataFeat:Immutable.List<common.CorplistItem>;
    isBusy:boolean;
    currFavitemId:string;
    origSubcorpName:string;
    anonymousUser:boolean;
    isWaitingForSearchResults:boolean;
    currSearchResult:Immutable.List<SearchResultRow>;
    currSearchPhrase:string;
    currentSubcorp:string;
    availSearchKeywords:Immutable.List<SearchKeyword>;
    availableSubcorpora:Immutable.List<Kontext.SubcorpListItem>;
    currSubcorpus:string;
    focusedRowIdx:number;
}


export interface CorplistWidgetModelArgs {
    dispatcher:IActionDispatcher;
    pluginApi:IPluginApi;
    corpusIdent:Kontext.FullCorpusIdent;
    corpSelection:PluginInterfaces.Corparch.ICorpSelection;
    anonymousUser:boolean;
    searchEngine:SearchEngine;
    dataFav:Array<common.ServerFavlistItem>;
    dataFeat:Array<common.CorplistItem>;
    onItemClick:Kontext.CorplistItemClick;
    corporaLabels:Array<[string, string, string]>;
}


/**
 *
 */
export class CorplistWidgetModel extends StatelessModel<CorplistWidgetModelState>
                                 implements Kontext.ICorpusSwitchAware<CorpusSwitchPreserved> {

    private pluginApi:IPluginApi;

    private searchEngine:SearchEngine;

    private onItemClick:Kontext.CorplistItemClick;

    private corpSelection:PluginInterfaces.Corparch.ICorpSelection;

    private inputThrottleTimer:number;

    private static MIN_SEARCH_PHRASE_ACTIVATION_LENGTH = 3;

    private static TRASH_TTL_TICKS = 20;

    private trashTimerSubsc:Subscription;

    constructor({dispatcher, pluginApi, corpusIdent, corpSelection, anonymousUser, searchEngine,
            dataFav, dataFeat, onItemClick, corporaLabels}:CorplistWidgetModelArgs) {
        const dataFavImp = importServerFavitems(dataFav);
        super(dispatcher, {
            isVisible: false,
            activeTab: 0,
            activeListItem: [null, null],
            corpusIdent: corpusIdent,
            currentSubcorp: corpSelection.getCurrentSubcorpus(),
            origSubcorpName: corpSelection.getCurrentSubcorpusOrigName(),
            anonymousUser: anonymousUser,
            dataFav: dataFavImp,
            dataFeat: Immutable.List<common.CorplistItem>(dataFeat),
            isBusy: false,
            currFavitemId: findCurrFavitemId(
                dataFavImp,
                {
                    subcorpus_id: corpSelection.getCurrentSubcorpus(),
                    subcorpus_orig_id: corpSelection.getCurrentSubcorpusOrigName(),
                    corpora: corpSelection.getCorpora().toArray()
                }
            ),
            isWaitingForSearchResults: false,
            currSearchPhrase: '',
            currSearchResult: Immutable.List<SearchResultRow>(),
            availSearchKeywords: Immutable.List<SearchKeyword>(corporaLabels.map(item => (
                {id: item[0], label: item[1], color: item[2], selected:false}))),
            availableSubcorpora: corpSelection.getAvailableSubcorpora(),
            currSubcorpus: corpSelection.getCurrentSubcorpus(),
            focusedRowIdx: -1
        });
        this.pluginApi = pluginApi;
        this.searchEngine = searchEngine;
        this.onItemClick = onItemClick;
        this.inputThrottleTimer = null;
        this.corpSelection = corpSelection;
    }

    reduce(state:CorplistWidgetModelState, action:Action):CorplistWidgetModelState {
        let newState:CorplistWidgetModelState;
        switch (action.name) {
            case 'DEFAULT_CORPARCH_WIDGET_SHOW':
                newState = this.copyState(state);
                newState.isVisible = true;
                return newState;
            case 'DEFAULT_CORPARCH_WIDGET_HIDE':
                newState = this.copyState(state);
                newState.activeTab = 0;
                newState.isVisible = false;
                return newState;
            case 'DEFAULT_CORPARCH_SET_ACTIVE_TAB':
                newState = this.copyState(state);
                newState.activeTab = action.payload['value'];
                return newState;
            case 'DEFAULT_CORPARCH_FAV_ITEM_CLICK':
                newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            case 'DEFAULT_CORPARCH_UPDATE_LIST':
                newState = this.copyState(state);
                newState.dataFav = importServerFavitems(action.payload['data']);
                return newState;
            case 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE':
                newState = this.copyState(state);
                newState.isBusy = false;
                return newState;
            case 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK':
                newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            case 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE':
                newState = this.copyState(state);
                newState.isBusy = false;
                return newState;
            case 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED':
                newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            case 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE':
                newState = this.copyState(state);
                newState.focusedRowIdx = -1;
                newState.isBusy = false;
                return newState;
            case 'DEFAULT_CORPARCH_FAV_ITEM_ADD':
                newState = this.copyState(state);
                newState.isBusy = true;
                const idx = state.dataFav.findIndex(x => x.id === action.payload['itemId']);
                if (idx > -1) {
                    const item = newState.dataFav.get(idx);
                    newState.dataFav = newState.dataFav.set(idx, {
                        id: item.id,
                        name: item.name,
                        subcorpus_id: item.subcorpus_id,
                        size: item.size,
                        size_info: item.size_info,
                        corpora: item.corpora,
                        description: item.description,
                        trashTTL: null
                    });
                }
                return newState;
            case 'DEFAULT_CORPARCH_FAV_ITEM_ADD_DONE':
                newState = this.copyState(state);
                newState.isBusy = false;
                if (!action.error) {
                    const idx = newState.dataFav.findIndex(v => v.id === action.payload['trashedItemId']);
                    if (action.payload['rescuedItem']) {
                        newState.dataFav = newState.dataFav.set(
                            idx, importServerFavitem(action.payload['rescuedItem']));

                    } else {
                        newState.dataFav = newState.dataFav.remove(idx);
                    }
                }
                return newState;
            case 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE':
                newState = this.copyState(state);
                this.moveItemToTrash(newState, action.payload['itemId']);
                return newState;
            case 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE_DONE':
                newState = this.copyState(state);
                if (!action.error) {
                    const idx = newState.dataFav.findIndex(v => v.id === action.payload['itemId']);
                    if (idx > -1) {
                        newState.dataFav = newState.dataFav.remove(idx);
                    }
                }
                return newState;
            case 'DEFAULT_CORPARCH_CHECK_TRASHED_ITEMS':
                newState = this.copyState(state);
                this.checkTrashedItems(newState);
                return newState;
            case 'DEFAULT_CORPARCH_STAR_ICON_CLICK':
                newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            case 'DEFAULT_CORPARCH_STAR_ICON_CLICK_DONE':
                newState = this.copyState(state);
                newState.isBusy = false;
                if (!action.error) {
                    newState.dataFav = importServerFavitems(action.payload['data']);
                    newState.currFavitemId = findCurrFavitemId(
                        newState.dataFav,
                        this.getFullCorpusSelection()
                    );
                }
                return newState;
            case 'DEFAULT_CORPARCH_KEYWORD_RESET_CLICKED':
                newState = this.copyState(state);
                newState.isBusy = true;
                this.resetKeywordSelectStatus(newState);
                newState.currSearchResult = Immutable.List<SearchResultRow>();
                newState.focusedRowIdx = -1;
                return newState;
            case 'LINDAT_CORPARCH_KEYWORD_CLICKED':
                newState = this.copyState(state);
                newState.isBusy = true;
                newState.focusedRowIdx = -1;
                this.setKeywordSelectedStatus(
                    newState,
                    action.payload['keywordId'],
                    action.payload['status'],
                    action.payload['exclusive']
                );
                return newState;
            case 'DEFAULT_CORPARCH_SEARCH_DONE':
                newState = this.copyState(state);
                newState.isBusy = false;
                newState.focusedRowIdx = -1;
                if (!action.error && action.payload['data'] !== null) {
                    newState.currSearchResult = <Immutable.List<SearchResultRow>>action.payload['data'];
                }
                return newState;
            case 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED':
                newState = this.copyState(state);
                newState.currSearchPhrase = action.payload['value'];
                newState.currSearchResult = Immutable.List<SearchResultRow>();
                newState.focusedRowIdx = -1;
                return newState;
            case 'DEFAULT_CORPARCH_FOCUS_SEARCH_ROW':
                if (state.currSearchResult.size > 0) {
                    newState = this.copyState(state);
                    const inc = action.payload['inc'] as number;
                    newState.focusedRowIdx = Math.abs((newState.focusedRowIdx + inc) % newState.currSearchResult.size);
                    return newState;
                }
                return state;
            case 'DEFAULT_CORPARCH_FOCUSED_ITEM_SELECT':
                newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            case 'QUERY_INPUT_SELECT_SUBCORP':
                newState = this.copyState(state);
                if (action.payload['pubName']) {
                    newState.currentSubcorp = action.payload['pubName'];
                    newState.origSubcorpName = action.payload['subcorp'];

                } else {
                    newState.currentSubcorp = action.payload['subcorp'];
                    newState.origSubcorpName = action.payload['subcorp'];
                }
                newState.currFavitemId = findCurrFavitemId(
                    newState.dataFav,
                    this.getFullCorpusSelection()
                );
                return newState;
            case 'QUERY_INPUT_ADD_ALIGNED_CORPUS':
                newState = this.copyState(state);
                newState.currFavitemId = findCurrFavitemId(
                    newState.dataFav,
                    this.getFullCorpusSelection()
                );
                return newState;
            case 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS':
                newState = this.copyState(state);
                newState.currFavitemId = findCurrFavitemId(
                    newState.dataFav,
                    this.getFullCorpusSelection()
                );
                return newState;
            case 'CORPUS_SWITCH_MODEL_RESTORE':
                if (action.payload['key'] === this.csGetStateKey()) {
                    newState = this.copyState(state);
                    newState.dataFav = action.payload['data'].dataFav.filter(v => v.trashTTL === null);
                    newState.currFavitemId = findCurrFavitemId(
                        newState.dataFav,
                        this.getFullCorpusSelection()
                    );
                    return newState;

                } else {
                    return state;
                }
            case 'DEFAULT_CORPARCH_MOVE_FOCUS_TO_NEXT_LISTITEM':
                newState = this.copyState(state);
                const [colInc, rowInc] = action.payload['change'];
                const [col, row] = newState.activeListItem;
                if (col === null || row === null) {
                    newState.activeListItem = [0, 0];

                } else {
                    const newCol = Math.abs((col + colInc) % 2);
                    const rotationLen = newCol === 0 ? newState.dataFav.size : newState.dataFeat.size;
                    newState.activeListItem = [
                        newCol,
                        colInc !== 0 ? 0 : (row + rowInc) >= 0 ? Math.abs((row + rowInc) % rotationLen) : rotationLen - 1
                    ];
                }
                return newState;
            case 'DEFAULT_CORPARCH_ENTER_ON_ACTIVE_LISTITEM':
                newState = this.copyState(state);
                newState.isBusy = false;
                return newState;
            default:
                return state;
        }
    }

    sideEffects(state:CorplistWidgetModelState, action:Action, dispatch:SEDispatcher) {
        switch (action.name) {
            case 'DEFAULT_CORPARCH_ENTER_ON_ACTIVE_LISTITEM':
                if (state.activeListItem[0] === 0) {
                    this.handleFavItemClick(state, state.dataFav.get(state.activeListItem[1]).id).then(
                        (_) => {
                            dispatch({
                                name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE',
                                payload: {}
                            });
                        },
                        (err) => {
                            dispatch({
                                name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE',
                                payload: {}
                            });
                            this.pluginApi.showMessage('error', err);
                        }
                    );

                } else {
                    this.handleFeatItemClick(state, state.dataFeat.get(state.activeListItem[1]).id).then(
                        () => {
                            dispatch({
                                name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE',
                                payload: {}
                            });
                        },
                        (err) => {
                            dispatch({
                                name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE',
                                payload: {}
                            });
                            this.pluginApi.showMessage('error', err);
                        }
                    );
                }
            break;
            case 'DEFAULT_CORPARCH_FAV_ITEM_CLICK':
                this.handleFavItemClick(state, action.payload['itemId']).then(
                    (_) => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE',
                            payload: {}
                        });
                    },
                    (err) => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE',
                            payload: {}
                        });
                        this.pluginApi.showMessage('error', err);
                    }
                );
            break;
            case 'DEFAULT_CORPARCH_FAV_ITEM_ADD':
                this.removeItemFromTrash(state, action.payload['itemId']).then(
                    (rescuedItem) => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_FAV_ITEM_ADD_DONE',
                            payload: {
                                trashedItemId: action.payload['itemId'],
                                rescuedItem: rescuedItem
                            }
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch({
                            name: 'DEFAULT_CORPARCH_FAV_ITEM_ADD_DONE',
                            payload: {
                                trashedItemId: action.payload['itemId']
                            },
                            error: err
                        });
                    }
                );
            break;
            case 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK':
                this.handleFeatItemClick(state, action.payload['itemId']).then(
                    () => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE',
                            payload: {}
                        });
                    },
                    (err) => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE',
                            payload: {}
                        });
                        this.pluginApi.showMessage('error', err);
                    }
                );
            break;
            case 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED':
                this.handleSearchItemClick(state, action.payload['itemId']).then(
                () => {
                    dispatch({
                        name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE',
                        payload: {}
                    });
                },
                (err) => {
                    dispatch({
                        name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE',
                        payload: {}
                    });
                    this.pluginApi.showMessage('error', err);
                }
            );
            break;
            case 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE':
                this.removeFavItemFromServer(action.payload['itemId']).then(
                    (favItem) => {
                        const src = rxTimer(0, 1000).pipe(take(CorplistWidgetModel.TRASH_TTL_TICKS));
                        if (this.trashTimerSubsc) {
                            this.trashTimerSubsc.unsubscribe();
                        }
                        this.trashTimerSubsc = src.subscribe(
                            () => {
                                dispatch({
                                    name: 'DEFAULT_CORPARCH_CHECK_TRASHED_ITEMS',
                                    payload: {}
                                });
                            },
                            (_) => undefined,
                            () => {
                                dispatch({
                                    name: 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE_DONE',
                                    payload: {
                                        itemId: action.payload['itemId']
                                    }
                                });
                            }
                        );
                    }
                );
            break;
            case 'DEFAULT_CORPARCH_STAR_ICON_CLICK':
                (() => {
                    if (action.payload['status']) {
                        return this.setFavItem(state);

                    } else {
                        return this.unsetFavItem(action.payload['itemId']);
                    }
                })().then(
                    (data) => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_STAR_ICON_CLICK_DONE',
                            payload: {data: data}
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch({
                            name: 'DEFAULT_CORPARCH_STAR_ICON_CLICK_DONE',
                            payload: {data: null},
                            error: err
                        });
                    }
                );
            break;
            case 'DEFAULT_CORPARCH_KEYWORD_RESET_CLICKED':
            case 'LINDAT_CORPARCH_KEYWORD_CLICKED':
            case 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED':
                this.searchDelayed(state).then(
                    (data) => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_SEARCH_DONE',
                            payload: {data: data}
                        });
                    },
                    (err) => {
                        dispatch({
                            name: 'DEFAULT_CORPARCH_SEARCH_DONE',
                            payload: {data: null},
                            error: err
                        });
                        this.pluginApi.showMessage('error', err);
                    }
                );
            break;
            case 'DEFAULT_CORPARCH_FOCUSED_ITEM_SELECT':
                if (state.focusedRowIdx > -1) {
                    this.handleSearchItemClick(
                            state,
                            state.currSearchResult.get(state.focusedRowIdx).id).then(
                        () => {
                            dispatch({
                                name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE',
                                payload: {}
                            });
                        },
                        (err) => {
                            dispatch({
                                name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE',
                                payload: {}
                            });
                            this.pluginApi.showMessage('error', err);
                        }
                    );
                }
            break;
        }
    }


    csExportState():CorpusSwitchPreserved {
        return {dataFav: this.getState().dataFav};
    }

    csGetStateKey():string {
        return 'default-corparch-widget';
    }


    /**
     * According to the state of the current query form, this method creates
     * a new CorplistItem instance with proper type, id, etc.
     */
    getFullCorpusSelection():common.GeneratedFavListItem {
        return {
            subcorpus_id: this.corpSelection.getCurrentSubcorpus(),
            subcorpus_orig_id: this.pluginApi.getCorpusIdent().foreignSubcorp ?
            `#${this.corpSelection.getCurrentSubcorpusOrigName()}` :
                    this.corpSelection.getCurrentSubcorpus(),
            corpora: this.corpSelection.getCorpora().toArray()
        };
    };

    private removeFavItemFromServer(itemId:string):RSVP.Promise<boolean> {
        return this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('user/unset_favorite_item'),
            {id: itemId}

        ).then(
            () => {
                this.pluginApi.showMessage(
                    'info',
                    this.pluginApi.translate('defaultCorparch__item_removed_from_fav')
                );
                return true;
            }
        );
    }

    /**
     * Returns (promise wrapped) newly created item
     * as a result of "rescue" operation or null if the item is lost.
     */
    private removeItemFromTrash(state:CorplistWidgetModelState, itemId:string):RSVP.Promise<SetFavItemResponse> {

        if (this.trashTimerSubsc && state.dataFav.find(x => x.trashTTL !== null) === undefined) {
            this.trashTimerSubsc.unsubscribe();
        }
        state.currFavitemId = findCurrFavitemId(
            state.dataFav,
            this.getFullCorpusSelection()
        );
        const trashedItem = state.dataFav.find(x => x.id === itemId);
        if (trashedItem) {
            return this.pluginApi.ajax<SetFavItemResponse>(
                'POST',
                this.pluginApi.createActionUrl('user/set_favorite_item'),
                {
                    subcorpus_id: trashedItem.subcorpus_id,
                    corpora: trashedItem.corpora.map(v => v.id)
                }
            );

        } else {
            return RSVP.resolve(null);
        }
    }

    private moveItemToTrash(state:CorplistWidgetModelState, itemId:string):void {
        const idx = state.dataFav.findIndex(x => x.id === itemId);
        if (idx > -1) {
            const item = state.dataFav.get(idx);
            state.dataFav = state.dataFav.set(idx, {
                id: item.id,
                name: item.name,
                subcorpus_id: item.subcorpus_id,
                size: item.size,
                size_info: item.size_info,
                corpora: item.corpora,
                description: item.description,
                trashTTL: CorplistWidgetModel.TRASH_TTL_TICKS
            });
            state.currFavitemId = findCurrFavitemId(
                state.dataFav,
                this.getFullCorpusSelection()
            );
        }
    }

    private checkTrashedItems(state:CorplistWidgetModelState):void {
        state.dataFav = state.dataFav.map(item => ({
            id: item.id,
            name: item.name,
            subcorpus_id: item.subcorpus_id,
            size: item.size,
            size_info: item.size_info,
            corpora: item.corpora,
            description: item.description,
            trashTTL: item.trashTTL !== null ? item.trashTTL -= 1 : null
        })).filter(item => item.trashTTL > 0 || item.trashTTL === null).toList();
    }

    private shouldStartSearch(state:CorplistWidgetModelState):boolean {
        return state.currSearchPhrase.length >= CorplistWidgetModel.MIN_SEARCH_PHRASE_ACTIVATION_LENGTH ||
            state.availSearchKeywords.find(x => x.selected) !== undefined;
    }

    private searchDelayed(state:CorplistWidgetModelState):RSVP.Promise<Immutable.List<SearchResultRow>> {
        if (this.inputThrottleTimer) {
            window.clearTimeout(this.inputThrottleTimer);
        }
        if (this.shouldStartSearch(state)) {
            return new RSVP.Promise<Immutable.List<SearchResultRow>>(
                (resolve:(value)=>void, reject:(err)=>void) => {
                    this.inputThrottleTimer = window.setTimeout(() => {
                        this.searchEngine.search(
                            state.currSearchPhrase,
                            state.availSearchKeywords
                        ).then(
                            (data) => {
                                resolve(data);
                            },
                            (err) => {
                                reject(err);
                            }
                        );
                    }, 350);
                }
            );

        } else {
            return RSVP.resolve(Immutable.List<SearchResultRow>());
        }
    }

    private handleFavItemClick(state:CorplistWidgetModelState, itemId:string):RSVP.Promise<any> {
        const item = state.dataFav.find(item => item.id === itemId);
        return (() => {
            if (item !== undefined) {
                return this.onItemClick(item.corpora.map(x => x.id), item.subcorpus_id);

            } else {
                return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
                    reject(new Error(`Favorite item ${itemId} not found`));
                });
            }
        })();
    }

    private handleFeatItemClick(state:CorplistWidgetModelState, itemId:string):RSVP.Promise<any> {
        const item = state.dataFeat.find(item => item.id === itemId);
        return (() => {
            if (item !== undefined) {
                return this.onItemClick([item.corpus_id], item.subcorpus_id);

            } else {
                return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
                    reject(new Error(`Featured item ${itemId} not found`));
                });
            }
        })();
    }

    private handleSearchItemClick(state:CorplistWidgetModelState, itemId:string):RSVP.Promise<any> {
        const item = state.currSearchResult.find(item => item.id === itemId);
        return (() => {
            if (item !== undefined) {
                return this.onItemClick([item.id], '');

            } else {
                return new RSVP.Promise((resolve:(v)=>void, reject:(err)=>void) => {
                    reject(new Error(`Clicked item ${itemId} not found in search results`));
                });
            }
        })();
    }

    private reloadItems(editAction:RSVP.Promise<any>, message:string|null):RSVP.Promise<FavitemsList> {
        return editAction.then<Array<common.CorplistItem>>(
            (data:Kontext.AjaxResponse) => {
                if (message !== null) {
                    this.pluginApi.showMessage('info', message);
                }
                return this.pluginApi.ajax<Array<common.CorplistItem>>(
                    'GET',
                    this.pluginApi.createActionUrl('user/get_favorite_corpora'),
                    {}
                );
            }
        );
    }



    // TODO: this.dataFav = this.importServerItems(favItems);

    private setFavItem(state:CorplistWidgetModelState, showMessage:boolean=true):RSVP.Promise<FavitemsList> {
        const message = showMessage ?
                this.pluginApi.translate('defaultCorparch__item_added_to_fav') :
                null;
        const newItem = this.getFullCorpusSelection();
        return this.reloadItems(this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('user/set_favorite_item'),
            newItem
        ), message);
    }

    private unsetFavItem(id:string, showMessage:boolean=true):RSVP.Promise<any> {
        const message = showMessage ?
                this.pluginApi.translate('defaultCorparch__item_removed_from_fav') :
                null;
        return this.reloadItems(this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('user/unset_favorite_item'),
            {id: id}
        ), message);
    }

    private resetKeywordSelectStatus(state:CorplistWidgetModelState):void {
        state.availSearchKeywords = state.availSearchKeywords.map(item => {
            return {
                id: item.id,
                label: item.label,
                color: item.color,
                selected: false
            };
        }).toList();
    }

    private setKeywordSelectedStatus(state:CorplistWidgetModelState, id:string, status:boolean,
                exclusive:boolean):void {
        if (exclusive) {
            this.resetKeywordSelectStatus(state);
        }
        const idx = state.availSearchKeywords.findIndex(x => x.id === id);
        if (idx > -1) {
            const v = state.availSearchKeywords.get(idx);
            state.availSearchKeywords = state.availSearchKeywords.set(idx,
                {
                    id: v.id,
                    label: v.label,
                    color: v.color,
                    selected: status
                }
            );

        } else {
            throw new Error(`Cannot change label status - label ${id} not found`);
        }
    }
}
