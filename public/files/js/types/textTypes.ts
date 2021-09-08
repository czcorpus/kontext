/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IModel } from 'kombo';
import { WidgetView } from '../models/textTypes/common'; // TODO this breaks meaning of the 'common' module


/**
 * This module contains types used along with text type
 * selection component (e.g. when creating a subcorpus).
 */


/**
 *
 */
export interface AttributeValue {

    ident: string;

    value:string;

    selected:boolean;

    locked:boolean;

    /**
     * How many items are actually hidden behind the value (= have the same name).
     * Value 1 means there is a single unique value available (such a value should
     * provide a bibliography information). Higher values mean that there are
     * multiple items with the same name (which means no biblography info)
     */
    numGrouped:number;

    /**
     * A number of tokens matching the value
     */
    availItems?:number;

    extendedInfo?:ExtendedInfo;
}

export interface AutoCompleteItem {
    ident: string;
    label: string;
}

export interface BibMapping {
    [bibId:string]:string;
}

export interface AttrInfo {

    /**
     * a URL link leading to a documentation for the attribute
     */
    doc:string;

    /**
     * ??
     */
    docLabel:string;
}

export type TTSelectionTypes = 'full'|'text'|'regexp';

export function isEncodedSelectionType(sel:TTSelectionTypes):boolean {
    return sel === 'regexp';
}

export interface FullAttributeSelection {
    attrInfo:AttrInfo;
    isInterval:boolean;
    widget:WidgetView;
    isNumeric:boolean;
    label:string;
    name:string;
    values:Array<AttributeValue>;
    type:'full';
}

export interface TextInputAttributeSelection {
    attrInfo:AttrInfo;
    isInterval:boolean;
    widget:WidgetView;
    isNumeric:boolean;
    label:string;
    name:string;
    autoCompleteHints:Array<AutoCompleteItem>;
    values:Array<AttributeValue>; // it supports appending values via a single text input
    textFieldValue:string;
    type:'text';
}

export interface RegexpAttributeSelection {
    attrInfo:AttrInfo;
    widget:WidgetView;
    label:string;
    name:string;
    textFieldValue:string;
    textFieldDecoded:string;
    isLocked:boolean;
    type:'regexp';
}

export type AnyTTSelection = TextInputAttributeSelection|FullAttributeSelection|
        RegexpAttributeSelection;

export type ExportedSelection = {[sca:string]:Array<string>|string};

/**
 *
 */
export interface IAdHocSubcorpusDetector {
    usesAdHocSubcorpus():boolean;
    UNSAFE_exportSelections(lockedOnesOnly:boolean):ExportedSelection;
}

export interface ITextTypesModel<T> extends IModel<T> {
    UNSAFE_exportSelections(lockedOnesOnly:boolean):ExportedSelection;
    getInitialAvailableValues():Array<AnyTTSelection>;
}

/**
 * An additional information containing information
 * about an attribute.
 */
export interface AttrSummary {
    text:string;
    help?:string;
}


export interface AlignedLanguageItem {
    value:string;
    label:string;
    selected:boolean;
    locked:boolean;
}

export type ExtendedInfo = Array<[string, string]>|{__message__:string};

export interface ValueDomainsSizes {
    [key:string]:{length:number}|Array<[string, string, string, number, number]>
}
