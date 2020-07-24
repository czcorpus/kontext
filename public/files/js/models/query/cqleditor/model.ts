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

import { IActionDispatcher, StatelessModel } from 'kombo';
import { List, Dict, pipe, tuple } from 'cnc-tskit';

import { Kontext, typedProps } from '../../../types/common';
import { PageModel } from '../../../app/page';
import { AttrHelper } from './attrs';
import { highlightSyntax } from './parser';
import { Actions, ActionName } from '../actions';
import { Actions as GeneralViewOptionsActions, ActionName as GeneralViewOptionsActionName }
    from '../../options/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../../common/actions';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { IUnregistrable } from '../../common/common';

/**
 *
 */
export interface CQLEditorModelState {

    rawCode:{[key:string]:string};

    richCode:{[key:string]:string};

    message:{[key:string]:string};

    rawAnchorIdx:{[key:string]:number};

    rawFocusIdx:{[key:string]:number};

    downArrowTriggersHistory:{[key:string]:boolean};

    isEnabled:boolean;

    cqlEditorMessage:{[key:string]:string};

    isReady:boolean;

}

interface CQLEditorSetRawQueryProps {
    sourceId:string;
    query:string;
    rawFocusIdx:number;
    rawAnchorIdx:number;
    insertRange:[number, number]|null;
}


export interface CQLEditorModelInitArgs {
    dispatcher:IActionDispatcher;
    pageModel:PageModel;
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    structList:Array<string>;
    tagAttr:string;
    isEnabled:boolean;
    currQueries?:{[sourceId:string]:string};
}

export interface CQLEditorModelCorpusSwitchPreserve {
    rawCode:{[key:string]:string};
    message:{[key:string]:string};
    rawAnchorIdx:{[key:string]:number};
    rawFocusIdx:{[key:string]:number};
    cqlEditorMessage:{[key:string]:string};
}


/**
 *
 */
export class CQLEditorModel extends StatelessModel<CQLEditorModelState> implements IUnregistrable {

    private pageModel:PageModel;

    private attrHelper:AttrHelper;

    private hintListener:(state:CQLEditorModelState, sourceId:string, msg:string)=>void;


    constructor({dispatcher, pageModel, attrList, structAttrList, structList, tagAttr,
                    isEnabled, currQueries}:CQLEditorModelInitArgs) {
        const attrHelper = new AttrHelper(attrList, structAttrList, structList, tagAttr);
        super(
            dispatcher,
            {
                rawCode: (currQueries || {}),
                richCode: pipe(
                    currQueries || {},
                    Dict.keys(),
                    List.map(sourceId => tuple(
                        sourceId,
                        currQueries[sourceId] ?
                            highlightSyntax(
                                currQueries[sourceId],
                                'cql',
                                pageModel.getComponentHelpers(),
                                attrHelper,
                                (_) => () => undefined
                            ) : ''
                    )),
                    Dict.fromEntries()
                ),
                message: {},
                rawAnchorIdx: {},
                rawFocusIdx: {},
                cqlEditorMessage: {},
                isEnabled: isEnabled,
                isReady: false,
                downArrowTriggersHistory: {}
            }
        );
        this.attrHelper = attrHelper;
        this.pageModel = pageModel;
        this.hintListener = (state, sourceId, msg) => {
            state.message[sourceId] = msg;
        };

        this.addActionHandler<Actions.CQLEditorInitialize>(
            ActionName.CQLEditorInitialize,
            null,
            (state, action, dispatch) => {
                dispatch<Actions.CQLEditorInitializeDone>({
                    name: ActionName.CQLEditorInitializeDone
                })
            }
        )

        this.addActionHandler<Actions.CQLEditorInitializeDone>(
            ActionName.CQLEditorInitializeDone,
            (state, action) => {
                state.isReady = true;
            }
        );

        this.addActionHandler<Actions.CQLEditorEnable>(
            ActionName.CQLEditorEnable,
            (state, action) => {
                state.isEnabled = true;
                Dict.forEach(
                    (query, sourceId) => {
                        state.richCode[sourceId] = highlightSyntax(
                            query,
                            'cql',
                            this.pageModel.getComponentHelpers(),
                            this.attrHelper,
                            (msg) => this.hintListener(state, sourceId, msg)
                        );
                    },
                    state.rawCode
                );
            }
        );

        this.addActionHandler<Actions.CQLEditorDisable>(
            ActionName.CQLEditorDisable,
            (state, action) => {
                state.isEnabled = false;
            }
        );

        this.addActionHandler<GeneralViewOptionsActions.GeneralSetUseCQLEditor>(
            GeneralViewOptionsActionName.GeneralSetUseCQLEditor,
            (state, action) => {
                state.isEnabled = action.payload.value;
            }
        );

        this.addActionHandler<Actions.QueryInputMoveCursor>(
            ActionName.QueryInputMoveCursor,
            (state, action) => {
                state.rawAnchorIdx[action.payload.sourceId] = action.payload.rawAnchorIdx;
                state.rawFocusIdx[action.payload.sourceId] = action.payload.rawFocusIdx;
                state.downArrowTriggersHistory[action.payload.sourceId] =
                    this.shouldDownArrowTriggerHistory(
                        state,
                        action.payload.sourceId
                    )
            }
        );

        this.addActionHandler<Actions.QueryInputSetQuery>(
            ActionName.QueryInputSetQuery,
            (state, action) => {
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
            }
        );

        this.addActionHandler<Actions.QueryInputAppendQuery>(
            ActionName.QueryInputAppendQuery,
            (state, action) => {
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
            }
        );

        this.addActionHandler<Actions.QueryInputRemoveLastChar>(
            ActionName.QueryInputRemoveLastChar,
            (state, action) => {
                const queryLength = state.rawCode[action.payload.sourceId].length;
                this.setRawQuery(
                    state,
                    action.payload.sourceId,
                    '',
                    tuple(queryLength - 1, queryLength)
                );
                this.moveCursorToEnd(state, action.payload.sourceId);
            }
        );

        this.addActionHandler<Actions.EditQueryOperationDone>(
            ActionName.EditQueryOperationDone,
            (state, action) => {
                const data = action.payload.data;
                if (AjaxResponse.isQueryFormArgs(data) && data.curr_query_types[action.payload.sourceId] === 'cql') {
                    this.setRawQuery(
                        state,
                        action.payload.sourceId,
                        data.curr_queries[action.payload.sourceId],
                        null
                    );

                } else if (AjaxResponse.isFilterFormArgs(data) && data.query_type === 'cql') {
                    const newState = this.copyState(state);
                    this.setRawQuery(
                        state,
                        action.payload.sourceId,
                        data.query,
                        null
                    );
                }
            }
        );

        this.addActionHandler<Actions.QueryOverviewEditorClose>(
            ActionName.QueryOverviewEditorClose,
            (state, action) => {
                state.isReady = false;
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            (state, action) => {
                dispatcher.dispatch<GlobalActions.SwitchCorpusReady<CQLEditorModelCorpusSwitchPreserve>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(state)
                    }
                })
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            (state, action) => {
                this.deserialize(
                    state,
                    action.payload.data[this.getRegistrationId()] as CQLEditorModelCorpusSwitchPreserve,
                    action.payload.corpora
                );
            }
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

    deserialize(state:CQLEditorModelState, data:CQLEditorModelCorpusSwitchPreserve, corpora:Array<[string, string]>):void {
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
        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(state, sourceId);
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
    private setRawQuery(state:CQLEditorModelState, sourceId:string, query:string, insertRange:[number, number]|null):void {
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

        state.downArrowTriggersHistory[sourceId] = this.shouldDownArrowTriggerHistory(state, sourceId);

        if (state.isEnabled) {
            state.richCode[sourceId] = highlightSyntax(
                state.rawCode[sourceId] ? state.rawCode[sourceId] : '',
                'cql',
                this.pageModel.getComponentHelpers(),
                this.attrHelper,
                (msg) => this.hintListener(state, sourceId, msg)
            );

        } else {
            state.richCode[sourceId] = '';
        }
    }

}