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

import {ActionDispatcher} from '../../../app/dispatcher';

export class CQLEditorActions {

    dispatcher:ActionDispatcher;

    constructor(dispatcher:ActionDispatcher) {
        this.dispatcher = dispatcher;
    }

    CQL_EDITOR_SET_RAW_QUERY(props:{
            query:string,
            sourceId:string,
            rawAnchorIdx:number,
            rawFocusIdx:number}):void {

        this.dispatcher.dispatch({
            actionType: 'CQL_EDITOR_SET_RAW_QUERY',
            props: props
        });
        this.dispatcher.dispatch({
            actionType: 'QUERY_INPUT_SET_QUERY',
            props: {
                sourceId: props.sourceId,
                query: props.query
            }
        });
    }
}