/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { Action } from 'kombo';


export enum ActionName {

    SubmitQuery = 'PQUERY_SUBMIT_QUERY',
    SubmitQueryDone = 'PQUERY_SUBMIT_QUERY_DONE',
    AddQueryItem = 'PQUERY_ADD_QUERY_ITEM',
    RemoveQueryItem = 'PQUERY_REMOVE_QUERY_ITEM',
    QueryChange = 'PQUERY_QUERY_CHANGE',
    FreqChange = 'PQUERY_FREQ_CHANGE',
    PositionChange = 'PQUERY_POSITION_CHANGE',
    AttrChange = 'PQUERY_ATTR_CHANGE',
}


export namespace Actions {

    export interface SubmitQuery extends Action<{

    }> {
        name: ActionName.SubmitQuery;
    }

    export interface SubmitQueryDone extends Action<{

    }> {
        name: ActionName.SubmitQueryDone;
    }

    export interface AddQueryItem extends Action<{

    }> {
        name: ActionName.AddQueryItem;
    }

    export interface RemoveQueryItem extends Action<{
        sourceId: string;
    }> {
        name: ActionName.RemoveQueryItem;
    }

    export interface QueryChange extends Action<{
        sourceId: string;
        query: string;
    }> {
        name: ActionName.QueryChange;
    }

    export interface FreqChange extends Action<{
        value: string;
    }> {
        name: ActionName.FreqChange;
    }

    export interface PositionChange extends Action<{
        value: string;
    }> {
        name: ActionName.PositionChange;
    }

    export interface AttrChange extends Action<{
        value: string;
    }> {
        name: ActionName.AttrChange;
    }
}