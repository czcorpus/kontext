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
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />


import {SimplePageStore} from '../../util';
import Immutable = require('vendor/immutable');
import rangeSelector = require('./rangeSelector');
import {TextInputAttributeSelection, FullAttributeSelection} from './valueSelections';


/**
 * Server-side data a returned by respective AJAX calls.
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
 * Provides essential general operations on available text types
 * (filtering values, updating status - checked/locked, ...).
 *
 * All the state data is based on Immutable.js except for individual data
 * items which are updated via manual copying (i.e. no Immutable.Record).
 */
export class TextTypesStore extends SimplePageStore implements TextTypes.ITextTypesStore {

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

    /**
     * Represents meta information related to the whole attribute
     * (i.e. not just to a single value).
     */
    private metaInfo:Immutable.Map<string, TextTypes.AttrSummary>;

    /**
     * Contains externally registered callbacks invoked in case
     * user clicks to the [i] icon. The store must be set to provide
     * such a functionality.
     */
    private extendedInfoCallbacks:Immutable.Map<string, (idx:number)=>RSVP.Promise<any>>; // TODO type

    /**
     * Contains externally registered callbacks invoked in case
     * user writes something to text-input based value selection boxes.
     * This can be used e.g. to provide auto-complete features.
     */
    private textInputChangeCallback:(attrName:string, inputValue:string)=>RSVP.Promise<any>;

    /**
     *
     */
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
        this.rangeSelector = new rangeSelector.RangeSelector(pluginApi, this);
        this.metaInfo = Immutable.Map({});
        this.extendedInfoCallbacks = Immutable.Map({});
        this.textInputPlaceholder = null;
        const self = this;

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
                case 'TT_TOGGLE_RANGE_MODE':
                    self.setRangeMode(payload.props['attrName'], !self.getRangeModes().get(payload.props['attrName']));
                    self.notifyChangeListeners();
                    break;
                case 'TT_EXTENDED_INFORMATION_REQUEST':
                    self.fetchExtendedInfo(payload.props['attrName'], payload.props['idx']).then(
                        (v) => {
                            self.notifyChangeListeners('$TT_EXTENDED_INFO_CHANGED');
                        },
                        (err) => {
                            self.pluginApi.showMessage('error', err);
                        }
                    );
                    break;
                case 'TT_EXTENDED_INFORMATION_REMOVE_REQUEST':
                    self.clearExtendedInfo(payload.props['attrName'], payload.props['idx']);
                    self.notifyChangeListeners('$TT_EXTENDED_INFO_CHANGED');
                    break;
                case 'TT_ATTRIBUTE_AUTO_COMPLETE_HINT_CLICKED':
                    self.setTextInputAttrValue(payload.props['attrName'], payload.props['ident'],
                            payload.props['label'], payload.props['append']);
                    self.notifyChangeListeners('$TT_NEW_VALUE_ADDED');
                    break;
                case 'TT_ATTRIBUTE_TEXT_INPUT_CHANGED':
                    self.handleAttrTextInputChange(payload.props['attrName'], payload.props['value']);
                    self.notifyChangeListeners('$TT_RAW_INPUT_VALUE_UPDATED');
                    break;
                case 'TT_ATTRIBUTE_AUTO_COMPLETE_RESET':
                    self.resetAutoComplete(payload.props['attrName']);
                    self.notifyChangeListeners('$TT_ATTRIBUTE_AUTO_COMPLETE_RESET');
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

    private clearExtendedInfo(attrName:string, itemIdx:number):void {
        const attr = this.getAttribute(attrName);
        if (attr) {
            const attrIdx = this.attributes.indexOf(attr);
            const newAttr = attr.setExtendedInfo(itemIdx, null);
            this.attributes = this.attributes.set(attrIdx, newAttr);

        } else {
            throw new Error('Attribute not found: ' + attrName);
        }
    }

    private fetchExtendedInfo(attrName:string, itemIdx:number):RSVP.Promise<any> {
        const attr = this.getAttribute(attrName);
        const attrIdx = this.attributes.indexOf(attr);
        this.attributes = this.attributes.set(attrIdx, attr.mapValues(item => {
            return {
                availItems: item.availItems,
                extendedInfo: undefined,
                ident: item.ident,
                locked: item.locked,
                numGrouped: item.numGrouped,
                selected: item.selected,
                value: item.value
            };
        }));
        const fn = this.extendedInfoCallbacks.get(attrName);
        if (fn) {
            return fn(itemIdx);

        } else {
            return new RSVP.Promise((resolve: (v:any)=>void, reject:(e:any)=>void) => {
                resolve(null);
            });
        }
    }

    private resetAutoComplete(attrName:string):void {
        const attr = this.getTextInputAttribute(attrName);
        if (attr) {
            const idx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(idx, attr.resetAutoComplete());
        }
    }

    private handleAttrTextInputChange(attrName:string, value:string) {
        const attr = this.getTextInputAttribute(attrName);
        if (attr) {
            const idx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(idx, attr.setTextFieldValue(value));
        }
    }

    private handleAttrTextInputAutoCompleteRequest(attrName:string, value:string):RSVP.Promise<any> {
        if (typeof this.textInputChangeCallback === 'function') {
            return this.textInputChangeCallback(attrName, value);
        }
    }

    private setTextInputAttrValue(attrName:string, ident:string, label:string, append:boolean):void {
        const attr:TextTypes.AttributeSelection = this.getTextInputAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        const newVal:TextTypes.AttributeValue = {
            ident: ident,
            value: label,
            selected: true,
            locked: false,
            numGrouped: 1
        };
        let newAttr;
        if (append) {
            newAttr = attr.addValue(newVal);

        } else {
            newAttr = attr.clearValues().addValue(newVal);
        }
        this.attributes = this.attributes.set(idx, newAttr);
    }

    private importInitialData(data:InitialData, checkedValues:TextTypes.ServerCheckedValues):Array<TextTypes.AttributeSelection> {
        const mergedBlocks:Array<BlockLine> = data.Blocks.reduce((prev:Array<BlockLine>, curr:Block) => {
            return prev.concat(curr.Line);
        }, []);
        if (mergedBlocks.length > 0) {
            return mergedBlocks.map((attrItem:BlockLine) => {
                if (attrItem.textboxlength) {
                    return new TextInputAttributeSelection(attrItem.name, attrItem.label, attrItem.numeric,
                        !!attrItem.is_interval, null, Immutable.List([]), Immutable.List([]));

                } else {
                    const checkedInfo:Array<string> = checkedValues[attrItem.name] || [];
                    const values:Array<TextTypes.AttributeValue> = attrItem.Values.map(
                        (valItem:{v:string, xcnt:string}) => {
                            return {
                                value: valItem.v,
                                ident: valItem.v, // TODO what about bib items?
                                selected: checkedInfo.indexOf(valItem.v) > -1 ? true : false,
                                locked:false,
                                availItems:valItem.xcnt,
                                numGrouped: 1 // TODO here we expect that initial data do not have any name duplicities
                            };
                        }
                    );
                    return new FullAttributeSelection(attrItem.name, attrItem.label, attrItem.numeric,
                            !!attrItem.is_interval, Immutable.List(values));
                }
            });
        }
        return null;
    }

    private changeValueSelection(attrIdent:string, itemIdx:number):void {
        const attr = this.getAttribute(attrIdent);
        const idx = this.attributes.indexOf(attr);
        if (attr) {
            this.attributes = this.attributes.set(idx, attr.toggleValueSelection(itemIdx));

        } else {
            throw new Error('no such attribute value: ' + attrIdent);
        }
        this.notifyChangeListeners('$TT_VALUE_CHECKBOX_STORED');
    }

    // TODO move notify... out of the method
    private applyRange(attrName:string, fromVal:number, toVal: number, strictInterval:boolean,
            keepCurrent:boolean):void {
        const prom = this.rangeSelector.applyRange(attrName, fromVal, toVal, strictInterval, keepCurrent);
        prom.then(
            (newSelection:TextTypes.AttributeSelection) => {
                this.notifyChangeListeners();
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    private applySelectAll(ident:string) {
        const item = this.getAttribute(ident);
        const idx = this.attributes.indexOf(item);
        if (item.containsFullList()) {
            this.selectAll = this.selectAll.set(ident, !this.selectAll.get(ident));
            const newVal = this.selectAll.get(ident);
            this.attributes = this.attributes.set(idx, item.mapValues((item) => {
                return {
                    ident: item.ident,
                    value: item.value,
                    selected: newVal,
                    locked: item.locked,
                    numGrouped: item.numGrouped
                };
            }));
            this.notifyChangeListeners('$TT_SELECT_ALL_UPDATED');
        }
    }

    reset():void {
        this.attributes = this.initialAttributes;
        this.selectAll = this.selectAll.map((item)=>false).toMap();
        this.metaInfo = this.metaInfo.clear();
    }

    getAttribute(ident:string):TextTypes.AttributeSelection {
        return this.attributes.find((val) => val.name === ident);
    }

    getTextInputAttribute(ident:string):TextTypes.TextInputAttributeSelection {
        const ans = this.attributes.find(val => val.name === ident);
        if (ans instanceof TextInputAttributeSelection) {
            return ans;
        }
        return undefined;
    }

    replaceAttribute(ident:string, val:TextTypes.AttributeSelection):void {
        const attr = this.getAttribute(ident);
        const idx = this.attributes.indexOf(attr);
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
        const ans = {};
        this.attributes.forEach((attrSel:TextTypes.AttributeSelection) => {
            if (attrSel.hasUserChanges()) {
                ans[attrSel.name] = attrSel.exportSelections(lockedOnesOnly);
            }
        });
        return ans;
    }

    updateItems(attrName:string, items:Array<string>):void {
        const attr = this.getAttribute(attrName);
        let newAttr;
        const idx = this.attributes.indexOf(attr);
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, attr.updateItems(items));
        }
    }

    filter(attrName:string, fn:(v:TextTypes.AttributeValue)=>boolean):void {
        const attr = this.getAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        this.attributes = this.attributes.set(idx, attr.filter(fn));
    }

    mapItems(attrName:string, mapFn:(v:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue):void {
        const attr = this.getAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        const newAttr = attr.mapValues(mapFn);
        this.attributes = this.attributes.set(idx, newAttr);
    }

    setValues(attrName:string, values:Array<string>):void {
        const attr = this.getAttribute(attrName);
        const idx = this.attributes.indexOf(attr);
        const values2:Array<TextTypes.AttributeValue> = values.map((item:string) => {
            return {
                ident: item, // TODO what about bib items?
                value: item,
                selected: false,
                locked: false,
                numGrouped: 1 // TODO is it always OK here?
            };
        });
        if (idx > -1) {
            this.attributes = this.attributes.set(idx, attr.setValues(values2));

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    setAutoComplete(attrName:string, values:Array<TextTypes.AutoCompleteItem>):void {
        const attr = this.getTextInputAttribute(attrName);
        if (attr) {
            let idx = this.attributes.indexOf(attr);
            this.attributes = this.attributes.set(idx, attr.setAutoComplete(values));
        }
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

    setRangeMode(attrName:string, rangeIsOn:boolean) {
        this.rangeSelector.setRangeMode(attrName, rangeIsOn);
    }

    getRangeModes():Immutable.Map<string, boolean> {
        return this.rangeSelector.getRangeModes();
    }

}