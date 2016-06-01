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

/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/common.d.ts" />


import RSVP = require('vendor/rsvp');


enum IntervalChar {
    LEFT, BOTH, RIGHT
}


/**
 *
 */
export class RangeSelector {

    private pluginApi:Kontext.PluginApi;

    private textTypesStore:TextTypes.ITextTypesStore;

    constructor(pluginApi:Kontext.PluginApi, textTypesStore:TextTypes.ITextTypesStore) {
        this.pluginApi = pluginApi;
        this.textTypesStore = textTypesStore;
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
        this.textTypesStore.updateItems(attribName, (item:TextTypes.AttributeValue) => {
            let newItem = {
                value: item.value,
                locked: item.locked,
                selected: item.selected
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
            strictMode:boolean, keepCurrent:boolean):number {
        let numChecked = 0;

        function isEmpty(v) {
            return isNaN(v) || v === null || v === undefined;
        }

        if (isEmpty(fromVal) && isEmpty(toVal)) {
            throw new Error(this.pluginApi.translate('ucnkLA__at_least_one_required'));
        }

        this.textTypesStore.updateItems(attribName, (item:TextTypes.AttributeValue) => {
            let newItem = {
                value: item.value,
                locked: item.locked,
                selected: item.selected
            };
            let interval = this.decodeRange(item.value);
            if (!interval) {
                return newItem; // silently ignore unknown entries

            } else {
                let [lft, rgt] = [interval.lft, interval.rgt];
                if (strictMode) {
                    if ((lft >= fromVal && rgt >= fromVal && lft <= toVal && rgt <= toVal)
                            || (lft <= toVal && rgt <= toVal && isEmpty(fromVal))
                            || (lft >= fromVal && rgt >= fromVal && isEmpty(toVal))) {
                        newItem.selected = true;
                        numChecked += 1;

                    } else if (!keepCurrent) {
                        newItem.selected = false;
                    }

                } else {
                    if ((lft >= fromVal && lft <= toVal) || (lft >= fromVal && isEmpty(toVal)) || (rgt >= fromVal && isNaN(toVal))
                            || (rgt >= fromVal && rgt <= toVal) || (lft <= toVal && isEmpty(fromVal)) || (rgt <= toVal && isNaN(fromVal))) {
                        newItem.selected = true;
                        numChecked += 1;

                    } else if (!keepCurrent) {
                        newItem.selected = true;
                    }
                }
                return newItem;
            }
        });

        return numChecked;
    }


    private isEmpty(attrName:string):boolean {
        return !this.textTypesStore.getAttribute(attrName).containsFullList();
    }


    /**
     * @param attribArgs Custom attributes overwriting the implicit ones plug-in collects itself
     * @param ajaxAnimation An animation object notyfying that the operation is in progress
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
                (data:{[key:string]:any}) => {
                    if (!data['contains_errors']) {
                        this.textTypesStore.setValues(attribName,
                            data[attribName].map(item=>item[0]));
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
            keepCurrent:boolean):RSVP.Promise<number> {
        let numChecked;

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
                    numChecked = this.checkIntervalRange(attrName, fromVal, toVal, strictInterval, keepCurrent);
                    if (numChecked === 0) {
                        this.pluginApi.showMessage('warning',
                                this.pluginApi.translate('ucnkLA__nothing_selected'));
                    }
                    return numChecked;
                },
                (err) => {
                    this.pluginApi.showMessage('error', this.pluginApi.translate('ucnkLA__failed_to_calc_range'));
                }
            );
        }
    }
}