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

import { StatefulModel, IFullActionControl } from 'kombo';
import { List, Dict, pipe, tuple } from 'cnc-tskit';

import { Kontext, typedProps } from '../../../types/common';
import { PageModel } from '../../../app/page';
import { AttrHelper } from './attrs';
import { highlightSyntax, ParsedAttr } from './parser';
import { Actions, ActionName } from '../actions';
import { Actions as GeneralViewOptionsActions, ActionName as GeneralViewOptionsActionName }
    from '../../options/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../../common/actions';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { IUnregistrable } from '../../common/common';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PluginInterfaces } from '../../../types/plugins';

/**
 *
 */
export interface CQLEditorModelState {

    rawCode:{[key:string]:string};

    richCode:{[key:string]:string};

    parsedAttrs:{[key:string]:Array<ParsedAttr>};

    focusedAttr:{[key:string]:ParsedAttr|undefined};

    message:{[key:string]:string};

    rawAnchorIdx:{[key:string]:number};

    rawFocusIdx:{[key:string]:number};

    downArrowTriggersHistory:{[key:string]:boolean};

    isEnabled:boolean;

    cqlEditorMessage:{[key:string]:string};

    isReady:boolean;

    suggestionsVisibility:PluginInterfaces.QuerySuggest.SuggestionVisibility;
}

interface CQLEditorSetRawQueryProps {
    sourceId:string;
    query:string;
    rawFocusIdx:number;
    rawAnchorIdx:number;
    insertRange:[number, number]|null;
}


export interface CQLEditorModelInitArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    structList:Array<string>;
    tagAttr:string;
    isEnabled:boolean;
    currQueries?:{[sourceId:string]:string};
    suggestionsVisibility:PluginInterfaces.QuerySuggest.SuggestionVisibility;
}

export interface CQLEditorModelCorpusSwitchPreserve {
    rawCode:{[key:string]:string};
    message:{[key:string]:string};
    rawAnchorIdx:{[key:string]:number};
    rawFocusIdx:{[key:string]:number};
    cqlEditorMessage:{[key:string]:string};
}


function highlightAllQueries(
    pageModel:PageModel,
    attrHelper:AttrHelper,
    queries:{[sourceId:string]:string}

):Array<[string, string, Array<ParsedAttr>]> {
    return pipe(
        queries || {},
        Dict.keys(),
        List.map(sourceId => tuple(
            sourceId,
            ...(queries[sourceId] ?
                highlightSyntax(
                    queries[sourceId],
                    'advanced',
                    pageModel.getComponentHelpers(),
                    attrHelper,
                    (_) => () => undefined
                ) : tuple('', []))
        )),
    );
}


/**
 *
 */
export class CQLEditorModel extends StatefulModel<CQLEditorModelState> implements IUnregistrable {

    private readonly pageModel:PageModel;

    private readonly attrHelper:AttrHelper;

    private readonly hintListener:(state:CQLEditorModelState, sourceId:string, msg:string)=>void;

    private readonly autoSuggestTrigger:Subject<string>; // stream of source IDs


    constructor({dispatcher, pageModel, attrList, structAttrList, structList, tagAttr,
                    isEnabled, currQueries, suggestionsVisibility}:CQLEditorModelInitArgs) {
        const attrHelper = new AttrHelper(attrList, structAttrList, structList, tagAttr);
        const queryData = highlightAllQueries(pageModel, attrHelper, currQueries);
        super(
            dispatcher,
            {
                rawCode: (currQueries || {}),
                richCode: pipe(
                    queryData,
                    List.map(([ident, query]) => tuple(ident, query)),
                    Dict.fromEntries()
                ),
                parsedAttrs: pipe(
                    queryData,
                    List.map(([ident,,attrs]) => tuple(ident, attrs)),
                    Dict.fromEntries()
                ),
                focusedAttr: {},
                message: {},
                rawAnchorIdx: {},
                rawFocusIdx: {},
                cqlEditorMessage: {},
                isEnabled,
                isReady: false,
                downArrowTriggersHistory: {},
                suggestionsVisibility
            }
        );
        this.attrHelper = attrHelper;
        this.pageModel = pageModel;
        this.hintListener = (state, sourceId, msg) => {
            state.message[sourceId] = msg;
        };
        this.autoSuggestTrigger = new Subject<string>();
        this.autoSuggestTrigger.pipe(debounceTime(500)).subscribe(
            (sourceId) => {
                const currAttr = this.state.focusedAttr[sourceId];
                if (currAttr && this.state.suggestionsVisibility !==
                    PluginInterfaces.QuerySuggest.SuggestionVisibility.DISABLED) {
                    dispatcher.dispatch<PluginInterfaces.QuerySuggest.Actions.AskSuggestions>({
                        name: PluginInterfaces.QuerySuggest.ActionName.AskSuggestions,
                        payload: {
                            corpora: List.concat(
                                this.pageModel.getConf<Array<string>>('alignedCorpora'),
                                [this.pageModel.getCorpusIdent().id]
                            ),
                            subcorpus: null, // TODO
                            value: currAttr.value.replace(/^"(.+)"$/, '$1'),
                            valueType: 'unspecified',
                            queryType: 'advanced',
                            posAttr: currAttr.type === 'posattr' ? currAttr.name : null,
                            struct: undefined, // TODO
                            structAttr: undefined, // TODO
                            sourceId
                        }
                    });
                }
            }
        );

        this.addActionHandler<Actions.CQLEditorInitialize>(
            ActionName.CQLEditorInitialize,
            action => {
                dispatcher.dispatch<Actions.CQLEditorInitializeDone>({
                    name: ActionName.CQLEditorInitializeDone
                });
            }
        );

        this.addActionHandler<Actions.CQLEditorInitializeDone>(
            ActionName.CQLEditorInitializeDone,
            action => {
                this.changeState(state => {
                    state.isReady = true;
                });
            }
        );

        this.addActionHandler<Actions.CQLEditorEnable>(
            ActionName.CQLEditorEnable,
            action => {
                this.changeState(state => {
                    state.isEnabled = true;
                    Dict.forEach(
                        (query, sourceId) => {
                            [state.richCode[sourceId], state.parsedAttrs[sourceId]] =
                                highlightSyntax(
                                    query,
                                    'advanced',
                                    this.pageModel.getComponentHelpers(),
                                    this.attrHelper,
                                    (msg) => this.hintListener(state, sourceId, msg)
                                );
                        },
                        state.rawCode
                    );
                });
            }
        );

        this.addActionHandler<Actions.CQLEditorDisable>(
            ActionName.CQLEditorDisable,
            action => {
                this.changeState(state => {
                    state.isEnabled = false;
                });
            }
        );

        this.addActionHandler<GeneralViewOptionsActions.GeneralSetUseCQLEditor>(
            GeneralViewOptionsActionName.GeneralSetUseCQLEditor,
            action => {
                this.changeState(state => {
                    state.isEnabled = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.QueryInputMoveCursor>(
            ActionName.QueryInputMoveCursor,
            action => {
                this.changeState(state => {
                    state.rawAnchorIdx[action.payload.sourceId] = action.payload.rawAnchorIdx;
                    state.rawFocusIdx[action.payload.sourceId] = action.payload.rawFocusIdx;
                    state.downArrowTriggersHistory[action.payload.sourceId] =
                        this.shouldDownArrowTriggerHistory(
                            state,
                            action.payload.sourceId
                        )
                    state.focusedAttr[action.payload.sourceId] = this.findFocusedAttr(
                        state, action.payload.sourceId);
                });
                this.autoSuggestTrigger.next(action.payload.sourceId);
            }
        );

        this.addActionHandler<Actions.QueryInputSetQuery>(
            ActionName.QueryInputSetQuery,
            action => {
                this.changeState(state => {
                    const args = typedProps<CQLEditorSetRawQueryProps>(action.payload);
                    if (args.rawAnchorIdx !== undefined && args.rawFocusIdx !== undefined) {
                        state.rawAnchorIdx[args.sourceId] = args.rawAnchorIdx || args.query.length;
                        state.rawFocusIdx[args.sourceId] = args.rawFocusIdx || args.query.length;
                    }
                    this.setRawQuery(
                        state,
                        args.sourceId,
                        args.query,
                        args.insertRange
                    );
                    if (args.rawAnchorIdx === null && args.rawFocusIdx === null) {
                        this.moveCursorToPos(
                            state, args.sourceId, state.rawCode[args.sourceId].length
                        );
                    }
                    state.focusedAttr[args.sourceId] = this.findFocusedAttr(
                        state, action.payload.sourceId);
                });
                this.autoSuggestTrigger.next(action.payload.sourceId);
            }
        );

        this.addActionHandler<Actions.QueryInputAppendQuery>(
            ActionName.QueryInputAppendQuery,
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
                    this.moveCursorToEnd(state, action.payload.sourceId);
                    state.focusedAttr[action.payload.sourceId] = this.findFocusedAttr(
                        state, action.payload.sourceId);
                });
                this.autoSuggestTrigger.next(action.payload.sourceId);
            }
        );

        this.addActionHandler<Actions.QueryInputRemoveLastChar>(
            ActionName.QueryInputRemoveLastChar,
            action => {
                this.changeState(state => {
                    const queryLength = state.rawCode[action.payload.sourceId].length;
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
                this.autoSuggestTrigger.next(action.payload.sourceId);
            }
        );

        this.addActionHandler<Actions.EditQueryOperationDone>(
            ActionName.EditQueryOperationDone,
            action => {
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else {
                    this.changeState(state => {
                        const data = action.payload.data;
                        if (AjaxResponse.isQueryFormArgs(data) &&
                                data.curr_query_types[action.payload.sourceId] === 'advanced') {
                            this.setRawQuery(
                                state,
                                action.payload.sourceId,
                                data.curr_queries[action.payload.sourceId],
                                null
                            );

                        } else if (AjaxResponse.isFilterFormArgs(data) && data.query_type === 'advanced') {
                            this.setRawQuery(
                                state,
                                action.payload.sourceId,
                                data.query,
                                null
                            );
                        }
                    });
                }
            }
        );

        this.addActionHandler<Actions.QueryOverviewEditorClose>(
            ActionName.QueryOverviewEditorClose,
            action => {
                this.changeState(state => {
                    state.isReady = false;
                });
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            action => {
                this.changeState(state => {
                    dispatcher.dispatch<GlobalActions.SwitchCorpusReady<
                            CQLEditorModelCorpusSwitchPreserve>>({
                        name: GlobalActionName.SwitchCorpusReady,
                        payload: {
                            modelId: this.getRegistrationId(),
                            data: this.serialize(state)
                        }
                    });
                });
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            action => {
                this.changeState(state => {
                    if (!action.error) {
                        this.deserialize(
                            state,
                            action.payload.data[this.getRegistrationId()] as
                                CQLEditorModelCorpusSwitchPreserve,
                            action.payload.corpora
                        );
                    }
                });
            }
        );
    }

    private findFocusedAttr(state:CQLEditorModelState, sourceId:string):ParsedAttr|undefined {
        const focus = state.rawFocusIdx[sourceId];
        const attrs = state.parsedAttrs[sourceId];
        return List.find(
            (v, i) => v.rangeAll[0] <= focus && (
                focus <= v.rangeAll[1] ||
                focus > v.rangeAll[1] && i === 0),
            attrs
        );
    }

    getRegistrationId():string {
        return 'CQLEditorModelState';
    }

    serialize(state:CQLEditorModelState):CQLEditorModelCorpusSwitchPreserve {
        return {
            rawCode: {...state.rawCode},
            message: {...state.message},
            rawAnchorIdx: {...state.rawAnchorIdx},
            rawFocusIdx: {...state.rawFocusIdx},
            cqlEditorMessage: {...state.cqlEditorMessage}
        };
    }

    deserialize(
        state:CQLEditorModelState,
        data:CQLEditorModelCorpusSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        if (data && state.isEnabled) {
            pipe(
                corpora,
                List.forEach(
                    ([oldCorp, newCorp]) => {
                        this.setRawQuery(
                            state,
                            newCorp,
                            data.rawCode[oldCorp],
                            null
                        );
                        state.message[newCorp] = state.message[oldCorp];
                        state.rawAnchorIdx[newCorp] = state.rawAnchorIdx[oldCorp];
                        state.rawFocusIdx[newCorp] = state.rawFocusIdx[oldCorp];
                        state.cqlEditorMessage[newCorp] = state.cqlEditorMessage[oldCorp];
                    }
                )
            );
        }
    }

    private getQueryLength(state:CQLEditorModelState, sourceId:string):number {
        return state.rawCode[sourceId] ? (state.rawCode[sourceId] || '').length : 0;
    }

    private moveCursorToPos(state:CQLEditorModelState, sourceId:string, posIdx:number):void {
        state.rawAnchorIdx[sourceId] = posIdx;
        state.rawFocusIdx[sourceId] = posIdx;
        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(
            state, sourceId);
    }

    private moveCursorToEnd(state:CQLEditorModelState, sourceId:string):void {
        this.moveCursorToPos(state, sourceId, state.rawCode[sourceId].length);
    }

    private shouldDownArrowTriggerHistory(state:CQLEditorModelState, sourceId:string):boolean {
        const q = state.rawCode[sourceId] || '';
        const anchorIdx = state.rawAnchorIdx[sourceId];
        const focusIdx = state.rawFocusIdx[sourceId];

        if (anchorIdx === focusIdx) {
            return q.substr(anchorIdx+1).search(/[\n\r]/) === -1;

        } else {
            return false;
        }
    }

    /**
     * @param range in case we want to insert a CQL snippet into an existing code;
     *              if undefined then whole query is replaced
     */
    private setRawQuery(
        state:CQLEditorModelState,
        sourceId:string,
        query:string,
        insertRange:[number, number]|null

    ):void {
        let newQuery:string;

        if (!state.rawCode[sourceId]) {
            state.rawCode[sourceId] = '';
        }
        if (insertRange !== null) {
            newQuery = state.rawCode[sourceId].substring(0, insertRange[0]) + query +
                    state.rawCode[sourceId].substr(insertRange[1]);

        } else {
            newQuery = query;
        }

        state.rawCode[sourceId] = newQuery;

        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(
            state, sourceId);

        if (state.isEnabled) {
            [state.richCode[sourceId], state.parsedAttrs[sourceId]] = highlightSyntax(
                state.rawCode[sourceId] ? state.rawCode[sourceId] : '',
                'advanced',
                this.pageModel.getComponentHelpers(),
                this.attrHelper,
                (msg) => this.hintListener(state, sourceId, msg)
            );

        } else {
            state.richCode[sourceId] = '';
        }
    }

}