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


export class Actions {

    static LoadDataDone:Action<{
        data:CorplistDataResponse;
    }> = {
        name: 'LOAD_DATA_DONE'
    };

    static LoadExpansionDataDone:Action<{
        data:CorplistDataResponse;
    }> = {
        name: 'LOAD_EXPANSION_DATA_DONE'
    };

    static KeywordClicked:Action<{
        ctrlKey:boolean;
        keyword:string;
        status:boolean;
    }> = {
        name: 'KEYWORD_CLICKED'
    };

    static KeywordResetClicked:Action<{
    }> = {
        name: 'KEYWORD_RESET_CLICKED'
    };

    static ExpansionClicked:Action<{
        offset:number;
    }> = {
        name: 'EXPANSION_CLICKED'
    };

    static FilterChanged:Action<Filters> = {
        name: 'FILTER_CHANGED'
    };

    static ListStarClicked:Action<{
        corpusId:string;
        favId:string;
    }> = {
        name: 'LIST_STAR_CLICKED'
    };

    static ListStarClickedDone:Action<{
        corpusId:string;
        newId:string|null;
        action:'add'|'remove';
    }> = {
        name: 'LIST_STAR_CLICKED_DONE'
    };

    static CorpusInfoRequired:Action<{
        corpusId:string;
    }> = {
        name: 'CORPARCH_CORPUS_INFO_REQUIRED'
    };

    static CorpusInfoLoaded:Action<CorpusInfo> = {
        name: 'CORPARCH_CORPUS_INFO_LOADED'
    };

    static CorpusInfoClosed:Action<{
    }> = {
        name: 'CORPARCH_CORPUS_INFO_CLOSED'
    };

    static WidgetShow:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SHOW'
    };

    static WidgetHide:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_HIDE'
    };

    static WidgetSetActiveTab:Action<{
        value:number;
    }> = {
        name: 'DEFAULT_CORPARCH_SET_ACTIVE_TAB'
    };

    static WidgetUpdateList:Action<{
        data:Array<ServerFavlistItem>;
    }> = {
        name: 'DEFAULT_CORPARCH_UPDATE_LIST'
    };

    static WidgetFavItemClick:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK'
    };

    static WidgetFavItemClickDone:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE'
    };

    static WidgetFeatItemClick:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK'
    };

    static WidgetFeatItemClickDone:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE'
    };

    static WidgetSearchResultClick:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED'
    };

    static WidgetSearchResultClickDone:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE'
    };

    static WidgetFavItemAdd:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_ADD'
    };

    static WidgetFavItemAddDone:Action<{
        trashedItemId:string;
        rescuedItem:ServerFavlistItem
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_ADD_DONE'
    };

    static WidgetFavItemRemove:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE'
    };

    static WidgetFavItemRemoveDone:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE_DONE'
    };

    static WidgetCheckTrashedItems:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_CHECK_TRASHED_ITEMS'
    };

    static WidgetStarIconClick:Action<{
        status:boolean;
        itemId:string
    }> = {
        name: 'DEFAULT_CORPARCH_STAR_ICON_CLICK'
    };

    static WidgetStarIconClickDone:Action<{
        data:Array<ServerFavlistItem>;
    }> = {
        name: 'DEFAULT_CORPARCH_STAR_ICON_CLICK_DONE'
    };

    static WidgetKeywordResetClick:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_KEYWORD_RESET_CLICKED'
    };

    static WidgetKeywordClick:Action<{
        keywordId:string;
        status:boolean;
        exclusive:boolean;
    }> = {
        name: 'LINDAT_CORPARCH_KEYWORD_CLICKED'
    };

    static WidgetSearchDone:Action<{
        data:Array<SearchResultRow>;
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_DONE'
    };

    static WidgetSearchInputChanged:Action<{
        value:string;
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED'
    };

    static WidgetFocusSearchRow:Action<{
        inc:number;
    }> = {
        name: 'DEFAULT_CORPARCH_FOCUS_SEARCH_ROW'
    };

    static WidgetFocusedItemSelect:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_FOCUSED_ITEM_SELECT'
    };

    static WidgetMoveFocusToNextItem:Action<{
        change:[number, number];
    }> = {
        name: 'DEFAULT_CORPARCH_MOVE_FOCUS_TO_NEXT_LISTITEM'
    };

    static WidgetEnterOnActiveItem:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_ENTER_ON_ACTIVE_LISTITEM'
    };
}