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

import { List } from 'cnc-tskit';

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
    bib_attr:string; // bib item label (possibly non-unique)
    id_attr:string; // actual bib item identifier (unique)
}


const typeIsSelected = (data:TextTypes.ExportedSelection, attr:string, v:string):boolean => {
    if (data.hasOwnProperty(attr)) {
        return data[attr].indexOf(v) > -1;
    }
    return false;
}

export function importInitialData(data:TTInitialData,
        selectedItems:TextTypes.ExportedSelection):Array<TextTypes.AnyTTSelection> {
    const mergedBlocks:Array<BlockLine> = List.foldl(
        (prev, curr) => prev.concat(curr.Line),
        [] as Array<BlockLine>,
        data.Blocks
    );
    if (mergedBlocks.length > 0) {
        return mergedBlocks.map((attrItem:BlockLine) => {
            if (isRegexpGeneratingWidgetView(attrItem.widget)) {
                return {
                    name: attrItem.name,
                    label: attrItem.label,
                    isNumeric: attrItem.numeric,
                    widget: attrItem.widget,
                    attrInfo: {
                        doc: attrItem.attr_doc,
                        docLabel: attrItem.attr_doc_label
                    },
                    textFieldValue: '',
                    textFieldDecoded: '',
                    isLocked: false,
                    type: 'regexp'
                };

            } else if (attrItem.textboxlength) {
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
                    textFieldValue: '',
                    type: 'text'
                };

            } else {
                const values:Array<TextTypes.AttributeValue> = List.map(
                    valItem => ({
                        value: valItem.v,
                        ident: valItem.v, // TODO what about bib items?
                        selected: typeIsSelected(selectedItems, attrItem.name, valItem.v) ?
                            true : false,
                        locked:false,
                        availItems:valItem.xcnt,
                        // TODO here we expect that initial data
                        // do not have any name duplicities
                        numGrouped: 1
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
                    type: 'full'
                };
            }
        });
    }
    return null;
}
