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

import { Subscription } from 'rxjs';
import { take, tap, map, concatMap } from 'rxjs/operators';
import { HTTP, List, pipe } from 'cnc-tskit';
import { timer as rxTimer, Observable, of as rxOf } from 'rxjs';
import * as Kontext from '../../types/kontext';
import * as common from './common';
import * as PluginInterfaces from '../../types/plugins';
import { SearchEngine, SearchKeyword, SearchResultRow } from './search';
import { IActionDispatcher, StatelessModel, Action, SEDispatcher } from 'kombo';
import { Actions } from './actions';
import { Actions as QueryActions } from '../../models/query/actions';
import { Actions as CommonActions } from '../../models/common/actions';
import { IUnregistrable } from '../../models/common/common';
import { IPluginApi } from '../../types/plugins/common';

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
    itemClickAction?:PluginInterfaces.Corparch.CorplistItemClick;
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

const importServerFavitems = (items:Array<common.ServerFavlistItem>):Array<FavListItem> => {
    return List.map(importServerFavitem, items);
};


/**
 * Finds a matching favorite item based on currently selected
 * corpora and subcorpus.
 *
 * @param item
 * @returns an ID if the current item is set as favorite else undefined
 */
const findCurrFavitemId = (dataFav:Array<FavListItem>, item:common.GeneratedFavListItem):string => {
    const normalize = (v:string) => v ? v : '';
    const srch = pipe(
        dataFav,
        List.filter(x => x.trashTTL === null),
        List.find(x => {
            return normalize(x.subcorpus_id) === normalize(item.subcorpus_id) &&
                item.corpora.join('') === List.map(x => x.id, x.corpora).join('');
        })
    )
    return srch ? srch.id : undefined;
}


export interface CorpusSwitchPreserved {
    dataFav:Array<FavListItem>;
}


/**
 *
 */
export interface CorplistWidgetModelState {
    isVisible:boolean;
    activeTab:number;
    activeListItem:[number, number];
    corpusIdent:Kontext.FullCorpusIdent;
    alignedCorpora:Array<string>;
    dataFav:Array<FavListItem>;
    dataFeat:Array<common.CorplistItem>;
    isBusy:boolean;
    currFavitemId:string;
    anonymousUser:boolean;
    isWaitingForSearchResults:boolean;
    currSearchResult:Array<SearchResultRow>;
    currSearchPhrase:string;
    availSearchKeywords:Array<SearchKeyword>;
    currSubcorpus:string;
    currSubcorpusOrigName:string;
    focusedRowIdx:number;
    availableSubcorpora:Array<Kontext.SubcorpListItem>;
}

export interface CorplistWidgetModelCorpusSwitchPreserve {
    dataFav:Array<FavListItem>;
}

export interface CorplistWidgetModelArgs {
    dispatcher:IActionDispatcher;
    pluginApi:IPluginApi;
    corpusIdent:Kontext.FullCorpusIdent;
    anonymousUser:boolean;
    searchEngine:SearchEngine;
    dataFav:Array<common.ServerFavlistItem>;
    dataFeat:Array<common.CorplistItem>;
    onItemClick:PluginInterfaces.Corparch.CorplistItemClick;
    corporaLabels:Array<[string, string, string]>;
}


/**
 *
 */
export class CorplistWidgetModel extends StatelessModel<CorplistWidgetModelState>
        implements IUnregistrable {

    private pluginApi:IPluginApi;

    private searchEngine:SearchEngine;

    private onItemClick:PluginInterfaces.Corparch.CorplistItemClick;

    private inputThrottleTimer:number;

    private static MIN_SEARCH_PHRASE_ACTIVATION_LENGTH = 3;

    private static TRASH_TTL_TICKS = 20;

    private trashTimerSubsc:Subscription;

    constructor({dispatcher, pluginApi, corpusIdent, anonymousUser, searchEngine,
            dataFav, dataFeat, onItemClick, corporaLabels}:CorplistWidgetModelArgs) {
        const dataFavImp = importServerFavitems(dataFav);
        super(dispatcher, {
            isVisible: false,
            activeTab: 0,
            activeListItem: [null, null],
            corpusIdent,
            alignedCorpora: [],
            anonymousUser,
            dataFav: dataFavImp,
            dataFeat,
            isBusy: false,
            currFavitemId: findCurrFavitemId(
                dataFavImp,
                {
                    subcorpus_id: pluginApi.getCorpusIdent().usesubcorp,
                    subcorpus_orig_id: pluginApi.getCorpusIdent().origSubcorpName,
                    corpora: List.concat(
                        pluginApi.getConf<Array<string>>('alignedCorpora'),
                        [pluginApi.getCorpusIdent().id]
                    )
                }
            ),
            isWaitingForSearchResults: false,
            currSearchPhrase: '',
            currSearchResult: [],
            availSearchKeywords: List.map(item => (
                {id: item[0], label: item[1], color: item[2], selected:false}), corporaLabels),
            currSubcorpus: pluginApi.getCorpusIdent().usesubcorp,
            currSubcorpusOrigName: pluginApi.getCorpusIdent().origSubcorpName,
            focusedRowIdx: -1,
            availableSubcorpora: pluginApi.getConf<Array<Kontext.SubcorpListItem>>('SubcorpList')
        });
        this.pluginApi = pluginApi;
        this.searchEngine = searchEngine;
        this.onItemClick = onItemClick;
        this.inputThrottleTimer = null;

        this.handleSearchDelay = this.handleSearchDelay.bind(this);

        this.addActionHandler<typeof Actions.WidgetShow>(
            Actions.WidgetShow.name,
            (state, action) => {state.isVisible = true}
        );

        this.addActionHandler<typeof Actions.WidgetHide>(
            Actions.WidgetHide.name,
            (state, action) => {
                state.activeTab = 0;
                state.isVisible = false;
            }
        );

        this.addActionHandler<typeof Actions.WidgetSetActiveTab>(
            Actions.WidgetSetActiveTab.name,
            (state, action) => {state.activeTab = action.payload.value}
        );

        this.addActionHandler<typeof Actions.WidgetFavItemClick>(
            Actions.WidgetFavItemClick.name,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                dispatch<typeof Actions.WidgetFavItemClickDone>({
                    name: Actions.WidgetFavItemClickDone.name,
                    payload: {}
                });
                this.handleFavItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<typeof Actions.WidgetUpdateList>(
            Actions.WidgetUpdateList.name,
            (state, action) => {state.dataFav = importServerFavitems(action.payload.data)}
        );

        this.addActionHandler<typeof Actions.WidgetFavItemClickDone>(
            Actions.WidgetFavItemClickDone.name,
            (state, action) => {state.isBusy = false}
        );

        this.addActionHandler<typeof Actions.WidgetFeatItemClick>(
            Actions.WidgetFeatItemClick.name,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                dispatch<typeof Actions.WidgetFeatItemClickDone>({
                    name: Actions.WidgetFeatItemClickDone.name,
                    payload: {}
                });
                this.handleFeatItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<typeof Actions.WidgetFeatItemClickDone>(
            Actions.WidgetFeatItemClickDone.name,
            (state, action) => {state.isBusy = false}
        );

        this.addActionHandler<typeof Actions.WidgetSearchResultClick>(
            Actions.WidgetSearchResultClick.name,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                dispatch<typeof Actions.WidgetSearchResultClickDone>({
                    name: Actions.WidgetSearchResultClickDone.name,
                    payload: {}
                });
                this.handleSearchItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<typeof Actions.WidgetSearchResultClickDone>(
            Actions.WidgetSearchResultClickDone.name,
            (state, action) => {
                state.focusedRowIdx = -1;
                state.isBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.WidgetFavItemAdd>(
            Actions.WidgetFavItemAdd.name,
            (state, action) => {
                state.isBusy = true;
                const idx = List.findIndex(x => x.id === action.payload.itemId, state.dataFav);
                if (idx > -1) {
                    const item = state.dataFav[idx];
                    state.dataFav[idx] = {
                        id: item.id,
                        name: item.name,
                        subcorpus_id: item.subcorpus_id,
                        size: item.size,
                        size_info: item.size_info,
                        corpora: item.corpora,
                        description: item.description,
                        trashTTL: null
                    };
                }
            },
            (state, action, dispatch) => {
                this.removeItemFromTrash(state, action.payload.itemId).subscribe(
                    (rescuedItem) => {
                        dispatch<typeof Actions.WidgetFavItemAddDone>({
                            name: Actions.WidgetFavItemAddDone.name,
                            payload: {
                                trashedItemId: action.payload.itemId,
                                rescuedItem
                            }
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<typeof Actions.WidgetFavItemAddDone>({
                            name: Actions.WidgetFavItemAddDone.name,
                            payload: {
                                trashedItemId: action.payload.itemId,
                                rescuedItem: null
                            },
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.WidgetFavItemAddDone>(
            Actions.WidgetFavItemAddDone.name,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    const idx = List.findIndex(
                        v => v.id === action.payload.trashedItemId,
                        state.dataFav
                    );
                    if (action.payload.rescuedItem) {
                        state.dataFav[idx] = importServerFavitem(action.payload.rescuedItem);

                    } else {
                        state.dataFav = List.removeAt(idx, state.dataFav);
                    }
                }
            }
        );

        this.addActionHandler<typeof Actions.WidgetFavItemRemove>(
            Actions.WidgetFavItemRemove.name,
            (state, action) => {this.moveItemToTrash(state, action.payload.itemId)},
            (state, action, dispatch) => {
                this.removeFavItemFromServer(action.payload.itemId).subscribe(
                    (favItem) => {
                        const src = rxTimer(0, 1000).pipe(
                            take(CorplistWidgetModel.TRASH_TTL_TICKS)
                        );
                        if (this.trashTimerSubsc) {
                            this.trashTimerSubsc.unsubscribe();
                        }
                        this.trashTimerSubsc = src.subscribe(
                            () => {
                                dispatch<typeof Actions.WidgetCheckTrashedItems>({
                                    name: Actions.WidgetCheckTrashedItems.name,
                                    payload: {}
                                });
                            },
                            (_) => undefined,
                            () => {
                                dispatch<typeof Actions.WidgetFavItemRemoveDone>({
                                    name: Actions.WidgetFavItemRemoveDone.name,
                                    payload: {
                                        itemId: action.payload.itemId
                                    }
                                });
                            }
                        );
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.WidgetFavItemRemoveDone>(
            Actions.WidgetFavItemRemoveDone.name,
            (state, action) => {
                if (!action.error) {
                    const idx = List.findIndex(v => v.id === action.payload.itemId, state.dataFav);
                    if (idx > -1) {
                        state.dataFav = List.removeAt(idx, state.dataFav);
                    }
                }
            }
        );

        this.addActionHandler<typeof Actions.WidgetCheckTrashedItems>(
            Actions.WidgetCheckTrashedItems.name,
            (state, action) => {this.checkTrashedItems(state)}
        );

        this.addActionHandler<typeof Actions.WidgetStarIconClick>(
            Actions.WidgetStarIconClick.name,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                (action.payload.status ?
                    this.setFavItem(state) :
                    this.unsetFavItem(action.payload.itemId)
                ).subscribe(
                    (data) => {
                        dispatch<typeof Actions.WidgetStarIconClickDone>({
                            name: Actions.WidgetStarIconClickDone.name,
                            payload: {data}
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<typeof Actions.WidgetStarIconClickDone>({
                            name: Actions.WidgetStarIconClickDone.name,
                            payload: {data: null},
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.WidgetStarIconClickDone>(
            Actions.WidgetStarIconClickDone.name,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.dataFav = importServerFavitems(action.payload.data);
                    state.currFavitemId = findCurrFavitemId(
                        state.dataFav,
                        this.getFullCorpusSelection(state)
                    );
                }
            }
        );

        this.addActionHandler<typeof Actions.KeywordResetClicked>(
            Actions.KeywordResetClicked.name,
            (state, action) => {
                state.isBusy = true;
                this.resetKeywordSelectStatus(state);
                state.currSearchResult = [];
                state.focusedRowIdx = -1;
            },
            this.handleSearchDelay
        );

        this.addActionHandler<typeof Actions.WidgetKeywordClick>(
            Actions.WidgetKeywordClick.name,
            (state, action) => {
                state.isBusy = true;
                state.focusedRowIdx = -1;
                this.setKeywordSelectedStatus(
                    state,
                    action.payload.keywordId,
                    action.payload.status,
                    action.payload.exclusive
                );
            },
            this.handleSearchDelay
        );

        this.addActionHandler<typeof Actions.WidgetSearchDone>(
            Actions.WidgetSearchDone.name,
            (state, action) => {
                state.isBusy = false;
                state.focusedRowIdx = -1;
                if (!action.error && action.payload.data !== null) {
                    state.currSearchResult = action.payload.data;
                }
            }
        );

        this.addActionHandler<typeof Actions.WidgetSearchInputChanged>(
            Actions.WidgetSearchInputChanged.name,
            (state, action) => {
                state.currSearchPhrase = action.payload.value;
                state.currSearchResult = [];
                state.focusedRowIdx = -1;
            },
            this.handleSearchDelay
        );

        this.addActionHandler<typeof Actions.WidgetFocusSearchRow>(
            Actions.WidgetFocusSearchRow.name,
            (state, action) => {
                state.focusedRowIdx = Math.abs(
                    (state.focusedRowIdx + action.payload.inc) % state.currSearchResult.length);
            }
        );

        this.addActionHandler<typeof Actions.WidgetFocusedItemSelect>(
            Actions.WidgetFocusedItemSelect.name,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                if (state.focusedRowIdx > -1) {
                    dispatch<typeof Actions.WidgetSearchResultClickDone>({
                        name: Actions.WidgetSearchResultClickDone.name,
                        payload: {}
                    });
                    this.handleSearchItemClick(
                        state,
                        state.currSearchResult[state.focusedRowIdx].id
                    );
                }
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputSelectSubcorp>(
            QueryActions.QueryInputSelectSubcorp.name,
            (state, action) => {
                if (action.payload.pubName) {
                    state.currSubcorpus = action.payload.pubName;
                    state.currSubcorpusOrigName = action.payload.subcorp;

                } else {
                    state.currSubcorpus = action.payload.subcorp;
                    state.currSubcorpusOrigName = action.payload.subcorp;
                }
                state.currFavitemId = findCurrFavitemId(
                    state.dataFav,
                    this.getFullCorpusSelection(state)
                );
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputAddAlignedCorpus>(
            QueryActions.QueryInputAddAlignedCorpus.name,
            (state, action) => {
                state.currFavitemId = findCurrFavitemId(
                    state.dataFav,
                    this.getFullCorpusSelection(state)
                );
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputRemoveAlignedCorpus>(
            QueryActions.QueryInputRemoveAlignedCorpus.name,
            (state, action) => {
                state.currFavitemId = findCurrFavitemId(
                    state.dataFav,
                    this.getFullCorpusSelection(state)
                );
            }
        );

        this.addActionHandler<typeof CommonActions.SwitchCorpus>(
            CommonActions.SwitchCorpus.name,
            null,
            (state, action, dispatch) => {
                dispatch<typeof CommonActions.SwitchCorpusReady>({
                    name: CommonActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(state)
                    }
                });
            }
        );

        this.addActionHandler<typeof CommonActions.CorpusSwitchModelRestore>(
            CommonActions.CorpusSwitchModelRestore.name,
            (state, action) => {
                if (!action.error) {
                    const storedData = action.payload.data[this.getRegistrationId()];
                    if (storedData) {
                        state.dataFav = storedData.dataFav.filter(v => v.trashTTL === null);
                        state.currFavitemId = findCurrFavitemId(
                            state.dataFav,
                            this.getFullCorpusSelection(state)
                        );
                        state.alignedCorpora = pipe(
                            action.payload.corpora,
                            List.tail(),
                            List.map(([,newCorp]) => newCorp)
                        );
                    }
                }
            }
        );

        this.addActionHandler<typeof Actions.WidgetMoveFocusToNextItem>(
            Actions.WidgetMoveFocusToNextItem.name,
            (state, action) => {
                const [colInc, rowInc] = action.payload.change;
                const [col, row] = state.activeListItem;
                if (col === null || row === null) {
                    state.activeListItem = [0, 0];

                } else {
                    const newCol = Math.abs((col + colInc) % 2);
                    const rotationLen = newCol === 0 ? state.dataFav.length : state.dataFeat.length;
                    state.activeListItem = [
                        newCol,
                        colInc !== 0 ?
                            0 :
                            (row + rowInc) >= 0 ?
                                Math.abs((row + rowInc) % rotationLen) :
                                rotationLen - 1
                    ];
                }
            }
        );

        this.addActionHandler<typeof Actions.WidgetEnterOnActiveItem>(
            Actions.WidgetEnterOnActiveItem.name,
            (state, action) => {state.isBusy = false},
            (state, action, dispatch) => {
                if (state.activeListItem[0] === 0) {
                    dispatch<typeof Actions.WidgetFavItemClickDone>({
                        name: Actions.WidgetFavItemClickDone.name,
                        payload: {}
                    });
                    this.handleFavItemClick(state, state.dataFav[state.activeListItem[1]].id);

                } else {
                    dispatch<typeof Actions.WidgetFavItemClickDone>({
                        name: Actions.WidgetFavItemClickDone.name,
                        payload: {}
                    });
                    this.handleFeatItemClick(state, state.dataFeat[state.activeListItem[1]].id);
                }
            }
        );

        this.addActionHandler<typeof QueryActions.QueryAddSubcorp>(
            QueryActions.QueryAddSubcorp.name,
            (state, action) => {
                state.availableSubcorpora.push(action.payload);
            }
        );
    }

    handleSearchDelay(state:CorplistWidgetModelState, action:Action, dispatch:SEDispatcher) {
        this.searchDelayed(state).subscribe(
            (data) => {
                dispatch<typeof Actions.WidgetSearchDone>({
                    name: Actions.WidgetSearchDone.name,
                    payload: {data}
                });
            },
            (err) => {
                dispatch<typeof Actions.WidgetSearchDone>({
                    name: Actions.WidgetSearchDone.name,
                    payload: {data: null},
                    error: err
                });
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    getRegistrationId():string {
        return 'lindat-corparch-widget-2';
    }

    serialize(state:CorplistWidgetModelState):CorplistWidgetModelCorpusSwitchPreserve {
        return {
            dataFav: [...state.dataFav]
        };
    }

    deserialize(
        state:CorplistWidgetModelState,
        data:CorplistWidgetModelCorpusSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        if (data) {
            List.forEach(
                ([oldCorp, newCorp]) => {
                    state.dataFav[newCorp] = data.dataFav[oldCorp];
                },
                corpora
            )
        }
    }

    /**
     * According to the state of the current query form, this method creates
     * a new CorplistItem instance with proper type, id, etc.
     */
    getFullCorpusSelection(state:CorplistWidgetModelState):common.GeneratedFavListItem {
        return {
            subcorpus_id: state.corpusIdent.usesubcorp,
            subcorpus_orig_id: state.corpusIdent.origSubcorpName ?
                    `#${state.corpusIdent.origSubcorpName}` :
                    state.corpusIdent.usesubcorp,
            corpora: [state.corpusIdent.id].concat(state.alignedCorpora)
        };
    };

    private removeFavItemFromServer(itemId:string):Observable<boolean> {
        return this.pluginApi.ajax$(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl('user/unset_favorite_item'),
            {id: itemId}

        ).pipe(
            tap(() => {
                this.pluginApi.showMessage(
                    'info',
                    this.pluginApi.translate('lindatCorparch2__item_removed_from_fav')
                )
            }),
            map(_ => true)
        );
    }

    /**
     * Returns (promise wrapped) newly created item
     * as a result of "rescue" operation or null if the item is lost.
     */
    private removeItemFromTrash(
        state:CorplistWidgetModelState,
        itemId:string
    ):Observable<common.ServerFavlistItem> {

        if (this.trashTimerSubsc &&
                List.find(x => x.trashTTL !== null, state.dataFav) === undefined) {
            this.trashTimerSubsc.unsubscribe();
        }
        state.currFavitemId = findCurrFavitemId(
            state.dataFav,
            this.getFullCorpusSelection(state)
        );
        const trashedItem = List.find(x => x.id === itemId, state.dataFav);
        if (trashedItem) {
            return this.pluginApi.ajax$<common.ServerFavlistItem>(
                HTTP.Method.POST,
                this.pluginApi.createActionUrl('user/set_favorite_item'),
                {
                    subcorpus_id: trashedItem.subcorpus_id,
                    corpora: List.map(v => v.id, trashedItem.corpora)
                }
            );

        } else {
            return rxOf(null);
        }
    }

    private moveItemToTrash(state:CorplistWidgetModelState, itemId:string):void {
        const idx = List.findIndex(x => x.id === itemId, state.dataFav);
        if (idx > -1) {
            const item = state.dataFav[idx];
            state.dataFav[idx] = {
                id: item.id,
                name: item.name,
                subcorpus_id: item.subcorpus_id,
                size: item.size,
                size_info: item.size_info,
                corpora: item.corpora,
                description: item.description,
                trashTTL: CorplistWidgetModel.TRASH_TTL_TICKS
            };
            state.currFavitemId = findCurrFavitemId(
                state.dataFav,
                this.getFullCorpusSelection(state)
            );
        }
    }

    private checkTrashedItems(state:CorplistWidgetModelState):void {
        state.dataFav = pipe(
            state.dataFav,
            List.map(item => ({
                id: item.id,
                name: item.name,
                subcorpus_id: item.subcorpus_id,
                size: item.size,
                size_info: item.size_info,
                corpora: item.corpora,
                description: item.description,
                trashTTL: item.trashTTL !== null ? item.trashTTL -= 1 : null
            })),
            List.filter(item => item.trashTTL > 0 || item.trashTTL === null)
        );
    }

    private shouldStartSearch(state:CorplistWidgetModelState):boolean {
        return state.currSearchPhrase.length >=
            CorplistWidgetModel.MIN_SEARCH_PHRASE_ACTIVATION_LENGTH ||
                List.find(x => x.selected, state.availSearchKeywords) !== undefined;
    }

    private searchDelayed(state:CorplistWidgetModelState):Observable<Array<SearchResultRow>> {
        if (this.inputThrottleTimer) {
            window.clearTimeout(this.inputThrottleTimer);
        }
        if (this.shouldStartSearch(state)) {
            return new Observable<Array<SearchResultRow>>(observer => {
                this.inputThrottleTimer = window.setTimeout(() => { // TODO antipattern here
                    this.searchEngine.search(
                        state.currSearchPhrase,
                        state.availSearchKeywords

                    ).subscribe(
                        (data) => {
                            observer.next(data);
                            observer.complete();
                        },
                        (err) => {
                            observer.error(err);
                        }
                    );
                }, 350);
            }
            );

        } else {
            return rxOf([]);
        }
    }

    private handleFavItemClick(state:CorplistWidgetModelState, itemId:string):void {
        const item = List.find(item => item.id === itemId, state.dataFav);
        if (item !== undefined) {
            this.onItemClick(List.map(x => x.id, item.corpora), item.subcorpus_id);

        } else {
            throw new Error(`Favorite item ${itemId} not found`);
        }
    }

    private handleFeatItemClick(state:CorplistWidgetModelState, itemId:string):void {
        const item = List.find(item => item.id === itemId, state.dataFeat);
        if (item !== undefined) {
                this.onItemClick([item.corpus_id], item.subcorpus_id);

        } else {
            throw new Error(`Featured item ${itemId} not found`);
        }
    }

    private handleSearchItemClick(state:CorplistWidgetModelState, itemId:string):void {
        const item = List.find(item => item.id === itemId, state.currSearchResult);
        if (item !== undefined) {
            this.onItemClick([item.id], '');

        } else {
            throw new Error(`Clicked item ${itemId} not found in search results`);
        }
    }

    private reloadItems(
        editAction:Observable<Array<common.CorplistItem>>,
        message:string|null
    ):Observable<FavitemsList> {
        return editAction.pipe(
            tap((_) => {
                if (message !== null) {
                    this.pluginApi.showMessage('info', message);
                }
            }),
            concatMap(
                (_) => this.pluginApi.ajax$<Array<common.CorplistItem>>(
                    HTTP.Method.GET,
                    this.pluginApi.createActionUrl('user/get_favorite_corpora'),
                    {}
                )
            )
        );
    }



    // TODO: this.dataFav = this.importServerItems(favItems);

    private setFavItem(
        state:CorplistWidgetModelState,
        showMessage:boolean=true
    ):Observable<FavitemsList> {

        const message = showMessage ?
                this.pluginApi.translate('lindatCorparch2__item_added_to_fav') :
                null;
        const newItem = this.getFullCorpusSelection(state);
        return this.reloadItems(this.pluginApi.ajax$(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl('user/set_favorite_item'),
            newItem
        ), message);
    }

    private unsetFavItem(id:string, showMessage:boolean=true):Observable<any> {
        const message = showMessage ?
                this.pluginApi.translate('defaultCorparch__item_removed_from_fav') :
                null;
        return this.reloadItems(this.pluginApi.ajax$(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl('user/unset_favorite_item'),
            {id}
        ), message);
    }

    private resetKeywordSelectStatus(state:CorplistWidgetModelState):void {
        state.availSearchKeywords = List.map(item => ({
            id: item.id,
            label: item.label,
            color: item.color,
            selected: false
        }), state.availSearchKeywords);
    }

    private setKeywordSelectedStatus(state:CorplistWidgetModelState, id:string, status:boolean,
                exclusive:boolean):void {
        if (exclusive) {
            this.resetKeywordSelectStatus(state);
        }
        const idx = List.findIndex(x => x.id === id, state.availSearchKeywords);
        if (idx > -1) {
            const v = state.availSearchKeywords[idx];
            state.availSearchKeywords[idx] = {
                id: v.id,
                label: v.label,
                color: v.color,
                selected: status
            }

        } else {
            throw new Error(`Cannot change label status - label ${id} not found`);
        }
    }
}
