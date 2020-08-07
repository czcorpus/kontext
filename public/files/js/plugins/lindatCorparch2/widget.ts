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
import { Kontext } from '../../types/common';
import * as common from './common';
import {IPluginApi, PluginInterfaces} from '../../types/plugins';
import {SearchEngine, SearchKeyword, SearchResultRow} from './search';
import { IActionDispatcher, StatelessModel, Action, SEDispatcher } from 'kombo';
import { Actions, ActionName } from './actions';
import { Actions as QueryActions, ActionName as QueryActionName
    } from '../../models/query/actions';
import { Actions as CommonActions, ActionName as CommonActionName
    } from '../../models/common/actions';
import { IUnregistrable } from '../../models/common/common';

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

        this.addActionHandler<Actions.WidgetShow>(
            ActionName.WidgetShow,
            (state, action) => {state.isVisible = true}
        );

        this.addActionHandler<Actions.WidgetHide>(
            ActionName.WidgetHide,
            (state, action) => {
                state.activeTab = 0;
                state.isVisible = false;
            }
        );

        this.addActionHandler<Actions.WidgetSetActiveTab>(
            ActionName.WidgetSetActiveTab,
            (state, action) => {state.activeTab = action.payload.value}
        );

        this.addActionHandler<Actions.WidgetFavItemClick>(
            ActionName.WidgetFavItemClick,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                dispatch<Actions.WidgetFavItemClickDone>({
                    name: ActionName.WidgetFavItemClickDone,
                    payload: {}
                });
                this.handleFavItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<Actions.WidgetUpdateList>(
            ActionName.WidgetUpdateList,
            (state, action) => {state.dataFav = importServerFavitems(action.payload.data)}
        );

        this.addActionHandler<Actions.WidgetFavItemClickDone>(
            ActionName.WidgetFavItemClickDone,
            (state, action) => {state.isBusy = false}
        );

        this.addActionHandler<Actions.WidgetFeatItemClick>(
            ActionName.WidgetFeatItemClick,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                dispatch<Actions.WidgetFeatItemClickDone>({
                    name: ActionName.WidgetFeatItemClickDone,
                    payload: {}
                });
                this.handleFeatItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<Actions.WidgetFeatItemClickDone>(
            ActionName.WidgetFeatItemClickDone,
            (state, action) => {state.isBusy = false}
        );

        this.addActionHandler<Actions.WidgetSearchResultClick>(
            ActionName.WidgetSearchResultClick,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                dispatch<Actions.WidgetSearchResultClickDone>({
                    name: ActionName.WidgetSearchResultClickDone,
                    payload: {}
                });
                this.handleSearchItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<Actions.WidgetSearchResultClickDone>(
            ActionName.WidgetSearchResultClickDone,
            (state, action) => {
                state.focusedRowIdx = -1;
                state.isBusy = false;
            }
        );

        this.addActionHandler<Actions.WidgetFavItemAdd>(
            ActionName.WidgetFavItemAdd,
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
                        dispatch<Actions.WidgetFavItemAddDone>({
                            name: ActionName.WidgetFavItemAddDone,
                            payload: {
                                trashedItemId: action.payload.itemId,
                                rescuedItem
                            }
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<Actions.WidgetFavItemAddDone>({
                            name: ActionName.WidgetFavItemAddDone,
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

        this.addActionHandler<Actions.WidgetFavItemAddDone>(
            ActionName.WidgetFavItemAddDone,
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

        this.addActionHandler<Actions.WidgetFavItemRemove>(
            ActionName.WidgetFavItemRemove,
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
                                dispatch<Actions.WidgetCheckTrashedItems>({
                                    name: ActionName.WidgetCheckTrashedItems,
                                    payload: {}
                                });
                            },
                            (_) => undefined,
                            () => {
                                dispatch<Actions.WidgetFavItemRemoveDone>({
                                    name: ActionName.WidgetFavItemRemoveDone,
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

        this.addActionHandler<Actions.WidgetFavItemRemoveDone>(
            ActionName.WidgetFavItemRemoveDone,
            (state, action) => {
                if (!action.error) {
                    const idx = List.findIndex(v => v.id === action.payload.itemId, state.dataFav);
                    if (idx > -1) {
                        state.dataFav = List.removeAt(idx, state.dataFav);
                    }
                }
            }
        );

        this.addActionHandler<Actions.WidgetCheckTrashedItems>(
            ActionName.WidgetCheckTrashedItems,
            (state, action) => {this.checkTrashedItems(state)}
        );

        this.addActionHandler<Actions.WidgetStarIconClick>(
            ActionName.WidgetStarIconClick,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                (action.payload.status ?
                    this.setFavItem(state) :
                    this.unsetFavItem(action.payload.itemId)
                ).subscribe(
                    (data) => {
                        dispatch<Actions.WidgetStarIconClickDone>({
                            name: ActionName.WidgetStarIconClickDone,
                            payload: {data}
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<Actions.WidgetStarIconClickDone>({
                            name: ActionName.WidgetStarIconClickDone,
                            payload: {data: null},
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<Actions.WidgetStarIconClickDone>(
            ActionName.WidgetStarIconClickDone,
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

        this.addActionHandler<Actions.KeywordResetClicked>(
            ActionName.KeywordResetClicked,
            (state, action) => {
                state.isBusy = true;
                this.resetKeywordSelectStatus(state);
                state.currSearchResult = [];
                state.focusedRowIdx = -1;
            },
            this.handleSearchDelay
        );

        this.addActionHandler<Actions.WidgetKeywordClick>(
            ActionName.WidgetKeywordClick,
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

        this.addActionHandler<Actions.WidgetSearchDone>(
            ActionName.WidgetSearchDone,
            (state, action) => {
                state.isBusy = false;
                state.focusedRowIdx = -1;
                if (!action.error && action.payload.data !== null) {
                    state.currSearchResult = action.payload.data;
                }
            }
        );

        this.addActionHandler<Actions.WidgetSearchInputChanged>(
            ActionName.WidgetSearchInputChanged,
            (state, action) => {
                state.currSearchPhrase = action.payload.value;
                state.currSearchResult = [];
                state.focusedRowIdx = -1;
            },
            this.handleSearchDelay
        );

        this.addActionHandler<Actions.WidgetFocusSearchRow>(
            ActionName.WidgetFocusSearchRow,
            (state, action) => {
                state.focusedRowIdx = Math.abs(
                    (state.focusedRowIdx + action.payload.inc) % state.currSearchResult.length);
            }
        );

        this.addActionHandler<Actions.WidgetFocusedItemSelect>(
            ActionName.WidgetFocusedItemSelect,
            (state, action) => {state.isBusy = true},
            (state, action, dispatch) => {
                if (state.focusedRowIdx > -1) {
                    dispatch<Actions.WidgetSearchResultClickDone>({
                        name: ActionName.WidgetSearchResultClickDone,
                        payload: {}
                    });
                    this.handleSearchItemClick(
                        state,
                        state.currSearchResult[state.focusedRowIdx].id
                    );
                }
            }
        );

        this.addActionHandler<QueryActions.QueryInputSelectSubcorp>(
            QueryActionName.QueryInputSelectSubcorp,
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

        this.addActionHandler<QueryActions.QueryInputAddAlignedCorpus>(
            QueryActionName.QueryInputAddAlignedCorpus,
            (state, action) => {
                state.currFavitemId = findCurrFavitemId(
                    state.dataFav,
                    this.getFullCorpusSelection(state)
                );
            }
        );

        this.addActionHandler<QueryActions.QueryInputRemoveAlignedCorpus>(
            QueryActionName.QueryInputRemoveAlignedCorpus,
            (state, action) => {
                state.currFavitemId = findCurrFavitemId(
                    state.dataFav,
                    this.getFullCorpusSelection(state)
                );
            }
        );

        this.addActionHandler<CommonActions.SwitchCorpus>(
            CommonActionName.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch<CommonActions.SwitchCorpusReady<CorplistWidgetModelCorpusSwitchPreserve>>({
                    name: CommonActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(state)
                    }
                });
            }
        );

        this.addActionHandler<CommonActions.CorpusSwitchModelRestore>(
            CommonActionName.CorpusSwitchModelRestore,
            (state, action) => {
                if (!action.error) {
                    const storedData = action.payload.data[this.getRegistrationId()];
                    if (storedData) {
                        state.dataFav = storedData.dataFav.filter(v => v.trashTTL === null);
                        state.currFavitemId = findCurrFavitemId(
                            state.dataFav,
                            this.getFullCorpusSelection(state)
                        );
                    }
                }
            }
        );

        this.addActionHandler<Actions.WidgetMoveFocusToNextItem>(
            ActionName.WidgetMoveFocusToNextItem,
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

        this.addActionHandler<Actions.WidgetEnterOnActiveItem>(
            ActionName.WidgetEnterOnActiveItem,
            (state, action) => {state.isBusy = false},
            (state, action, dispatch) => {
                if (state.activeListItem[0] === 0) {
                    dispatch<Actions.WidgetFavItemClickDone>({
                        name: ActionName.WidgetFavItemClickDone,
                        payload: {}
                    });
                    this.handleFavItemClick(state, state.dataFav[state.activeListItem[1]].id);

                } else {
                    dispatch<Actions.WidgetFavItemClickDone>({
                        name: ActionName.WidgetFavItemClickDone,
                        payload: {}
                    });
                    this.handleFeatItemClick(state, state.dataFeat[state.activeListItem[1]].id);
                }
            }
        );
    }

    handleSearchDelay(state:CorplistWidgetModelState, action:Action, dispatch:SEDispatcher) {
        this.searchDelayed(state).subscribe(
            (data) => {
                dispatch<Actions.WidgetSearchDone>({
                    name: ActionName.WidgetSearchDone,
                    payload: {data}
                });
            },
            (err) => {
                dispatch<Actions.WidgetSearchDone>({
                    name: ActionName.WidgetSearchDone,
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
                    this.pluginApi.translate('defaultCorparch__item_removed_from_fav')
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
                this.pluginApi.translate('defaultCorparch__item_added_to_fav') :
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
