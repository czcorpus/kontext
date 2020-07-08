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

import { Dict } from 'cnc-tskit';
import { Action, IFullActionControl, StatefulModel } from 'kombo';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { parse as parseQuery, ITracer } from 'cqlParser/parser';
import { ConcServerArgs } from '../concordance/common';


export type QueryTypes = 'iquery'|'phrase'|'lemma'|'word'|'cql';

export type AnyQuery = {
    iquery?:string;
    phrase?:string;
    lemma?:string;
    word?:string;
    cql?:string
}

export interface ConcQueryArgs extends ConcServerArgs, AnyQuery {
    shuffle:0|1;
    [sca:string]:string|number;
}


export interface ConcSortServerArgs extends ConcServerArgs {
    sattr:string;
    skey:string;
    sbward:string;
    sicase:string;
    spos:string;
    sortlevel:string;
    [other:string]:string|number;
}

export interface SampleServerArgs extends ConcServerArgs {
    rlines:number;
}

export interface SwitchMainCorpServerArgs extends ConcServerArgs {
    maincorp:string;
}

export interface FirstHitsServerArgs extends ConcServerArgs {
    fh_struct:string;
}

export interface FilterServerArgs extends ConcServerArgs {
    pnfilter:string;
    filfl:string;
    filfpos:string;
    filtpos:string;
    inclkwic:'1'|'0';
    queryselector:string; // TODO more specific type here
    within:'1'|'0';
}

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

export interface WithinBuilderData extends Kontext.AjaxResponse {
    structattrs:{[attr:string]:Array<string>};
}

/**
 *
 */
export class WidgetsMap {

    private data:{[key:string]:Array<string>};

    constructor(data:Array<[string, Array<string>]>) {
        this.data = Dict.fromEntries(data);
    }

    get(key:string):Array<string> {
        return this.data[key] ? this.data[key] : [];
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


export function shouldDownArrowTriggerHistory(query:string, anchorIdx:number, focusIdx:number):boolean {
    if (anchorIdx === focusIdx) {
        return (query || '').substr(anchorIdx+1).search(/[\n\r]/) === -1;

    } else {
        return false;
    }
}


export interface QueryFormModelState {

    forcedAttr:string;

    attrList:Array<Kontext.AttrItem>;

    structAttrList:Array<Kontext.AttrItem>;

    lemmaWindowSizes:Array<number>;

    posWindowSizes:Array<number>;

    wPoSList:Array<{v:string; n:string}>;

    currentAction:string;

    queries:{[key:string]:string}; // corpname|filter_id -> query

    tagBuilderSupport:{[key:string]:boolean};

    useCQLEditor:boolean;

    tagAttr:string;

    widgetArgs:Kontext.GeneralProps;

    supportedWidgets:WidgetsMap;

    isAnonymousUser:boolean;

    activeWidgets:{[key:string]:string|null};

    downArrowTriggersHistory:{[key:string]:boolean};

    contextFormVisible:boolean;

    textTypesFormVisible:boolean;
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
    }

    protected validateQuery(query:string, queryType:QueryTypes):boolean {
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

    protected addQueryInfix(state:QueryFormModelState, sourceId:string, query:string, insertRange:[number, number]):void {
        state.queries[sourceId] = state.queries[sourceId].substring(0, insertRange[0]) + query +
                state.queries[sourceId].substr(insertRange[1]);
    }

    getQueryUnicodeNFC(queryId:string):string {
         // TODO ES2015 stuff here
        return Dict.hasKey(queryId, this.state.queries) ? this.state.queries[queryId]['normalize']() : undefined;
    }

    csGetStateKey():string {
        return this.ident;
    }
}