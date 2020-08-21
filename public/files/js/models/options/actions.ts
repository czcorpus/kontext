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
import { ViewOptions } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';


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
    GeneralSubmitDone = 'GENERAL_VIEW_OPTIONS_SUBMIT_DONE',
    LoadDataDone = 'VIEW_OPTIONS_LOAD_DATA_DONE',
    DataReady = 'VIEW_OPTIONS_DATA_READY',
    UpdateAttrVisibility = 'VIEW_OPTIONS_UPDATE_ATTR_VISIBILITY',
    ToggleAttribute = 'VIEW_OPTIONS_TOGGLE_ATTRIBUTE',
    ToggleAllAttributes = 'VIEW_OPTIONS_TOGGLE_ALL_ATTRIBUTES',
    ToggleStructure = 'VIEW_OPTIONS_TOGGLE_STRUCTURE',
    ToggleAllStructures = 'VIEW_OPTIONS_TOGGLE_ALL_STRUCTURES',
    ToggleAllStructureAttrs = 'VIEW_OPTIONS_TOGGLE_ALL_STRUCTURE_ATTRS',
    ToggleReference = 'VIEW_OPTIONS_TOGGLE_REFERENCE',
    ToogleAllReferenceAttrs = 'VIEW_OPTIONS_TOGGLE_ALL_REF_ATTRS',
    ToggleAllReferences = 'VIEW_OPTIONS_TOGGLE_ALL_REFERENCES',
    SetBaseViewAttr = 'VIEW_OPTIONS_SET_BASE_VIEW_ATTR',
    SaveSettings = 'VIEW_OPTIONS_SAVE_SETTINGS',
    SaveSettingsDone = 'VIEW_OPTIONS_SAVE_SETTINGS_DONE',
    ChangeQuerySuggestionMode = 'VIEW_OPTIONS_CHANGE_QUERY_SUGGESTION_MODE'
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

    export interface LoadDataDone extends Action<{
        data:ViewOptions.PageData;
    }> {
        name:ActionName.LoadDataDone;
    }

    export interface DataReady extends Action<{}> {
        name:ActionName.DataReady;
    }

    export interface UpdateAttrVisibility extends Action<{
        value:ViewOptions.AttrViewMode;
    }> {
        name:ActionName.UpdateAttrVisibility;
    }

    export interface ToggleAttribute extends Action<{
        idx:number;
    }> {
        name:ActionName.ToggleAttribute;
    }

    export interface ToggleAllAttributes extends Action<{}> {
        name:ActionName.ToggleAllAttributes;
    }

    export interface ToggleStructure extends Action<{
        structIdent:string;
        structAttrIdent:string;
    }> {
        name:ActionName.ToggleStructure;
    }

    export interface ToggleAllStructures extends Action<{}> {
        name:ActionName.ToggleAllStructures;
    }

    export interface ToggleAllStructureAttrs extends Action<{
        structIdent:string;
    }> {
        name:ActionName.ToggleAllStructureAttrs;
    }

    export interface ToggleReference extends Action<{
        refIdent:string;
        refAttrIdent:string|null;
    }> {
        name:ActionName.ToggleReference;
    }

    export interface ToogleAllReferenceAttrs extends Action<{
        refIdent:string;
    }> {
        name:ActionName.ToogleAllReferenceAttrs;
    }

    export interface ToggleAllReferences extends Action<{}> {
        name:ActionName.ToggleAllReferences;
    }
    export interface SetBaseViewAttr extends Action<{
        value:string;
    }> {
        name:ActionName.SetBaseViewAttr;
    }

    export interface SaveSettings extends Action<{}> {
        name:ActionName.SaveSettings;
    }

    export interface SaveSettingsDone extends Action<{
        baseViewAttr:string;
        widectxGlobals:Array<[string, string]>;
        attrVmode:ViewOptions.AttrViewMode;
        qsVisibilityMode:PluginInterfaces.QuerySuggest.SuggestionVisibility;
    }> {
        name:ActionName.SaveSettingsDone;
    }

    export interface ChangeQuerySuggestionMode extends Action<{
        value:PluginInterfaces.QuerySuggest.SuggestionVisibility;
    }> {
        name:ActionName.ChangeQuerySuggestionMode;
    }

}