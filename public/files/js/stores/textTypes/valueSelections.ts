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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />

import Immutable = require('vendor/immutable');

/**
 * This class represents a text input-based selection of values for a specific structural
 * attribute. Although it is expected that a respective view contains a text input field,
 * the class is able to handle multiple selected values at once (e.g. user writes something
 * and adds it to a temporary list and then she queries the database).
 *
 * Instances of this class operate in an immutable way. Any modification call to the
 * object will produce a new copy.
 */
export class TextInputAttributeSelection implements TextTypes.TextInputAttributeSelection {

    attrDoc:string;  // ??

    attrDocLabel:string; // ??

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    autoCompleteHints:Immutable.List<TextTypes.AutoCompleteItem>;

    values:Immutable.List<TextTypes.AttributeValue>; // it supports appending values via a single text input

    textFieldValue:string;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean,
            textFieldValue:string, values:Immutable.List<TextTypes.AttributeValue>,
            autoCompleteHints:Immutable.List<TextTypes.AutoCompleteItem>) {
        this.name = name;
        this.label = label;
        this.isNumeric = isNumeric;
        this.isInterval = isInterval;
        this.autoCompleteHints = autoCompleteHints ? autoCompleteHints : Immutable.List([]);
        this.values = values ? values : Immutable.List([]);
    }

    mapValues(mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):TextTypes.AttributeSelection {
        return new TextInputAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.textFieldValue, this.values.map(mapFn).toList(), this.autoCompleteHints);
    }

    toggleValueSelection(idx:number):TextTypes.AttributeSelection {
        let val = this.values.get(idx);
        if (val.selected) {
            return new TextInputAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.textFieldValue, this.values.remove(idx), this.autoCompleteHints);

        } else {
            return this;
        }
    }

    containsFullList():boolean {
        return false;
    }

    hasUserChanges():boolean {
        return this.values.find((item:TextTypes.AttributeValue) => {
            return item.selected === true;
        }) !== undefined;
    }

    exportSelections(lockedOnesOnly:boolean):any {
        let items = lockedOnesOnly ?
                this.values.filter((item:TextTypes.AttributeValue)=>item.locked) : this.values;
        return items
            .filter((item:TextTypes.AttributeValue) => {
                return item.selected === true;
            })
            .map((item:TextTypes.AttributeValue) => {
                return item.ident;
            }).toJS();
    }

    updateItems(items:Array<string>):TextTypes.AttributeSelection {
        let values;
        if (this.values.size > 0) {
            values = this.values.filter((item:TextTypes.AttributeValue) => {
                return items.indexOf(item.ident) > -1;
            }).toList();

        } else {
            values = Immutable.List(items).map((item) => {
                return {
                    value: item,
                    selected: false,
                    locked: false,
                }
            }).toList();
        }
        return new FullAttributeSelection(this.name, this.label,
                this.isNumeric, this.isInterval, values);
    }

    filter(fn:(v:TextTypes.AttributeValue)=>boolean):TextTypes.AttributeSelection {
        let values = this.values.filter(fn).toList();
        return new FullAttributeSelection(this.name, this.label,
                this.isNumeric, this.isInterval, values);
    }

    addValue(value:TextTypes.AttributeValue):TextTypes.AttributeSelection {
        if (this.values.find(x => x.value === value.value) === undefined) {
            return new TextInputAttributeSelection(this.name, this.label,
                    this.isNumeric, this.isInterval, this.textFieldValue, this.values.push(value),
                    this.autoCompleteHints);

        } else {
            return this;
        }
    }

    removeValue(value:string):TextTypes.AttributeSelection {
        let idx = this.values.map(x => x.value).toList().indexOf(value);
        if (idx > -1) {
            let newValues = this.values.remove(idx);
            return new TextInputAttributeSelection(this.name, this.label, this.isNumeric,
                    this.isInterval, this.textFieldValue, newValues, this.autoCompleteHints);

        } else {
            return this;
        }
    }

    clearValues():TextTypes.AttributeSelection {
        return new TextInputAttributeSelection(this.name, this.label, this.isNumeric,
                    this.isInterval, this.textFieldValue, this.values.clear(), this.autoCompleteHints);
    }

    getValues():Immutable.List<TextTypes.AttributeValue> {
        return this.values;
    }


    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, Immutable.List(values));
    }

    setAutoComplete(values:Array<TextTypes.AutoCompleteItem>):TextInputAttributeSelection {
        let newValues = Immutable.List(values);
        return new TextInputAttributeSelection(this.name, this.label, this.isNumeric, this.isInterval,
                this.textFieldValue, this.values, this.autoCompleteHints.clear().merge(newValues));
    }

    resetAutoComplete():TextInputAttributeSelection {
        return new TextInputAttributeSelection(this.name, this.label, this.isNumeric, this.isInterval,
                this.textFieldValue, this.values, Immutable.List([]));
    }

    getAutoComplete():Immutable.List<TextTypes.AutoCompleteItem> {
        return this.autoCompleteHints;
    }

    isLocked():boolean {
        return !!this.values.find(item=>item.locked);
    }

    setExtendedInfo(idx:number, data:Immutable.Map<string, any>):TextTypes.AttributeSelection {
        let currVal = this.values.get(idx);
        let newVal = {
            ident: currVal.ident,
            value: currVal.value,
            locked: currVal.locked,
            selected: currVal.selected,
            availItems: currVal.availItems,
            extendedInfo: data
        };
        let values = this.values.set(idx, newVal);
        return new TextInputAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.textFieldValue, values, this.autoCompleteHints);
    }

    getTextFieldValue():string {
        return this.textFieldValue;
    }

    setTextFieldValue(v:string):TextInputAttributeSelection {
        return new TextInputAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, v, this.values, this.autoCompleteHints);
    }

    getNumOfSelectedItems():number {
        return this.values.reduce((p, curr) => p + (curr.selected ? 1 : 0), 0);
    }
}

/**
 * This class represents a text type selection based on a list of checkboxes user can interactively
 * select.
 *
 * Instances of this class operate in an immutable way. Any modification call to the
 * object will produce a new copy.
 */
export class FullAttributeSelection implements TextTypes.AttributeSelection {

    attrDoc:string;  // ??

    attrDocLabel:string; // ??

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    values:Immutable.List<TextTypes.AttributeValue>;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean,
            values:Immutable.List<TextTypes.AttributeValue>) {
        this.name = name;
        this.label = label;
        this.isNumeric = isNumeric;
        this.isInterval = isInterval;
        this.values = values;
    }

    mapValues(mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):TextTypes.AttributeSelection {
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.values.map(mapFn).toList());
    }

    toggleValueSelection(idx:number):TextTypes.AttributeSelection {
        let ans:FullAttributeSelection = new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.values);
        let val = ans.values.get(idx);
        let newVal = {
            ident: val.ident,
            locked: val.locked,
            value: val.value,
            selected: !val.selected,
            availItems: val.availItems,
            extendedInfo: val.extendedInfo
        };
        ans.values = ans.values.set(idx, newVal);
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

    exportSelections(lockedOnesOnly:boolean):any {
        let items = lockedOnesOnly ?
                this.values.filter((item:TextTypes.AttributeValue)=>item.locked) : this.values;
        return items
            .filter((item:TextTypes.AttributeValue) => {
                return item.selected === true;
            })
            .map((item:TextTypes.AttributeValue) => {
                return item.ident;
            }).toJS();
    }

    updateItems(items:Array<string>):TextTypes.AttributeSelection {
        let values = this.values.filter((item:TextTypes.AttributeValue) => {
                        return items.indexOf(item.ident) > -1;
                     }).toList();
        return new FullAttributeSelection(this.name, this.label,
                this.isNumeric, this.isInterval, values);
    }

    filter(fn:(v:TextTypes.AttributeValue)=>boolean):TextTypes.AttributeSelection {
        let values = this.values.filter(fn).toList();
        return new FullAttributeSelection(this.name, this.label,
                this.isNumeric, this.isInterval, values);
    }

    getValues():Immutable.List<TextTypes.AttributeValue> {
        return this.values;
    }

    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, Immutable.List(values));
    }

    addValue(value:TextTypes.AttributeValue):TextTypes.AttributeSelection {
        throw new Error('FullAttributeSelection cannot add new values');
    }

    removeValue(value:string):TextTypes.AttributeSelection {
        throw new Error('FullAttributeSelection cannot remove values');
    }

    clearValues():TextTypes.AttributeSelection {
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.values = this.values.clear());
    }

    isLocked():boolean {
        return !!this.values.find(item=>item.locked);
    }

    setExtendedInfo(idx:number, data:{[key:string]:any}):TextTypes.AttributeSelection {
        let currVal = this.values.get(idx);
        let newVal = {
            ident: currVal.ident,
            value: currVal.value,
            locked: currVal.locked,
            selected: currVal.selected,
            availItems: currVal.availItems,
            extendedInfo: data
        };
        let values = this.values.set(idx, newVal);
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, values);
    }

    getNumOfSelectedItems():number {
        return this.values.reduce((p, curr) => p + (curr.selected ? 1 : 0), 0);
    }
}
