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

    definesSubcorp:boolean;

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

interface BaseAttributeSelection {
    label:string;
    name:string;
    attrInfo:AttrInfo;
    widget:WidgetView;
    metaInfo:AttrSummary;
}

export interface FullAttributeSelection extends BaseAttributeSelection {
    isInterval:boolean;
    isNumeric:boolean;
    values:Array<AttributeValue>;
    type:'full';
}

export interface TextInputAttributeSelection extends BaseAttributeSelection {
    isInterval:boolean;
    isNumeric:boolean;
    autoCompleteHints:Array<AutoCompleteItem>;
    values:Array<AttributeValue>; // it supports appending values via a single text input
    textFieldValue:string;
    type:'text';
}

export interface RegexpAttributeSelection extends BaseAttributeSelection {
    textFieldValue:string;
    textFieldDecoded:string;
    isLocked:boolean;
    type:'regexp';
}

export type AnyTTSelection = TextInputAttributeSelection|FullAttributeSelection|
        RegexpAttributeSelection;


export interface ExportedRegexpSelection {
    regexp:string
};

export type SingleValueExportedTTSelection = string|ExportedRegexpSelection;

export type AnyExportedTTSelection = Array<string>|SingleValueExportedTTSelection;

export function isExportedRegexpSelection(v:AnyExportedTTSelection):v is ExportedRegexpSelection {
    return typeof v['regexp'] === 'string';
}


export type ExportedSelection = {[sca:string]:AnyExportedTTSelection};


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
