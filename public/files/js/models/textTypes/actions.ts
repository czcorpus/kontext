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
import * as TextTypes from '../../types/textTypes';
import { SelectionFilterMap } from './common';


export class Actions {

    static SelectionChanged:Action<{
        hasSelectedItems:boolean;
        attributes:Array<TextTypes.AnyTTSelection>;
    }> = {
        name: 'TT_SELECTION_CHANGED'
    };

    static ValueCheckboxClicked:Action<{
        attrName:string;
        itemIdx:number;
    }> = {
        name: 'TT_VALUE_CHECKBOX_CLICKED'
    };

    static SelectAllClicked:Action<{
        attrName:string;
    }> = {
        name: 'TT_SELECT_ALL_CHECKBOX_CLICKED'
    };

    static RangeButtonClicked:Action<{
        attrName:string;
        fromVal:number;
        toVal:number;
        strictInterval:boolean;
        keepCurrent:boolean;
    }> = {
        name: 'TT_RANGE_BUTTON_CLICKED'
    };

    static ToggleRangeMode:Action<{
        attrName:string;
    }> = {
        name: 'TT_TOGGLE_RANGE_MODE'
    };

    static ExtendedInformationRequest:Action<{
        attrName:string;
        ident:string;
    }> = {
        name: 'TT_EXTENDED_INFORMATION_REQUEST'
    };

    static ExtendedInformationRequestDone:Action<{
        attrName:string;
        ident:string;
        data:any; // TODO !!!
    }> = {
        name: 'TT_EXTENDED_INFORMATION_REQUEST_DONE'
    };

    static ExtendedInformationRemoveRequest:Action<{
        attrName:string;
        ident:string;
    }> = {
        name: 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST'
    };

    static AttributeAutoCompleteHintClicked:Action<{
        attrName:string;
        ident:string;
        label:string;
        append:boolean;
    }> = {
        name: 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED'
    };

    static AttributeTextInputChanged:Action<{
        attrName:string;
        value:string;
        type:TextTypes.TTSelectionTypes;
        decodedValue?:string; // human readable alternative (if necessary)
    }> = {
        name: 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED'
    };

    static AttributeAutoCompleteReset:Action<{
        attrName:string;
    }> = {
        name: 'TT_ATTRIBUTE_AUTO_COMPLETE_RESET'
    };

    static AttributeTextInputAutocompleteRequest:Action<{
        attrName:string;
        value:string;
    }> = {
        name: 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST'
    };


    static AttributeTextInputAutocompleteReady:Action<{
        attrName:string;
        value:string;
        selections:TextTypes.ExportedSelection;
    }> = {
        name: 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_READY'
    };

    static isAttributeTextInputAutocompleteReady(action:Action<{}>):action is typeof Actions.AttributeTextInputAutocompleteReady {
        return action.name === Actions.AttributeTextInputAutocompleteReady.name;
    }


    static AttributeTextInputAutocompleteRequestDone:Action<{
        attrName:string;
        autoCompleteData:Array<TextTypes.AutoCompleteItem>;
        filterData:SelectionFilterMap;
    }> = {
        name: 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST_DONE'
    };

    static MinimizeAll:Action<{
    }> = {
        name: 'TT_MINIMIZE_ALL'
    };

    static MaximizeAll:Action<{
    }> = {
        name: 'TT_MAXIMIZE_ALL'
    };


    static ToggleMinimizeItem:Action<{
        ident:string;
    }> = {
        name: 'TT_TOGGLE_MINIMIZE_ITEM'
    };

    static UndoState:Action<{
    }> = {
        name: 'TT_UNDO_STATE'
    };

    static ResetState:Action<{
    }> = {
        name: 'TT_RESET_STATE'
    };

    static LockSelected:Action<{
    }> = {
        name: 'TT_LOCK_SELECTED'
    };

    static FilterWholeSelection:Action<{
        poscount:number;
        filterData:SelectionFilterMap;
        selectedTypes:TextTypes.ExportedSelection;
        bibAttrValsAreListed:boolean;
    }> = {
        name: 'TT_FILTER_WHOLE_SELECTION'
    };

    static SetAttrSummary:Action<{
        attrName:string;
        value:TextTypes.AttrSummary;
    }> = {
        name: 'TT_SET_ATTR_SUMMARY'
    };

    static ToggleMetaInfoView:Action<{
    }> = {
        name: 'TT_TOGGLE_META_INFO_VIEW'
    };
}