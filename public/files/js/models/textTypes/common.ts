/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/**
 * Server-side data representing a single text types box (= a single [struct].[attr])
 * as returned by respective AJAX calls.
 */

import { Dict, List, Strings } from 'cnc-tskit';

import * as TextTypes from '../../types/textTypes';


export enum IntervalChar {
    LEFT, BOTH, RIGHT
}

export type WidgetView = 'years'|'days';

export function isRegexpGeneratingWidgetView(wv:WidgetView):boolean {
    return wv === 'days';
}

export interface BlockLine {


    Values?:Array<{v:string; xcnt?:number}>;

    /**
     * Specifies a size (approx. in chars) of a text input
     * box required for this specific BlockLine. This is
     * Bonito-open approach but KonText still uses sthe
     * value to distinguish between enumerated items
     * and input-text ones.
     *
     * Please note that 'Values' and 'textboxlength' are
     * mutually exclusive.
     */
    textboxlength?:number;

    attr_doc:string;

    attr_doc_label:string;

    is_interval:number;

    widget:WidgetView;

    label:string;

    name:string;

    numeric:boolean;
}

/**
 * Server-side data
 */
export interface Block {
    Line:Array<BlockLine>;
}


export interface SelectionFilterValue {

    ident:string;

    v:string;

    lock:boolean;

    /*
     * Specifies how many items in returned list is actually behind the item.
     * This typically happens in case there are multiple items with the same name.
     */
    numGrouped:number;

    availItems?:number;
}


export type SelectionFilterMap = {[k:string]:Array<SelectionFilterValue>};


/**
 * Server-side data representing a group
 * of structures, structural attributes and
 * their values.
 *
 * Please note that for bib_attr, the initial
 * data is not expected to contain items IDs
 * which means that bibliography attribute box
 * model must be always an instance of
 * ./valueSelections.TextInputAttributeSelection
 * (otherwise a user would click on a label but
 * there would be no corresponding ID underneath)
 * On server, this is ensured by passing the
 * bib. attr. name to 'shrink_list' argument
 * (see lib/texttypes.py method export_with_norms())
 */
export interface TTInitialData {
    Blocks:Array<Block>;
    Normslist:Array<any>;
    bib_label_attr:string; // bib item label (possibly non-unique)
    bib_id_attr:string; // actual bib item identifier (unique)
}


export const textTypeSelectionEquals = (sel:TextTypes.AnyExportedTTSelection, v:string):boolean => {
    if (Array.isArray(sel)) {
        return sel.indexOf(v) > -1;

    } else if (typeof sel === 'string') {
        return sel === v;

    } else {
        return sel.regexp === v;
    }
};


export const extractTTSelectionValue = (sel:TextTypes.SingleValueExportedTTSelection):string => {
    if (typeof sel === 'string') {
        return sel;
    }
    return sel.regexp;
}


const textTypeValueIsSelected = (data:TextTypes.ExportedSelection, attr:string, v:string):boolean => {
    if (data.hasOwnProperty(attr)) {
        const typeSelection = data[attr];
        if (Array.isArray(typeSelection)) {
            return List.find(item => item === v, typeSelection) !== undefined;

        } else if (TextTypes.isExportedRegexpSelection(typeSelection)) {
            return typeSelection.regexp === v;

        } else {
            return typeSelection === v;
        }
    }
    return false;
}


function createTextInputAttributeSelection(
    sel:TextTypes.AnyExportedTTSelection|undefined,
    attrItem:BlockLine,
    definesSubcorpus:boolean
):TextTypes.TextInputAttributeSelection {
    if (Array.isArray(sel)) {
        return {
            name: attrItem.name,
            label: attrItem.label,
            isNumeric: attrItem.numeric,
            isInterval: !!attrItem.is_interval,
            widget: attrItem.widget,
            attrInfo: {
                doc: attrItem.attr_doc,
                docLabel: attrItem.attr_doc_label
            },
            autoCompleteHints: [],
            values: List.map(
                value => ({
                    value,
                    selected: true,
                    locked: true,
                    ident: value,
                    numGrouped: 0
                }),
                sel
            ),
            definesSubcorpus,
            textFieldValue: '',
            type: 'text',
            metaInfo: null,
        };
    }
    return {
        name: attrItem.name,
        label: attrItem.label,
        isNumeric: attrItem.numeric,
        isInterval: !!attrItem.is_interval,
        widget: attrItem.widget,
        attrInfo: {
            doc: attrItem.attr_doc,
            docLabel: attrItem.attr_doc_label
        },
        autoCompleteHints: [],
        values: [],
        definesSubcorpus,
        textFieldValue: '',
        type: 'text',
        metaInfo: null,
    };
}

function createFullAttributeSelection(
    selectedItems:TextTypes.ExportedSelection,
    attrItem:BlockLine,
    definesSubcorpus:boolean
):TextTypes.FullAttributeSelection {

    const values:Array<TextTypes.AttributeValue> = List.map(
        valItem => ({
            value: valItem.v,
            ident: valItem.v, // TODO what about bib items?
            selected: textTypeValueIsSelected(selectedItems, attrItem.name, valItem.v),
            locked: definesSubcorpus,
            availItems:valItem.xcnt,
            // TODO here we expect that initial data
            // do not have any name duplicities
            numGrouped: 1,
            metaInfo: null,
        }),
        attrItem.Values
    );
    return {
        name: attrItem.name,
        label: attrItem.label,
        isNumeric: attrItem.numeric,
        isInterval: !!attrItem.is_interval,
        widget: attrItem.widget,
        attrInfo: {
            doc: attrItem.attr_doc,
            docLabel: attrItem.attr_doc_label
        },
        values,
        definesSubcorpus,
        type: 'full',
        metaInfo: null,
    };
}

function createRegexpAttributeSelection(
    sel:TextTypes.ExportedRegexpSelection,
    attrItem:BlockLine,
    definesSubcorpus:boolean
):TextTypes.RegexpAttributeSelection {
    return {
        name: attrItem.name,
        label: attrItem.label,
        widget: attrItem.widget,
        attrInfo: {
            doc: attrItem.attr_doc,
            docLabel: attrItem.attr_doc_label
        },
        textFieldValue: sel.regexp,
        textFieldDecoded: Strings.shortenText(sel.regexp, 50, '\u2026'),
        isLocked: definesSubcorpus,
        definesSubcorpus,
        type: 'regexp',
        metaInfo: null,
    };
}

/**
 *
 * @param data
 * @param selectedItems
 * @param subcIncludedAttrs if restoring a subcorpus selection, include involved attributes
 *   so we can lock respective text type boxes
 * @returns
 */
export function importInitialTTData(
    data:TTInitialData,
    selectedItems:TextTypes.ExportedSelection|null,
    subcorpStructure?:TextTypes.ExportedSelection
):Array<TextTypes.AnyTTSelection> {
    const nSelectedItems = selectedItems ? selectedItems : {};
    const mergedBlocks:Array<BlockLine> = List.foldl(
        (prev, curr) => prev.concat(curr.Line),
        [] as Array<BlockLine>,
        data.Blocks
    );
    if (mergedBlocks.length > 0) {
        return List.map(
            (attrItem:BlockLine) => {
                const attrInSubc = subcorpStructure ?
                    Dict.hasKey(attrItem.name, subcorpStructure) : false;

                if (isRegexpGeneratingWidgetView(attrItem.widget)) {
                    const sel = nSelectedItems[attrItem.name] || {regexp: ''};
                    if (TextTypes.isExportedRegexpSelection(sel)) {
                        return createRegexpAttributeSelection(
                            sel, attrItem, attrInSubc);

                    } else {
                        throw new Error(`failed to decode regexp attr. data for ${attrItem.name}`);
                    }

                } else if (attrItem.textboxlength) {
                    return createTextInputAttributeSelection(
                        nSelectedItems[attrItem.name],
                        attrItem,
                        attrInSubc
                    );

                } else {
                    return createFullAttributeSelection(
                        nSelectedItems,
                        attrItem,
                        attrInSubc
                    )
                }
            },
            mergedBlocks
        );
    }
    return null;
}
