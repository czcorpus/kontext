/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IUnregistrable } from '../../models/common/common';
import { QueryFormType } from '../../models/query/actions';
import { AnyQuery, QuerySuggestion, QueryType } from '../../models/query/query';
import { GeneralProps } from '../kontext';
import { BasePlugin, IPluginApi } from './common';


// ------------------------------------------------------------------------
// ------------------------- [query_suggest] plug-in ----------------------

export interface IPlugin extends BasePlugin, IUnregistrable {
    createElement<T>(
        dr:QuerySuggestion<T>,
        itemClickHandler:(providerId:string, value:unknown)=>void
    ):React.ReactElement;
    isEmptyResponse<T>(v:QuerySuggestion<T>):boolean;
    listCurrentProviders():Array<string>;
    applyClickOnItem(query:AnyQuery, tokenIdx:number, providerId:string, value:unknown):void;
    suggestionsAvailableFor(formType:QueryFormType, valueSubformat:QueryValueSubformat, posAttr:string|undefined):boolean;
}

export type SuggestionValueType = 'posattr'|'struct'|'structattr'|'unspecified';

/**
 * formats are:
 * regexp: simple query with regexp support enabled
 * simple: simple query with regexp disabled and case sensitive
 *   - this mode probably won't be needed (TODO)
 * simple_ic: simple query with regexp disabled and ignoring case enabled
 * advanced: CQL query
 */
export type QueryValueSubformat = 'regexp'|'simple'|'simple_ic'|'advanced';

export interface SuggestionArgs {
    timeReq:number;
    sourceId:string;
    formType:QueryFormType;
    value:string;
    valueStartIdx:number;
    valueEndIdx:number;
    attrStartIdx?:number;
    attrEndIdx?:number;
    valueType:SuggestionValueType;
    valueSubformat:QueryValueSubformat;
    queryType:QueryType;
    corpora:Array<string>;
    subcorpus:string|undefined;
    posAttr:string|undefined;
    struct:string|undefined;
    structAttr:string|undefined;
}

export interface SuggestionAnswer {
    parsedWord:string; // the word actually used to search the suggestion
    results:Array<QuerySuggestion<unknown>>;
    isPartial:boolean;
}

export type SuggestionReturn = SuggestionArgs & SuggestionAnswer;

export class Actions {

    static AskSuggestions:Action<SuggestionArgs> = {
        name: 'QUERY_SUGGEST_ASK_SUGGESTIONS'
    }

    static ClearSuggestions:Action<{
        formType:QueryFormType;
    }> = {
        name: 'QUERY_SUGGEST_CLEAR_SUGGESTIONS'
    }

    static SuggestionsRequested:Action<SuggestionArgs> = {
        name: 'QUERY_SUGGEST_SUGGESTIONS_REQUESTED'
    }

    static SuggestionsReceived:Action<SuggestionReturn> = {
        name: 'QUERY_SUGGEST_SUGGESTIONS_RECEIVED'
    }

    static ItemClicked:Action<{
        value:unknown;
        tokenIdx:number;
        sourceId:string;
        providerId:string;
        formType:string;
    }> = {
        name: 'QUERY_SUGGEST_ITEM_CLICKED'
    }

}

export type Renderer = React.ComponentClass<GeneralProps>|
    React.FC<GeneralProps>;

export type Factory = (pluginApi:IPluginApi)=>IPlugin;
