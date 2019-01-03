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
import {Kontext, ViewOptions} from '../../types/common';
import {ActionDispatcher, Action} from '../../app/dispatcher';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {TextTypesModel} from '../textTypes/main';
import {QueryContextModel} from './context';
import {parse as parseQuery, ITracer} from 'cqlParser/parser';


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


/**
 *
 */
export abstract class QueryFormModel extends StatefulModel {

    protected pageModel:PageModel;

    protected forcedAttr:string;

    protected attrList:Immutable.List<Kontext.AttrItem>;

    protected structAttrList:Immutable.List<Kontext.AttrItem>;

    protected lemmaWindowSizes:Immutable.List<number>;

    protected posWindowSizes:Immutable.List<number>;

    protected wPoSList:Immutable.List<{v:string; n:string}>;

    protected currentAction:string;

    protected queries:Immutable.Map<string, string>; // corpname|filter_id -> query

    // ----- other models

    protected textTypesModel:TextTypesModel;

    protected queryContextModel:QueryContextModel;

    protected queryTracer:ITracer;

    // ----

    protected useCQLEditor:boolean;

    private tagAttr:string;

    private widgetArgs:Kontext.GeneralProps;

    protected supportedWidgets:WidgetsMap;


    // -------


    constructor(
            dispatcher:ActionDispatcher,
            pageModel:PageModel,
            textTypesModel:TextTypesModel,
            queryContextModel:QueryContextModel,
            props:GeneralQueryFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.textTypesModel = textTypesModel;
        this.queryContextModel = queryContextModel;
        this.forcedAttr = props.forcedAttr;
        this.attrList = Immutable.List<Kontext.AttrItem>(props.attrList);
        this.structAttrList = Immutable.List<Kontext.AttrItem>(props.structAttrList);
        this.lemmaWindowSizes = Immutable.List<number>(props.lemmaWindowSizes);
        this.posWindowSizes = Immutable.List<number>(props.posWindowSizes);
        this.wPoSList = Immutable.List<{v:string; n:string}>(props.wPoSList);
        this.tagAttr = props.tagAttr;
        this.queryTracer = {trace:(_)=>undefined};
        this.useCQLEditor = props.useCQLEditor;
        this.queries = Immutable.Map<string, string>();

        this.dispatcher.register(payload => {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SET_ACTIVE_WIDGET':
                    this.setActiveWidget(payload.props['sourceId'], payload.props['value']);
                    this.widgetArgs = payload.props['widgetArgs'] || {};
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    /**
     * Returns a currently active widget identifier
     * (one of 'tag', 'keyboard', 'within', 'history')
     */
    abstract getActiveWidget(sourceId:string):string;

    /**
     * Sets a currently active widget.
     */
    abstract setActiveWidget(sourceId:string, ident:string):void;


    abstract getQueries():Immutable.Map<string, string>;

    abstract getQuery(sourceId:string):string;

    abstract getQueryTypes():Immutable.Map<string, string>;

    abstract getDownArrowTriggersHistory(sourceId:string):boolean;

    /// ---------

    getSupportedWidgets():WidgetsMap {
        return this.supportedWidgets;
    }

    getWidgetArgs():Kontext.GeneralProps {
        return this.widgetArgs;
    }

    getForcedAttr():string {
        return this.forcedAttr;
    }

    getAttrList():Immutable.List<Kontext.AttrItem> {
        return this.attrList;
    }

    getStructAttrList():Immutable.List<Kontext.AttrItem> {
        return this.structAttrList;
    }

    getLemmaWindowSizes():Immutable.List<number> {
        return this.lemmaWindowSizes;
    }

    getPosWindowSizes():Immutable.List<number> {
        return this.posWindowSizes;
    }

    getwPoSList():Immutable.List<{v:string; n:string}> {
        return this.wPoSList;
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
        this.queries = this.queries.set(
            sourceId,
            this.queries.get(sourceId).substring(0, insertRange[0]) + query +
                this.queries.get(sourceId).substr(insertRange[1])
        );
    }

    onSettingsChange(optsModel:ViewOptions.IGeneralViewOptionsModel):void {
        this.useCQLEditor = optsModel.getUseCQLEditor();
        this.notifyChangeListeners();
    }

    getTagAttr():string {
        return this.tagAttr;
    }

    getUseCQLEditor():boolean {
        return this.useCQLEditor;
    }

    getQueryUnicodeNFC(queryId:string):string {
        return this.queries.has(queryId) ? this.queries.get(queryId).normalize() : undefined;
    }
}