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

import * as Immutable from 'immutable';
import { IActionDispatcher, StatelessModel, Action, SEDispatcher } from 'kombo';

import { Kontext, typedProps } from '../../../types/common';
import { PageModel } from '../../../app/page';
import { AttrHelper } from './attrs';
import { highlightSyntax } from './parser';
import { Actions, ActionName } from '../actions';
import { AjaxResponse } from '../../../types/ajaxResponses';

/**
 *
 */
export interface CQLEditorModelState {

    rawCode:Immutable.Map<string, string>;

    richCode:Immutable.Map<string, string>;

    message:Immutable.Map<string, string>;

    rawAnchorIdx:Immutable.Map<string, number>;

    rawFocusIdx:Immutable.Map<string, number>;

    downArrowTriggersHistory:Immutable.Map<string, boolean>;

    isEnabled:boolean;

    cqlEditorMessage:Immutable.Map<string, string>;

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


/**
 *
 */
export class CQLEditorModel extends StatelessModel<CQLEditorModelState> {

    private pageModel:PageModel;

    private attrHelper:AttrHelper;

    private hintListener:(state:CQLEditorModelState, sourceId:string, msg:string)=>void;


    constructor({dispatcher, pageModel, attrList, structAttrList, structList, tagAttr,
                    isEnabled, currQueries}:CQLEditorModelInitArgs) {
        const attrHelper = new AttrHelper(attrList, structAttrList, structList, tagAttr);
        super(
            dispatcher,
            {
                rawCode: Immutable.Map<string, string>(currQueries || {}),
                richCode: Immutable.Map<string, string>((() => (
                    Object.keys(currQueries || {}).map(sourceId => [
                        sourceId,
                        currQueries[sourceId] ? highlightSyntax(
                                currQueries[sourceId],
                                'cql',
                                pageModel.getComponentHelpers(),
                                attrHelper,
                                (_) => () => undefined
                            ) : ''
                    ])
                ))()),
                message: Immutable.Map<string, string>(),
                rawAnchorIdx: Immutable.Map<string, number>(),
                rawFocusIdx: Immutable.Map<string, number>(),
                cqlEditorMessage: Immutable.Map<string, string>(),
                isEnabled: isEnabled,
                isReady: false,
                downArrowTriggersHistory: Immutable.Map<string, boolean>()
            }
        );
        this.attrHelper = attrHelper;
        this.pageModel = pageModel;
        this.hintListener = (state, sourceId, msg) => {
            state.message = state.message.set(sourceId, msg);
        }
        this.actionMatch = {
            'CQL_EDITOR_INITIALIZE_DONE': (state, action) => {
                const newState = this.copyState(state);
                newState.isReady = true;
                return newState;
            },
            'CQL_EDITOR_ENABLE': (state, action) => {
                const newState = this.copyState(state);
                newState.isEnabled = true;
                newState.rawCode.forEach((query, sourceId) => {
                    newState.richCode = newState.richCode.set(
                        sourceId,
                        highlightSyntax(
                            state.rawCode.get(sourceId),
                            'cql',
                            this.pageModel.getComponentHelpers(),
                            this.attrHelper,
                            (msg) => this.hintListener(state, sourceId, msg)
                        )
                    );
                });
                return newState;
            },
            'CQL_EDITOR_DISABLE': (state, action) => {
                const newState = this.copyState(state);
                newState.isEnabled = false;
                return newState;
            },
            'GENERAL_VIEW_OPTIONS_SET_USE_CQL_EDITOR': (state, action) => {
                const newState = this.copyState(state);
                newState.isEnabled = action.payload['value'];
                return newState;
            },
            'QUERY_INPUT_MOVE_CURSOR': (state, action) => {
                const newState = this.copyState(state);
                newState.rawAnchorIdx = newState.rawAnchorIdx.set(
                    action.payload['sourceId'],
                    action.payload['rawAnchorIdx']
                );
                newState.rawFocusIdx = newState.rawFocusIdx.set(
                    action.payload['sourceId'],
                    action.payload['rawFocusIdx']
                );
                newState.downArrowTriggersHistory = newState.downArrowTriggersHistory.set(
                    action.payload['sourceId'],
                    this.shouldDownArrowTriggerHistory(
                        newState,
                        action.payload['sourceId']
                    )
                );
                return newState;
            },
            'QUERY_INPUT_SET_QUERY': (state, action) => {
                const newState = this.copyState(state);
                const args = typedProps<CQLEditorSetRawQueryProps>(action.payload);
                if (args.rawAnchorIdx !== undefined && args.rawFocusIdx !== undefined) {
                    newState.rawAnchorIdx = newState.rawAnchorIdx.set(args.sourceId, args.rawAnchorIdx || args.query.length);
                    newState.rawFocusIdx = newState.rawFocusIdx.set(args.sourceId, args.rawFocusIdx || args.query.length);
                }
                this.setRawQuery(
                    newState,
                    args.sourceId,
                    args.query,
                    args.insertRange
                );
                if (args.rawAnchorIdx === null && args.rawFocusIdx === null) {
                    this.moveCursorToPos(
                        newState, args.sourceId, newState.rawCode.get(args.sourceId).length);
                }
                return newState;
            },
            'QUERY_INPUT_APPEND_QUERY': (state, action) => {
                const newState = this.copyState(state);
                this.setRawQuery(
                    newState,
                    <string>action.payload['sourceId'],
                    <string>action.payload['query'],
                    [
                        this.getQueryLength(newState, action.payload['sourceId']),
                        this.getQueryLength(newState, action.payload['sourceId'])
                    ]
                );
                this.moveCursorToEnd(newState, action.payload['sourceId']);
                return newState;
            },
            'QUERY_INPUT_REMOVE_LAST_CHAR': (state, action) => {
                const newState = this.copyState(state);
                const queryLength = newState.rawCode.get(action.payload['sourceId']).length;
                this.setRawQuery(
                    newState,
                    <string>action.payload['sourceId'],
                    '',
                    [queryLength - 1, queryLength]
                );
                this.moveCursorToEnd(newState, action.payload['sourceId']);
                return newState;
            },
            [ActionName.EditQueryOperationDone]: (state, action:Actions.EditQueryOperationDone) => {
                const data = action.payload.data;
                if (AjaxResponse.isQueryFormArgs(data) && data.curr_query_types[action.payload.sourceId] === 'cql') {
                    const newState = this.copyState(state);
                    this.setRawQuery(
                        newState,
                        action.payload.sourceId,
                        data.curr_queries[action.payload.sourceId],
                        null
                    );
                    return newState;

                } else if (AjaxResponse.isFilterFormArgs(data) && data.query_type === 'cql') {
                    const newState = this.copyState(state);
                    this.setRawQuery(
                        newState,
                        action.payload.sourceId,
                        data.query,
                        null
                    );
                    return newState;
                }
                return state;
            },
            'QUERY_OVERVIEW_EDITOR_CLOSE': (state, action) => {
                const newState = this.copyState(state);
                newState.isReady = false;
                return newState;
            }
        };

        this.actionMatch['FILTER_QUERY_INPUT_MOVE_CURSOR'] = this.actionMatch['QUERY_INPUT_MOVE_CURSOR'];
        this.actionMatch['FILTER_QUERY_INPUT_SET_QUERY'] = this.actionMatch['QUERY_INPUT_SET_QUERY'];
        this.actionMatch['FILTER_QUERY_INPUT_APPEND_QUERY'] = this.actionMatch['QUERY_INPUT_APPEND_QUERY'];
        this.actionMatch['FILTER_QUERY_INPUT_REMOVE_LAST_CHAR'] = this.actionMatch['QUERY_INPUT_REMOVE_LAST_CHAR'];
    }

    sideEffects(state:CQLEditorModelState, action:Action, dispatch:SEDispatcher) {
        switch (action.name) {
            case 'CQL_EDITOR_INITIALIZE':
                dispatch({
                    name: 'CQL_EDITOR_INITIALIZE_DONE'
                });
            break;
        }
    }

    private getQueryLength(state:CQLEditorModelState, sourceId:string):number {
        return state.rawCode.get(sourceId) ? (state.rawCode.get(sourceId, '')).length : 0;
    }

    private moveCursorToPos(state:CQLEditorModelState, sourceId:string, posIdx:number):void {
        state.rawAnchorIdx = state.rawAnchorIdx.set(sourceId, posIdx);
        state.rawFocusIdx = state.rawFocusIdx.set(sourceId, posIdx);
        state.downArrowTriggersHistory = state.downArrowTriggersHistory.set(
            sourceId, this.shouldDownArrowTriggerHistory(state, sourceId));
    }

    private moveCursorToEnd(state:CQLEditorModelState, sourceId:string):void {
        this.moveCursorToPos(state, sourceId, state.rawCode.get(sourceId).length);
    }

    private shouldDownArrowTriggerHistory(state:CQLEditorModelState, sourceId:string):boolean {
        const q = state.rawCode.get(sourceId) || '';
        const anchorIdx = state.rawAnchorIdx.get(sourceId);
        const focusIdx = state.rawFocusIdx.get(sourceId);

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

        if (!state.rawCode.get(sourceId)) {
            state.rawCode = state.rawCode.set(sourceId, '');
        }
        if (insertRange !== null) {
            newQuery = state.rawCode.get(sourceId).substring(0, insertRange[0]) + query +
                    state.rawCode.get(sourceId).substr(insertRange[1]);

        } else {
            newQuery = query;
        }

        state.rawCode = state.rawCode.set(
            sourceId,
            newQuery
        );

        state.downArrowTriggersHistory = state.downArrowTriggersHistory.set(
            sourceId,
            this.shouldDownArrowTriggerHistory(state, sourceId)
        );

        if (state.isEnabled) {
            state.richCode = state.richCode.set(
                sourceId,
                highlightSyntax(
                    state.rawCode.get(sourceId),
                    'cql',
                    this.pageModel.getComponentHelpers(),
                    this.attrHelper,
                    (msg) => this.hintListener(state, sourceId, msg)
                )
            );

        } else {
            state.richCode = state.richCode.set(sourceId, '');
        }
    }

}