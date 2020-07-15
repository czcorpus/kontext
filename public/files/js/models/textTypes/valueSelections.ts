/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
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

import { TextTypes } from '../../types/common';
import { List, pipe } from 'cnc-tskit';


export type ExtendedInfo = {[key:string]:any}; // TODO type

/**
 * This class represents a text input-based selection of values for a specific structural
 * attribute. Although it is expected for a respective view to contain a text input field,
 * the class is able to handle multiple selected values at once (e.g. user writes something
 * and adds it to a temporary list).
 *
 * Please note that the class does not preserve data immutability as we expect it
 * to be handled within Immer.js 'produce' function.
 */
export class TextInputAttributeSelection implements TextTypes.ITextInputAttributeSelection {

    attrInfo:TextTypes.AttrInfo;

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    autoCompleteHints:Array<TextTypes.AutoCompleteItem>;

    values:Array<TextTypes.AttributeValue>; // it supports appending values via a single text input

    textFieldValue:string;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean,
            attrInfo:TextTypes.AttrInfo, textFieldValue:string,
            values:Array<TextTypes.AttributeValue>,
            autoCompleteHints:Array<TextTypes.AutoCompleteItem>) {
        this.name = name;
        this.label = label;
        this.isNumeric = isNumeric;
        this.isInterval = isInterval;
        this.attrInfo = attrInfo;
        this.autoCompleteHints = autoCompleteHints ? autoCompleteHints : [];
        this.values = values ? values : [];
        this.textFieldValue = textFieldValue;
    }

    mapValues(mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):TextTypes.AttributeSelection {
        return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                List.map(mapFn, this.values), this.autoCompleteHints);
    }

    toggleValueSelection(idx:number):TextTypes.AttributeSelection {
        const val = this.values[idx];
        if (val.selected) {
            return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                List.removeAt(idx, this.values),
                this.autoCompleteHints);

        } else {
            return this;
        }
    }

    containsFullList():boolean {
        return false;
    }

    hasUserChanges():boolean {
        const hasSelected = this.values.find((item:TextTypes.AttributeValue) => item.selected === true);
        return hasSelected !== undefined || !!this.textFieldValue;
    }

    exportSelections(lockedOnesOnly:boolean):Array<string> {
        const items = lockedOnesOnly ?
                this.values.filter((item:TextTypes.AttributeValue)=>item.locked) :
                this.values;

        return pipe(
            items,
            List.filter((item:TextTypes.AttributeValue) => item.selected === true),
            List.map((item:TextTypes.AttributeValue) => item.ident)
        );
    }

    updateItems(items:Array<string>):TextTypes.AttributeSelection {
        let values;
        if (!List.empty(this.values)) {
            values = List.filter(
                (item:TextTypes.AttributeValue) => items.indexOf(item.ident) > -1,
                this.values
            );

        } else {
            values = List.map(
                item => ({
                    value: item,
                    selected: false,
                    locked: false,
                }),
                items
            );
        }
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            values
        );
    }

    filter(fn:(v:TextTypes.AttributeValue)=>boolean):TextTypes.AttributeSelection {
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            this.values.filter(fn)
        );
    }

    addValue(value:TextTypes.AttributeValue):TextTypes.AttributeSelection {
        if (this.values.find(x => x.value === value.value) === undefined) {
            this.values.push(value);
            return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                this.values,
                this.autoCompleteHints
            );

        } else {
            return this;
        }
    }

    removeValue(value:string):TextTypes.AttributeSelection {
        const idx = List.findIndex(x => x.value === value, this.values);
        if (idx > -1) {
            const newValues = List.removeAt(idx, this.values);
            return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                newValues,
                this.autoCompleteHints
            );

        } else {
            return this;
        }
    }

    clearValues():TextTypes.AttributeSelection {
        return new TextInputAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            this.textFieldValue,
            [],
            this.autoCompleteHints
        );
    }

    getValues():Array<TextTypes.AttributeValue> {
        return this.values;
    }


    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            values
        );
    }

    setAutoComplete(values:Array<TextTypes.AutoCompleteItem>):TextInputAttributeSelection {
        return new TextInputAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            this.textFieldValue,
            this.values,
            values
        );
    }

    resetAutoComplete():TextInputAttributeSelection {
        return new TextInputAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            this.textFieldValue,
            this.values,
            []
        );
    }

    getAutoComplete():Array<TextTypes.AutoCompleteItem> {
        return this.autoCompleteHints;
    }

    isLocked():boolean {
        return !!this.values.find(item=>item.locked);
    }

    setExtendedInfo(ident:string, data:ExtendedInfo):TextTypes.AttributeSelection {
        const srchIdx = this.values.findIndex(v => v.ident === ident);
        if (srchIdx > -1) {
            const currVal = this.values[srchIdx];
            const newVal = {
                ident: currVal.ident,
                value: currVal.value,
                locked: currVal.locked,
                selected: currVal.selected,
                availItems: currVal.availItems,
                numGrouped: currVal.numGrouped,
                extendedInfo: data
            };
            this.values[srchIdx] = newVal;
            return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                this.values,
                this.autoCompleteHints
            );

        } else {
            throw new Error(`Cannot set extended info - ident ${ident} not found`);
        }
    }

    getTextFieldValue():string {
        return this.textFieldValue;
    }

    setTextFieldValue(v:string):TextInputAttributeSelection {
        return new TextInputAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            v,
            this.values,
            this.autoCompleteHints
        );
    }

    getNumOfSelectedItems():number {
        return List.foldl(
            (p, curr) => p + (curr.selected ? 1 : 0),
            0,
            this.values
        );
    }
}

/**
 * This class represents a text type selection based on a list of checkboxes user can interactively
 * select.
 *
 * Please note that the class does not preserve data immutability as we expect it
 * to be handled within Immer.js 'produce' function.
 */
export class FullAttributeSelection implements TextTypes.AttributeSelection {

    attrInfo:TextTypes.AttrInfo;

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    values:Array<TextTypes.AttributeValue>;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean,
            attrInfo:TextTypes.AttrInfo,
            values:Array<TextTypes.AttributeValue>) {
        this.name = name;
        this.label = label;
        this.isNumeric = isNumeric;
        this.isInterval = isInterval;
        this.attrInfo = attrInfo;
        this.values = values;
    }

    mapValues(mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):TextTypes.AttributeSelection {
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            List.map(mapFn, this.values)
        );
    }

    toggleValueSelection(idx:number):TextTypes.AttributeSelection {
        let ans:FullAttributeSelection = new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            this.values
        );
        const val = ans.values[idx];
        let newVal = {
            ...val,
            selected: !val.selected
        };
        ans.values[idx] = newVal;
        return ans;
    }

    containsFullList():boolean {
        return true;
    }

    hasUserChanges():boolean {
        return this.values.find((item:TextTypes.AttributeValue) => {
            return item.selected === true;
        }) !== undefined;
    }

    exportSelections(lockedOnesOnly:boolean):Array<string> {
        const items = lockedOnesOnly ?
                this.values.filter((item:TextTypes.AttributeValue)=>item.locked) :
                this.values;
        return pipe(
            items,
            List.filter((item:TextTypes.AttributeValue) => item.selected === true),
            List.map((item:TextTypes.AttributeValue) => item.ident)
        );
    }

    updateItems(items:Array<string>):TextTypes.AttributeSelection {
        const values = List.filter(
            (item:TextTypes.AttributeValue) => items.indexOf(item.ident) > -1,
            this.values
        );
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            values
        );
    }

    filter(fn:(v:TextTypes.AttributeValue)=>boolean):TextTypes.AttributeSelection {
        const values = List.filter(fn, this.values);
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            values
        );
    }

    getValues():Array<TextTypes.AttributeValue> {
        return this.values;
    }

    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            values
        );
    }

    addValue(value:TextTypes.AttributeValue):TextTypes.AttributeSelection {
        throw new Error('FullAttributeSelection cannot add new values');
    }

    removeValue(value:string):TextTypes.AttributeSelection {
        throw new Error('FullAttributeSelection cannot remove values');
    }

    clearValues():TextTypes.AttributeSelection {
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            []
        );
    }

    isLocked():boolean {
        return !!this.values.find(item=>item.locked);
    }

    setExtendedInfo(ident:string, data:{[key:string]:any}):TextTypes.AttributeSelection {
        const srchIdx = List.findIndex(v => v.ident === ident, this.values);
        if (srchIdx > -1) {
            const currVal = this.values[srchIdx];
            const newVal = {
                ...currVal,
                extendedInfo: data
            };
            this.values[srchIdx] = newVal;
            return new FullAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.values
            );

        } else {
            throw new Error(`Cannot set extended info - ident ${ident} not found`);
        }
    }

    getNumOfSelectedItems():number {
        return this.values.reduce((p, curr) => p + (curr.selected ? 1 : 0), 0);
    }
}
