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
    CorpusInfoClosed = 'CORPARCH_CORPUS_INFO_CLOSED'
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

    export interface FilterChanged extends Action<{
        maxSize?:string;
        minSize?:string;
        name?:string;
        sortBySize?:string;
        query?:string;
        corpusName?:string;
    }> {
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
}