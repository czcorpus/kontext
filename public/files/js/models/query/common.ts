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

import { Dict, List, tuple, pipe } from 'cnc-tskit';
import { IFullActionControl, StatefulModel } from 'kombo';
import { diffArrays } from 'diff';

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import * as ViewOptions from '../../types/viewOptions';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { parse as parseQuery, ITracer } from 'cqlParser/parser';
import { ConcServerArgs, ConcViewMode } from '../concordance/common';
import { QueryFormType, Actions } from './actions';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as PluginInterfaces from '../../types/plugins';
import { Actions as CorpOptActions } from '../options/actions';
import {
    AdvancedQuery, advancedToSimpleQuery, AnyQuery, AnyQuerySubmit, findTokenIdxByFocusIdx,
    parseSimpleQuery, QueryType, runSimpleQueryParser, SimpleQuery, simpleToAdvancedQuery,
    TokenSuggestions } from './query';
import { getApplyRules, highlightSyntax, ParsedAttr } from '../cqleditor/parser';
import { AttrHelper } from '../cqleditor/attrs';
import { Actions as QueryHintsActions } from '../usageTips/actions';
import { Actions as HistoryActions } from '../searchHistory/actions';
import { SubmitEncodedSimpleTokens } from './formArgs';
import { QueryValueSubformat } from '../../types/plugins/querySuggest';
import { EmptyPlugin } from '../../plugins/empty/init';

/*
Some important terms to prevent confusion:

position, focusIdx = position of cursor

tokenIdx = position of a parsed token

*/


export type CtxLemwordType = 'any'|'all'|'none';

export interface QueryContextArgs {
    fc_lemword_wsize:[number, number];
    fc_lemword:string;
    fc_lemword_type:CtxLemwordType;
    fc_pos_wsize:[number, number];
    fc_pos:string[];
    fc_pos_type:CtxLemwordType;
}

export interface ConcQueryArgs {
    queries:Array<AnyQuerySubmit>;
    usesubcorp:string|undefined;
    viewmode:ConcViewMode;
    pagesize:number;
    shuffle:boolean;
    attrs:Array<string>;
    ctxattrs:Array<string>;
    attr_vmode:ViewOptions.AttrViewMode;
    base_viewattr:string;
    structs:Array<string>;
    refs:Array<string>;
    fromp:number;
    text_types:TextTypes.ExportedSelection;
    context:QueryContextArgs;
    async:boolean;
    no_query_history?:boolean;
    cutoff?:number;
    type:'concQueryArgs';
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

/**
 * Defines positive and negative filters either
 * including kwic (p/n) or excluding kwic (P/N)
 */
export type FilterTypes = 'p' | 'P' | 'n' | 'N';

export interface FilterServerArgs extends ConcServerArgs {
    maincorp:string;
    pnfilter:FilterTypes;
    filfl:string;
    filfpos:string;
    filtpos:string;
    inclkwic:boolean;
    qtype:QueryType;
    query:string;
    queryParsed:SubmitEncodedSimpleTokens|undefined;
    qmcase:boolean;
    within:boolean;
    default_attr:string|Array<string>;
    use_regexp:boolean;
    no_query_history?:boolean;
    type:'filterQueryArgs';
}

export interface SortServerArgs extends ConcServerArgs {
    sattr:string;
    skey:string;
    sbward:string;
    sicase:string;
    spos:string;
    type:'sortQueryArgs';
}

export interface MLSortServerArgs extends ConcServerArgs {
    levels:Array<{
        sattr:string;
        sbward:string;
        sicase:string;
        spos:string;
        ctx:string;
    }>;
    type:'mlSortQueryArgs';
}

export interface GeneralQueryFormProperties {
    forcedAttr:string;
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    structList:Array<string>;
    wPoSList:Array<{v:string; n:string}>;
    useRichQueryEditor:boolean;
    suggestionsConfigured:boolean;
}


export const appendQuery = (origQuery:string, query:string, prependSpace:boolean):string => {
    return origQuery + (origQuery && prependSpace ? ' ' : '') + query;
};


export interface WithinBuilderData extends Kontext.AjaxResponse {
    structattrs:{[attr:string]:Array<string>};
}


export function determineSuggValueType(query:AnyQuery):QueryValueSubformat {
    if (query.qtype === 'advanced') {
        return 'advanced';

    } else if (query.use_regexp) {
        return 'regexp';
    }
    return 'simple_ic';
}

export function suggestionsEnabled(
    plugin:PluginInterfaces.QuerySuggest.IPlugin,
    configured:boolean,
    formType:QueryFormType,
    query:AnyQuery,
):boolean {
    return configured && plugin.suggestionsAvailableFor(
    formType,
    determineSuggValueType(query),
    Array.isArray(query.default_attr) ?
        undefined :
        query.default_attr
    );
}


export interface QueryFormModelState {

    formType:QueryFormType;

    forcedAttr:string;

    /**
     * This list also serves as a list of default values
     * for the advanced query mode.
     */
    attrList:Array<Kontext.AttrItem>;

    /**
     * simpleQueryDefaultAttrs contains a list of default attributes
     * for the simple query. The possible value types for a single item are:
     * 1) a string -> single attribute (e.g. 'word')
     * 2) a list of strings -> multiple attributes interpreted by server as disjunction
     *    (e.g. ['word', 'lemma'] -> [word="foo" | lemma="foo"])
     */
    simpleQueryDefaultAttrs:{[sourceId:string]:Array<Array<string>|string>};

    structAttrList:Array<Kontext.AttrItem>;

    wPoSList:Array<{v:string; n:string}>;

    currentAction:string;

    currentSubcorp:string;

    queries:{[sourceId:string]:AnyQuery}; // corpname|filter_id -> query

    cqlEditorMessages:{[sourceId:string]:Array<string>};

    useRichQueryEditor:boolean;

    supportedWidgets:{[sourceId:string]:Array<string>};

    isAnonymousUser:boolean;

    activeWidgets:{[sourceId:string]:string|null};

    downArrowTriggersHistory:{[sourceId:string]:boolean};

    contextFormVisible:boolean;

    textTypesFormVisible:boolean;

    queryOptionsVisible:{[sourceId:string]:boolean};

    historyVisible:{[sourceId:string]:boolean};

    suggestionsVisible:{[sourceId:string]:number};

    /**
     * This specifies whether the "suggestions" are enabled by user in respective options
     */
    suggestionsConfigured:boolean;

    /**
     * This specifies whether the suggestions are enabled given the current form state
     * (e.g. by selected attributes, case sensitivity etc.). Please note that this depends
     * on suggestionsConfigured - i.e. suggestionsEnabled => suggestionsConfigured
     */
    suggestionsEnabled:{[sourceId:string]:boolean};

    suggestionsLoading:{[sourceId:string]:{[position:number]:boolean}};

    isBusy:boolean;

    isLocalUiLang:boolean;

    /**
     * When true then character composition is enabled and we should not update rich editor.
     * This issue affects different character compositions in different operating systems.
     * E.g. for spec. Czech characters, the issue can be met only in macOS.
     */
    compositionModeOn:boolean;
}

/**
 *
 */
export function determineSupportedWidgets(
    queries:{[key:string]:AnyQuery},
    tagBuilderSupport:{[key:string]:boolean},
    isAnonymousUser:boolean

):{[key:string]:Array<string>} {

    const getCorpWidgets = (corpname:string, queryType:QueryType):Array<string> => {
        const ans = ['keyboard'];
        if (!isAnonymousUser) {
            ans.push('history');
        }
        if (queryType === 'advanced') {
            ans.push('within');
            if (tagBuilderSupport[corpname]) {
                ans.push('tag');
            }
        }
        if (queryType === 'simple') {
            ans.push('structure');
        }
        return ans;
    }
    return Dict.map(
        (query, corpname) => getCorpWidgets(corpname, query.qtype),
        queries
    );
}

/**
 *
 */
export function getTagBuilderSupport(
    plugin:PluginInterfaces.TagHelper.IPlugin,
    tagsets:{[sourceId:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>}
):{[sourceId:string]:boolean} {
    if (plugin instanceof EmptyPlugin) {
        return {};
    }
    return pipe(
        tagsets,
        Dict.map(
            corpTagsets => List.some(t => t.widgetEnabled, corpTagsets)
        )
    );
}

export function formEncodeDefaultAttr(attr:string|Array<string>):string {
    return Array.isArray(attr) ? attr.join('|') : attr;
}

export function formDecodeDefaultAttr(attr:string):string|Array<string> {
    const items = attr.split('|');
    return items.length > 1 ? items : items[0];
}

/**
 *
 */
interface SuggestionReqArgs {
    value:string;
    attrStartIdx:number;
    attrEndIdx:number;
    valueStartIdx:number;
    valueEndIdx:number;
}

/**
 * QueryFormModel is a common base for both 'first' and 'filter' queries.
 */
export abstract class QueryFormModel<T extends QueryFormModelState> extends StatefulModel<T> {

    protected readonly pageModel:PageModel;

    protected readonly queryContextModel:QueryContextModel;

    protected readonly textTypesModel:TextTypesModel;

    protected readonly queryTracer:ITracer;

    protected readonly ident:string;

    protected readonly formType:QueryFormType;

    // stream of [source ID, rawAnchorIdx, rawFocusIdx]
    protected readonly autoSuggestTrigger:Subject<[string, number, number]>;

    private readonly attrHelper:AttrHelper;

    private readonly qsPlugin:PluginInterfaces.QuerySuggest.IPlugin;

    protected readonly thPlugin:PluginInterfaces.TagHelper.IPlugin;

    protected readonly qsSubscription:Subscription|undefined;

    // -------

    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            queryContextModel:QueryContextModel,
            qsPlugin:PluginInterfaces.QuerySuggest.IPlugin,
            thPlugin:PluginInterfaces.TagHelper.IPlugin,
            attrHelper:AttrHelper,
            ident:string,
            initState:T) {
        super(
            dispatcher,
            initState
        );
        this.pageModel = pageModel;
        this.queryContextModel = queryContextModel;
        this.qsPlugin = qsPlugin;
        this.thPlugin = thPlugin;
        this.queryTracer = {trace:(_)=>undefined};
        this.ident = ident;
        this.formType = initState.formType;
        this.attrHelper = attrHelper;
        this.autoSuggestTrigger = new Subject<[string, number, number]>();
        this.qsSubscription = this.qsPlugin.isActive() ?
                this.subscribeAutoSuggest(dispatcher) : undefined;

        this.addActionSubtypeHandler(
            Actions.QueryInputSetQType,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const query = state.queries[action.payload.sourceId];
                    if (query.qtype === 'advanced' && action.payload.queryType === 'simple') {
                        state.queries[action.payload.sourceId] = advancedToSimpleQuery(
                            query,
                            List.head(initState.simpleQueryDefaultAttrs[action.payload.sourceId])
                        );

                    } else if (query.qtype === 'simple' && action.payload.queryType === 'advanced') {
                        state.queries[action.payload.sourceId] = simpleToAdvancedQuery(
                            query,
                            List.head(state.attrList).n
                        );
                    }
                    state.supportedWidgets = determineSupportedWidgets(
                        state.queries,
                        getTagBuilderSupport(
                            this.thPlugin,
                            this.getTagsets(state)),
                        state.isAnonymousUser
                    );
                })
            }
        );

        this.addActionSubtypeHandler(
            HistoryActions.ToggleQueryHistoryWidget,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    state.historyVisible[action.payload.sourceId] =
                        !state.historyVisible[action.payload.sourceId];
                    state.suggestionsVisible[action.payload.sourceId] = null;
                    state.activeWidgets[action.payload.sourceId] = null;
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.ToggleQuerySuggestionWidget,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    state.suggestionsVisible[action.payload.sourceId] = action.payload.tokenIdx;
                    state.historyVisible[action.payload.sourceId] = null;
                    state.activeWidgets[action.payload.sourceId] = null;
                });
                if (action.payload.tokenIdx !== null) {
                    const queryObj = this.state.queries[action.payload.sourceId];
                    if (queryObj.qtype === 'simple') {
                        const tok = queryObj.queryParsed[action.payload.tokenIdx];
                        if (tok.isExtended && !tok.suggestions) {
                            this.autoSuggestTrigger.next(tuple(
                                action.payload.sourceId,
                                0,
                                0
                            ));
                        }
                    }
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryOptionsToggleForm,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    state.queryOptionsVisible[action.payload.sourceId] =
                            !state.queryOptionsVisible[action.payload.sourceId];
                })
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputSetDefaultAttr,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    if (queryObj.qtype === 'simple') {
                        queryObj.default_attr = formDecodeDefaultAttr(action.payload.value);
                        queryObj.queryParsed = parseSimpleQuery(queryObj);

                    } else if (action.payload.value) {
                        queryObj.default_attr = action.payload.value;

                    } else {
                        throw new Error(`Invalid default attr value: ${action.payload.value}`);
                    }
                    this.updateQsEnabled(state, action.payload.sourceId);
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    0,
                    0
                ));
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputSetMatchCase,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    if (queryObj.qtype === 'simple') {
                        queryObj.qmcase = action.payload.value;

                    } else {
                        console.error('Invalid query type');
                    }
                    this.updateQsEnabled(state, action.payload.sourceId);
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    0,
                    0
                ));
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputToggleAllowRegexp,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    if (queryObj.qtype === 'simple') {
                        queryObj.use_regexp = !queryObj.use_regexp;
                        queryObj.qmcase = queryObj.use_regexp;
                        if (queryObj.use_regexp) {
                            queryObj.queryParsed = List.map(
                                item => ({...item, suggestions: null}),
                                queryObj.queryParsed
                            );
                            this.rehighlightSimpleQuery(queryObj);
                        }
                        this.updateQsEnabled(state, action.payload.sourceId);
                    }
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    0,
                    0
                ));
            }
        );

        this.addActionSubtypeHandler(
            Actions.SetActiveInputWidget,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    state.activeWidgets[action.payload.sourceId] = action.payload.value;
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputSetQuery,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    if (action.payload.rawAnchorIdx !== null &&
                            action.payload.rawFocusIdx !== null) {
                        const queryObj = state.queries[action.payload.sourceId];
                        queryObj.rawAnchorIdx = action.payload.rawAnchorIdx;
                        queryObj.rawFocusIdx = action.payload.rawFocusIdx;
                    }
                    this.setRawQuery(
                        state,
                        action.payload.sourceId,
                        action.payload.query,
                        action.payload.insertRange
                    );
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    action.payload.rawAnchorIdx,
                    action.payload.rawFocusIdx
                ));
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputAppendQuery,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    this.setRawQuery(
                        state,
                        action.payload.sourceId,
                        action.payload.query,
                        tuple(
                            this.getQueryLength(state, action.payload.sourceId),
                            this.getQueryLength(state, action.payload.sourceId)
                        )
                    );

                    if (action.payload.closeWhenDone) {
                        state.activeWidgets[action.payload.sourceId] = null;
                    }
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputInsertAtCursor,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    const oldPos = queryObj.rawFocusIdx;
                    this.setRawQuery(
                        state,
                        action.payload.sourceId,
                        action.payload.chunk,
                        tuple(
                            queryObj.rawAnchorIdx,
                            queryObj.rawFocusIdx
                        )
                    );
                    this.moveCursorToPos(
                        state,
                        action.payload.sourceId,
                        oldPos + action.payload.chunk.length
                    );
                });
            }
        );

        this.addActionHandler(
            Actions.QueryInputRemoveLastChar,
            action => {
                this.changeState(state => {
                    const queryLength = this.getQueryLength(state, action.payload.sourceId);
                    this.setRawQuery(
                        state,
                        action.payload.sourceId,
                        '',
                        tuple(queryLength - 1, queryLength)
                    );
                    this.moveCursorToEnd(state, action.payload.sourceId);
                    const queryObj = state.queries[action.payload.sourceId];
                    if (queryObj.qtype === 'advanced') {
                        queryObj.focusedAttr = this.findFocusedAttr(queryObj);
                    }
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    this.state.queries[action.payload.sourceId].rawAnchorIdx,
                    this.state.queries[action.payload.sourceId].rawFocusIdx
                ));
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputMoveCursor,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    if (queryObj.rawAnchorIdx === action.payload.rawAnchorIdx ||
                            queryObj.rawFocusIdx === action.payload.rawFocusIdx) {
                        return;
                    }
                    queryObj.rawAnchorIdx = action.payload.rawAnchorIdx;
                    queryObj.rawFocusIdx = action.payload.rawFocusIdx;
                    state.downArrowTriggersHistory[action.payload.sourceId] =
                        this.shouldDownArrowTriggerHistory(
                            state,
                            action.payload.sourceId
                        );
                        if (queryObj.qtype === 'advanced') {
                            queryObj.focusedAttr = this.findFocusedAttr(queryObj);
                        }
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.SetCompositionMode,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(
                    state => {
                        state.compositionModeOn = action.payload.status;
                    }
                )
            }
        );

        this.addActionSubtypeHandler(
            PluginInterfaces.QuerySuggest.Actions.ItemClicked,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    this.qsPlugin.applyClickOnItem(
                        queryObj,
                        action.payload.tokenIdx,
                        action.payload.providerId,
                        action.payload.value
                    );
                    state.suggestionsVisible[action.payload.sourceId] = null;
                    if (queryObj.qtype === 'simple') {
                        this.rehighlightSimpleQuery(queryObj);

                    } else {
                        this.reparseAdvancedQuery(state, action.payload.sourceId, true);
                    }
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    0,
                    0
                ));

                const queryObject = this.state.queries[action.payload.sourceId];
                if (queryObject.qtype === 'simple' && List.some(v => v.isExtended, queryObject.queryParsed)) {
                    this.dispatchSideEffect<typeof QueryHintsActions.ForceHint>({
                        name: QueryHintsActions.ForceHint.name,
                        payload: {
                            message: pageModel.translate('query__tip_08'),
                            priority: 2
                        }
                    });
                }
            }
        );

        this.addActionSubtypeHandler(
            PluginInterfaces.QuerySuggest.Actions.SuggestionsRequested,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    this.clearSuggestionForPosition(state, action.payload.sourceId, action.payload.valueStartIdx);
                    const currVisible = state.suggestionsVisible[action.payload.sourceId];
                    if (currVisible !== null) {
                        const queryObj = state.queries[action.payload.sourceId];
                        if (queryObj.qtype !== 'simple' || !queryObj.queryParsed[currVisible].isExtended
                                && queryObj.queryParsed[currVisible].suggestions) {
                            state.suggestionsVisible[action.payload.sourceId] = null;
                        }
                    }
                    state.suggestionsLoading[action.payload.sourceId][action.payload.valueStartIdx] = true;
                });
            }
        );

        this.addActionSubtypeHandler(
            PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived,
            action => action.payload.formType === this.formType,
            action => {
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);
                    this.changeState(state => {
                        this.clearSuggestionForPosition(state, action.payload.sourceId, action.payload.valueStartIdx);
                        state.suggestionsVisible[action.payload.sourceId] = null;
                        state.suggestionsLoading[action.payload.sourceId][action.payload.valueStartIdx] = false;
                    });

                } else if (
                    this.shouldAcceptSuggestion(
                        this.state,
                        action.payload.sourceId,
                        action.payload) &&
                    this.isCurrentSuggestionInvalid(
                        this.state,
                        action.payload.sourceId,
                        action.payload.valueStartIdx,
                        action.payload
                    )
                ) {
                    this.changeState(state => {
                        this.addSuggestion(
                            state,
                            action.payload.sourceId,
                            action.payload.valueStartIdx,
                            action.payload
                        );
                        state.suggestionsLoading[action.payload.sourceId][action.payload.valueStartIdx] = false;
                    });

                    const queryObject = this.state.queries[action.payload.sourceId];
                    if (
                        (queryObject.qtype === 'simple' && List.some(v => this.someSuggestionIsNonEmpty(v.suggestions), queryObject.queryParsed)) ||
                        (queryObject.qtype === 'advanced' && List.some(v => this.someSuggestionIsNonEmpty(v.suggestions), queryObject.parsedAttrs))
                     ) {
                        this.dispatchSideEffect<typeof QueryHintsActions.ForceHint>({
                            name: QueryHintsActions.ForceHint.name,
                            payload: {
                                message: pageModel.translate('query__tip_06'),
                                priority: 1
                            }
                        });
                    }
                }
            }
        );

        this.addActionSubtypeHandler(
            PluginInterfaces.QuerySuggest.Actions.ClearSuggestions,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    pipe(
                        state.queries,
                        Dict.forEach(
                            query => {
                                if (query.qtype === 'simple') {
                                    query.queryParsed = List.map(
                                        item => ({...item, suggestions: null}),
                                        query.queryParsed
                                    );

                                } else {
                                    query.parsedAttrs = List.map(
                                        item => ({...item, suggestions: null}),
                                        query.parsedAttrs
                                    );
                                }
                            }
                        )
                    );
                });
            }
        );

        this.addActionHandler(
            CorpOptActions.SaveSettingsDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.suggestionsConfigured = action.payload.qsEnabled;
                        if (!state.suggestionsConfigured) {
                            state.suggestionsVisible = Dict.map(
                                v => null,
                                state.suggestionsVisible
                            );
                        }
                    });
                }
            }
        );

        this.addActionSubtypeHandler(
            Actions.ShowQueryStructureWidget,
            action => action.payload.formType === this.formType,
            (action) => {
                this.changeState(state => {
                    state.activeWidgets[action.payload.sourceId] = 'query-structure';
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.HideQueryStructureWidget,
            action => action.payload.formType === this.formType,
            (action) => {
                this.changeState(state => {
                    state.activeWidgets[action.payload.sourceId] = null;
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputResetQueryExpansion,
            action => action.payload.formType === this.formType,
            (action) => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    if (queryObj.qtype === 'simple') {
                        queryObj.queryParsed = List.map(
                            item => ({
                                    ...item,
                                    isExtended: false,
                                    args: [tuple(queryObj.default_attr, item.value)]
                            }),
                            queryObj.queryParsed
                        );
                        this.rehighlightSimpleQuery(queryObj);

                    } else {
                        throw new Error('Cannot reset query expansion - invalid target query type');
                    }
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputSelectText,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    queryObj.rawAnchorIdx = action.payload.anchorIdx;
                    queryObj.rawFocusIdx = action.payload.focusIdx;
                });
            }
        );
    }

    abstract getTagsets(state:T):{[sourceId:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>};

    private subscribeAutoSuggest(dispatcher:IFullActionControl):Subscription {
        return this.autoSuggestTrigger.pipe(
            debounceTime(Kontext.TEXT_INPUT_WRITE_THROTTLE_INTERVAL_MS)
        ).subscribe(
            ([sourceId,,]) => {
                const queryObj = this.state.queries[sourceId];
                const suggRequests:Array<SuggestionReqArgs> =
                    queryObj.qtype === 'simple' ?
                        List.map(
                            q => ({
                                value: q.value,
                                attrStartIdx: undefined,
                                attrEndIdx: undefined,
                                valueStartIdx: q.position[0],
                                valueEndIdx: q.position[1]
                            }),
                            queryObj.queryParsed
                        ) : [];

                this.changeState(state => {
                    state.suggestionsLoading[sourceId] = {};
                });

                List.forEach(
                    args => {
                        if (this.shouldAskForSuggestion(sourceId, args.value)) {
                            const defaultAttr = this.state.queries[sourceId].default_attr;
                            dispatcher.dispatch<typeof PluginInterfaces.QuerySuggest.Actions.AskSuggestions>({
                                name: PluginInterfaces.QuerySuggest.Actions.AskSuggestions.name,
                                payload: {
                                    ...args,
                                    timeReq: new Date().getTime(),
                                    corpora: [...this.pageModel.getConf<Array<string>>('alignedCorpora'),
                                              this.pageModel.getCorpusIdent().id],
                                    subcorpus: this.state.currentSubcorp,
                                    valueType: 'unspecified',
                                    valueSubformat: this.determineSuggValueType(sourceId),
                                    queryType: this.state.queries[sourceId].qtype,
                                    posAttr: Array.isArray(defaultAttr) ? undefined : defaultAttr,
                                    struct: undefined,
                                    structAttr: undefined,
                                    sourceId,
                                    formType: this.formType
                                }
                            });

                        } else {
                            dispatcher.dispatch<typeof PluginInterfaces.QuerySuggest.Actions.ClearSuggestions>({
                                name: PluginInterfaces.QuerySuggest.Actions.ClearSuggestions.name,
                                payload: {
                                    formType: this.formType
                                }
                            });
                        }
                    },
                    suggRequests
                );
            }
        );
    }

    private updateQsEnabled(state:QueryFormModelState, sourceId:string):void {
        const query = state.queries[sourceId];
        state.suggestionsEnabled[sourceId] = suggestionsEnabled(
            this.qsPlugin,
            state.suggestionsConfigured,
            state.formType,
            query
        );
    }

    private clearSuggestionForPosition(state:QueryFormModelState, sourceId:string, position:number):void {
        const queryObj = state.queries[sourceId];
        const tokIdx = findTokenIdxByFocusIdx(queryObj, position);
        if (tokIdx === -1) {
            throw new Error(`No valid token found at position ${position}`);
        }
        if (queryObj.qtype === 'simple') {
            queryObj.queryParsed[tokIdx].suggestions = null;

        } else {
            queryObj.parsedAttrs[tokIdx].suggestions = null;
        }
    }

    private isCurrentSuggestionInvalid(
        state:QueryFormModelState,
        sourceId:string,
        position:number,
        data:PluginInterfaces.QuerySuggest.SuggestionArgs & PluginInterfaces.QuerySuggest.SuggestionAnswer
    ) {
        const queryObj = state.queries[sourceId];
        const tokIdx = findTokenIdxByFocusIdx(queryObj, position);
        if (tokIdx < 0) {
            return true;
        }
        if (queryObj.qtype === 'simple') {
            return queryObj.queryParsed[tokIdx].suggestions === null ||
                 queryObj.queryParsed[tokIdx].suggestions.timeReq <= data.timeReq;

        } else {
            return queryObj.parsedAttrs[tokIdx].suggestions === null ||
                queryObj.parsedAttrs[tokIdx].suggestions.timeReq <= data.timeReq;
        }
    }

    private shouldAcceptSuggestion(
        state:QueryFormModelState,
        sourceId:string,
        data:PluginInterfaces.QuerySuggest.SuggestionArgs & PluginInterfaces.QuerySuggest.SuggestionAnswer
    ):boolean {

        return state.queries[sourceId].qtype === data.queryType;
    }

    /**
     * note: returns back the original queryObj mutated by query highlighting
     */
    protected rehighlightSimpleQuery(
        queryObj:SimpleQuery,
        focusTokenIdx?:number
    ):SimpleQuery {

        const richText = [];
        const escape = (s:string) => (s + '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        runSimpleQueryParser(
            queryObj.query,
            (token, tokenIdx, charIdx) => {
                if (focusTokenIdx === tokenIdx) {
                    queryObj.rawFocusIdx = charIdx + 1;
                    queryObj.rawAnchorIdx = charIdx + 1;
                }
                if (queryObj.queryParsed[tokenIdx].isExtended) {
                    richText.push(
                        `<a class="sh-modified" data-tokenIdx="${tokenIdx}" title="${this.pageModel.translate('query__token_is_expanded')}">${escape(token.value)}</a>`);

                } else if (this.someSuggestionIsNonEmpty(queryObj.queryParsed[tokenIdx].suggestions)) {
                    richText.push(
                        `<a class="sh-sugg" data-tokenIdx="${tokenIdx}" title="${this.pageModel.translate('query__suggestions_for_token_avail')}">${escape(token.value)}</a>`);

                } else {
                    richText.push(`<span>${escape(token.value)}</span>`);
                }
            },
            () => {
                richText.push(`<span>\u00a0</span>`);
            }
        );
        queryObj.queryHtml = richText.join('');
        return queryObj;
    }

    private validateSemantics(
        state:QueryFormModelState,
        sourceId:string,
        attrs:Array<ParsedAttr>
    ):void {

        state.cqlEditorMessages[sourceId] = pipe(
            attrs,
            List.map(
                ({name, type}) => {
                    if (type === 'posattr' && !this.attrHelper.attrExists(name)) {
                        return `${this.pageModel.translate('query__attr_does_not_exist')}: <strong>${name}</strong>`;
                    }

                    if (type === 'structattr' && !this.attrHelper.structAttrExists(name, '0' /* TODO */)) {
                        return `${this.pageModel.translate('query__structattr_does_not_exist')}: <strong>${name}.${name}</strong>`;
                    }

                    if (type === 'struct' && !this.attrHelper.structExists(name)) {
                        return `${this.pageModel.translate('query__struct_does_not_exist')}: <strong>${name}</strong>`;
                    }
                    return null;
                }
            ),
            List.filter(v => v !== null)
        );
    }

    protected reparseAdvancedQuery(
        state:QueryFormModelState,
        sourceId:string,
        updateCurrAttrs:boolean
    ):void {

        const queryObj = state.queries[sourceId];
        if (queryObj.qtype === 'advanced') {
            const [queryHtml, newAttrs, _, syntaxErr] = highlightSyntax({
                query: queryObj.query,
                querySuperType: 'conc',
                he: this.pageModel.getComponentHelpers(),
                attrHelper: this.attrHelper,
                wrapRange: (startIdx, endIdx) => {
                    const matchingAttr = updateCurrAttrs ?
                        undefined :
                        List.find(
                            attr => attr.rangeVal[0] === startIdx && attr.rangeVal[1] === endIdx,
                            queryObj.parsedAttrs
                        );
                    if (matchingAttr && matchingAttr.suggestions) {
                        const activeSugg = List.find(s => s.isActive, matchingAttr.suggestions.data);
                        return tuple(
                            `<a class="sugg" data-type="sugg" data-leftIdx="${startIdx}" data-rightIdx="${endIdx}" data-providerId="${activeSugg.providerId}">`, '</a>'
                        )
                    }
                    return tuple(null, null);
                }
            });
            this.validateSemantics(state, sourceId, newAttrs);
            queryObj.focusedAttr = this.findFocusedAttr(queryObj);
            queryObj.queryHtml = queryHtml;
            if (updateCurrAttrs) {
                queryObj.parsedAttrs = newAttrs;
            }
            if (syntaxErr) {
                state.cqlEditorMessages[sourceId].push(syntaxErr);
            }
        }
    }

    private someSuggestionIsNonEmpty(suggs:TokenSuggestions|null):boolean {
        if (!suggs) {
            return false;
        }
        return List.some(
            s => !this.qsPlugin.isEmptyResponse(s),
            suggs.data
        );
    }

    private addSuggestion(
        state:QueryFormModelState,
        sourceId:string,
        position:number,
        data:PluginInterfaces.QuerySuggest.SuggestionArgs & PluginInterfaces.QuerySuggest.SuggestionAnswer
    ):void {
        const queryObj = state.queries[sourceId];
        const newSugg = {
            timeReq: data.timeReq,
            data: data.results,
            isPartial: data.isPartial,
            valuePosStart: data.valueStartIdx,
            valuePosEnd: data.valueEndIdx,
            attrPosStart: data.attrStartIdx,
            attrPosEnd: data.attrEndIdx
        };
        const tokIdx = findTokenIdxByFocusIdx(queryObj, position);
        if (tokIdx < 0) {
            return; // the position is gone (user has edited the text meanwile)
        }
        const suggTime = this.getSuggestionTime(queryObj, position);
        if (suggTime > data.timeReq) {
            return; // an older suggestion (for already rewritten word) has arrived
        }
        if (queryObj.qtype === 'simple') {
            queryObj.queryParsed[tokIdx].suggestions = newSugg;
            this.rehighlightSimpleQuery(queryObj);

        } else if (this.someSuggestionIsNonEmpty(newSugg)) {
            queryObj.parsedAttrs[tokIdx].suggestions = newSugg;
            this.reparseAdvancedQuery(state, sourceId, false);
        }
    }

    private getSuggestionTime(queryObj:AnyQuery, focusIdx:number):number {
        const tokIdx = findTokenIdxByFocusIdx(queryObj, focusIdx);
        if (tokIdx < 0) {
            return -1;
        }
        if (queryObj.qtype === 'simple') {
            return queryObj.queryParsed[tokIdx].suggestions ?
                    queryObj.queryParsed[tokIdx].suggestions.timeReq : -1;

        } else {
            return queryObj.parsedAttrs[tokIdx].suggestions ?
                    queryObj.parsedAttrs[tokIdx].suggestions.timeReq : -1;
        }
    }

    private shouldDownArrowTriggerHistory(state:QueryFormModelState, sourceId:string):boolean {
        const queryObj = state.queries[sourceId];
        if (queryObj.rawAnchorIdx === queryObj.rawFocusIdx) {
            return queryObj.query.substr(queryObj.rawAnchorIdx+1).search(/[\n\r]/) === -1;

        } else {
            return false;
        }
    }

    private findFocusedAttr(queryObj:AdvancedQuery):ParsedAttr|undefined {
        return List.find(
            (v, i) => v.rangeAll[0] <= queryObj.rawFocusIdx && (
                queryObj.rawFocusIdx <= v.rangeAll[1]),
            queryObj.parsedAttrs
        );
    }

    private moveCursorToPos(state:QueryFormModelState, sourceId:string, posIdx:number):void {
        state.queries[sourceId].rawAnchorIdx = posIdx;
        state.queries[sourceId].rawFocusIdx = posIdx;
        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(
            state, sourceId);
    }

    private getQueryLength(state:QueryFormModelState, sourceId:string):number {
        return state.queries[sourceId].query ? (state.queries[sourceId].query || '').length : 0;
    }

    private moveCursorToEnd(state:QueryFormModelState, sourceId:string):void {
        this.moveCursorToPos(state, sourceId, state.queries[sourceId].query.length);
    }

/**
     * @param range in case we want to insert a CQL snippet into an existing code;
     *              if undefined then whole query is replaced
     */
    protected setRawQuery(
        state:QueryFormModelState,
        sourceId:string,
        query:string,
        insertRange:[number, number]|null

    ):void {
        const queryObj = state.queries[sourceId];
        if (insertRange !== null) {
            queryObj.query = queryObj.query.substring(0, insertRange[0]) + query +
                    queryObj.query.substring(insertRange[1]);

        } else {
            queryObj.query = query;
        }

        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(
            state, sourceId);

        if (queryObj.qtype === 'advanced') {
            this.reparseAdvancedQuery(state, sourceId, true);

        } else {
            const newTokens = parseSimpleQuery(queryObj);
            const diff = diffArrays(
                List.map(v => v.value, queryObj.queryParsed),
                List.map(v => v.value, newTokens)
            );
            let pos = 0;
            for (let i = 0; i < diff.length; i++) {
                if (!diff[i].added && !diff[i].removed) {
                    List.forEach(
                        _ => {
                            queryObj.queryParsed[pos].trailingSpace = newTokens[pos].trailingSpace;
                            pos += 1;
                        },
                        diff[i].value
                    );

                } else if (diff[i].added) {
                    List.forEach(
                        _ => {
                            queryObj.queryParsed.splice(pos, 0, newTokens[pos]);
                            pos += 1;
                        },
                        diff[i].value
                    );

                } else if (diff[i].removed) {
                    List.forEach(
                        _ => {
                            queryObj.queryParsed.splice(pos, 1);
                        },
                        diff[i].value
                    )
                }
            }
            if (diff.length > 0) {
                queryObj.query = pipe(
                    queryObj.queryParsed,
                    List.map(item => item.value + item.trailingSpace)
                ).join('');
            }
            this.rehighlightSimpleQuery(queryObj);
        }
    }

    private determineSuggValueType(sourceId:string):PluginInterfaces.QuerySuggest.QueryValueSubformat {
        return determineSuggValueType(this.state.queries[sourceId]);
    }

    private shouldAskForSuggestion(sourceId:string, srchWord:string):boolean {
        const queryObj = this.state.queries[sourceId];
        // TODO maybe the 'use_regexp' should be allowed in case plug-in is OK with that
        const queryOptsOk = queryObj.qtype === 'simple' && !queryObj.use_regexp ||
            queryObj.qtype === 'advanced';
        return this.state.suggestionsConfigured && !!srchWord.trim() && queryOptsOk;
    }

    protected validateQuery(query:string, queryType:QueryType):boolean {
        const parseFn = ((query:string) => {
            switch (queryType) {
                case 'advanced':
                    return parseQuery.bind(
                        null,
                        query,
                        {
                            startRule: List.head(getApplyRules('conc')),
                            tracer: this.queryTracer
                        }
                    );
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

    protected addQueryInfix(
        state:QueryFormModelState,
        sourceId:string,
        query:string,
        insertRange:[number, number]
    ):void {
        const queryObj = state.queries[sourceId];
        queryObj.query = queryObj.query.substring(0, insertRange[0]) + query +
                queryObj.query.substr(insertRange[1]);
        if (queryObj.qtype === 'simple') {
            queryObj.queryParsed = parseSimpleQuery(queryObj);
        }
        /* TODO !!!!
        if (!this.noSuggestion(state, sourceId, queryObj.query)) {
            state.querySuggestions[sourceId][queryObj.query].valuePosEnd = insertRange[0] + query.length;
        }
        */
    }

    protected testQueryNonEmpty(sourceId:string):Error|null {
        if (this.state.queries[sourceId].query.length > 0) {
            return null;

        } else {
            return new Error(this.pageModel.translate('query__query_must_be_entered'));
        }
    }

    private isPossibleQueryTypeMismatch(sourceId:string):[boolean, QueryType] {
        const query = this.state.queries[sourceId].query;
        const queryType = this.state.queries[sourceId].qtype;
        return tuple(this.validateQuery(query, queryType), queryType);
    }

    protected testQueryTypeMismatch():Error|null {
        const errors = pipe(
            this.state.queries,
            Dict.toEntries(),
            List.map(([corpname,]) => this.isPossibleQueryTypeMismatch(corpname)),
            List.filter(([err,]) => !!err)
        );
        if (List.empty(errors)) {
            return null;
        }
        const [err, type] = List.head(errors);
        if (window.confirm(this.pageModel.translate(
                'global__query_type_mismatch_confirm_{type}', {type:
                    type === 'advanced' ?
                            this.pageModel.translate('query__qt_advanced') :
                            this.pageModel.translate('query__qt_simple')}))) {
            return null;
        }
        return new Error(this.pageModel.translate('global__query_type_mismatch'));
    }

    getRegistrationId():string {
        return this.ident;
    }

}