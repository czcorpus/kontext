/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Immutable from 'immutable';
import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { parse as parseQuery, ITracer } from 'cqlParser/parser';
import { Action, IFullActionControl, StatefulModel } from 'kombo';


export interface GeneralQueryFormProperties {
    forcedAttr:string;
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    lemmaWindowSizes:Array<number>;
    posWindowSizes:Array<number>;
    wPoSList:Array<{v:string; n:string}>;
    useCQLEditor:boolean;
    tagAttr:string;
}

export const appendQuery = (origQuery:string, query:string, prependSpace:boolean):string => {
    return origQuery + (origQuery && prependSpace ? ' ' : '') + query;
};

/**
 *
 */
export class WidgetsMap {

    private data:Immutable.Map<string, Immutable.List<string>>;

    constructor(data:Immutable.List<[string, Immutable.List<string>]>) {
        this.data = Immutable.Map<string, Immutable.List<string>>(data);
    }

    get(key:string):Immutable.List<string> {
        if (this.data.has(key)) {
            return this.data.get(key);
        }
        return Immutable.List<string>();
    }
}

export interface SetQueryInputAction extends Action<{
    sourceId:string;
    query:string;
    insertRange:[number, number]|null;
    rawAnchorIdx:number|null;
    rawFocusIdx:number|null;
}> {};

export interface MoveCursorInputAction extends Action<{
    sourceId:string;
    rawAnchorIdx:number|null;
    rawFocusIdx:number|null;
}> {};

export interface AppendQueryInputAction extends Action<{
    sourceId:string;
    query:string;
    prependSpace?:boolean;
    closeWhenDone?:boolean;
    triggeredKey?:[number, number]; // from virtual keyboard
}> {};


export interface QueryFormModelState {

    forcedAttr:string;

    attrList:Immutable.List<Kontext.AttrItem>;

    structAttrList:Immutable.List<Kontext.AttrItem>;

    lemmaWindowSizes:Immutable.List<number>;

    posWindowSizes:Immutable.List<number>;

    wPoSList:Immutable.List<{v:string; n:string}>;

    currentAction:string;

    queries:Immutable.Map<string, string>; // corpname|filter_id -> query

    tagBuilderSupport:Immutable.Map<string, boolean>;

    useCQLEditor:boolean;

    tagAttr:string;

    widgetArgs:Kontext.GeneralProps;

    supportedWidgets:WidgetsMap;

    isAnonymousUser:boolean;

    activeWidgets:Immutable.Map<string, string>;

    downArrowTriggersHistory:Immutable.Map<string, boolean>;

}

/**
 *
 */
export abstract class QueryFormModel<T extends QueryFormModelState> extends StatefulModel<T> implements Kontext.ICorpusSwitchAwareModel<T> {

    protected readonly pageModel:PageModel;

    protected readonly queryContextModel:QueryContextModel;

    protected readonly textTypesModel:TextTypesModel;

    protected readonly queryTracer:ITracer;

    protected readonly ident:string;

    // -------


    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            textTypesModel:TextTypesModel,
            queryContextModel:QueryContextModel,
            ident:string,
            initState:T) {
        super(
            dispatcher,
            initState
        );
        this.pageModel = pageModel;
        this.textTypesModel = textTypesModel;
        this.queryContextModel = queryContextModel;
        this.queryTracer = {trace:(_)=>undefined};
        this.ident = ident;

        /*
        this.onAction(action => {
            switch (action.name) {
                case 'QUERY_INPUT_SET_ACTIVE_WIDGET':
                    this.setActiveWidget(action.payload['sourceId'], action.payload['value']);
                    this.widgetArgs = action.payload['widgetArgs'] || {};
                    this.emitChange();
                break;
            }
        });
        */
    }

    protected validateQuery(query:string, queryType:string):boolean {
        const parseFn = ((query:string) => {
            switch (queryType) {
                case 'iquery':
                    return () => {
                        if (!!(/^"[^\"]+"$/.exec(query) || /^(\[(\s*\w+\s*!?=\s*"[^"]*"(\s*[&\|])?)+\]\s*)+$/.exec(query))) {
                            throw new Error();
                        }
                    }
                case 'phrase':
                    return parseQuery.bind(null, query, {startRule: 'PhraseQuery', tracer: this.queryTracer});
                case 'lemma':
                case 'word':
                    return parseQuery.bind(null, query, {startRule: 'RegExpRaw', tracer: this.queryTracer});
                case 'cql':
                    return parseQuery.bind(null, query + ';', {tracer: this.queryTracer});
                default:
                    return () => {};
            }
        })(query.trim());

        let mismatch;
        try {
            parseFn();
            mismatch = false;

        } catch (e) {
            mismatch = true;
            console.error(e);
        }
        return mismatch;
    }

    protected shouldDownArrowTriggerHistory(query:string, anchorIdx:number, focusIdx:number):boolean {
        if (anchorIdx === focusIdx) {
            return (query || '').substr(anchorIdx+1).search(/[\n\r]/) === -1;

        } else {
            return false;
        }
    }

    protected addQueryInfix(sourceId:string, query:string, insertRange:[number, number]):void {
        this.state.queries = this.state.queries.set(
            sourceId,
            this.state.queries.get(sourceId).substring(0, insertRange[0]) + query +
                this.state.queries.get(sourceId).substr(insertRange[1])
        );
    }

    getQueryUnicodeNFC(queryId:string):string {
         // TODO ES2015 stuff here
        return this.state.queries.has(queryId) ? this.state.queries.get(queryId)['normalize']() : undefined;
    }

    csGetStateKey():string {
        return this.ident;
    }
}