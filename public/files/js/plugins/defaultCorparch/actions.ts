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


export class Actions {

    static LoadDataDone:Action<{
        data:CorplistDataResponse;
    }> = {
        name: 'CORPARCH_LOAD_DATA_DONE'
    };

    static LoadExpansionDataDone:Action<{
        data:CorplistDataResponse;
    }> = {
        name: 'CORPARCH_LOAD_EXPANSION_DATA_DONE'
    };

    static KeywordClicked:Action<{
        keywordId:string;
        status:boolean;
        attachToCurrent:boolean;
    }> = {
        name: 'CORPARCH_KEYWORD_CLICKED'
    };

    static KeywordResetClicked:Action<{
    }> = {
        name: 'CORPARCH_KEYWORD_RESET_CLICKED'
    };

    static ExpansionClicked:Action<{
        offset:number;
    }> = {
        name: 'CORPARCH_EXPANSION_CLICKED'
    };

    static FilterChanged:Action<{
        debounced?:boolean;
    } & Filters> = {
        name: 'CORPARCH_FILTER_CHANGED'
    };

    static ListStarClicked:Action<{
        corpusId:string;
        favId:string|null;
    }> = {
        name: 'CORPARCH_LIST_STAR_CLICKED'
    };

    static ListStarClickedDone:Action<{
        corpusId:string;
        newId:string|null;
        action:'add'|'remove';
    }> = {
        name: 'CORPARCH_LIST_STAR_CLICKED_DONE'
    };

    static CorpusInfoRequired:Action<{
        corpusId:string;
    }> = {
        name: 'CORPARCH_CORPUS_INFO_REQUIRED'
    };

    static CorpusInfoLoaded:Action<{
        data:CorpusInfo;
    }> = {
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

    static SetActiveTab:Action<{
        value:number;
    }> = {
        name: 'DEFAULT_CORPARCH_SET_ACTIVE_TAB'
    };

    static FavItemClick:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK'
    };

    static FavItemClickDone:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_CLICK_DONE'
    };

    static FeatItemClick:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK'
    };

    static FeatItemClickDone:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_FEAT_ITEM_CLICK_DONE'
    };

    static StarIconClick:Action<{
        itemId:string;
        status:boolean;
    }> = {
        name: 'DEFAULT_CORPARCH_STAR_ICON_CLICK'
    };

    static StarIconClickDone:Action<{
        data:Array<ServerFavlistItem>;
    }> = {
        name: 'DEFAULT_CORPARCH_STAR_ICON_CLICK_DONE'
    };

    static MoveFocusToNextListItem:Action<{
        change:Array<number>;
    }> = {
        name: 'DEFAULT_CORPARCH_MOVE_FOCUS_TO_NEXT_LISTITEM'
    };

    static EnterOnActiveListItem:Action<{

    }> = {
        name: 'DEFAULT_CORPARCH_ENTER_ON_ACTIVE_LISTITEM'
    };

    static SearchInputChanged:Action<{
        value:string;
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_INPUT_CHANGED'
    };

    static FocusSearchRow:Action<{
        inc:number;
    }> = {
        name: 'DEFAULT_CORPARCH_FOCUS_SEARCH_ROW'
    };

    static FocusedItemSelect:Action<{

    }> = {
        name: 'DEFAULT_CORPARCH_FOCUSED_ITEM_SELECT'
    };

    static SearchResultItemClicked:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED'
    };

    static SearchResultItemClickedDone:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_RESULT_ITEM_CLICKED_DONE'
    };

    static FavItemRemove:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE'
    };

    static FavItemRemoveDone:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_REMOVE_DONE'
    };

    static FavItemAdd:Action<{
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_ADD'
    };

    static FavItemAddDone:Action<{
        trashedItemId:string;
        rescuedItem:ServerFavlistItem;
    }> = {
        name: 'DEFAULT_CORPARCH_FAV_ITEM_ADD_DONE'
    };

    static CheckTrashedItems:Action<{
    }> = {
        name: 'DEFAULT_CORPARCH_CHECK_TRASHED_ITEMS'
    };

    static SearchDone:Action<{
        data:Array<SearchResultRow>|null;
    }> = {
        name: 'DEFAULT_CORPARCH_SEARCH_DONE'
    };
}