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

import { WidgetView } from '../models/textTypes/common.js'; // TODO this breaks meaning of the 'common'.js module


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

interface BaseAttributeSelection {
    label:string;
    name:string;
    attrInfo:AttrInfo;
    widget:WidgetView;
    metaInfo:AttrSummary;
    definesSubcorpus:boolean;
}

/**
 * Text type selection based on full value listing with 'checked' flag.
 */
export interface FullAttributeSelection extends BaseAttributeSelection {
    isInterval:boolean;
    isNumeric:boolean;
    values:Array<AttributeValue>;
    excludeSelection:boolean;
    type:'full';
}

/**
 * Text type selection for long lists we cannot fully display. It shows
 * an input box along with possible selected values obtained by auto-complete
 * function. I.e. it is a combination of a list (but showing only selected items)
 * with a search input box (for accessing a long list)
 */
export interface TextInputAttributeSelection extends BaseAttributeSelection {
    isInterval:boolean;
    isNumeric:boolean;
    autoCompleteHints:Array<AutoCompleteItem>;
    autocompleteCutoff:number|undefined;
    values:Array<AttributeValue>; // it supports appending values via a single text input
    textFieldValue:string;
    excludeSelection:boolean;
    type:'text';
}

/**
 * Text type selection where we have to encode the selected values into
 * a regular expression. This is e.g. used to encode publication date
 * range.
 */
export interface RegexpAttributeSelection extends BaseAttributeSelection {
    textFieldValue:string;
    textFieldDecoded:string;
    isLocked:boolean;
    excludeSelection:boolean;
    type:'regexp';
}

export type AnyTTSelection =
    TextInputAttributeSelection |
    FullAttributeSelection |
    RegexpAttributeSelection;


// exported selection types (i.e. selections as stored on server)


export interface ExportedRegexpSelection {
    regexp:string
};

export type SingleValueExportedTTSelection = string|ExportedRegexpSelection;

export type AnyExportedTTSelection = Array<string>|SingleValueExportedTTSelection;

export function isExportedRegexpSelection(v:AnyExportedTTSelection):v is ExportedRegexpSelection {
    return typeof v === 'object' && typeof v['regexp'] === 'string';
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

export type AvailItemsList = Array<[string, string, string, number, number]>;

export interface ValueDomainsSizes {
    [key:string]:{length:number}|AvailItemsList
}
