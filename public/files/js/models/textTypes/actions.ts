/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
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
import { TextTypes } from '../../types/common';
import { SelectionFilterMap } from './common';


export enum ActionName {
    SelectionChanged = 'TT_SELECTION_CHANGED',
    ValueCheckboxClicked = 'TT_VALUE_CHECKBOX_CLICKED',
    SelectAllClicked = 'TT_SELECT_ALL_CHECKBOX_CLICKED',
    RangeButtonClicked = 'TT_RANGE_BUTTON_CLICKED',
    ToggleRangeMode = 'TT_TOGGLE_RANGE_MODE',
    ExtendedInformationRequest = 'TT_EXTENDED_INFORMATION_REQUEST',
    ExtendedInformationRequestDone = 'TT_EXTENDED_INFORMATION_REQUEST_DONE',
    ExtendedInformationRemoveRequest = 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST',
    AttributeAutoCompleteHintClicked = 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED',
    AttributeTextInputChanged = 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED',
    AttributeAutoCompleteReset = 'TT_ATTRIBUTE_AUTO_COMPLETE_RESET',
    AttributeTextInputAutocompleteRequest = 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST',
    AttributeTextInputAutocompleteRequestDone = 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST_DONE',
    MinimizeAll = 'TT_MINIMIZE_ALL',
    MaximizeAll = 'TT_MAXIMIZE_ALL',
    ToggleMinimizeItem = 'TT_TOGGLE_MINIMIZE_ITEM',
    UndoState = 'TT_UNDO_STATE',
    ResetState = 'TT_RESET_STATE',
    LockSelected = 'TT_LOCK_SELECTED',
    FilterWholeSelection = 'TT_FILTER_WHOLE_SELECTION',
    SetAttrSummary = 'TT_SET_ATTR_SUMMARY',
    ToggleMetaInfoView = 'TT_TOGGLE_META_INFO_VIEW'
}

export namespace Actions {

    export interface SelectionChanged extends Action<{
        hasSelectedItems:boolean;
        attributes:Array<TextTypes.AnyTTSelection>;
    }> {
        name:ActionName.SelectionChanged;
    };

    export interface ValueCheckboxClicked extends Action<{
        attrName:string;
        itemIdx:number;
    }> {
        name:ActionName.ValueCheckboxClicked;
    };

    export interface SelectAllClicked extends Action<{
        attrName:string;
    }> {
        name:ActionName.SelectAllClicked;
    };

    export interface RangeButtonClicked extends Action<{
        attrName:string;
        fromVal:number;
        toVal:number;
        strictInterval:boolean;
        keepCurrent:boolean;
    }> {
        name:ActionName.RangeButtonClicked;
    };

    export interface ToggleRangeMode extends Action<{
        attrName:string;
    }> {
        name:ActionName.ToggleRangeMode;
    };

    export interface ExtendedInformationRequest extends Action<{
        attrName:string;
        ident:string;
    }> {
        name:ActionName.ExtendedInformationRequest;
    };

    export interface ExtendedInformationRequestDone extends Action<{
        attrName:string;
        ident:string;
        data:any; // TODO !!!
    }> {
        name:ActionName.ExtendedInformationRequestDone;
    };

    export interface ExtendedInformationRemoveRequest extends Action<{
        attrName:string;
        ident:string;
    }> {
        name:ActionName.ExtendedInformationRemoveRequest;
    };

    export interface AttributeAutoCompleteHintClicked extends Action<{
        attrName:string;
        ident:string;
        label:string;
        append:boolean;
    }> {
        name:ActionName.AttributeAutoCompleteHintClicked;
    };

    export interface AttributeTextInputChanged extends Action<{
        attrName:string;
        value:string;
    }> {
        name:ActionName.AttributeTextInputChanged;
    };

    export interface AttributeAutoCompleteReset extends Action<{
        attrName:string;
    }> {
        name:ActionName.AttributeAutoCompleteReset;
    };

    export interface AttributeTextInputAutocompleteRequest extends Action<{
        attrName:string;
        value:string;
    }> {
        name:ActionName.AttributeTextInputAutocompleteRequest;
    };


    export interface AttributeTextInputAutocompleteRequestDone extends Action<{
        attrName:string;
        autoCompleteData:Array<TextTypes.AutoCompleteItem>;
        filterData:SelectionFilterMap;
    }> {
        name:ActionName.AttributeTextInputAutocompleteRequestDone;
    };

    export interface MinimizeAll extends Action<{
    }> {
        name:ActionName.MinimizeAll;
    };

    export interface MaximizeAll extends Action<{
    }> {
        name:ActionName.MaximizeAll;
    };


    export interface ToggleMinimizeItem extends Action<{
        ident:string;
    }> {
        name:ActionName.ToggleMinimizeItem;
    };

    export interface UndoState extends Action<{
    }> {
        name:ActionName.UndoState;
    };

    export interface ResetState extends Action<{
    }> {
        name:ActionName.ResetState;
    };

    export interface LockSelected extends Action<{
    }> {
        name:ActionName.LockSelected;
    };

    export interface FilterWholeSelection extends Action<{
        poscount:number;
        filterData:SelectionFilterMap;
        selectedTypes:TextTypes.ServerCheckedValues;
        bibAttrValsAreListed:boolean;
    }> {
        name:ActionName.FilterWholeSelection;
    };

    export interface SetAttrSummary extends Action<{
        attrName:string;
        value:TextTypes.AttrSummary;
    }> {
        name:ActionName.SetAttrSummary;
    };

    export interface ToggleMetaInfoView extends Action<{

    }>{
        name:ActionName.ToggleMetaInfoView;
    }
}