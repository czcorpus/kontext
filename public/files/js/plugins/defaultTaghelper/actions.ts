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

export class Actions {

    static GetInitialData:Action<{
        sourceId:string;
        tagsetId:string;
        corpname:string;
    }> = {
        name: 'TAGHELPER_GET_INITIAL_DATA'
    };

    static GetInitialDataDone:Action<{
        tagsetId:string;
        sourceId:string;
        tags:Array<Array<[string, string]>>;
        labels:Array<string>;
    }> = {
        name: 'TAGHELPER_GET_INITIAL_DATA_DONE'
    };

    static CheckboxChanged:Action<{
        tagsetId:string;
        sourceId:string;
        position:number;
        value:string;
        checked:boolean;
    }> = {
        name: 'TAGHELPER_CHECKBOX_CHANGED'
    };

    static LoadFilteredDataDone:Action<{
        tagsetId:string;
        sourceId:string;
        tags:Array<Array<[string, string]>>;
        triggerRow:number;
    }> = {
        name: 'TAGHELPER_LOAD_FILTERED_DATA_DONE'
    };

    static Undo:Action<{
        tagsetId:string;
        sourceId:string;
    }> = {
        name: 'TAGHELPER_UNDO'
    };

    static Reset:Action<{
        tagsetId:string;
        sourceId:string;
    }> = {
        name: 'TAGHELPER_RESET'
    };

    static ToggleActivePosition:Action<{
        tagsetId:string;
        sourceId:string;
        idx:number;
    }> = {
        name: 'TAGHELPER_TOGGLE_ACTIVE_POSITION'
    };

    static SetActiveTag:Action<{
        tagsetId:string;
        sourceId:string;
        corpname:string;
    }> = {
        name: 'TAGHELPER_SET_ACTIVE_TAG'
    };

    static KVSelectCategory:Action<{
        tagsetId:string;
        sourceId:string;
        value:string;
    }> = {
        name: 'TAGHELPER_SELECT_CATEGORY'
    };

    static KVAddFilter:Action<{
        tagsetId:string;
        sourceId:string;
        name:string;
        value:string;
    }> = {
        name: 'TAGHELPER_ADD_FILTER'
    };

    static KVRemoveFilter:Action<{
        tagsetId:string;
        sourceId:string;
        name:string;
        value:string;
    }> = {
        name: 'TAGHELPER_REMOVE_FILTER'
    };

    static KVGetInitialDataDone:Action<{
        tagsetId:string;
        sourceId:string;
        result:{[key:string]:Array<string>};
    }> = {
        name: 'TAGHELPER_KV_GET_INITIAL_DATA_DONE'
    };

    static KVGetInitialDataNOP:Action<{
        tagsetId:string;
    }> = {
        name: 'TAGHELPER_KV_GET_INITIAL_DATA_NOP'
    };

    static KVGetFilteredDataDone:Action<{
        tagsetId:string;
        sourceId:string;
        result:{[key:string]:Array<string>};
    }> = {
        name: 'TAGHELPER_KV_GET_FILTERED_DATA_DONE'
    };
}


export function isSetActiveTagAction(a:Action):a is typeof Actions.SetActiveTag {
    return a.name === Actions.SetActiveTag.name;
}