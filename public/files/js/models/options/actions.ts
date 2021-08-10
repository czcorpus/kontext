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
import * as ViewOptions from '../../types/viewOptions';


export class Actions {

    static GeneralInitalDataLoaded: Action<{
        data: ViewOptsResponse;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_INITIAL_DATA_LOADED'
        };

    static GeneralSetPageSize: Action<{
        value: number;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_PAGESIZE'
        };

    static GeneralSetContextSize: Action<{
        value: number;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_CONTEXTSIZE'
        };

    static GeneralSetLineNums: Action<{
        value: boolean;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_LINE_NUMS'
        };

    static GeneralSetShuffle: Action<{
        value: boolean;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE'
        };

    static GeneralSetUseRichQueryEditor: Action<{
        value: boolean;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_USE_RICH_QUERY_EDITOR'
        };

    static GeneralSetWlPageSize: Action<{
        value: number;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_WLPAGESIZE'
        };

    static GeneralSetFmaxItems: Action<{
        value: number;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_FMAXITEMS'
        };

    static GeneralSetCitemsPerPage: Action<{
        value: number;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_CITEMSPERPAGE'
        };

    static GeneralSetPQueryitemsPerPage: Action<{
        value: number;
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SET_PQUERYITEMSPERPAGE'
        };

    static GeneralSubmit: Action<{
    }> = {
            name: 'GENERAL_VIEW_OPTIONS_SUBMIT'
        };

    static GeneralSubmitDone: Action<GeneralOptionsShared> = {
        name: 'GENERAL_VIEW_OPTIONS_SUBMIT_DONE'
    };

    static LoadDataDone: Action<{
        data: ViewOptions.PageData;
    }> = {
            name: 'VIEW_OPTIONS_LOAD_DATA_DONE'
        };

    static DataReady: Action<{}> = {
        name: 'VIEW_OPTIONS_DATA_READY'
    };

    static UpdateAttrVisibility: Action<{
        value: ViewOptions.AttrViewMode;
    }> = {
            name: 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY'
        };

    static ToggleAttribute: Action<{
        idx: number;
    }> = {
            name: 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE'
        };

    static ToggleAllAttributes: Action<{}> = {
        name: 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES'
    };

    static ToggleStructure: Action<{
        structIdent: string;
        structAttrIdent: string;
    }> = {
            name: 'VIEW_OPTIONS_TOGGLE_STRUCTURE'
        };

    static ToggleAllStructures: Action<{}> = {
        name: 'VIEW_OPTIONS_TOGGLE_ALL_STRUCTURES'
    };

    static ToggleAllStructureAttrs: Action<{
        structIdent: string;
    }> = {
            name: 'VIEW_OPTIONS_TOGGLE_ALL_STRUCTURE_ATTRS'
        };

    static ToggleReference: Action<{
        refIdent: string;
        refAttrIdent: string | null;
    }> = {
            name: 'VIEW_OPTIONS_TOGGLE_REFERENCE'
        };

    static ToogleAllReferenceAttrs: Action<{
        refIdent: string;
    }> = {
            name: 'VIEW_OPTIONS_TOGGLE_ALL_REF_ATTRS'
        };

    static ToggleAllReferences: Action<{}> = {
        name: 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES'
    };

    static SetBaseViewAttr: Action<{
        value: string;
    }> = {
            name: 'VIEW_OPTIONS_SET_BASE_VIEW_ATTR'
        };

    static SaveSettings: Action<{}> = {
        name: 'VIEW_OPTIONS_SAVE_SETTINGS'
    };

    static SaveSettingsDone: Action<{
        baseViewAttr: string;
        widectxGlobals: Array<[string, string]>;
        attrVmode: ViewOptions.AttrViewMode;
        qsEnabled: boolean;
    }> = {
            name: 'VIEW_OPTIONS_SAVE_SETTINGS_DONE'
        };

    static ChangeQuerySuggestionMode: Action<{
        value: boolean;
    }> = {
            name: 'VIEW_OPTIONS_CHANGE_QUERY_SUGGESTION_MODE'
        };
}