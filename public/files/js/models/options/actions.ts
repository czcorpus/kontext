/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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
import { ViewOptsResponse, GeneralOptionsShared } from './common';
import { Kontext } from '../../types/common';


export enum ActionName {
    GeneralInitalDataLoaded = 'GENERAL_VIEW_OPTIONS_INITIAL_DATA_LOADED',
    GeneralSetPageSize = 'GENERAL_VIEW_OPTIONS_SET_PAGESIZE',
    GeneralSetContextSize = 'GENERAL_VIEW_OPTIONS_SET_CONTEXTSIZE',
    GeneralSetLineNums = 'GENERAL_VIEW_OPTIONS_SET_LINE_NUMS',
    GeneralSetShuffle = 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE',
    GeneralSetUseCQLEditor = 'GENERAL_VIEW_OPTIONS_SET_USE_CQL_EDITOR',
    GeneralSetWlPageSize = 'GENERAL_VIEW_OPTIONS_SET_WLPAGESIZE',
    GeneralSetFmaxItems = 'GENERAL_VIEW_OPTIONS_SET_FMAXITEMS',
    GeneralSetCitemsPerPage = 'GENERAL_VIEW_OPTIONS_SET_CITEMSPERPAGE',
    GeneralSubmit = 'GENERAL_VIEW_OPTIONS_SUBMIT',
    GeneralSubmitDone = 'GENERAL_VIEW_OPTIONS_SUBMIT_DONE'
}

export namespace Actions {

    export interface GeneralInitalDataLoaded extends Action<{
        data:ViewOptsResponse;
    }> {
        name:ActionName.GeneralInitalDataLoaded;
    }

    export interface GeneralSetPageSize extends Action<{
        value:string;
    }> {
        name:ActionName.GeneralSetPageSize;
    }

    export interface GeneralSetContextSize extends Action<{
        value:string;
    }> {
        name:ActionName.GeneralSetContextSize;
    }

    export interface GeneralSetLineNums extends Action<{
        value:boolean;
    }> {
        name:ActionName.GeneralSetLineNums;
    }

    export interface GeneralSetShuffle extends Action<{
        value:boolean;
    }> {
        name:ActionName.GeneralSetShuffle;
    }

    export interface GeneralSetUseCQLEditor extends Action<{
        value:boolean;
    }> {
        name:ActionName.GeneralSetUseCQLEditor;
    }

    export interface GeneralSetWlPageSize extends Action<{
        value:string;
    }> {
        name:ActionName.GeneralSetWlPageSize;
    }

    export interface GeneralSetFmaxItems extends Action<{
        value:string;
    }> {
        name:ActionName.GeneralSetFmaxItems;
    }

    export interface GeneralSetCitemsPerPage extends Action<{
        value:string;
    }> {
        name:ActionName.GeneralSetCitemsPerPage;
    }

    export interface GeneralSubmit extends Action<{
    }> {
        name:ActionName.GeneralSubmit;
    }

    export interface GeneralSubmitDone extends Action<GeneralOptionsShared> {
        name:ActionName.GeneralSubmitDone;
    }

}