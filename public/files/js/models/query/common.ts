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

import { Kontext, TextTypes, ViewOptions } from '../../types/common';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { parse as parseQuery, ITracer } from 'cqlParser/parser';
import { ConcServerArgs } from '../concordance/common';
import { QueryFormType, Actions, ActionName } from './actions';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PluginInterfaces } from '../../types/plugins';
import { Actions as CorpOptActions, ActionName as CorpOptActionName } from '../options/actions';
import { advancedToSimpleQuery, AnyQuery, parseSimpleQuery, QueryType, simpleToAdvancedQuery } from './query';
import { highlightSyntax, ParsedAttr } from './cqleditor/parser';
import { AttrHelper } from './cqleditor/attrs';


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
    queries:Array<AnyQuery>;
    maincorp:string|null;
    usesubcorp:string|null;
    viewmode:'kwic'|'sen'|'align';
    pagesize:number;
    shuffle:0|1;
    attrs:Array<string>;
    ctxattrs:Array<string>;
    attr_vmode:ViewOptions.AttrViewMode;
    base_viewattr:string;
    structs:Array<string>;
    refs:Array<string>;
    fromp:number;
    text_types:TextTypes.ExportedSelection;
    context:QueryContextArgs;
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

export interface FilterServerArgs extends ConcServerArgs {
    pnfilter:string;
    filfl:string;
    filfpos:string;
    filtpos:string;
    inclkwic:0|1;
    qtype:QueryType;
    query:string;
    qmcase:boolean;
    within:boolean;
    default_attr:string;
    use_regexp:boolean;
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
    useCQLEditor:boolean;
    tagAttr:string;
}

export const appendQuery = (origQuery:string, query:string, prependSpace:boolean):string => {
    return origQuery + (origQuery && prependSpace ? ' ' : '') + query;
};

export interface WithinBuilderData extends Kontext.AjaxResponse {
    structattrs:{[attr:string]:Array<string>};
}

export interface TokenSuggestions {
    data:Array<PluginInterfaces.QuerySuggest.DataAndRenderer<unknown>>;
    isPartial:boolean;
    valuePosStart:number;
    valuePosEnd:number;
    attrPosStart?:number;
    attrPosEnd?:number;
    timeReq:number;
}

export interface SuggestionsData {
    [sourceId:string]:{[word:string]:TokenSuggestions};
}


export interface QueryFormModelState {

    formType:QueryFormType;

    forcedAttr:string;

    attrList:Array<Kontext.AttrItem>;

    structAttrList:Array<Kontext.AttrItem>;

    wPoSList:Array<{v:string; n:string}>;

    currentAction:string;

    currentSubcorp:string;

    queries:{[sourceId:string]:AnyQuery}; // corpname|filter_id -> query

    richCode:{[sourceId:string]:string};

    cqlEditorMessages:{[sourceId:string]:string};

    rawAnchorIdx:{[sourceId:string]:number};

    rawFocusIdx:{[sourceId:string]:number};

    parsedAttrs:{[sourceId:string]:Array<ParsedAttr>};

    focusedAttr:{[sourceId:string]:ParsedAttr|undefined};

    querySuggestions:SuggestionsData;

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

    queryOptionsVisible:{[sourceId:string]:boolean};

    historyVisible:{[sourceId:string]:boolean};

    suggestionsVisible:{[sourceId:string]:boolean};

    suggestionsVisibility:PluginInterfaces.QuerySuggest.SuggestionVisibility;

    queryStructureVisible:{[sourceId:string]:boolean};

    isBusy:boolean;

    cursorPos:number;

    /**
     * In case of a simple query, this sequence determines
     * which attribute is set in case nothing is specified by user.
     * The client starts with 0-th item and if nothing is found,
     * 1-th is used etc.
     */
    simpleQueryAttrSeq:Array<string>;
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

function findCursorWord(value:string, focusIdx:number):[string, number, number] {
    const ans:Array<[string, number, number]> = [];
    let curr:[string, number, number] = ['', 0, 0];
    for (let i = 0; i < value.length; i++) {
        if (value[i] === ' ') {
            if (curr) {
                ans.push(curr);
            }
            curr = [value[i] === ' ' ? '' : value[i], i + 1, i + 1];

        } else {
            curr[0] += value[i];
            curr[2] = i + 1;
        }
    }
    ans.push(curr);
    for (let i = 0; i < ans.length; i++) {
        const [, f, t] = ans[i];
        if (focusIdx >= f && focusIdx <= t) {
            return ans[i];
        }
    }
    return ['', 0, 0];
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

    // stream of [source ID, rawAnchorIdx, rawFocusIdx]
    protected readonly autoSuggestTrigger:Subject<[string, number, number]>;

    private readonly attrHelper:AttrHelper;

    // -------

    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            textTypesModel:TextTypesModel,
            queryContextModel:QueryContextModel,
            ident:string,
            props:GeneralQueryFormProperties,
            initState:T) {
        super(
            dispatcher,
            initState
        );
        this.hintListener = this.hintListener.bind(this);
        this.pageModel = pageModel;
        this.textTypesModel = textTypesModel;
        this.queryContextModel = queryContextModel;
        this.queryTracer = {trace:(_)=>undefined};
        this.ident = ident;
        this.formType = initState.formType;
        this.attrHelper = new AttrHelper(
            props.attrList, props.structAttrList, props.structList, props.tagAttr);
        this.autoSuggestTrigger = new Subject<[string, number, number]>();
        this.autoSuggestTrigger.pipe(
            debounceTime(500)
        ).subscribe(
            ([sourceId,, rawFocusIdx]) => {
                const [srchWord, srchWordStart, srchWordEnd] = findCursorWord(
                    this.state.queries[sourceId].query,
                    rawFocusIdx
                );
                if (this.shouldAskForSuggestion(sourceId, srchWord)) {
                    dispatcher.dispatch<PluginInterfaces.QuerySuggest.Actions.AskSuggestions>({
                        name: PluginInterfaces.QuerySuggest.ActionName.AskSuggestions,
                        payload: {
                            timeReq: new Date().getTime(),
                            corpora: List.concat(
                                this.pageModel.getConf<Array<string>>('alignedCorpora'),
                                [this.pageModel.getCorpusIdent().id]
                            ),
                            subcorpus: this.state.currentSubcorp,
                            value: srchWord,
                            valueStartIdx: srchWordStart,
                            valueEndIdx: srchWordEnd,
                            valueType: 'unspecified',
                            valueSubformat: this.determineSuggValueType(sourceId),
                            queryType: this.state.queries[sourceId].qtype,
                            posAttr: this.state.queries[sourceId].default_attr,
                            struct: undefined,
                            structAttr: undefined,
                            sourceId
                        }
                    });

                } else {
                    dispatcher.dispatch<PluginInterfaces.QuerySuggest.Actions.ClearSuggestions>({
                        name: PluginInterfaces.QuerySuggest.ActionName.ClearSuggestions
                    });
                }
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetQType>(
            ActionName.QueryInputSetQType,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const query = state.queries[action.payload.sourceId];
                    if (query.qtype === 'advanced' && action.payload.queryType === 'simple') {
                        state.queries[action.payload.sourceId] = advancedToSimpleQuery(query);

                    } else if (query.qtype === 'simple' && action.payload.queryType === 'advanced') {
                        state.queries[action.payload.sourceId] = simpleToAdvancedQuery(query);
                    }
                    state.supportedWidgets = determineSupportedWidgets(
                        state.queries,
                        state.tagBuilderSupport,
                        state.isAnonymousUser
                    );
                })
            }
        );

        this.addActionSubtypeHandler<Actions.ToggleQueryHistoryWidget>(
            ActionName.ToggleQueryHistoryWidget,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.historyVisible[action.payload.sourceId] =
                        !state.historyVisible[action.payload.sourceId];
                    state.suggestionsVisible[action.payload.sourceId] = false;
                });
            }
        );

        this.addActionSubtypeHandler<Actions.ToggleQuerySuggestionWidget>(
            ActionName.ToggleQuerySuggestionWidget,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.suggestionsVisible[action.payload.sourceId] =
                        !state.suggestionsVisible[action.payload.sourceId];
                });
            }
        );

        this.addActionSubtypeHandler<Actions.ToggleQueryStructureWidget>(
            ActionName.ToggleQueryStructureWidget,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.queryStructureVisible[action.payload.sourceId] =
                        !state.queryStructureVisible[action.payload.sourceId];
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryOptionsToggleForm>(
            ActionName.QueryOptionsToggleForm,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.queryOptionsVisible[action.payload.sourceId] =
                            !state.queryOptionsVisible[action.payload.sourceId];
                })
            }
        )

        this.addActionSubtypeHandler<Actions.QueryInputSetDefaultAttr>(
            ActionName.QueryInputSetDefaultAttr,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    state.queries[action.payload.sourceId].default_attr = action.payload.value;
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    0,
                    0
                ));
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetMatchCase>(
            ActionName.QueryInputSetMatchCase,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    const val = state.queries[action.payload.sourceId];
                    if (val.qtype === 'simple') {
                        val.qmcase = action.payload.value;
                        if (val.qmcase) {
                            val.use_regexp = false;
                        }

                    } else {
                        console.error('Invalid query type');
                    }
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputToggleAllowRegexp>(
            ActionName.QueryInputToggleAllowRegexp,
            action => action.payload.formType === this.state.formType,
            action => {
                this.changeState(state => {
                    const val = state.queries[action.payload.sourceId];
                    if (val.qtype === 'simple') {
                        val.use_regexp = !val.use_regexp;
                        if (val.use_regexp) {
                            val.qmcase = false;
                        }
                    }
                });
            }
        );

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
                    if (action.payload.rawAnchorIdx !== undefined &&
                            action.payload.rawFocusIdx !== undefined) {
                        state.rawAnchorIdx[action.payload.sourceId] = action.payload.rawAnchorIdx ||
                            action.payload.query.length;
                        state.rawFocusIdx[action.payload.sourceId] = action.payload.rawFocusIdx ||
                            action.payload.query.length;
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

        this.addActionSubtypeHandler<Actions.QueryInputAppendQuery>(
            ActionName.QueryInputAppendQuery,
            action => action.payload.formType === 'query',
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
                    const queryObj = state.queries[action.payload.sourceId];
                    if (queryObj.qtype === 'simple') {
                        queryObj.queryParsed = parseSimpleQuery(queryObj);
                    }

                    if (action.payload.closeWhenDone) {
                        state.activeWidgets[action.payload.sourceId] = null;
                    }
                });
            }
        );

        this.addActionHandler<Actions.QueryInputRemoveLastChar>(
            ActionName.QueryInputRemoveLastChar,
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
                    state.focusedAttr[action.payload.sourceId] = this.findFocusedAttr(
                        state, action.payload.sourceId);
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    this.state.rawAnchorIdx[action.payload.sourceId],
                    this.state.rawFocusIdx[action.payload.sourceId]
                ));
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputMoveCursor>(
            ActionName.QueryInputMoveCursor,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    state.rawAnchorIdx[action.payload.sourceId] = action.payload.rawAnchorIdx;
                    state.rawFocusIdx[action.payload.sourceId] = action.payload.rawFocusIdx;
                    state.downArrowTriggersHistory[action.payload.sourceId] =
                        this.shouldDownArrowTriggerHistory(
                            state,
                            action.payload.sourceId
                        );
                        state.cursorPos = action.payload.rawAnchorIdx;
                        state.focusedAttr[action.payload.sourceId] = this.findFocusedAttr(
                            state, action.payload.sourceId);
                });
                this.autoSuggestTrigger.next(tuple(
                    action.payload.sourceId,
                    action.payload.rawAnchorIdx,
                    action.payload.rawFocusIdx
                ));
            }
        );

        this.addActionSubtypeHandler<PluginInterfaces.QuerySuggest.Actions.ItemClicked>(
            PluginInterfaces.QuerySuggest.ActionName.ItemClicked,
            action => action.payload.formType === this.formType,
            action => {
                this.changeState(state => {
                    const wordPos =
                        action.payload.onItemClick === 'replace' ?
                            [action.payload.valueStartIdx, action.payload.valueEndIdx] :
                        action.payload.onItemClick === 'insert' ?
                            [state.cursorPos, state.cursorPos] :
                            undefined

                    if (wordPos === undefined) {
                        pageModel.showMessage(
                            'error',
                            `Unknown query suggestion click action: "${action.payload.onItemClick}"`
                        );

                    } else {
                        this.addQueryInfix(
                            state,
                            action.payload.sourceId,
                            action.payload.value,
                            [wordPos[0], wordPos[1]]
                        );

                        // TODO on refocus on the input cursor is on the end
                        // this is to prevent confusion
                        state.cursorPos = state.queries[action.payload.sourceId].query.length;

                        state.queries[action.payload.sourceId].default_attr = action.payload.attr;
                    }
                    state.suggestionsVisible[action.payload.sourceId] = false;
                });
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.AskSuggestions>(
            PluginInterfaces.QuerySuggest.ActionName.AskSuggestions,
            action => {
                this.changeState(state => {
                    delete state.querySuggestions[action.payload.sourceId];
                    state.suggestionsVisible[action.payload.sourceId] = false;
                });
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.SuggestionsReceived>(
            PluginInterfaces.QuerySuggest.ActionName.SuggestionsReceived,
            action => {
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);
                    this.changeState(state => {
                        state.querySuggestions = {};
                        state.suggestionsVisible[action.payload.sourceId] = false;
                    });

                } else if (this.noValidSuggestion(
                    this.state,
                    action.payload.sourceId,
                    action.payload.value,
                    action.payload
                )) {
                    this.changeState(state => {
                        this.addSuggestion(
                            state,
                            action.payload.sourceId,
                            action.payload.value,
                            action.payload
                        );
                    });
                }
            }
        );

        this.addActionHandler<PluginInterfaces.QuerySuggest.Actions.ClearSuggestions>(
            PluginInterfaces.QuerySuggest.ActionName.ClearSuggestions,
            action => {
                this.changeState(state => {
                    state.querySuggestions = {};
                });
            }
        );

        this.addActionHandler<CorpOptActions.SaveSettingsDone>(
            CorpOptActionName.SaveSettingsDone,
            action => {
                this.changeState(state => {
                    state.suggestionsVisibility = action.payload.qsVisibilityMode;
                    if (
                        state.suggestionsVisibility !==
                            PluginInterfaces.QuerySuggest.SuggestionVisibility.AUTO
                    ) {
                        state.suggestionsVisible = Dict.map(
                            v => false,
                            state.suggestionsVisible
                        );
                    }
                });
            }
        );
    }

    private noValidSuggestion(
        state:QueryFormModelState,
        sourceId:string,
        word:string,
        data:PluginInterfaces.QuerySuggest.SuggestionArgs & PluginInterfaces.QuerySuggest.SuggestionAnswer
    ) {
        return !Dict.hasKey(sourceId, state.querySuggestions) ||
                !Dict.hasKey(word, state.querySuggestions[sourceId]) ||
                        state.querySuggestions[sourceId][word].timeReq <= data.timeReq;
    }

    private noSuggestion(
        state:QueryFormModelState,
        sourceId:string,
        word:string,
    ):boolean {
        return !Dict.hasKey(sourceId, state.querySuggestions) ||
            !Dict.hasKey(word, state.querySuggestions[sourceId]);
    }

    private addSuggestion(
        state:QueryFormModelState,
        sourceId:string,
        word:string,
        data:PluginInterfaces.QuerySuggest.SuggestionArgs & PluginInterfaces.QuerySuggest.SuggestionAnswer
    ):void {
        if (state.querySuggestions[sourceId] === undefined) {
            state.querySuggestions[sourceId] = {};
        }
        state.querySuggestions[sourceId][word] = {
            timeReq: data.timeReq,
            data: data.results,
            isPartial: data.isPartial,
            valuePosStart: data.valueStartIdx,
            valuePosEnd: data.valueEndIdx,
            attrPosStart: data.attrStartIdx,
            attrPosEnd: data.attrEndIdx
        };
        if (
            state.suggestionsVisibility ===
            PluginInterfaces.QuerySuggest.SuggestionVisibility.AUTO
        ) {
            state.suggestionsVisible[data.sourceId] = true;
            state.historyVisible[data.sourceId] = false;
        }
    }

    private hintListener(state:QueryFormModelState, sourceId:string, msg:string):void {
        state.cqlEditorMessages[sourceId] = msg;
    }

    private shouldDownArrowTriggerHistory(state:QueryFormModelState, sourceId:string):boolean {
        const q = state.queries[sourceId].query;
        const anchorIdx = state.rawAnchorIdx[sourceId];
        const focusIdx = state.rawFocusIdx[sourceId];

        if (anchorIdx === focusIdx) {
            return q.substr(anchorIdx+1).search(/[\n\r]/) === -1;

        } else {
            return false;
        }
    }

    private findFocusedAttr(state:QueryFormModelState, sourceId:string):ParsedAttr|undefined {
        const focus = state.rawFocusIdx[sourceId];
        const attrs = state.parsedAttrs[sourceId];
        return List.find(
            (v, i) => v.rangeAll[0] <= focus && (
                focus <= v.rangeAll[1]),
            attrs
        );
    }

    private moveCursorToPos(state:QueryFormModelState, sourceId:string, posIdx:number):void {
        state.rawAnchorIdx[sourceId] = posIdx;
        state.rawFocusIdx[sourceId] = posIdx;
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
    private setRawQuery(
        state:QueryFormModelState,
        sourceId:string,
        query:string,
        insertRange:[number, number]|null

    ):void {
        const queryObj = state.queries[sourceId];
        if (insertRange !== null) {
            queryObj.query = queryObj.query.substring(0, insertRange[0]) + query +
                    queryObj.query.substr(insertRange[1]);
            if (queryObj.qtype === 'simple') {
                queryObj.queryParsed = parseSimpleQuery(queryObj);
            }
            if (!this.noSuggestion(state, sourceId, queryObj.query)) {
                state.querySuggestions[sourceId][queryObj.query].valuePosEnd = insertRange[0] + query.length;
            }

        } else {
            queryObj.query = query;
        }

        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(
            state, sourceId);

        if (queryObj.qtype === 'advanced') {
            [state.richCode[sourceId], state.parsedAttrs[sourceId]] = highlightSyntax(
                queryObj.query,
                'advanced',
                this.pageModel.getComponentHelpers(),
                this.attrHelper,
                (msg) => this.hintListener(state, sourceId, msg)
            );
        }
    }

    private determineSuggValueType(sourceId:string):PluginInterfaces.QuerySuggest.QueryValueSubformat {
        const query = this.state.queries[sourceId];
        if (query.qtype === 'advanced') {
            return 'advanced';

        } else {
            if (query.use_regexp) {
                return 'regexp';

            } else if (query.qmcase) {
                return 'simple';
            }
            return 'simple_ic';
        }
    }

    private shouldAskForSuggestion(sourceId:string, srchWord:string):boolean {
        return this.state.queries[sourceId].qtype !== 'advanced'
                        && this.state.suggestionsVisibility !==
                            PluginInterfaces.QuerySuggest.SuggestionVisibility.DISABLED
                        && !!srchWord.trim();
    }

    protected validateQuery(query:string, queryType:QueryType):boolean {
        const parseFn = ((query:string) => {
            switch (queryType) {
                case 'advanced':
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
        if (!this.noSuggestion(state, sourceId, queryObj.query)) {
            state.querySuggestions[sourceId][queryObj.query].valuePosEnd = insertRange[0] + query.length;
        }
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

    static getCurrWordSuggestion(
        query:string,
        rawFocusIdx:number,
        data:SuggestionsData,
        sourceId:string
    ):[string, TokenSuggestions|null] {

        const [srchWord, srchWordStart, srchWordEnd] = findCursorWord(
            query,
            rawFocusIdx
        );
        const sugg = data[sourceId] ? data[sourceId][srchWord] : undefined;
        if (!sugg) {
            return [srchWord, null];
        }
        return [srchWord, sugg];
    }
}