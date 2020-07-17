/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import { Action } from 'kombo';
import { CorplistDataResponse, Filters } from './corplist';
import { CorpusInfo } from '../../models/common/layout';
import { ServerFavlistItem } from './common';
import { SearchResultRow } from './search';


export enum ActionName {
    LoadDataDone = 'LOAD_DATA_DONE',
    LoadExpansionDataDone = 'LOAD_EXPANSION_DATA_DONE',
    KeywordClicked = 'KEYWORD_CLICKED',
    KeywordResetClicked = 'KEYWORD_RESET_CLICKED',
    ExpansionClicked = 'EXPANSION_CLICKED',
    FilterChanged = 'FILTER_CHANGED',
    ListStarClicked = 'LIST_STAR_CLICKED',
    ListStarClickedDone = 'LIST_STAR_CLICKED_DONE',
    CorpusInfoRequired = 'CORPARCH_CORPUS_INFO_REQUIRED',
    CorpusInfoLoaded = 'CORPARCH_CORPUS_INFO_LOADED',
    CorpusInfoClosed = 'CORPARCH_CORPUS_INFO_CLOSED',
    WidgetShow = 'DEFAULT_CORPARCH_WIDGET_SHOW',
    WidgetHide = 'DEFAULT_CORPARCH_WIDGET_HIDE',
    WidgetSetActiveTab = 'DEFAULT_CORPARCH_SET_ACTIVE_TAB',
    WidgetUpdateList = 'DEFAULT_CORPARCH_UPDATE_LIST',
    WidgetFavItemClick = 'DEFAULT_CORPARCH_FAV_ITEM_CLICK',
    WidgetFavItemClickDone = 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE',
    WidgetFeatItemClick = 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK',
    WidgetFeatItemClickDone = 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE',
    WidgetSearchResultClick = 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED',
    WidgetSearchResultClickDone = 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE',
    WidgetFavItemAdd = 'DEFAULT_CORPARCH_FAV_ITEM_ADD',
    WidgetFavItemAddDone = 'DEFAULT_CORPARCH_FAV_ITEM_ADD_DONE',
    WidgetFavItemRemove = 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE',
    WidgetFavItemRemoveDone = 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE_DONE',
    WidgetCheckTrashedItems = 'DEFAULT_CORPARCH_CHECK_TRASHED_ITEMS',
    WidgetStarIconClick = 'DEFAULT_CORPARCH_STAR_ICON_CLICK',
    WidgetStarIconClickDone = 'DEFAULT_CORPARCH_STAR_ICON_CLICK_DONE',
    WidgetKeywordResetClick = 'DEFAULT_CORPARCH_KEYWORD_RESET_CLICKED',
    WidgetKeywordClick = 'LINDAT_CORPARCH_KEYWORD_CLICKED',
    WidgetSearchDone = 'DEFAULT_CORPARCH_SEARCH_DONE',
    WidgetSearchInputChanged = 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED',
    WidgetFocusSearchRow = 'DEFAULT_CORPARCH_FOCUS_SEARCH_ROW',
    WidgetFocusedItemSelect = 'DEFAULT_CORPARCH_FOCUSED_ITEM_SELECT',
    WidgetMoveFocusToNextItem = 'DEFAULT_CORPARCH_MOVE_FOCUS_TO_NEXT_LISTITEM',
    WidgetEnterOnActiveItem = 'DEFAULT_CORPARCH_ENTER_ON_ACTIVE_LISTITEM',
}


export namespace Actions {

    export interface LoadDataDone extends Action<{
        data:CorplistDataResponse;
    }> {
        name:ActionName.LoadDataDone;
    }

    export interface LoadExpansionDataDone extends Action<{
        data:CorplistDataResponse;
    }> {
        name:ActionName.LoadExpansionDataDone;
    }

    export interface KeywordClicked extends Action<{
        ctrlKey:boolean;
        keyword:string;
        status:boolean;
    }> {
        name:ActionName.KeywordClicked;
    }

    export interface KeywordResetClicked extends Action<{
    }> {
        name:ActionName.KeywordResetClicked;
    }

    export interface ExpansionClicked extends Action<{
        offset:number;
    }> {
        name:ActionName.ExpansionClicked;
    }

    export interface FilterChanged extends Action<Filters> {
        name:ActionName.FilterChanged;
    }

    export interface ListStarClicked extends Action<{
        corpusId:string;
        favId:string;
    }> {
        name:ActionName.ListStarClicked;
    }

    export interface ListStarClickedDone extends Action<{
        message:string;
    }> {
        name:ActionName.ListStarClickedDone;
    }

    export interface CorpusInfoRequired extends Action<{
        corpusId:string;
    }> {
        name:ActionName.CorpusInfoRequired;
    }

    export interface CorpusInfoLoaded extends Action<CorpusInfo> {
        name:ActionName.CorpusInfoLoaded;
    }

    export interface CorpusInfoClosed extends Action<{
    }> {
        name:ActionName.CorpusInfoClosed;
    }

    export interface LoadDataDone extends Action<{
        data:CorplistDataResponse;
    }> {
        name:ActionName.LoadDataDone;
    }

    export interface WidgetShow extends Action<{
    }> {
        name:ActionName.WidgetShow;
    }

    export interface WidgetHide extends Action<{
    }> {
        name:ActionName.WidgetHide;
    }

    export interface WidgetSetActiveTab extends Action<{
        value:number;
    }> {
        name:ActionName.WidgetSetActiveTab;
    }

    export interface WidgetUpdateList extends Action<{
        data:Array<ServerFavlistItem>;
    }> {
        name:ActionName.WidgetUpdateList;
    }

    export interface WidgetFavItemClick extends Action<{
        itemId:string;
    }> {
        name:ActionName.WidgetFavItemClick;
    }

    export interface WidgetFavItemClickDone extends Action<{
    }> {
        name:ActionName.WidgetFavItemClickDone;
    }

    export interface WidgetFeatItemClick extends Action<{
        itemId:string;
    }> {
        name:ActionName.WidgetFeatItemClick;
    }

    export interface WidgetFeatItemClickDone extends Action<{
    }> {
        name:ActionName.WidgetFeatItemClickDone;
    }

    export interface WidgetSearchResultClick extends Action<{
        itemId:string;
    }> {
        name:ActionName.WidgetSearchResultClick;
    }

    export interface WidgetSearchResultClickDone extends Action<{
    }> {
        name:ActionName.WidgetSearchResultClickDone;
    }

    export interface WidgetFavItemAdd extends Action<{
        itemId:string;
    }> {
        name:ActionName.WidgetFavItemAdd;
    }

    export interface WidgetFavItemAddDone extends Action<{
        trashedItemId:string;
        rescuedItem:ServerFavlistItem
    }> {
        name:ActionName.WidgetFavItemAddDone;
    }

    export interface WidgetFavItemRemove extends Action<{
        itemId:string;
    }> {
        name:ActionName.WidgetFavItemRemove;
    }

    export interface WidgetFavItemRemoveDone extends Action<{
        itemId:string;
    }> {
        name:ActionName.WidgetFavItemRemoveDone;
    }

    export interface WidgetCheckTrashedItems extends Action<{
    }> {
        name:ActionName.WidgetCheckTrashedItems;
    }

    export interface WidgetStarIconClick extends Action<{
        status:boolean;
        itemId:string
    }> {
        name:ActionName.WidgetStarIconClick;
    }

    export interface WidgetStarIconClickDone extends Action<{
        data:Array<ServerFavlistItem>;
    }> {
        name:ActionName.WidgetStarIconClickDone;
    }

    export interface WidgetKeywordResetClick extends Action<{
    }> {
        name:ActionName.WidgetKeywordResetClick;
    }

    export interface WidgetKeywordClick extends Action<{
        keywordId:string;
        status:boolean;
        exclusive:boolean;
    }> {
        name:ActionName.WidgetKeywordClick;
    }

    export interface WidgetSearchDone extends Action<{
        data:Array<SearchResultRow>;
    }> {
        name:ActionName.WidgetSearchDone;
    }

    export interface WidgetSearchInputChanged extends Action<{
        value:string;
    }> {
        name:ActionName.WidgetSearchInputChanged;
    }

    export interface WidgetFocusSearchRow extends Action<{
        inc:number;
    }> {
        name:ActionName.WidgetFocusSearchRow;
    }

    export interface WidgetFocusedItemSelect extends Action<{
    }> {
        name:ActionName.WidgetFocusedItemSelect;
    }

    export interface WidgetMoveFocusToNextItem extends Action<{
        change:[number, number];
    }> {
        name:ActionName.WidgetMoveFocusToNextItem;
    }

    export interface WidgetEnterOnActiveItem extends Action<{
    }> {
        name:ActionName.WidgetEnterOnActiveItem;
    }
}