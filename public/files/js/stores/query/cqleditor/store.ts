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

/// <reference path="../../../types/common.d.ts" />
/// <reference path="../../../vendor.d.ts/immutable.d.ts" />

import * as Immutable from 'vendor/immutable';
import {StatelessModel} from '../../../stores/base';
import {GeneralQueryStore} from '../main';
import {PageModel} from '../../../app/main';
import {AttrHelper} from './attrs';
import {highlightSyntax} from './main';
import {ActionDispatcher} from '../../../app/dispatcher';

/**
 *
 */
export interface CQLEditorStoreState {

    rawCode:Immutable.Map<string, string>;

    richCode:Immutable.Map<string, string>;

    message:Immutable.Map<string, string>;

    rawAnchorIdx:number;

    rawFocusIdx:number;

}

/**
 *
 */
export class CQLEditorStore extends StatelessModel<CQLEditorStoreState> {

    private pageModel:PageModel;

    private attrHelper:AttrHelper;

    private attrList:Immutable.List<Kontext.AttrItem>;

    private structAttrList:Immutable.List<Kontext.AttrItem>;

    private hintListener:(state:CQLEditorStoreState, sourceId:string, msg:string)=>void;


    constructor(dispatcher:ActionDispatcher, pageModel:PageModel,
            attrList:Array<Kontext.AttrItem>, structAttrList:Array<Kontext.AttrItem>, tagAttr:string) {
        super(dispatcher, {
            rawCode: Immutable.Map<string, string>(),
            richCode: Immutable.Map<string, string>(),
            message: Immutable.Map<string, string>(),
            rawAnchorIdx: 0,
            rawFocusIdx: 0
        });
        this.attrHelper = new AttrHelper(attrList, structAttrList, tagAttr);
        this.pageModel = pageModel;
       this.hintListener = (state, sourceId, msg) => {
           state.message = state.message.set(sourceId, msg);
       }
    }

    reduce(state:CQLEditorStoreState, action:Kontext.DispatcherPayload):CQLEditorStoreState {
        const newState = this.copyState(state);
        switch (action.actionType) {
            case 'CQL_EDITOR_SET_RAW_QUERY':
                newState.rawAnchorIdx = action.props['rawAnchorIdx'];
                newState.rawFocusIdx = action.props['rawFocusIdx'];
                this.setRawQuery(
                    newState,
                    <string>action.props['sourceId'],
                    <string>action.props['query'],
                    <[number, number]>action.props['range']
                );
                this.synchronize(action.actionType, newState);
            break;
            case 'QUERY_INPUT_SET_QUERY':
                this.setRawQuery(
                    newState,
                    <string>action.props['sourceId'],
                    <string>action.props['query'],
                    null
                );
            break;
            case 'QUERY_INPUT_APPEND_QUERY':
                this.setRawQuery(
                    newState,
                    <string>action.props['sourceId'],
                    <string>action.props['query'],
                    [newState.rawCode.get(action.props['sourceId']).length, newState.rawCode.get(action.props['sourceId']).length]
                );
                this.moveCursorToEnd(newState, action.props['sourceId']);
            break;
            case 'QUERY_INPUT_REMOVE_LAST_CHAR': {
                const queryLength = newState.rawCode.get(action.props['sourceId']).length;
                this.setRawQuery(
                    newState,
                    <string>action.props['sourceId'],
                    '',
                    [queryLength - 1, queryLength]
                );
                this.moveCursorToEnd(newState, action.props['sourceId']);
            }
            break;
            case '$EDIT_QUERY_OPERATION':
                for (let p in action.props['queries']) {
                    if (action.props['queryTypes'][p] === 'cql') {
                        this.setRawQuery(
                            newState,
                            p,
                            action.props['queries'][p],
                            null
                        );
                    }
                }
            break;
            default:
                return state;
        }
        return newState;
    }

    private moveCursorToEnd(state:CQLEditorStoreState, sourceId:string):void {
        state.rawAnchorIdx = state.rawCode.get(sourceId).length;
        state.rawFocusIdx = state.rawCode.get(sourceId).length;
    }

    /**
     *
     * @param sourceId
     * @param query
     * @param range
     */
    private setRawQuery(state:CQLEditorStoreState, sourceId:string, query:string, range:[number, number]):void {
        let newQuery:string;

        if (!state.rawCode.has(sourceId)) {
            state.rawCode = state.rawCode.set(sourceId, '');
        }
        if (Array.isArray(range)) {
            newQuery = state.rawCode.get(sourceId).substring(0, range[0]) + query +
                state.rawCode.get(sourceId).substr(range[1]);

        } else {
            newQuery = query;
        }

        state.rawCode = state.rawCode.set(
            sourceId,
            newQuery
        );

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
    }

}