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
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />


import * as RSVP from 'vendor/rsvp';
import * as Immutable from 'vendor/immutable';


enum IntervalChar {
    LEFT, BOTH, RIGHT
}


/**
 * This class provides an additional functionality able to provide
 * a more convenient way how to select ordered items - by a range.
 *
 * The current implementation is only able to find matching items
 * from the ones available on the client-side (if a text-input box
 * is present due to large number of items then it can load full list
 * from server). I.e. there is no range selection on the server performed.
 */
export class RangeSelector {

    private pluginApi:Kontext.PluginApi;

    private textTypesStore:TextTypes.ITextTypesStore;

    /**
     * Specifies whether a specific component (given by its respective
     * structure name) is in 'range' mode.
     */
    private modeStatus:Immutable.Map<string, boolean>;

    constructor(pluginApi:Kontext.PluginApi, textTypesStore:TextTypes.ITextTypesStore) {
        this.pluginApi = pluginApi;
        this.textTypesStore = textTypesStore;
        this.modeStatus = Immutable.Map<string, boolean>(textTypesStore.getAttributes().map(
                item => [item.name, item.isInterval ? true : false]));
    }

    /**
     * Decode a string-encoded interval (e.g. 1900±50) into
     * a pair of values specifying an interval (e.g. [1850, 1950])
     */
    private decodeRange(s:string):{lft:number, rgt:number} {
        let center:number;
        let ans:{lft:number; rgt:number};
        let parsed:Array<string>;
        let intervalChars = this.pluginApi.getConf<Array<string>>('ttIntervalChars');
        let defines = (ic) => intervalChars[ic] && s.indexOf(intervalChars[ic]) > -1;


        if (defines(IntervalChar.LEFT)) {
            parsed = s.split(intervalChars[IntervalChar.LEFT]);
            center = parseInt(parsed[0]);
            ans = {
                lft: center - parseInt(parsed[1]),
                rgt: center
            };

        } else if (defines(IntervalChar.BOTH)) {
            parsed = s.split(intervalChars[IntervalChar.BOTH]);
            center = parseInt(parsed[0]);
            ans = {
                lft: center - parseInt(parsed[1]),
                rgt: center + parseInt(parsed[1])
            };

        } else if (defines(IntervalChar.RIGHT)) {
            parsed = s.split(intervalChars[IntervalChar.RIGHT]);
            center = parseInt(parsed[0]);
            ans = {
                lft: center,
                rgt: center + parseInt(parsed[1])
            };

        } else if (/^\d+$/.exec(s)) {
            ans = {
                lft: parseInt(s),
                rgt: parseInt(s)
            };

        } else {
            ans = null;
        }
        return ans;
    }

    private checkRange(attribName:string, fromVal:number, toVal:number, keepCurrent:boolean):number {
        let numChecked = 0;
        this.textTypesStore.mapItems(attribName, (item:TextTypes.AttributeValue) => {
            let newItem = {
                ident: item.ident,
                value: item.value,
                locked: item.locked,
                selected: item.selected,
                numGrouped: item.numGrouped
            };
            let v = parseFloat(item.value);
            if ((v >= fromVal || isNaN(fromVal)) && (v <= toVal || isNaN(toVal))) {
                newItem.selected = true;
                numChecked += 1;

            } else if (!keepCurrent) {
                newItem.selected = false;
            }
            return newItem;
        });
        return numChecked;
    }


    private checkIntervalRange(attribName:string, fromVal:number, toVal:number,
            strictMode:boolean, keepCurrent:boolean):TextTypes.AttributeSelection {

        function isEmpty(v) {
            return isNaN(v) || v === null || v === undefined;
        }

        if (isEmpty(fromVal) && isEmpty(toVal)) {
            throw new Error(this.pluginApi.translate('ucnkLA__at_least_one_required'));
        }

        return this.textTypesStore.mapItems(attribName, (item:TextTypes.AttributeValue) => {
            const newItem = {
                ident: item.ident,
                value: item.value,
                locked: item.locked,
                selected: item.selected,
                numGrouped: item.numGrouped
            };
            const interval = this.decodeRange(item.value);
            if (!interval) {
                return newItem; // silently ignore non-expanded entries

            } else {
                let [lft, rgt] = [interval.lft, interval.rgt];
                if (strictMode) {
                    if ((lft >= fromVal && rgt >= fromVal && lft <= toVal && rgt <= toVal)
                            || (lft <= toVal && rgt <= toVal && isEmpty(fromVal))
                            || (lft >= fromVal && rgt >= fromVal && isEmpty(toVal))) {
                        newItem.selected = true;

                    } else if (!keepCurrent) {
                        newItem.selected = false;
                    }

                } else {
                    if ((lft >= fromVal && lft <= toVal)
                            || (lft >= fromVal && isEmpty(toVal))
                            || (rgt >= fromVal && isNaN(toVal))
                            || (rgt >= fromVal && rgt <= toVal)
                            || (lft <= toVal && isEmpty(fromVal))
                            || (rgt <= toVal && isNaN(fromVal))) {
                        newItem.selected = true;

                    } else if (!keepCurrent) {
                        newItem.selected = false;
                    }
                }
                return newItem;
            }
        });
    }


    private isEmpty(attrName:string):boolean {
        return !this.textTypesStore.getAttribute(attrName).containsFullList();
    }


    /**
     * @param attribArgs Custom attributes overwriting the implicit ones plug-in collects itself
     * @param alignedCorpnames Optional list of aligned corpora
     */
    loadData(attribArgs:{[key:string]:any}, alignedCorpnames?:Array<string>):RSVP.Promise<any> { // TODO type
        let self = this;
        let requestURL:string = this.pluginApi.createActionUrl('filter_attributes');
        let ajaxProm;
        let args = {corpname: this.pluginApi.getConf('corpname')};

        if (alignedCorpnames !== undefined) {
            args['aligned'] = JSON.stringify(alignedCorpnames);
        }

        let attrs = this.textTypesStore.exportSelections(false);
        for (let p in attribArgs) {
            attrs[p] = attribArgs[p];
        }
        args['attrs'] = JSON.stringify(attrs);

        return this.pluginApi.ajax(
            'GET',
            requestURL,
            args,
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private loadAndReplaceRawInput(attribName:string, from:number, to:number):RSVP.Promise<Array<string>> {
        let args:{[key:string]:any} = {};
        args[attribName] = {from: from, to: to};
        return new RSVP.Promise((fullfill:(d)=>void, reject:(err)=>void) => {
            this.loadData(args).then(
                // TODO data type relies on liveattrs specific returned data
                (data:{attr_values:{[key:string]:any}}) => {
                    if (!data['contains_errors']) {
                        this.textTypesStore.setValues(attribName,
                                data.attr_values[attribName].map(item=>item[0]));
                        fullfill(data);

                    } else {
                        reject(data['error'] || '');
                    }
                },
                (err) => {
                    reject(err);
                }
            );
        });
    }

    applyRange(attrName:string, fromVal:number, toVal:number, strictInterval:boolean,
            keepCurrent:boolean):RSVP.Promise<TextTypes.AttributeSelection> {

        if (isNaN(fromVal) && isNaN(toVal)) {
            this.pluginApi.showMessage('warning',
                    this.pluginApi.translate('ucnkLA__at_least_one_required'));

        } else {
            let prom:RSVP.Promise<any>;
            if (this.isEmpty(attrName)) {
                prom = this.loadAndReplaceRawInput(attrName, fromVal, toVal);

            } else {
                prom = new RSVP.Promise((resolve:()=>void, reject:()=>void) => { resolve(); });
            }

            return prom.then(
                () => {
                    const currSelection = this.textTypesStore.getAttribute(attrName);
                    this.checkIntervalRange(attrName, fromVal, toVal, strictInterval, keepCurrent);
                    const ans = this.textTypesStore.getAttribute(attrName);
                    if (currSelection.getNumOfSelectedItems() === ans.getNumOfSelectedItems()) {
                        this.pluginApi.showMessage('warning',
                                this.pluginApi.translate('ucnkLA__nothing_selected'));

                    } else {
                        this.modeStatus = this.modeStatus.set(attrName, false);
                    }
                    return ans;
                },
                (err) => {
                    this.pluginApi.showMessage('error', this.pluginApi.translate('ucnkLA__failed_to_calc_range'));
                }
            );
        }
    }

    setRangeMode(attrName:string, rangeIsOn:boolean) {
        this.modeStatus = this.modeStatus.set(attrName, rangeIsOn);
    }

    getRangeModes():Immutable.Map<string, boolean> {
        return this.modeStatus;
    }
}