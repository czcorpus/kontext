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
import { CorpusInfo } from '../../models/common/corpusInfo';
import { CorplistDataResponse, Filters, ServerFavlistItem } from './common';
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
        widgetId?:string;
        keywordId:string;
        status:boolean;
        attachToCurrent:boolean;
    }> = {
        name: 'CORPARCH_KEYWORD_CLICKED'
    };

    static KeywordResetClicked:Action<{
        widgetId?:string;
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
        widgetId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SHOW'
    };

    static WidgetHide:Action<{
        widgetId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_HIDE'
    };

    static WidgetSetActiveTab:Action<{
        widgetId:string;
        value:number;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SET_ACTIVE_TAB'
    };

    static WidgetFavItemClick:Action<{
        widgetId:string;
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FAV_ITEM_CLICK'
    };

    static WidgetFavItemClickDone:Action<{
        widgetId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FAV_ITEM_CLICK_DONE'
    };

    static WidgetFeatItemClick:Action<{
        widgetId:string;
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FEAT_ITEM_CLICK'
    };

    static WidgetFeatItemClickDone:Action<{
        widgetId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FEAT_ITEM_CLICK_DONE'
    };

    static WidgetStarIconClick:Action<{
        widgetId:string;
        itemId:string;
        status:boolean;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_STAR_ICON_CLICK'
    };

    static WidgetStarIconClickDone:Action<{
        widgetId:string;
        data:Array<ServerFavlistItem>;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_STAR_ICON_CLICK_DONE'
    };

    static WidgetMoveFocusToNextListItem:Action<{
        widgetId:string;
        change:Array<number>;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_MOVE_FOCUS_TO_NEXT_LISTITEM'
    };

    static WidgetEnterOnActiveListItem:Action<{
        widgetId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_ENTER_ON_ACTIVE_LISTITEM'
    };

    static WidgetSearchInputChanged:Action<{
        widgetId:string;
        value:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SEARCH_INPUT_CHANGED'
    };

    static WidgetFocusSearchRow:Action<{
        widgetId:string;
        inc:number;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FOCUS_SEARCH_ROW'
    };

    static WidgetFocusedItemSelect:Action<{
        widgetId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FOCUSED_ITEM_SELECT'
    };

    static WidgetSearchResultItemClicked:Action<{
        widgetId:string;
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SEARCH_RESULT_ITEM_CLICKED'
    };

    static WidgetSearchResultItemClickedDone:Action<{
        widgetId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SEARCH_RESULT_ITEM_CLICKED_DONE'
    };

    static WidgetFavItemRemove:Action<{
        widgetId:string;
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FAV_ITEM_REMOVE'
    };

    static WidgetCheckTrashedItems:Action<{}> = {
        name: 'DEFAULT_CORPARCH_WIDGET_CHECK_TRASHED_ITEMS'
    };

    static WidgetFavItemAdd:Action<{
        widgetId:string;
        itemId:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FAV_ITEM_ADD'
    };

    static WidgetFavItemAddDone:Action<{
        widgetId:string;
        trashedItemId:string;
        rescuedItem:ServerFavlistItem;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_FAV_ITEM_ADD_DONE'
    };

    static WidgetSearchDone:Action<{
        widgetId:string;
        data:Array<SearchResultRow>|null;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SEARCH_DONE'
    };

    static WidgetSubcorpusSelected:Action<{
        widgetId:string;
        subcorpus:string;
    }> = {
        name: 'DEFAULT_CORPARCH_WIDGET_SUBCORPUS_SELECTED'
    }
}