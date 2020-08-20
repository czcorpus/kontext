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

import { Dict, List } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';

import { Kontext } from '../../types/common';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { parse as parseQuery, ITracer } from 'cqlParser/parser';
import { ConcServerArgs } from '../concordance/common';
import { QueryFormType, Actions, ActionName } from './actions';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PluginInterfaces } from '../../types/plugins';


export type QueryType = 'iquery'|'phrase'|'lemma'|'word'|'cql';

export interface QueryContextArgs {
    fc_lemword_window_type:string;
    fc_lemword_wsize:string;
    fc_lemword:string;
    fc_lemword_type:string;
    fc_pos_window_type:string;
    fc_pos_wsize:string;
    fc_pos:string[];
    fc_pos_type:string;
}

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


export function shouldDownArrowTriggerHistory(query:string, anchorIdx:number,
            focusIdx:number):boolean {
    if (anchorIdx === focusIdx) {
        return (query || '').substr(anchorIdx+1).search(/[\n\r]/) === -1;

    } else {
        return false;
    }
}


export interface QueryFormModelState {

    formType:QueryFormType;

    forcedAttr:string;

    attrList:Array<Kontext.AttrItem>;

    structAttrList:Array<Kontext.AttrItem>;

    lemmaWindowSizes:Array<number>;

    posWindowSizes:Array<number>;

    wPoSList:Array<{v:string; n:string}>;

    currentAction:string;

    currentSubcorp:string;

    queries:{[sourceId:string]:string}; // corpname|filter_id -> query

    queryTypes:{[sourceId:string]:QueryType};

    querySuggestions:{[sourceId:string]:Array<PluginInterfaces.QuerySuggest.DataAndRenderer>};

    tagBuilderSupport:{[sourceId:string]:boolean};

    useCQLEditor:boolean;

    tagAttr:string;

    widgetArgs:Kontext.GeneralProps;

    supportedWidgets:{[sourceId:string]:Array<string>};

    isAnonymousUser:boolean;

    activeWidgets:{[sourceId:string]:string|null};

    downArrowTriggersHistory:{[sourceId:string]:boolean};

    contextFormVisible:boolean;

    textTypesFormVisible:boolean;

    historyVisible:boolean;

    suggestionsVisible:boolean;

    suggestionsVisibility:PluginInterfaces.QuerySuggest.SuggestionVisibility;

}

/**
 *
 */
export abstract class QueryFormModel<T extends QueryFormModelState> extends StatefulModel<T> {

    protected readonly pageModel:PageModel;

    protected readonly queryContextModel:QueryContextModel;

    protected readonly textTypesModel:TextTypesModel;

    protected readonly queryTracer:ITracer;

    protected readonly ident:string;

    protected readonly formType:QueryFormType;

    protected readonly autoSuggestTrigger:Subject<string>; // stream of source IDs

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
        this.formType = initState.formType;
        this.autoSuggestTrigger = new Subject<string>();
        this.autoSuggestTrigger.pipe(debounceTime(500)).subscribe(
            (sourceId) => {
                if (this.state.queryTypes[sourceId] !== 'cql') {
                    dispatcher.dispatch<PluginInterfaces.QuerySuggest.Actions.AskSuggestions>({
                        name: PluginInterfaces.QuerySuggest.ActionName.AskSuggestions,
                        payload: {
                            corpora: List.concat(
                                this.pageModel.getConf<Array<string>>('alignedCorpora'),
                                [this.pageModel.getCorpusIdent().id]
                            ),
                            subcorpus: this.state.currentSubcorp,
                            value: this.state.queries[sourceId],
                            valueType: 'unspecified',
                            queryType: this.state.queryTypes[sourceId],
                            posAttr: this.state.queryTypes[sourceId] === 'lemma' ?
                                'lemma' : undefined,
                            struct: undefined,
                            structAttr: undefined,
                            sourceId
                        }
                    });
                }
            }
        );

        this.addActionSubtypeHandler<Actions.ToggleQueryHistoryWidget>(
            ActionName.ToggleQueryHistoryWidget,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.historyVisible = !state.historyVisible;
                    state.suggestionsVisible = false;
                });
            }
        );

        this.addActionSubtypeHandler<Actions.HideQuerySuggestionWidget>(
            ActionName.HideQuerySuggestionWidget,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.suggestionsVisible = false;
                });
            }
        )

        this.addActionSubtypeHandler<Actions.SetActiveInputWidget>(
            ActionName.SetActiveInputWidget,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.activeWidgets[action.payload.sourceId] = action.payload.value;
                    state.widgetArgs = action.payload.widgetArgs || {};
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetQuery>(
            ActionName.QueryInputSetQuery,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    if (action.payload.insertRange) {
                        this.addQueryInfix(
                            state,
                            action.payload.sourceId,
                            action.payload.query,
                            action.payload.insertRange
                        );

                    } else {
                        state.queries[action.payload.sourceId] = action.payload.query;
                    }
                    state.downArrowTriggersHistory[action.payload.sourceId] =
                        shouldDownArrowTriggerHistory(
                            action.payload.query,
                            action.payload.rawAnchorIdx,
                            action.payload.rawFocusIdx
                        );
                });
                this.autoSuggestTrigger.next(action.payload.sourceId);
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputMoveCursor>(
            ActionName.QueryInputMoveCursor,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    state.downArrowTriggersHistory[action.payload.sourceId] =
                        shouldDownArrowTriggerHistory(
                            state.queries[action.payload.sourceId],
                            action.payload.rawAnchorIdx,
                            action.payload.rawFocusIdx
                        )
                });
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>(
            PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
            action => {
                this.changeState(state => {
                    if (action.error === undefined) {
                        state.querySuggestions[action.payload.sourceId] = action.payload.results;
                        state.suggestionsVisible = true;
                        state.historyVisible = false;

                    } else {
                        state.querySuggestions = {};
                        state.suggestionsVisible = false;
                    }
                });
            }
        );
    }

    protected validateQuery(query:string, queryType:QueryType):boolean {
        const parseFn = ((query:string) => {
            switch (queryType) {
                case 'iquery':
                    return () => {
                        if (!!(/^"[^\"]+"$/.exec(query) ||
                                /^(\[(\s*\w+\s*!?=\s*"[^"]*"(\s*[&\|])?)+\]\s*)+$/.exec(query))) {
                            throw new Error();
                        }
                    }
                case 'phrase':
                    return parseQuery.bind(
                        null, query, {startRule: 'PhraseQuery', tracer: this.queryTracer});
                case 'lemma':
                case 'word':
                    return parseQuery.bind(
                        null, query, {startRule: 'RegExpRaw', tracer: this.queryTracer});
                case 'cql':
                    return parseQuery.bind(
                        null, query + ';', {tracer: this.queryTracer});
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

    protected addQueryInfix(state:QueryFormModelState, sourceId:string, query:string,
            insertRange:[number, number]):void {
        state.queries[sourceId] = state.queries[sourceId].substring(0, insertRange[0]) + query +
                state.queries[sourceId].substr(insertRange[1]);
    }

    getQueryUnicodeNFC(queryId:string):string {
         // TODO ES2015 stuff here
        return Dict.hasKey(queryId, this.state.queries) ?
            this.state.queries[queryId]['normalize']() :
            undefined;
    }

    getRegistrationId():string {
        return this.ident;
    }
}