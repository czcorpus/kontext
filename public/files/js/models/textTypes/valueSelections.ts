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

import {TextTypes} from '../../types/common';
import * as Immutable from 'immutable';

export type ExtendedInfo = Immutable.Map<string, any>;

/**
 * This class represents a text input-based selection of values for a specific structural
 * attribute. Although it is expected for a respective view to contain a text input field,
 * the class is able to handle multiple selected values at once (e.g. user writes something
 * and adds it to a temporary list).
 *
 * Instances of this class operate in an immutable way. Any modification call to the
 * object will produce a new copy.
 */
export class TextInputAttributeSelection implements TextTypes.ITextInputAttributeSelection {

    attrInfo:TextTypes.AttrInfo;

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    autoCompleteHints:Immutable.List<TextTypes.AutoCompleteItem>;

    values:Immutable.List<TextTypes.AttributeValue>; // it supports appending values via a single text input

    textFieldValue:string;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean,
            attrInfo:TextTypes.AttrInfo, textFieldValue:string,
            values:Immutable.List<TextTypes.AttributeValue>,
            autoCompleteHints:Immutable.List<TextTypes.AutoCompleteItem>) {
        this.name = name;
        this.label = label;
        this.isNumeric = isNumeric;
        this.isInterval = isInterval;
        this.attrInfo = attrInfo;
        this.autoCompleteHints = autoCompleteHints ? autoCompleteHints : Immutable.List([]);
        this.values = values ? values : Immutable.List([]);
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
                this.values.map(mapFn).toList(), this.autoCompleteHints);
    }

    toggleValueSelection(idx:number):TextTypes.AttributeSelection {
        let val = this.values.get(idx);
        if (val.selected) {
            return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                this.values.remove(idx),
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

        return items
            .filter((item:TextTypes.AttributeValue) => item.selected === true)
            .map((item:TextTypes.AttributeValue) => item.ident)
            .toJS();
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
        let values = this.values.filter(fn).toList();
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
        if (this.values.find(x => x.value === value.value) === undefined) {
            return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                this.values.push(value),
                this.autoCompleteHints
            );

        } else {
            return this;
        }
    }

    removeValue(value:string):TextTypes.AttributeSelection {
        let idx = this.values.map(x => x.value).toList().indexOf(value);
        if (idx > -1) {
            let newValues = this.values.remove(idx);
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
            this.values.clear(),
            this.autoCompleteHints
        );
    }

    getValues():Immutable.List<TextTypes.AttributeValue> {
        return this.values;
    }


    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            Immutable.List(values)
        );
    }

    setAutoComplete(values:Array<TextTypes.AutoCompleteItem>):TextInputAttributeSelection {
        let newValues = Immutable.List(values);
        return new TextInputAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            this.textFieldValue,
            this.values,
            this.autoCompleteHints.clear().merge(newValues)
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
            Immutable.List([])
        );
    }

    getAutoComplete():Immutable.List<TextTypes.AutoCompleteItem> {
        return this.autoCompleteHints;
    }

    isLocked():boolean {
        return !!this.values.find(item=>item.locked);
    }

    setExtendedInfo(ident:string, data:ExtendedInfo):TextTypes.AttributeSelection {
        const srchIdx = this.values.findIndex(v => v.ident === ident);
        if (srchIdx > -1) {
            const currVal = this.values.get(srchIdx);
            const newVal = {
                ident: currVal.ident,
                value: currVal.value,
                locked: currVal.locked,
                selected: currVal.selected,
                availItems: currVal.availItems,
                numGrouped: currVal.numGrouped,
                extendedInfo: data
            };
            const values = this.values.set(srchIdx, newVal);
            return new TextInputAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                this.textFieldValue,
                values,
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

    attrInfo:TextTypes.AttrInfo;

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    values:Immutable.List<TextTypes.AttributeValue>;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean,
            attrInfo:TextTypes.AttrInfo,
            values:Immutable.List<TextTypes.AttributeValue>) {
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
            this.values.map(mapFn).toList()
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
        let val = ans.values.get(idx);
        let newVal = {
            ident: val.ident,
            locked: val.locked,
            value: val.value,
            selected: !val.selected,
            availItems: val.availItems,
            numGrouped: val.numGrouped,
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

    exportSelections(lockedOnesOnly:boolean):Array<string> {
        const items = lockedOnesOnly ?
                this.values.filter((item:TextTypes.AttributeValue)=>item.locked) :
                this.values;
        return items
            .filter((item:TextTypes.AttributeValue) => item.selected === true)
            .map((item:TextTypes.AttributeValue) => item.ident)
            .toJS();
    }

    updateItems(items:Array<string>):TextTypes.AttributeSelection {
        let values = this.values.filter((item:TextTypes.AttributeValue) => {
                        return items.indexOf(item.ident) > -1;
                     }).toList();
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
        let values = this.values.filter(fn).toList();
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            values
        );
    }

    getValues():Immutable.List<TextTypes.AttributeValue> {
        return this.values;
    }

    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(
            this.name,
            this.label,
            this.isNumeric,
            this.isInterval,
            this.attrInfo,
            Immutable.List(values)
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
            this.values = this.values.clear()
        );
    }

    isLocked():boolean {
        return !!this.values.find(item=>item.locked);
    }

    setExtendedInfo(ident:string, data:{[key:string]:any}):TextTypes.AttributeSelection {
        const srchIdx = this.values.findIndex(v => v.ident === ident);
        if (srchIdx > -1) {
            const currVal = this.values.get(srchIdx);
            const newVal = {
                ident: currVal.ident,
                value: currVal.value,
                locked: currVal.locked,
                selected: currVal.selected,
                availItems: currVal.availItems,
                numGrouped: currVal.numGrouped,
                extendedInfo: data
            };
            const values = this.values.set(srchIdx, newVal);
            return new FullAttributeSelection(
                this.name,
                this.label,
                this.isNumeric,
                this.isInterval,
                this.attrInfo,
                values
            );

        } else {
            throw new Error(`Cannot set extended info - ident ${ident} not found`);
        }
    }

    getNumOfSelectedItems():number {
        return this.values.reduce((p, curr) => p + (curr.selected ? 1 : 0), 0);
    }
}
