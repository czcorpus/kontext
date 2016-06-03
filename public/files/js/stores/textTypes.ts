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

/// <reference path="../../ts/declarations/common.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />


import util = require('../util');
import Immutable = require('vendor/immutable');
import rangeSelector = require('./util/rangeSelector');


/**
 * Server-side data
 */
export interface BlockLine {
    Values?:Array<{v:string; xcnt?:string}>;
    textboxlength?:number; // Values and textboxlength are mutually exclusive
    attr_doc:string;
    attr_doc_label:string;
    is_interval:number;
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


/**
 * Server-side data representing a group
 * of structures, structural attributes and
 * their values.
 */
export interface InitialData {
    Blocks:Array<Block>;
    Normslist:Array<any>;
    bib_attr:string;
}


/**
 *
 */
class TextInputAttributeSelection implements TextTypes.AttributeSelection {

    attrDoc:string;  // ??

    attrDocLabel:string; // ??

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    autoCompleteHints:Immutable.List<string>;

    value:string;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean, value?:string) {
        this.name = name;
        this.label = label;
        this.isNumeric = isNumeric;
        this.isInterval = isInterval;
        this.autoCompleteHints = Immutable.List([]);
        this.value = value;
    }

    updateValues(mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):TextTypes.AttributeSelection {
        throw new Error('cannot update values for SrchAttributeSelection');
    }

    toggleValueSelection(idx:number):TextTypes.AttributeSelection {
        throw new Error('cannot update values for SrchAttributeSelection');
    }

    containsFullList():boolean {
        return false;
    }

    hasUserChanges():boolean {
        return false; // TODO
    }

    exportSelections(lockedOnesOnly:boolean):any {
        return null; // TODO
    }

    filterItems(items:Array<string>):TextTypes.AttributeSelection {
        throw new Error('cannot filter items from SrchAttributeSelection');
    }

    filter(fn:(v:TextTypes.AttributeValue)=>boolean):TextTypes.AttributeSelection {
        throw new Error('cannot filter items from SrchAttributeSelection');
    }

    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, values);
    }

    setAutoComplete(values:Array<string>):void {
        this.autoCompleteHints = this.autoCompleteHints.merge(values);
    }

    getAutoComplete():Immutable.List<string> {
        return this.autoCompleteHints;
    }

    isLocked():boolean {
        return false;
    }

    setExtendedInfo(idx:number, data:Immutable.Map<string, any>):TextTypes.AttributeSelection {
        throw new Error('cannot set extended info for TextInputAttributeSelection');
    }

    setValue(v:string):TextInputAttributeSelection {
        return new TextInputAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, v);
    }

    getValue():string {
        return this.value;
    }
}

/**
 *
 */
class FullAttributeSelection implements TextTypes.AttributeSelection {

    attrDoc:string;  // ??

    attrDocLabel:string; // ??

    isInterval:boolean;

    isNumeric:boolean;

    label:string;

    name:string;

    values:Immutable.List<TextTypes.AttributeValue>;

    constructor(name:string, label:string, isNumeric:boolean, isInterval:boolean,
            values:Array<TextTypes.AttributeValue>) {
        this.name = name;
        this.label = label;
        this.isNumeric = isNumeric;
        this.isInterval = isInterval;
        this.values = Immutable.List(values);
    }

    updateValues(mapFn:(item:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):TextTypes.AttributeSelection {
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.values.map(mapFn).toArray());
    }

    toggleValueSelection(idx:number):TextTypes.AttributeSelection {
        let ans:FullAttributeSelection = new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, this.values.toArray());
        let val = ans.values.get(idx);
        let newVal = {
            locked: val.locked,
            value: val.value,
            selected: !val.selected,
            availItems: val.availItems
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
                return item.value;
            }).toJS();
    }

    filterItems(items:Array<string>):TextTypes.AttributeSelection {
        let values = this.values.filter((item:TextTypes.AttributeValue) => {
                        return items.indexOf(item.value) > -1;
                     }).toArray();
        return new FullAttributeSelection(this.name, this.label,
                this.isNumeric, this.isInterval, values);
    }

    filter(fn:(v:TextTypes.AttributeValue)=>boolean):TextTypes.AttributeSelection {
        let values = this.values.filter(fn).toArray();
        return new FullAttributeSelection(this.name, this.label,
                this.isNumeric, this.isInterval, values);
    }

    setValues(values:Array<TextTypes.AttributeValue>):TextTypes.AttributeSelection {
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, values);
    }

    setAutoComplete(values:Array<string>):void {} // ignoring intentionally

    getAutoComplete():Immutable.List<string> {
        return Immutable.List<string>([]);
    }

    isLocked():boolean {
        return !!this.values.find(item=>item.locked);
    }

    setExtendedInfo(idx:number, data:{[key:string]:any}):TextTypes.AttributeSelection {
        let currVal = this.values.get(idx);
        let newVal = {
            value: currVal.value,
            locked: currVal.locked,
            selected: currVal.selected,
            availItems: currVal.availItems,
            extendedInfo: data
        };
        let values = this.values.set(idx, newVal);
        return new FullAttributeSelection(this.name, this.label, this.isNumeric,
                this.isInterval, values.toArray());
    }

    setValue(v:string):FullAttributeSelection {
        throw new Error('Cannot set value for ' + this.name);
    }
}


/**
 * Provides essential general operations on available text types
 * (filtering values, updating status - checked/locked, ...).
 *
 * All the state data is based on Immutable.js except for individual data
 * items which are updated via manual copying (i.e. no Immutable.Record).
 */
export class TextTypesStore extends util.SimplePageStore implements TextTypes.ITextTypesStore {

    private attributes:Immutable.List<TextTypes.AttributeSelection>;

    /**
     * A reference used to reset state.
     */
    private initialAttributes:Immutable.List<TextTypes.AttributeSelection>;

    /**
     * Select-all request flags
     */
    private selectAll:Immutable.Map<string, boolean>;

    /**
     * A helper class used to process range-like selection requests
     * (e.g. "select years between 1980 and 1990").
     */
    private rangeSelector:rangeSelector.RangeSelector;

    private pluginApi:Kontext.PluginApi;

    private lastActiveRangeAttr:string;

    private metaInfo:Immutable.Map<string, TextTypes.AttrSummary>;

    private extendedInfoCallbacks:Immutable.Map<string, (idx:number)=>RSVP.Promise<any>>; // TODO type

    private textInputChangeCallback:(attrName:string, inputValue:string)=>RSVP.Promise<any>;

    private textInputPlaceholder:string;


    constructor(dispatcher:Dispatcher.Dispatcher<any>, pluginApi:Kontext.PluginApi, data:InitialData,
            checkedItems:TextTypes.ServerCheckedValues={}) {
        super(dispatcher);
        this.attributes = Immutable.List(this.importInitialData(data, checkedItems));
        this.initialAttributes = this.attributes;
        this.selectAll = Immutable.Map<string, boolean>(
                this.attributes.map(
                    (item:TextTypes.AttributeSelection)=>[item.name, false]
                ).toList());
        this.pluginApi = pluginApi;
        this.lastActiveRangeAttr = null;
        this.rangeSelector = new rangeSelector.RangeSelector(pluginApi, this);
        this.metaInfo = Immutable.Map({});
        this.extendedInfoCallbacks = Immutable.Map({});
        this.textInputPlaceholder = null;
        let self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'TT_VALUE_CHECKBOX_CLICKED':
                    self.changeValueSelection(payload.props['attrName'], payload.props['itemIdx']);
                    break;
                case 'TT_SELECT_ALL_CHECKBOX_CLICKED':
                    self.applySelectAll(payload.props['attrName']);
                    break;
                case 'TT_RANGE_BUTTON_CLICKED':
                    self.applyRange(payload.props['attrName'], payload.props['fromVal'],
                            payload.props['toVal'], payload.props['strictInterval'],
                            payload.props['keepCurrent']);
                    break;
                case 'TT_EXTENDED_INFORMATION_REQUEST':
                    let fn = self.extendedInfoCallbacks.get(payload.props['attrName']);
                    if (fn) {
                        fn(payload.props['idx']).then(
                            (v) => {
                                self.notifyChangeListeners('$TT_EXTENDED_INFO_CHANGED');
                            },
                            (err) => {
                                self.pluginApi.showMessage('error', err);
                            }
                        )
                    }
                    break;
                case 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST':
                    let attr = self.getAttribute(payload.props['attrName']);
                    if (attr) {
                        let attrIdx = self.attributes.indexOf(attr);
                        let newAttr = attr.setExtendedInfo(payload.props['idx'], null);
                        self.attributes = self.attributes.set(attrIdx, newAttr);
                        self.notifyChangeListeners('$TT_EXTENDED_INFO_CHANGED');

                    } else {
                        throw new Error('Attribute not found: ' + payload.props['attrName']);
                    }
                    break;
                case 'TT_ATTRIBUTE_TEXT_INPUT_SILENTLY_CHANGED':
                    self.setTextInputAttrValue(payload.props['attrName'], payload.props['value']);
                    self.notifyChangeListeners('$TT_RAW_INPUT_VALUE_UPDATED');
                    break;
                case 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED':
                    self.handleAttrTextInputChange(payload.props['attrName'], payload.props['value']);
                    self.notifyChangeListeners('$TT_RAW_INPUT_VALUE_UPDATED');
                    break;
                case 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST':
                    self.handleAttrTextInputAutoCompleteRequest(payload.props['attrName'], payload.props['value']).then(
                        (v) => {
                            self.notifyChangeListeners('$TT_RAW_INPUT_VALUE_UPDATED');
                        },
                        (err) => {
                            self.pluginApi.showMessage('error', err);
                            console.error(err);
                        }
                    );
                    break;
            }
        });
    }

    private handleAttrTextInputChange(attrName:string, value:string) {
        let attr = this.getAttribute(attrName);
        if (attr) {
            let idx = this.attributes.indexOf(attr);
            let newAttr = attr.setValue(value);
            this.attributes = this.attributes.set(idx, newAttr);
        }
    }

    private handleAttrTextInputAutoCompleteRequest(attrName:string, value:string):RSVP.Promise<any> {
        if (typeof this.textInputChangeCallback === 'function') {
            return this.textInputChangeCallback(attrName, value);
        }
    }

    private setTextInputAttrValue(attrName:string, value:string):void {
        let attr:any = this.getAttribute(attrName);
        if (attr && attr instanceof TextInputAttributeSelection) {
            let idx = this.attributes.indexOf(attr);
            let newAttr = attr.setValue(value);
            this.attributes = this.attributes.set(idx, newAttr);
        }
    }

    private importInitialData(data:InitialData, checkedValues:TextTypes.ServerCheckedValues):Array<TextTypes.AttributeSelection> {
        if (data.Blocks.length > 0) {
            return data.Blocks[0].Line.map((attrItem:BlockLine) => {
                if (attrItem.textboxlength) {
                    return new TextInputAttributeSelection(attrItem.name, attrItem.label, attrItem.numeric,
                        !!attrItem.is_interval);

                } else {
                    let checkedInfo:Array<string> = checkedValues[attrItem.name] || [];
                    let values:Array<TextTypes.AttributeValue> = attrItem.Values.map((valItem:{v:string, xcnt:string}) => {
                        return {
                            selected: checkedInfo.indexOf(valItem.v) > -1 ? true : false,
                            value: valItem.v,
                            locked:false,
                            availItems:valItem.xcnt
                        };
                    });
                    return new FullAttributeSelection(attrItem.name, attrItem.label, attrItem.numeric,
                            !!attrItem.is_interval, values);
                }
            });
        }
        return null;
    }

    private changeValueSelection(attrIdent:string, itemIdx:number) {
        let attr = this.getAttribute(attrIdent);
        let idx = this.attributes.indexOf(attr);
        if (attr) {
            this.attributes = this.attributes.set(idx, attr.toggleValueSelection(itemIdx));

        } else {
            throw new Error('no such attribute value: ' + attrIdent);
        }
        this.notifyChangeListeners('$TT_VALUE_CHECKBOX_CLICKED');
    }

    private applyRange(attrName:string, fromVal:number, toVal: number, strictInterval:boolean,
            keepCurrent:boolean) {
        let prom = this.rangeSelector.applyRange(attrName, fromVal, toVal, strictInterval, keepCurrent);
        prom.then(
            (v:number) => {
                if (v > 0) {
                    this.lastActiveRangeAttr = attrName;
                    this.notifyChangeListeners('$TT_RANGE_APPLIED');
                }
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        )
    }

    private applySelectAll(ident:string) {
        let item = this.getAttribute(ident);
        let idx = this.attributes.indexOf(item);
        if (item.containsFullList()) {
            this.selectAll = this.selectAll.set(ident, !this.selectAll.get(ident));
            let newVal = this.selectAll.get(ident);
            this.attributes = this.attributes.set(idx, item.updateValues((item) => {
                return {
                    value: item.value,
                    selected: newVal,
                    locked: item.locked
                };
            }));
            this.notifyChangeListeners('$TT_SELECT_ALL_UPDATED');
        }
    }

    reset():void {
        this.attributes = this.initialAttributes;
        this.lastActiveRangeAttr = null;
        this.selectAll = this.selectAll.map((item)=>false).toMap();
        this.metaInfo = this.metaInfo.clear();
    }

    getAttribute(ident:string):TextTypes.AttributeSelection {
        return this.attributes.find((val) => val.name === ident);
    }

    replaceAttribute(ident:string, val:TextTypes.AttributeSelection):void {
        let attr = this.getAttribute(ident);
        let idx = this.attributes.indexOf(attr);
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, val);

        } else {
            throw new Error('Failed to find attribute ' + ident);
        }
    }

    getAttributes():Array<TextTypes.AttributeSelection> {
        return this.attributes.toArray();
    }

    exportSelections(lockedOnesOnly:boolean):{[attr:string]:any} {
        let ans = {};
        this.attributes.forEach((attrSel:TextTypes.AttributeSelection) => {
            if (attrSel.hasUserChanges()) {
                ans[attrSel.name] = attrSel.exportSelections(lockedOnesOnly);
            }
        });
        return ans;
    }

    filterItems(attrName:string, items:Array<string>):void {
        let attr = this.getAttribute(attrName);
        let newAttr;
        let idx = this.attributes.indexOf(attr);
        if (idx > -1) {
            if (attr.containsFullList()) {
                newAttr = attr.filterItems(items);

            } else {
                let values = items.map((v) => {
                    return {value: v, selected: false, locked: false, availItems:null}
                });
                newAttr = new FullAttributeSelection(attr.name,
                    attr.label, attr.isNumeric, attr.isInterval, values);
            }
            this.attributes = this.attributes.set(idx, newAttr);
        }
    }

    filter(attrName:string, fn:(v:TextTypes.AttributeValue)=>boolean):void {
        let attr = this.getAttribute(attrName);
        let idx = this.attributes.indexOf(attr);
        this.attributes = this.attributes.set(idx, attr.filter(fn));
    }

    updateItems(attrName:string, mapFn:(v:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):void {
        let attr = this.getAttribute(attrName);
        let idx = this.attributes.indexOf(attr);
        this.attributes = this.attributes.set(idx, attr.updateValues(mapFn));
    }

    setValues(attrName:string, values:Array<string>):void {
        let attr = this.getAttribute(attrName);
        let idx = this.attributes.indexOf(attr);
        let values2:Array<TextTypes.AttributeValue> = values.map((item:string) => {
            return {
                value: item,
                selected: false,
                locked: false
            };
        });
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, attr.setValues(values2));

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    setAutoComplete(attrName:string, values:Array<string>):void {
        let attr = this.getAttribute(attrName);
        if (attr) {
            attr.setAutoComplete(values);
        }
    }

    getLastActiveRangeAttr():string {
        return this.lastActiveRangeAttr;
    }

    hasSelectedItems(attrName:string):boolean {
        let attr = this.getAttribute(attrName);
        if (attr) {
            return attr.hasUserChanges();

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    getAttributesWithSelectedItems(includeLocked:boolean):Array<string> {
        return this.attributes.filter((item:TextTypes.AttributeSelection) => {
            return item.hasUserChanges() && (!item.isLocked() || includeLocked);
        }).map((item:TextTypes.AttributeSelection)=>item.name).toArray();
    }

    setAttrSummary(attrName:string, value:TextTypes.AttrSummary):void {
        this.metaInfo = this.metaInfo.set(attrName, value);
    }

    getAttrSummary():Immutable.Map<string, TextTypes.AttrSummary> {
        return this.metaInfo;
    }

    setExtendedInfoSupport<T>(attrName:string, fn:(idx:number)=>RSVP.Promise<T>):void {
        this.extendedInfoCallbacks = this.extendedInfoCallbacks.set(attrName, fn);
    }

    hasDefinedExtendedInfo(attrName:string):boolean {
        return this.extendedInfoCallbacks.has(attrName);
    }

    setExtendedInfo(attrName:string, idx:number, data:Immutable.Map<string, any>):void {
        let attr = this.getAttribute(attrName);
        if (attrName) {
            let attrIdx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(attrIdx, attr.setExtendedInfo(idx, data));

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    setTextInputChangeCallback(fn:(attrName:string, inputValue:string)=>RSVP.Promise<any>):void {
        this.textInputChangeCallback = fn;
    }


    setTextInputPlaceholder(s:string):void {
        this.textInputPlaceholder = s;
    }

    getTextInputPlaceholder():string {
        return this.textInputPlaceholder;
    }

}