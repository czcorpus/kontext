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

export const enum ActionName {
    PresetPattern = 'TAGHELPER_PRESET_PATTERN',
    GetInitialData = 'TAGHELPER_GET_INITIAL_DATA',
    GetInitialDataDone = 'TAGHELPER_GET_INITIAL_DATA_DONE',
    CheckboxChanged = 'TAGHELPER_CHECKBOX_CHANGED',
    LoadFilteredDataDone = 'TAGHELPER_LOAD_FILTERED_DATA_DONE',
    Undo = 'TAGHELPER_UNDO',
    Reset = 'TAGHELPER_RESET',
    ToggleActivePosition = 'TAGHELPER_TOGGLE_ACTIVE_POSITION',
    SetActiveTag = 'TAGHELPER_SET_ACTIVE_TAG'

}

export namespace Actions {

    export interface PresetPattern extends Action<{
        sourceId:string;
        pattern:string;
    }> {
        name:ActionName.PresetPattern;
    }

    export interface GetInitialData extends Action<{
        sourceId:string;
    }> {
        name:ActionName.GetInitialData;
    }

    export interface GetInitialDataDone extends Action<{
        sourceId:string;
        tags:Array<Array<[string, string]>>;
        labels:Array<string>;
    }> {
        name:ActionName.GetInitialDataDone;
    }

    export interface CheckboxChanged extends Action<{
        sourceId:string;
        position:number;
        value:string;
        checked:boolean;
    }> {
        name:ActionName.CheckboxChanged;
    }

    export interface LoadFilteredDataDone extends Action<{
        tags:Array<Array<[string, string]>>;
        triggerRow:number;
        sourceId:string;
    }> {
        name:ActionName.LoadFilteredDataDone;
    }

    export interface Undo extends Action<{
        sourceId:string;
    }> {
        name:ActionName.Undo;
    }

    export interface Reset extends Action<{
        sourceId:string;
    }> {
        name:ActionName.Reset;
    }

    export interface ToggleActivePosition extends Action<{
        sourceId:string;
    }> {
        name:ActionName.ToggleActivePosition;
    }

    export interface SetActiveTag extends Action<{
        sourceId:string;
        value:string;
    }> {
        name:ActionName.SetActiveTag;
    }
}
