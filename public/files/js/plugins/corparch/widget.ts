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

import { IActionDispatcher, SEDispatcher, StatelessModel } from 'kombo';
import { Subscription, timer as rxTimer, Observable, of as rxOf } from 'rxjs';
import { take, tap, map, concatMap } from 'rxjs/operators';
import { List, tuple, HTTP, pipe } from 'cnc-tskit';

import * as Kontext from '../../types/kontext.js';
import * as common from './common.js';
import * as PluginInterfaces from '../../types/plugins/index.js';
import { SearchEngine, SearchKeyword, SearchResultRow} from './search.js';
import { Actions } from './actions.js';
import { Actions as CorparchActions } from '../../types/plugins/corparch.js';
import { Actions as GlobalActions } from '../../models/common/actions.js';
import { IUnregistrable } from '../../models/common/common.js';
import { IPluginApi } from '../../types/plugins/common.js';

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
    itemClickAction?:PluginInterfaces.Corparch.CorpusSelectionHandler;
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
    corpora:Array<{id: string, name: string}>;
    subcorpus_id:string;
}


const importServerFavitem = (item:common.ServerFavlistItem):FavListItem => ({
    ...item,
    trashTTL: null
});

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
    const itemsEqual = (item1:FavListItem, item2:common.GeneratedFavListItem):boolean => {
        return normalize(item1.subcorpus_id) === normalize(item2.subcorpus_id) &&
            pipe(
                item1.corpora,
                List.map(v => v.id),
                List.zipAll(item2.corpora),
                List.every(([v1, v2]) => v1 === v2)
            );
    }
    const srch = pipe(
        dataFav,
        List.filter(x => x.trashTTL === null),
        List.find(x => itemsEqual(x, item))
    );
    return srch?.id;
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
    isBusyWidget:boolean;
    isBusyButton:boolean;
    currFavitemId:string;
    anonymousUser:boolean;
    isWaitingForSearchResults:boolean;
    currSearchResult:Array<SearchResultRow>;
    currSearchPhrase:string;
    availSearchKeywords:Array<SearchKeyword>;
    availableSubcorpora:Array<Kontext.SubcorpListItem>;
    focusedRowIdx:number;
}


export interface CorplistWidgetModelArgs {
    dispatcher:IActionDispatcher;
    pluginApi:IPluginApi;
    corpusIdent:Kontext.FullCorpusIdent;
    widgetId:string;
    anonymousUser:boolean;
    searchEngine:SearchEngine;
    dataFav:Array<common.ServerFavlistItem>;
    dataFeat:Array<common.CorplistItem>;
    onItemClick?:PluginInterfaces.Corparch.CorpusSelectionHandler;
    corporaLabels:Array<[string, string, string]>;
    availableSubcorpora:Array<Kontext.SubcorpListItem>;
}

export interface CorplistWidgetModelCorpusSwitchPreserve {
    corpusIdent:Kontext.FullCorpusIdent;
    currFavitemId:string;
    availableSubcorpora:Array<Kontext.SubcorpListItem>;
    alignedCorpora:Array<string>;
    dataFav:Array<FavListItem>;
}

/**
 *
 */
export class CorplistWidgetModel extends StatelessModel<CorplistWidgetModelState>
        implements IUnregistrable {

    private readonly pluginApi:IPluginApi;

    private readonly searchEngine:SearchEngine;

    private readonly onItemClick?:PluginInterfaces.Corparch.CorpusSelectionHandler;

    private inputThrottleTimer:number;

    private static readonly MIN_SEARCH_PHRASE_ACTIVATION_LENGTH = 3;

    private static readonly TRASH_TTL_TICKS = 20;

    private trashTimerSubsc:Subscription;

    private readonly widgetId:string;

    constructor({
        dispatcher,
        pluginApi,
        corpusIdent,
        widgetId,
        anonymousUser,
        searchEngine,
        dataFav,
        dataFeat,
        onItemClick,
        corporaLabels,
        availableSubcorpora,
    }:CorplistWidgetModelArgs) {
        const dataFavImp = importServerFavitems(dataFav);
        super(dispatcher, {
            isVisible: false,
            activeTab: 0,
            activeListItem: tuple(null, null),
            corpusIdent,
            alignedCorpora: [...(pluginApi.getConf<Array<string>>('alignedCorpora') || [])],
            anonymousUser,
            dataFav: dataFavImp,
            dataFeat: [...dataFeat],
            isBusyWidget: false,
            isBusyButton: false,
            currFavitemId: findCurrFavitemId(
                dataFavImp,
                {
                    subcorpus_id: corpusIdent.usesubcorp,
                    subcorpus_name: corpusIdent.subcName,
                    corpora: [corpusIdent.id, ...(pluginApi.getConf<Array<string>>('alignedCorpora') || [])]
                }
            ),
            isWaitingForSearchResults: false,
            currSearchPhrase: '',
            currSearchResult: [],
            availSearchKeywords: List.map(
                item => ({id: item[0], label: item[1], color: item[2], selected:false}),
                corporaLabels
            ),
            availableSubcorpora: availableSubcorpora,
            focusedRowIdx: -1
        });
        this.widgetId = widgetId;
        this.pluginApi = pluginApi;
        this.searchEngine = searchEngine;
        this.onItemClick = onItemClick;
        this.inputThrottleTimer = null;

        this.addActionHandler(
            Actions.WidgetShow,
            (state, action) => {
                if (action.payload.widgetId === this.widgetId) {
                    state.isVisible = true;
                } else {
                    state.isVisible = false;
                    state.activeTab = 0;
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetHide,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.activeTab = 0;
                state.isVisible = false;
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetSetActiveTab,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.activeTab = action.payload.value;
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetSubcorpusSelected,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyButton = true;

            },
            (state, action, dispatch) => {
                this.onItemClick([state.corpusIdent.id], action.payload.subcorpus);

            }
        )

        this.addActionSubtypeHandler(
            Actions.WidgetFavItemClick,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyButton = true;
                state.isVisible = false;
            },
            (state, action, dispatch) => {
                this.handleFavItemClick(dispatch, state, action.payload.itemId);
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetFeatItemClick,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyButton = true;
                state.isVisible = false;
            },
            (state, action, dispatch) => {
                this.handleFeatItemClick(dispatch, state, action.payload.itemId);
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetSearchResultItemClicked,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyButton = true;
                state.isVisible = false;
                state.focusedRowIdx = -1;
            },
            (state, action, dispatch) => {
                this.handleSearchItemClick(dispatch, state, action.payload.itemId);
            }
        );

        this.addActionHandler(
            Actions.WidgetFavItemAdd,
            (state, action) => {
                state.isBusyWidget = true;
                const idx = List.findIndex(x => x.id === action.payload.itemId, state.dataFav);
                if (idx > -1) {
                    state.dataFav[idx] = {...state.dataFav[idx], trashTTL: null};
                }
            },
            (state, action, dispatch) => {
                this.removeItemFromTrash(state, action.payload.itemId, action.payload.widgetId).subscribe({
                    next: response => {
                        dispatch<typeof Actions.WidgetFavItemAddDone>({
                            name: Actions.WidgetFavItemAddDone.name,
                            payload: {
                                widgetId: this.widgetId,
                                trashedItemId: action.payload.itemId,
                                rescuedItem: {
                                    id: response.id, // might be regenerated
                                    name: response.name,
                                    subcorpus_id: response.subcorpus_id,
                                    // TODO !!! missing orig subc name
                                    subcorpus_name: response.subcorpus_id,
                                    size: response.size,
                                    size_info: response.size_info,
                                    // TODO missing name
                                    corpora: response.corpora,
                                    description: '---' // TODO !!! missing desc.
                                }
                            }
                        });
                    },
                    error: error => {
                        this.pluginApi.showMessage('error', error);
                        dispatch<typeof Actions.WidgetFavItemAddDone>({
                            name: Actions.WidgetFavItemAddDone.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.WidgetFavItemAddDone,
            (state, action) => {
                state.isBusyWidget = false;
                if (!action.error) {
                    const idx = List.findIndex(
                        v => v.id === action.payload.trashedItemId,
                        state.dataFav
                    );
                    if (action.payload.rescuedItem) {
                        state.dataFav[idx] = importServerFavitem(action.payload.rescuedItem);

                    } else {
                        delete state.dataFav[idx];
                    }
                    state.currFavitemId = findCurrFavitemId(
                        state.dataFav,
                        this.getFullCorpusSelection(state)
                    );
                    if (action.payload.widgetId === this.widgetId) {
                        this.pluginApi.showMessage(
                            'info',
                            this.pluginApi.translate('defaultCorparch__item_added_to_fav')
                        );
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.WidgetFavItemRemove,
            (state, action) => {
                this.moveItemToTrash(state, action.payload.itemId);
            },
            (state, action, dispatch) => {
                if (action.payload.widgetId === this.widgetId) {
                    this.removeFavItemFromServer(action.payload.itemId).subscribe(
                        (favItem) => {
                            const src = rxTimer(0, 1000).pipe(
                                take(CorplistWidgetModel.TRASH_TTL_TICKS));
                            if (this.trashTimerSubsc) {
                                this.trashTimerSubsc.unsubscribe();
                            }
                            this.trashTimerSubsc = src.subscribe({
                                next: () => {
                                    dispatch(Actions.WidgetCheckTrashedItems);
                                },
                                complete: () => {
                                    dispatch(Actions.WidgetCheckTrashedItems);
                                }
                            });
                        }
                    );
                }
            }
        );

        this.addActionHandler(
            Actions.WidgetCheckTrashedItems,
            (state, action) => {
                this.checkTrashedItems(state);
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetStarIconClick,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyWidget = true;
            },
            (state, action, dispatch) => {
                (action.payload.status ?
                    this.setFavItem(state) :
                    this.unsetFavItem(action.payload.itemId)
                ).subscribe({
                    next: data => {
                        dispatch<typeof Actions.WidgetStarIconClickDone>({
                            name: Actions.WidgetStarIconClickDone.name,
                            payload: {
                                widgetId: this.widgetId,
                                data
                            }
                        });
                    },
                    error: error => {
                        this.pluginApi.showMessage('error', error);
                        dispatch<typeof Actions.WidgetStarIconClickDone>({
                            name: Actions.WidgetStarIconClickDone.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.WidgetStarIconClickDone,
            (state, action) => {
                state.isBusyWidget = false;
                if (!action.error) {
                    state.dataFav = importServerFavitems(action.payload.data);
                    state.currFavitemId = findCurrFavitemId(
                        state.dataFav,
                        this.getFullCorpusSelection(state)
                    );
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.KeywordResetClicked,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyWidget = true;
                this.resetKeywordSelectStatus(state);
                state.currSearchResult = []
                state.focusedRowIdx = -1;
            },
            (state, action, dispatch) => {
                this.searchDelayed(state).subscribe({
                    next: data => {
                        dispatch<typeof Actions.WidgetSearchDone>({
                            name: Actions.WidgetSearchDone.name,
                            payload: {
                                widgetId: this.widgetId,
                                data
                            }
                        });
                    },
                    error: error => {
                        dispatch<typeof Actions.WidgetSearchDone>({
                            name: Actions.WidgetSearchDone.name,
                            error
                        });
                        this.pluginApi.showMessage('error', error);
                    }
                });
            }
        ).sideEffectAlsoOn(
            Actions.KeywordResetClicked.name,
            Actions.WidgetSearchInputChanged.name,
            Actions.KeywordClicked.name
        )

        this.addActionSubtypeHandler(
            Actions.KeywordClicked,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyWidget = true;
                state.focusedRowIdx = -1;
                this.setKeywordSelectedStatus(
                    state,
                    action.payload.keywordId,
                    action.payload.status,
                    !action.payload.attachToCurrent
                );
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetSearchDone,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyWidget = false;
                state.focusedRowIdx = -1;
                if (!action.error && action.payload.data !== null) {
                    state.currSearchResult = action.payload.data;
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetSearchInputChanged,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.currSearchPhrase = action.payload.value;
                state.currSearchResult = [];
                state.focusedRowIdx = -1;
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetFocusSearchRow,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                if (state.currSearchResult.length > 0) {
                    const inc = action.payload.inc;
                    state.focusedRowIdx = Math.abs(
                        (state.focusedRowIdx + inc) % state.currSearchResult.length);
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetFocusedItemSelect,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyButton = true;
                state.isVisible = false;
            },
            (state, action, dispatch) => {
                if (state.focusedRowIdx > -1) {
                    this.handleSearchItemClick(
                        dispatch,
                        state,
                        state.currSearchResult[state.focusedRowIdx].id
                    );
                }
            }
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            (state, action) => {},
            (state, action, dispatch) => {
                dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(state)
                    }
                });
            }
        );

        this.addActionHandler(
            GlobalActions.CorpusSwitchModelRestore,
            (state, action) => {
                if (!action.error) {
                    const storedData:CorplistWidgetModelCorpusSwitchPreserve = action.payload.data[
                        this.getRegistrationId()];
                    const preserveOldCorpus = action.payload.widgetId !== this.widgetId;
                    this.deserialize(state, storedData, action.payload.corpora, preserveOldCorpus);
                }
                state.isBusyButton = false;
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetMoveFocusToNextListItem,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                const [colInc, rowInc] = action.payload.change;
                const [col, row] = state.activeListItem;
                if (col === null || row === null) {
                    state.activeListItem = [0, 0];

                } else {
                    const newCol = Math.abs((col + colInc) % 2);
                    const rotationLen = newCol === 0 ? state.dataFav.length : state.dataFeat.length;
                    state.activeListItem = tuple(
                        newCol,
                        colInc !== 0 ? 0 : (row + rowInc) >= 0 ? Math.abs(
                            (row + rowInc) % rotationLen) : rotationLen - 1
                    );
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.WidgetEnterOnActiveListItem,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyButton = true;
                state.isVisible = false;
            },
            (state, action, dispatch) => {
                if (state.activeListItem[0] === 0) {
                    this.handleFavItemClick(
                        dispatch, state, state.dataFav[state.activeListItem[1]].id
                    );


                } else {
                    this.handleFeatItemClick(
                        dispatch, state, state.dataFeat[state.activeListItem[1]].id
                    );
                }
            }
        );

        this.addActionSubtypeHandler(
            CorparchActions.SecondaryCorpusChange,
            action => action.payload.widgetId === this.widgetId,
            (state, action) => {
                state.isBusyButton = false;
                if (!action.error) {
                    state.corpusIdent = action.payload.corpusIdent;
                    state.availableSubcorpora = action.payload.availableSubcorpora;
                    state.currFavitemId = findCurrFavitemId(
                        state.dataFav,
                        this.getFullCorpusSelection(state),
                    );
                }
            }
        );

    }

    getRegistrationId():string {
        return `default-corparch-widget-${this.widgetId}`;
    }

    serialize(state:CorplistWidgetModelState):CorplistWidgetModelCorpusSwitchPreserve {
        return {
            corpusIdent: state.corpusIdent,
            currFavitemId: state.currFavitemId,
            alignedCorpora: state.alignedCorpora,
            availableSubcorpora: state.availableSubcorpora,
            dataFav: [...state.dataFav],
        };
    }

    deserialize(
        state:CorplistWidgetModelState,
        data:CorplistWidgetModelCorpusSwitchPreserve,
        corpora:Array<[string, string]>,
        preserveOldCorpus:boolean,
    ):void {
        if (data) {
            state.dataFav = data.dataFav.filter(v => v.trashTTL === null);
            if (preserveOldCorpus) {
                state.corpusIdent = data.corpusIdent;
                state.currFavitemId = data.currFavitemId;
                state.alignedCorpora = data.alignedCorpora;
                state.availableSubcorpora = data.availableSubcorpora;

            } else {
                state.currFavitemId = findCurrFavitemId(
                    state.dataFav,
                    this.getFullCorpusSelection(state),
                );
                state.alignedCorpora = pipe(
                    corpora,
                    List.tail(),
                    List.map(([,newCorp]) => newCorp),
                );
            }
        }
    }

    /**
     * According to the state of the current query form, this method creates
     * a new CorplistItem instance with proper type, id, etc.
     */
    getFullCorpusSelection(state:CorplistWidgetModelState):common.GeneratedFavListItem {
        return {
            subcorpus_id: state.corpusIdent.usesubcorp,
            subcorpus_name: state.corpusIdent.subcName,
            corpora: [state.corpusIdent.id, ...state.alignedCorpora]
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
                );
            }),
            map(_ => true)
        );
    }

    /**
     * Returns newly created item
     * as a result of "rescue" operation or null if the item is lost.
     */
    private removeItemFromTrash(state:CorplistWidgetModelState,
            itemId:string, widgetId:string):Observable<SetFavItemResponse|null> {

        if (this.trashTimerSubsc && state.dataFav.find(x => x.trashTTL !== null) === undefined) {
            this.trashTimerSubsc.unsubscribe();
        }
        const trashedItem = state.dataFav.find(x => x.id === itemId);
        if (trashedItem && widgetId === this.widgetId) {
            return this.pluginApi.ajax$<SetFavItemResponse>(
                HTTP.Method.POST,
                this.pluginApi.createActionUrl('user/set_favorite_item'),
                {
                    corpora: List.map(v => v.id, trashedItem.corpora),
                    subcorpus_id: trashedItem.subcorpus_id,
                    subcorpus_name: trashedItem.subcorpus_name,
                }
            );

        } else {
            return rxOf(null);
        }
    }

    private moveItemToTrash(state:CorplistWidgetModelState, itemId:string):void {
        const idx = state.dataFav.findIndex(x => x.id === itemId);
        if (idx > -1) {
            state.dataFav[idx] = {
                ...state.dataFav[idx],
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
            List.map(
                item => ({
                    ...item,
                    trashTTL: item.trashTTL !== null ? item.trashTTL -= 1 : null
                })
            ),
            List.filter(item => item.trashTTL > 0 || item.trashTTL === null)
        );
    }

    private shouldStartSearch(state:CorplistWidgetModelState):boolean {
        return (state.currSearchPhrase.length >=
                CorplistWidgetModel.MIN_SEARCH_PHRASE_ACTIVATION_LENGTH) ||
            state.availSearchKeywords.find(x => x.selected) !== undefined;
    }

    private searchDelayed(state:CorplistWidgetModelState):Observable<Array<SearchResultRow>> {
        if (this.inputThrottleTimer) {
            window.clearTimeout(this.inputThrottleTimer);
        }
        if (this.shouldStartSearch(state)) {
            return new Observable<Array<SearchResultRow>>(observer => {
                this.inputThrottleTimer = window.setTimeout(() => { // TODO - antipattern here
                    this.searchEngine.search(
                        state.currSearchPhrase,
                        state.availSearchKeywords

                    ).subscribe({
                        next: data => {
                            observer.next(data);
                            observer.complete();
                        },
                        error: error => {
                            observer.error(error);
                        }
                    });
                }, 350);
            });

        } else {
            return rxOf([]);
        }
    }

    private handleFavItemClick(dispatch:SEDispatcher, state:CorplistWidgetModelState, itemId:string):void {
        const item = state.dataFav.find(item => item.id === itemId);
        if (item !== undefined) {
            const corpora = List.map(x => x.id, item.corpora);
            this.onItemClick(corpora, item.subcorpus_id);

        } else {
            throw new Error(`Favorite item ${itemId} not found`);
        }
    }

    private handleFeatItemClick(dispatch:SEDispatcher, state:CorplistWidgetModelState, itemId:string):void {
        const item = state.dataFeat.find(item => item.id === itemId);
        if (item !== undefined) {
            this.onItemClick([item.corpus_id], item.subcorpus_id);

        } else {
            throw new Error(`Featured item ${itemId} not found`);
        }
    }

    private handleSearchItemClick(dispatch:SEDispatcher, state:CorplistWidgetModelState, itemId:string):void {
        const item = state.currSearchResult.find(item => item.id === itemId);
        if (item !== undefined) {
            this.onItemClick([item.id], '');

        } else {
            throw new Error(`Clicked item ${itemId} not found in search results`);
        }
    }

    private reloadItems(editAction:Observable<Kontext.AjaxResponse>,
            message:string|null):Observable<FavitemsList> {
        return editAction.pipe(
            tap(
                () => {
                    if (message !== null) {
                        this.pluginApi.showMessage('info', message);
                    }
                }
            ),
            concatMap(
                (_) => this.pluginApi.ajax$<Array<common.CorplistItem>>(
                    HTTP.Method.GET,
                    this.pluginApi.createActionUrl('user/get_favorite_corpora'),
                    {}
                )
            )
        );
    }

    private setFavItem(state:CorplistWidgetModelState,
            showMessage:boolean=true):Observable<FavitemsList> {
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
        state.availSearchKeywords = List.map(
            item => ({...item, selected: false}),
            state.availSearchKeywords
        );
    }

    private setKeywordSelectedStatus(state:CorplistWidgetModelState, id:string, status:boolean,
                exclusive:boolean):void {
        if (exclusive) {
            this.resetKeywordSelectStatus(state);
        }
        const idx = List.findIndex(x => x.id === id, state.availSearchKeywords);
        if (idx > -1) {
            const v = state.availSearchKeywords[idx];
            state.availSearchKeywords[idx] = {...state.availSearchKeywords[idx], selected: status};

        } else {
            throw new Error(`Cannot change label status - label ${id} not found`);
        }
    }

}
