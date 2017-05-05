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
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />

import {SimplePageStore} from '../../stores/base';
import * as RSVP from 'vendor/rsvp';
import * as textTypesStore from '../../stores/textTypes/attrValues';
import * as Immutable from 'vendor/immutable';


interface ServerBibData {
    contains_errors:boolean;
    error?:string;
    bib_data:Array<Array<string>>;
}

interface ServerRefineResponse {
    contains_errors:boolean;
    error?:string;
    aligned:Array<string>;
    poscount:string; // formatted number of positions
    attr_values:{[ident:string]:Array<string>}
}


export interface SelectionStep {
    num:number;
    attributes:Immutable.List<string>;
    numPosInfo:string;
}

export interface TTSelectionStep extends SelectionStep {
    values:Immutable.Map<string, Array<string>>;
}

export interface AlignedLangSelectionStep extends SelectionStep {
    languages:Array<string>;
}


interface FilterResponseValue {

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

function isArr(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
}

/**
 * Note: the update procedure expects values within attribute blocks
 * to keep the order (including initial data):
 *
 * attr1: v1#1, v1#2, v1#3
 * attr2: v2#1, v2#2, v2#3
 * attr3: v3#1, v3#2, v3#3
 *
 * --- filter response from server -->
 *
 * attr1: v1#1, v1#3 [OK]
 * attr2: v2#3 [OK]
 * attr3: v3#1 v3#2 [WRONG]
 */
export class LiveAttrsStore extends SimplePageStore implements LiveAttributesInit.AttrValueTextInputListener {

    private pluginApi:Kontext.PluginApi;

    private userData:Kontext.UserCredentials;

    private textTypesStore:TextTypes.ITextTypesStore;

    private selectionSteps:Immutable.List<SelectionStep>;

    private alignedCorpora:Immutable.List<LiveAttributesInit.AlignedLanguageItem>;

    private initialAlignedCorpora:Immutable.List<LiveAttributesInit.AlignedLanguageItem>;

    private bibliographyAttribute:string;

    private bibliographyIds:Immutable.List<string>;

    private updateListeners:Immutable.List<()=>void>;

    private manualAlignCorporaMode:boolean;

    private controlsEnabled:boolean;

    private selectedCorporaProvider:()=>Immutable.List<string>;

    /**
     * Provides an indication of at least one checked item selected
     * wihin Text types form.
     */
    private ttCheckStatusProvider:()=>boolean;

    /**
     * @param dispatcher a Flux dispatcher instance
     * @param pluginApi KonText plugin-api provider
     * @param textTypesStore
     * @param selectedCorporaProvider a function returning currently selected corpora (including the primary one)
     * @param ttCheckStatusProvider a function returning true if at least one item is checked within text types
     * @param bibAttr an attribute used to identify a bibliographic item (e.g. something like 'doc.id')
     */
    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi,
            textTypesStore:TextTypes.ITextTypesStore, selectedCorporaProvider:()=>Immutable.List<string>,
            ttCheckStatusProvider:()=>boolean, bibAttr:string) {
        super(dispatcher);
        let self = this;
        this.pluginApi = pluginApi;
        this.userData = null;
        this.bibliographyAttribute = bibAttr;
        this.controlsEnabled = false; // it is enabled when user selects one or more items (via )
        this.textTypesStore = textTypesStore;
        this.selectionSteps = Immutable.List<SelectionStep>([]);
        this.alignedCorpora = Immutable.List(this.pluginApi.getConf<Array<any>>('availableAlignedCorpora')
                        .map((item) => {
                            return {
                                value: item.n,
                                label: item.label,
                                selected: false,
                                locked: selectedCorporaProvider ? true : item.locked
                            };
                        }));
        this.bibliographyIds = Immutable.List<string>();
        this.initialAlignedCorpora = this.alignedCorpora;
        this.updateListeners = Immutable.List<()=>void>();
        this.selectedCorporaProvider = selectedCorporaProvider;
        this.ttCheckStatusProvider = ttCheckStatusProvider;
        textTypesStore.setTextInputPlaceholder(this.getTextInputPlaceholder());
        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'LIVE_ATTRIBUTES_REFINE_CLICKED':
                    self.processRefine().then(
                        (v) => {
                            self.updateListeners.forEach(item => item());
                            self.textTypesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            console.error(err);
                            self.pluginApi.showMessage('error', err);
                        }
                    );
                break;
                case 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED':
                    let item = self.alignedCorpora.get(payload.props['idx']);
                    if (item) {
                        let idx = self.alignedCorpora.indexOf(item);
                        let newItem:LiveAttributesInit.AlignedLanguageItem = {
                            value: item.value,
                            label: item.label,
                            locked: item.locked,
                            selected: !item.selected
                        };
                        self.alignedCorpora = self.alignedCorpora.set(idx, newItem);
                    }
                    self.setControlsEnabled(self.ttCheckStatusProvider() || self.hasSelectedLanguages());
                    self.updateListeners.forEach(fn => fn());
                    self.notifyChangeListeners();
                break;
                case 'LIVE_ATTRIBUTES_RESET_CLICKED':
                    self.textTypesStore.reset();
                    self.reset();
                    if (self.selectedCorporaProvider) {
                        self.selectLanguages(self.selectedCorporaProvider().rest().toList(), false);
                    }
                    self.updateListeners.forEach(item => item());
                    self.textTypesStore.notifyChangeListeners('VALUES_RESET');
                    self.notifyChangeListeners();
                break;
            }
        });
    }

    selectLanguages(languages:Immutable.List<string>, notifyListeners:boolean) {
        this.alignedCorpora = this.alignedCorpora.map(item => {
            return {
                value: item.value,
                label: item.label,
                selected: languages.indexOf(item.value) > -1,
                locked: true
            };
        }).toList();
        if (notifyListeners) {
            this.setControlsEnabled(this.ttCheckStatusProvider() || this.hasSelectedLanguages());
            this.notifyChangeListeners();
        }
    }

    private attachBibData(filterData:{[k:string]:Array<FilterResponseValue>}) {
        const attrObj = this.textTypesStore.getAttribute(this.bibliographyAttribute);
        const newBibData = filterData[this.bibliographyAttribute];

        // set the data iff server data are full-fledget (i.e. including unique 'ident')
        if (newBibData.length > 0 && !!newBibData[0].ident) {
            this.bibliographyIds = Immutable.List<string>(newBibData.map(v => v.ident));
        }
        this.textTypesStore.setExtendedInfoSupport(
            this.bibliographyAttribute,
            (idx:number) => {
                return this.loadBibInfo(this.bibliographyIds.get(idx)).then(
                    (serverData:ServerBibData) => {
                        if (!serverData.contains_errors) {
                            this.textTypesStore.setExtendedInfo(this.bibliographyAttribute,
                                    idx, Immutable.OrderedMap<string, any>(serverData.bib_data));

                        } else {
                            throw new Error(serverData.error);
                        }
                    },
                    (err:any) => {
                        this.pluginApi.showMessage('error', err);
                    }
                );
            }
        );
    }

    private processRefine():RSVP.Promise<any> {
        this.textTypesStore.getAttributesWithSelectedItems(false).forEach((attrName:string) => {
            this.textTypesStore.mapItems(attrName, (item:TextTypes.AttributeValue) => {
                return {
                    ident: item.ident,
                    value: item.value,
                    selected: item.selected,
                    locked: true,
                    availItems: item.availItems,
                    numGrouped: item.numGrouped,
                    extendedInfo: item.extendedInfo
                }
            });
        });
        let prom = this.loadFilteredData(this.textTypesStore.exportSelections(false));
        return prom.then(
            (data:ServerRefineResponse) => {
                if (!data.contains_errors) {
                    let filterData = this.importFilter(data.attr_values);
                    let k; // mut be defined here (ES5 cannot handle for(let k...) here)
                    for (k in filterData) {
                        this.textTypesStore.updateItems(k, filterData[k].map(v => v.ident));
                        this.textTypesStore.mapItems(k, (v, i) => {
                            if (filterData[k][i]) {
                                return {
                                    ident: filterData[k][i].ident,
                                    value: filterData[k][i].v,
                                    selected: v.selected,
                                    locked: v.locked,
                                    numGrouped: filterData[k][i].numGrouped,
                                    availItems: filterData[k][i].availItems,
                                    extendedInfo: v.extendedInfo
                                };

                            } else {
                                return null;
                            }
                        });
                        this.textTypesStore.filter(k, (item) => item !== null);
                    }
                    this.alignedCorpora = this.alignedCorpora.map((value) => {
                        let newVal:LiveAttributesInit.AlignedLanguageItem = {
                            label: value.label,
                            value: value.value,
                            locked: value.selected ? true : false,
                            selected: value.selected
                        }
                        return newVal;
                    }).filter(item=>item.locked).toList();
                    this.updateSelectionSteps(data);
                    if (isArr(filterData[this.bibliographyAttribute])) {
                        this.attachBibData(filterData);
                    }

                } else {
                    throw new Error(data.error);
                }
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    private reset():void {
        this.selectionSteps = this.selectionSteps.clear();
        this.alignedCorpora = this.initialAlignedCorpora;
        this.bibliographyIds = this.bibliographyIds.clear();
    }

    private updateSelectionSteps(data:any):void {
        const newAttrs = this.getUnusedAttributes();
        const selectedAligned = this.alignedCorpora.filter(item=>item.selected);

        if (this.selectionSteps.size === 0 && selectedAligned.size > 0) {
            const mainLang = this.pluginApi.getConf<string>('corpname');
            const newStep:AlignedLangSelectionStep = {
                num: 1,
                numPosInfo: newAttrs.length > 0 ? null : data['poscount'],
                attributes : Immutable.List([]),
                languages : this.alignedCorpora
                                    .splice(0, 0, {
                                        value: mainLang,
                                        label: mainLang,
                                        selected: true,
                                        locked: true
                                    })
                                    .filter((item)=>item.selected).map((item)=>item.value).toArray()
            }
            this.selectionSteps = this.selectionSteps.push(newStep);
        }
        if (this.selectionSteps.size > 0 && newAttrs.length > 0 || selectedAligned.size == 0) {
            const newStep:TTSelectionStep = {
                num: this.selectionSteps.size + 1,
                numPosInfo: data['poscount'],
                attributes: Immutable.List(newAttrs),
                values: Immutable.Map<string, Array<string>>(newAttrs.map((item) => {
                    return [item, this.textTypesStore.getAttribute(item).exportSelections(false)];
                }))
            };
            this.selectionSteps = this.selectionSteps.push(newStep);
        }
    }

    /**
     * Note: be careful when wiring-up this store with TextTypes store
     * as they listen to each other for different actions which is
     * a possible source of a infinite callback loop.
     */
    addUpdateListener(fn:()=>void):void {
        this.updateListeners = this.updateListeners.push(fn);
    }

    removeUpdateListener(fn:()=>void):void {
        const idx = this.updateListeners.indexOf(fn);
        if (idx > -1) {
            this.updateListeners = this.updateListeners.remove(idx);
        }
    }

    getAlignedCorpora():Immutable.List<LiveAttributesInit.AlignedLanguageItem> {
        return this.alignedCorpora;
    }

    getUnusedAttributes():Array<string> {
        const used = this.getUsedAttributes();
        return this.textTypesStore.getAttributesWithSelectedItems(true).filter((item) => {
            return used.indexOf(item) === -1;
        });
    }

    getUsedAttributes():Array<string> {
        return this.selectionSteps.reduce((red:Immutable.List<any>, val:SelectionStep) => {
            return red.concat(val.attributes);
        }, Immutable.List([])).toArray();
    }

    getSelectionSteps():Array<SelectionStep> {
        return this.selectionSteps.toArray();
    }

    hasSelectedLanguages():boolean {
        return this.alignedCorpora.find((item)=>item.selected) !== undefined;
    }

    hasLockedAlignedLanguages():boolean {
        return this.hasSelectedLanguages() && this.selectionSteps.size > 0;
    }

    private importFilter(data:{[ident:string]:Array<any>}):{[k:string]:Array<FilterResponseValue>} {
        let ans:{[k:string]:Array<FilterResponseValue>} = {};
        for (let k in data) {
            if (k.indexOf('.') > 0) { // is the key an attribute? (there are other values there too)
                if (isArr(data[k])) {
                    ans[k] = data[k].map((v) => {
                        return {
                            ident: v[1],
                            v: v[2], // [0] contains shortened version - cannot use here
                            lock: false,
                            availItems: v[4],
                            numGrouped: parseInt(v[3])
                        };
                    });
                    this.textTypesStore.setAttrSummary(k, null);

                } else if (typeof data[k] === 'object' && 'length' in data[k]) {
                    this.textTypesStore.setAttrSummary(k, {
                        text: this.pluginApi.translate('query__tt_{num}_items',
                                {num: data[k]['length']}),
                        help: this.pluginApi.translate('ucnkLA__bib_list_warning')
                    });
                }
            }
        }
        return ans;
    }

    private loadBibInfo(bibId:string):RSVP.Promise<any> {
        return this.pluginApi.ajax(
            'GET',
            this.pluginApi.createActionUrl('corpora/bibliography'),
            {
                corpname: this.pluginApi.getConf<string>('corpname'),
                id: bibId
            },
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private loadFilteredData(selections:any):RSVP.Promise<any> {
        let aligned = this.alignedCorpora.filter((item)=>item.selected).map((item)=>item.value).toArray();
        return this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('filter_attributes'),
            {
                corpname: this.pluginApi.getConf<string>('corpname'),
                attrs: JSON.stringify(selections),
                aligned: JSON.stringify(aligned)
            },
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private loadAutocompleteHint(pattern:string, patternAttr:string, selections:any):RSVP.Promise<any> {
        let aligned = this.alignedCorpora.filter((item)=>item.selected).map((item)=>item.value).toArray();
        return this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('attr_val_autocomplete'),
            {
                corpname: this.pluginApi.getConf<string>('corpname'),
                pattern: pattern,
                patternAttr: patternAttr,
                attrs: JSON.stringify(selections),
                aligned: JSON.stringify(aligned)
            },
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    getListenerCallback():(attrName:string, value:string)=>RSVP.Promise<any> {
        return (attrName:string, value:string) => {
            if (value.length > 2) {
                let prom = this.loadAutocompleteHint(
                    value, attrName, this.textTypesStore.exportSelections(true));
                return prom.then(
                    (v:ServerRefineResponse) => {
                        if (!v.contains_errors) {
                            let filterData = this.importFilter(v.attr_values);
                            if (isArr(filterData[this.bibliographyAttribute])) {
                                this.attachBibData(filterData);
                            }
                            this.textTypesStore.setAutoComplete(
                                attrName,
                                v.attr_values[attrName].map((v) => {
                                        return {ident: v[1], label: v[2]};
                                })
                            );

                        } else {
                            throw new Error(v.error);
                        }
                    },
                    (err) => {
                        console.error(err);
                        this.pluginApi.showMessage('error', err);
                    }
                );

            } else {
                return new RSVP.Promise<any>((resolve:(v: any)=>void, reject:(e:any)=>void) => {
                    resolve(null);
                });
            }
        }
    }

    getTextInputPlaceholder():string {
        return this.pluginApi.translate('ucnkLA__start_writing_for_suggestions');
    }

    getControlsEnabled():boolean {
        return this.controlsEnabled;
    }

    setControlsEnabled(v:boolean):void {
        this.controlsEnabled = v;
    }
}