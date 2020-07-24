/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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
import { CorplistDataResponse, Filters, ServerFavlistItem } from './common';
import { CorpusInfo } from '../../models/common/layout';
import { SearchResultRow } from './search';


export enum ActionName {
    LoadDataDone = 'CORPARCH_LOAD_DATA_DONE',
    LoadExpansionDataDone = 'CORPARCH_LOAD_EXPANSION_DATA_DONE',
    KeywordClicked = 'CORPARCH_KEYWORD_CLICKED',
    KeywordResetClicked = 'CORPARCH_KEYWORD_RESET_CLICKED',
    ExpansionClicked = 'CORPARCH_EXPANSION_CLICKED',
    FilterChanged = 'CORPARCH_FILTER_CHANGED',
    ListStarClicked = 'CORPARCH_LIST_STAR_CLICKED',
    ListStarClickedDone = 'CORPARCH_LIST_STAR_CLICKED_DONE',
    CorpusInfoRequired = 'CORPARCH_CORPUS_INFO_REQUIRED',
    CorpusInfoLoaded = 'CORPARCH_CORPUS_INFO_LOADED',
    CorpusInfoClosed = 'CORPARCH_CORPUS_INFO_CLOSED',
    WidgetShow = 'DEFAULT_CORPARCH_WIDGET_SHOW',
    WidgetHide = 'DEFAULT_CORPARCH_WIDGET_HIDE',
    SetActiveTab = 'DEFAULT_CORPARCH_SET_ACTIVE_TAB',
    FavItemClick = 'DEFAULT_CORPARCH_FAV_ITEM_CLICK',
    FavItemClickDone = 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE',
    FeatItemClick = 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK',
    FeatItemClickDone = 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE',
    StarIconClick = 'DEFAULT_CORPARCH_STAR_ICON_CLICK',
    StarIconClickDone = 'DEFAULT_CORPARCH_STAR_ICON_CLICK_DONE',
    MoveFocusToNextListItem = 'DEFAULT_CORPARCH_MOVE_FOCUS_TO_NEXT_LISTITEM',
    EnterOnActiveListItem = 'DEFAULT_CORPARCH_ENTER_ON_ACTIVE_LISTITEM',
    SearchInputChanged = 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED',
    FocusSearchRow = 'DEFAULT_CORPARCH_FOCUS_SEARCH_ROW',
    FocusedItemSelect = 'DEFAULT_CORPARCH_FOCUSED_ITEM_SELECT',
    SearchResultItemClicked = 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED',
    SearchResultItemClickedDone = 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE',
    FavItemRemove = 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE',
    FavItemRemoveDone = 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE_DONE',
    FavItemAdd = 'DEFAULT_CORPARCH_FAV_ITEM_ADD',
    FavItemAddDone = 'DEFAULT_CORPARCH_FAV_ITEM_ADD_DONE',
    CheckTrashedItems = 'DEFAULT_CORPARCH_CHECK_TRASHED_ITEMS',
    SearchDone = 'DEFAULT_CORPARCH_SEARCH_DONE'
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
        keywordId:string;
        status:boolean;
        attachToCurrent:boolean;
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

    export interface FilterChanged extends Action<{
        corpusName?:string;
    } & Filters> {
        name:ActionName.FilterChanged;
    }

    export interface ListStarClicked extends Action<{
        corpusId:string;
        favId:string|null;
    }> {
        name:ActionName.ListStarClicked;
    }

    export interface ListStarClickedDone extends Action<{
        corpusId:string;
        newId:string|null;
        action:'add'|'remove';
    }> {
        name:ActionName.ListStarClickedDone;
    }

    export interface CorpusInfoRequired extends Action<{
        corpusId:string;
    }> {
        name:ActionName.CorpusInfoRequired;
    }

    export interface CorpusInfoLoaded extends Action<{
        data:CorpusInfo;
    }> {
        name:ActionName.CorpusInfoLoaded;
    }

    export interface CorpusInfoClosed extends Action<{
    }> {
        name:ActionName.CorpusInfoClosed;
    }

    export interface WidgetShow extends Action<{
    }> {
        name:ActionName.WidgetShow;
    }

    export interface WidgetHide extends Action<{
    }> {
        name:ActionName.WidgetHide;
    }

    export interface SetActiveTab extends Action<{
        value:number;
    }> {
        name:ActionName.SetActiveTab;
    }

    export interface FavItemClick extends Action<{
        itemId:string;
    }> {
        name:ActionName.FavItemClick;
    }

    export interface FavItemClickDone extends Action<{
    }> {
        name:ActionName.FavItemClickDone;
    }

    export interface FeatItemClick extends Action<{
        itemId:string;
    }> {
        name:ActionName.FeatItemClick;
    }

    export interface FeatItemClickDone extends Action<{
    }> {
        name:ActionName.FeatItemClickDone;
    }

    export interface StarIconClick extends Action<{
        itemId:string;
        status:boolean;
    }> {
        name:ActionName.StarIconClick;
    }

    export interface StarIconClickDone extends Action<{
        data:Array<ServerFavlistItem>;
    }> {
        name:ActionName.StarIconClickDone;
    }

    export interface MoveFocusToNextListItem extends Action<{
        change:Array<number>;
    }> {
        name:ActionName.MoveFocusToNextListItem;
    }

    export interface EnterOnActiveListItem extends Action<{

    }> {
        name:ActionName.EnterOnActiveListItem;
    }

    export interface SearchInputChanged extends Action<{
        value:string;
    }> {
        name:ActionName.SearchInputChanged;
    }

    export interface FocusSearchRow extends Action<{
        inc:number;
    }> {
        name:ActionName.FocusSearchRow;
    }

    export interface FocusedItemSelect extends Action<{

    }> {
        name:ActionName.FocusedItemSelect;
    }

    export interface SearchResultItemClicked extends Action<{
        itemId:string;
    }> {
        name:ActionName.SearchResultItemClicked;
    }

    export interface SearchResultItemClickedDone extends Action<{
        itemId:string;
    }> {
        name:ActionName.SearchResultItemClickedDone;
    }

    export interface FavItemRemove extends Action<{
        itemId:string;
    }> {
        name:ActionName.FavItemRemove;
    }

    export interface FavItemRemoveDone extends Action<{
        itemId:string;
    }> {
        name:ActionName.FavItemRemoveDone;
    }

    export interface FavItemAdd extends Action<{
        itemId:string;
    }> {
        name:ActionName.FavItemAdd;
    }

    export interface FavItemAddDone extends Action<{
        trashedItemId:string;
        rescuedItem:ServerFavlistItem;
    }> {
        name:ActionName.FavItemAddDone;
    }

    export interface CheckTrashedItems extends Action<{
    }> {
        name:ActionName.CheckTrashedItems;
    }

    export interface SearchDone extends Action<{
        data:Array<SearchResultRow>|null;
    }> {
        name:ActionName.SearchDone;
    }
}