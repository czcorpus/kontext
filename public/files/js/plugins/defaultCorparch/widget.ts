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

import { IActionDispatcher, StatelessModel } from 'kombo';
import { Subscription, timer as rxTimer, Observable, of as rxOf } from 'rxjs';
import { take, tap, map, concatMap } from 'rxjs/operators';
import { List, tuple, HTTP, pipe } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as common from './common';
import * as PluginInterfaces from '../../types/plugins';
import { SearchEngine, SearchKeyword, SearchResultRow} from './search';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../../models/common/actions';
import { Actions as QueryActions } from '../../models/query/actions';
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
    corpora:Array<{id: string, name: string}>;
    subcorpus_id:string;
}


const importServerFavitem = (item:common.ServerFavlistItem):FavListItem => {
    return {
        id: item.id,
        name: item.name,
        subcorpus_id: item.subcorpus_id,
        subcorpus_orig_id: item.subcorpus_orig_id,
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
    const srch = dataFav.filter(x => x.trashTTL === null).find(x => {
            return normalize(x.subcorpus_id) === normalize(item.subcorpus_id) &&
                item.corpora.join('') === x.corpora.map(x => x.id).join('');
    });
    return srch ? srch.id : undefined;
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
    availableSubcorpora:Array<Kontext.SubcorpListItem>;
    focusedRowIdx:number;
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

export interface CorplistWidgetModelCorpusSwitchPreserve {
    dataFav:Array<FavListItem>;
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
        const currCorp = pluginApi.getCorpusIdent();
        super(dispatcher, {
            isVisible: false,
            activeTab: 0,
            activeListItem: tuple(null, null),
            corpusIdent,
            alignedCorpora: [...(pluginApi.getConf<Array<string>>('alignedCorpora') || [])],
            anonymousUser,
            dataFav: dataFavImp,
            dataFeat: [...dataFeat],
            isBusy: false,
            currFavitemId: findCurrFavitemId(
                dataFavImp,
                {
                    subcorpus_id: currCorp.usesubcorp,
                    subcorpus_orig_id: currCorp.origSubcorpName,
                    corpora: [...(pluginApi.getConf<Array<string>>('alignedCorpora') || []),
                            currCorp.id]
                }
            ),
            isWaitingForSearchResults: false,
            currSearchPhrase: '',
            currSearchResult: [],
            availSearchKeywords: List.map(
                item => ({id: item[0], label: item[1], color: item[2], selected:false}),
                corporaLabels
            ),
            availableSubcorpora: pluginApi.getConf<
                Array<Kontext.SubcorpListItem>>('SubcorpList') || [],
            focusedRowIdx: -1
        });
        this.pluginApi = pluginApi;
        this.searchEngine = searchEngine;
        this.onItemClick = onItemClick;
        this.inputThrottleTimer = null;

        this.addActionHandler<typeof Actions.WidgetShow>(
            Actions.WidgetShow.name,
            (state, action) => {
                state.isVisible = true;
            }
        );

        this.addActionHandler<typeof Actions.WidgetHide>(
            Actions.WidgetHide.name,
            (state, action) => {
                state.activeTab = 0;
                state.isVisible = false;
            }
        );

        this.addActionHandler<typeof Actions.SetActiveTab>(
            Actions.SetActiveTab.name,
            (state, action) => {
                state.activeTab = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.FavItemClick>(
            Actions.FavItemClick.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                dispatch<typeof Actions.FavItemClickDone>({
                    name: Actions.FavItemClickDone.name
                });
                this.handleFavItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<typeof Actions.FavItemClickDone>(
            Actions.FavItemClickDone.name,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.FeatItemClick>(
            Actions.FeatItemClick.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                dispatch<typeof Actions.FeatItemClickDone>({
                    name: Actions.FeatItemClickDone.name
                });
                this.handleFeatItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<typeof Actions.FeatItemClickDone>(
            Actions.FeatItemClickDone.name,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.SearchResultItemClicked>(
            Actions.SearchResultItemClicked.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                dispatch<typeof Actions.SearchResultItemClickedDone>({
                    name: Actions.SearchResultItemClickedDone.name
                });
                this.handleSearchItemClick(state, action.payload.itemId);
            }
        );

        this.addActionHandler<typeof Actions.SearchResultItemClickedDone>(
            Actions.SearchResultItemClickedDone.name,
            (state, action) => {
                state.focusedRowIdx = -1;
                state.isBusy = false;
            }
        );

        this.addActionHandler<typeof Actions.FavItemAdd>(
            Actions.FavItemAdd.name,
            (state, action) => {
                state.isBusy = true;
                const idx = List.findIndex(x => x.id === action.payload.itemId, state.dataFav);
                if (idx > -1) {
                    state.dataFav[idx] = {...state.dataFav[idx], trashTTL: null};
                }
            },
            (state, action, dispatch) => {
                this.removeItemFromTrash(state, action.payload.itemId).subscribe(
                    (response) => {
                        dispatch<typeof Actions.FavItemAddDone>({
                            name: Actions.FavItemAddDone.name,
                            payload: {
                                trashedItemId: action.payload.itemId,
                                rescuedItem: {
                                    id: response.id, // might be regenerated
                                    name: response.name,
                                    subcorpus_id: response.subcorpus_id,
                                    // TODO !!! missing orig subc name
                                    subcorpus_orig_id: response.subcorpus_id,
                                    size: response.size,
                                    size_info: response.size_info,
                                    // TODO missing name
                                    corpora: response.corpora,
                                    description: '---' // TODO !!! missing desc.
                                }
                            }
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<typeof Actions.FavItemAddDone>({
                            name: Actions.FavItemAddDone.name,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.FavItemAddDone>(
            Actions.FavItemAddDone.name,
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
                        delete state.dataFav[idx];
                    }
                    state.currFavitemId = findCurrFavitemId(
                        state.dataFav,
                        this.getFullCorpusSelection(state)
                    );
                    this.pluginApi.showMessage(
                        'info',
                        this.pluginApi.translate('defaultCorparch__item_added_to_fav')
                    );
                }
            }
        );

        this.addActionHandler<typeof Actions.FavItemRemove>(
            Actions.FavItemRemove.name,
            (state, action) => {
                this.moveItemToTrash(state, action.payload.itemId);
            },
            (state, action, dispatch) => {
                this.removeFavItemFromServer(action.payload.itemId).subscribe(
                    (favItem) => {
                        const src = rxTimer(0, 1000).pipe(
                            take(CorplistWidgetModel.TRASH_TTL_TICKS));
                        if (this.trashTimerSubsc) {
                            this.trashTimerSubsc.unsubscribe();
                        }
                        this.trashTimerSubsc = src.subscribe(
                            () => {
                                dispatch<typeof Actions.CheckTrashedItems>({
                                    name: Actions.CheckTrashedItems.name
                                });
                            },
                            (_) => undefined,
                            () => {
                                dispatch<typeof Actions.CheckTrashedItems>({
                                    name: Actions.CheckTrashedItems.name
                                });
                            }
                        );
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.FavItemRemoveDone>(
            Actions.FavItemRemoveDone.name,
            (state, action) => {
                if (!action.error) {
                    const idx = List.findIndex(v => v.id === action.payload.itemId, state.dataFav);
                    if (idx > -1) {
                        delete state.dataFav[idx];
                    }
                }
            }
        );

        this.addActionHandler<typeof Actions.CheckTrashedItems>(
            Actions.CheckTrashedItems.name,
            (state, action) => {
                this.checkTrashedItems(state);
            }
        );

        this.addActionHandler<typeof Actions.StarIconClick>(
            Actions.StarIconClick.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                (action.payload.status ?
                    this.setFavItem(state) :
                    this.unsetFavItem(action.payload.itemId)
                ).subscribe(
                    (data) => {
                        dispatch<typeof Actions.StarIconClickDone>({
                            name: Actions.StarIconClickDone.name,
                            payload: {data}
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<typeof Actions.StarIconClickDone>({
                            name: Actions.StarIconClickDone.name,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<typeof Actions.StarIconClickDone>(
            Actions.StarIconClickDone.name,
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
                state.currSearchResult = []
                state.focusedRowIdx = -1;
            },
            (state, action, dispatch) => {
                this.searchDelayed(state).subscribe(
                    (data) => {
                        dispatch<typeof Actions.SearchDone>({
                            name: Actions.SearchDone.name,
                            payload: {data}
                        });
                    },
                    (err) => {
                        dispatch<typeof Actions.SearchDone>({
                            name: Actions.SearchDone.name,
                            error: err
                        });
                        this.pluginApi.showMessage('error', err);
                    }
                );
            }
        ).sideEffectAlsoOn(
            Actions.KeywordResetClicked.name,
            Actions.SearchInputChanged.name,
            Actions.KeywordClicked.name
        )

        this.addActionHandler<typeof Actions.KeywordClicked>(
            Actions.KeywordClicked.name,
            (state, action) => {
                state.isBusy = true;
                state.focusedRowIdx = -1;
                this.setKeywordSelectedStatus(
                    state,
                    action.payload.keywordId,
                    action.payload.status,
                    !action.payload.attachToCurrent
                );
            }
        );

        this.addActionHandler<typeof Actions.SearchDone>(
            Actions.SearchDone.name,
            (state, action) => {
                state.isBusy = false;
                state.focusedRowIdx = -1;
                if (!action.error && action.payload.data !== null) {
                    state.currSearchResult = action.payload.data;
                }
            }
        );

        this.addActionHandler<typeof Actions.SearchInputChanged>(
            Actions.SearchInputChanged.name,
            (state, action) => {
                state.currSearchPhrase = action.payload.value;
                state.currSearchResult = [];
                state.focusedRowIdx = -1;
            }
        );

        this.addActionHandler<typeof Actions.FocusSearchRow>(
            Actions.FocusSearchRow.name,
            (state, action) => {
                if (state.currSearchResult.length > 0) {
                    const inc = action.payload.inc;
                    state.focusedRowIdx = Math.abs(
                        (state.focusedRowIdx + inc) % state.currSearchResult.length);
                }
            }
        );

        this.addActionHandler<typeof Actions.FocusedItemSelect>(
            Actions.FocusedItemSelect.name,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                if (state.focusedRowIdx > -1) {
                    dispatch<typeof Actions.SearchResultItemClickedDone>({
                        name: Actions.SearchResultItemClickedDone.name
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
                    state.corpusIdent = {
                        ...state.corpusIdent,
                        usesubcorp: action.payload.pubName,
                        origSubcorpName: action.payload.subcorp
                    };

                } else {
                    state.corpusIdent = {
                        ...state.corpusIdent,
                        usesubcorp: action.payload.subcorp,
                        origSubcorpName: action.payload.subcorp
                    };
                }
                state.currFavitemId = findCurrFavitemId(
                    state.dataFav,
                    this.getFullCorpusSelection(state)
                );
            }
        );

        this.addActionHandler<typeof GlobalActions.SwitchCorpus>(
            GlobalActions.SwitchCorpus.name,
            null,
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

        this.addActionHandler<typeof GlobalActions.CorpusSwitchModelRestore>(
            GlobalActions.CorpusSwitchModelRestore.name,
            (state, action) => {
                if (!action.error) {
                    const storedData:CorplistWidgetModelCorpusSwitchPreserve = action.payload.data[
                        this.getRegistrationId()];
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

        this.addActionHandler<typeof Actions.MoveFocusToNextListItem>(
            Actions.MoveFocusToNextListItem.name,
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

        this.addActionHandler<typeof Actions.EnterOnActiveListItem>(
            Actions.EnterOnActiveListItem.name,
            (state, action) => {
                state.isBusy = false;
            },
            (state, action, dispatch) => {
                if (state.activeListItem[0] === 0) {
                    dispatch<typeof Actions.FavItemClickDone>({
                        name: Actions.FavItemClickDone.name
                    });
                    this.handleFavItemClick(
                        state, state.dataFav[state.activeListItem[1]].id
                    );


                } else {
                    dispatch<typeof Actions.FeatItemClickDone>({
                        name: Actions.FeatItemClickDone.name
                    });
                    this.handleFeatItemClick(
                        state, state.dataFeat[state.activeListItem[1]].id
                    );
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

    getRegistrationId():string {
        return 'default-corparch-widget';
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
            itemId:string):Observable<SetFavItemResponse|null> {

        if (this.trashTimerSubsc && state.dataFav.find(x => x.trashTTL !== null) === undefined) {
            this.trashTimerSubsc.unsubscribe();
        }
        const trashedItem = state.dataFav.find(x => x.id === itemId);
        if (trashedItem) {
            return this.pluginApi.ajax$<SetFavItemResponse>(
                HTTP.Method.POST,
                this.pluginApi.createActionUrl('user/set_favorite_item'),
                {
                    corpora: List.map(v => v.id, trashedItem.corpora),
                    subcorpus_id: trashedItem.subcorpus_id,
                    subcorpus_orig_id: trashedItem.subcorpus_orig_id,
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
            });

        } else {
            return rxOf([]);
        }
    }

    private handleFavItemClick(state:CorplistWidgetModelState, itemId:string):void {
        const item = state.dataFav.find(item => item.id === itemId);
        if (item !== undefined) {
            this.onItemClick(item.corpora.map(x => x.id), item.subcorpus_id);

        } else {
            throw new Error(`Favorite item ${itemId} not found`);
        }
    }

    private handleFeatItemClick(state:CorplistWidgetModelState, itemId:string):void {
        const item = state.dataFeat.find(item => item.id === itemId);
        if (item !== undefined) {
            this.onItemClick([item.corpus_id], item.subcorpus_id);

        } else {
            throw new Error(`Featured item ${itemId} not found`);
        }
    }

    private handleSearchItemClick(state:CorplistWidgetModelState, itemId:string):void {
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
