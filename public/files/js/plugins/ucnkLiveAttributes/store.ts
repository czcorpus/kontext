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
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />

import {SimplePageStore} from '../../stores/base';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import * as RSVP from 'vendor/rsvp';
import * as textTypesStore from '../../stores/textTypes/attrValues';
import * as Immutable from 'vendor/immutable';


interface ServerBibData {
    error?:string;
    bib_data:Array<Array<string>>;
}

interface ServerRefineResponse {
    error?:string;
    aligned:Array<string>;
    poscount:number;
    attr_values:TextTypes.ServerCheckedValues;
}

export interface SelectionStep {
    num:number;
    attributes:Immutable.List<string>;
    numPosInfo:number;
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
export class LiveAttrsStore extends SimplePageStore implements TextTypes.AttrValueTextInputListener {

    private pluginApi:Kontext.PluginApi;

    private userData:Kontext.UserCredentials;

    private textTypesStore:TextTypes.ITextTypesStore;

    private selectionSteps:Immutable.List<SelectionStep>;

    private alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;

    private initialAlignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;

    private bibliographyAttribute:string;

    private bibliographyIds:Immutable.OrderedSet<string>;

    private updateListeners:Immutable.List<()=>void>;

    private manualAlignCorporaMode:boolean;

    private controlsEnabled:boolean;

    private isBusy:boolean;

    private selectedCorporaProvider:()=>Immutable.List<string>;

    /**
     * Provides an indication of at least one checked item selected
     * wihin Text types form.
     */
    private ttCheckStatusProvider:()=>boolean;

    /**
     * @param dispatcher an action dispatcher instance
     * @param pluginApi KonText plugin-api provider
     * @param textTypesStore
     * @param selectedCorporaProvider a function returning currently selected corpora (including the primary one)
     * @param ttCheckStatusProvider a function returning true if at least one item is checked within text types
     * @param bibAttr an attribute used to identify a bibliographic item (e.g. something like 'doc.id')
     */
    constructor(dispatcher:ActionDispatcher, pluginApi:Kontext.PluginApi,
            textTypesStore:TextTypes.ITextTypesStore, selectedCorporaProvider:()=>Immutable.List<string>,
            ttCheckStatusProvider:()=>boolean, args:PluginInterfaces.ILiveAttrsInitArgs) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.userData = null;
        this.bibliographyAttribute = args.bibAttr;
        this.manualAlignCorporaMode = args.manualAlignCorporaMode;
        this.controlsEnabled = false; // it is enabled when user selects one or more items
        this.textTypesStore = textTypesStore;
        this.isBusy = false;
        this.selectionSteps = Immutable.List<SelectionStep>([]);
        this.alignedCorpora = Immutable.List(args.availableAlignedCorpora
                        .map((item) => {
                            return {
                                value: item.n,
                                label: item.label,
                                selected: false,
                                locked: selectedCorporaProvider ? true : false // TODO ??? item.locked
                            };
                        }));
        this.bibliographyIds = Immutable.OrderedSet<string>();
        this.initialAlignedCorpora = this.alignedCorpora;
        this.updateListeners = Immutable.List<()=>void>();
        this.selectedCorporaProvider = selectedCorporaProvider;
        this.ttCheckStatusProvider = ttCheckStatusProvider;
        textTypesStore.setTextInputPlaceholder(this.getTextInputPlaceholder());
        // initial enabled/disabled state:
        this.setControlsEnabled(args.refineEnabled);

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'LIVE_ATTRIBUTES_REFINE_CLICKED':
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.processRefine().then(
                        (v) => {
                            this.updateListeners.forEach(item => item());
                            this.textTypesStore.snapshotState();
                            this.textTypesStore.notifyChangeListeners();
                            this.isBusy = false;
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.notifyChangeListeners();
                            this.pluginApi.showMessage('error', err);
                        }
                    );
                break;
                case 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED':
                    const item = this.alignedCorpora.get(payload.props['idx']);
                    if (item) {
                        const idx = this.alignedCorpora.indexOf(item);
                        const newItem:TextTypes.AlignedLanguageItem = {
                            value: item.value,
                            label: item.label,
                            locked: item.locked,
                            selected: !item.selected
                        };
                        this.alignedCorpora = this.alignedCorpora.set(idx, newItem);
                    }
                    this.setControlsEnabled(this.ttCheckStatusProvider() || this.hasSelectedLanguages());
                    this.updateListeners.forEach(fn => fn());
                    this.notifyChangeListeners();
                break;
                case 'LIVE_ATTRIBUTES_RESET_CLICKED':
                    if (window.confirm(this.pluginApi.translate('ucnkLA__are_you_sure_to_reset'))) {
                        this.reset();
                        this.textTypesStore.notifyChangeListeners();
                    }
                    this.notifyChangeListeners();
                break;
                case 'LIVE_ATTRIBUTES_UNDO_CLICKED':
                    /*
                     * Please note that textTypesStore and selection steps are
                     * coupled only loosely (the two lists must match for all
                     * items). Once some other function starts to call snapshotState()
                     * on TextTypesStore, the UNDO function here gets broken.
                     */
                    this.textTypesStore.undoState();
                    this.textTypesStore.notifyChangeListeners();
                    this.selectionSteps = this.selectionSteps.pop();
                    this.notifyChangeListeners();
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
            this.bibliographyIds = this.bibliographyIds.union(Immutable.OrderedSet<string>(newBibData.map(v => v.ident)));
        }
        this.textTypesStore.setExtendedInfoSupport(
            this.bibliographyAttribute,
            (ident:string) => {
                if (this.bibliographyIds.contains(ident)) {
                    return this.loadBibInfo(ident).then(
                        (serverData:ServerBibData) => {
                            this.textTypesStore.setExtendedInfo(this.bibliographyAttribute,
                                    ident, Immutable.OrderedMap<string, any>(serverData.bib_data));

                        }
                    ).catch(
                        (err:any) => {
                            this.pluginApi.showMessage('error', err);
                        }
                    );

                } else {
                    return new RSVP.Promise<any>((resolve:()=>void, reject:(err)=>void) => {
                        reject(new Error('Item not found'));
                    })
                }
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
        const selections = this.textTypesStore.exportSelections(false);
        return this.loadFilteredData(selections).then(
            (data:ServerRefineResponse) => {
                const filterData = this.importFilter(data.attr_values);
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
                    let newVal:TextTypes.AlignedLanguageItem = {
                        label: value.label,
                        value: value.value,
                        locked: value.selected ? true : false,
                        selected: value.selected
                    }
                    return newVal;
                }).filter(item=>item.locked).toList();
                this.updateSelectionSteps(selections, data);
                if (isArr(filterData[this.bibliographyAttribute])) {
                    this.attachBibData(filterData);
                }
            },
            (err) => {
                this.pluginApi.showMessage('error', err);
            }
        );
    }

    reset():void {
        this.textTypesStore.reset();
        this.selectionSteps = this.selectionSteps.clear();
        this.alignedCorpora = this.initialAlignedCorpora;
        this.bibliographyIds = this.bibliographyIds.clear();
        if (this.selectedCorporaProvider) {
            this.selectLanguages(this.selectedCorporaProvider().rest().toList(), false);
        }
        this.updateListeners.forEach(item => item());
    }

    hasSelectionSteps():boolean {
        return this.selectionSteps.size > 0;
    }

    private updateSelectionSteps(selections:TextTypes.ServerCheckedValues, data:ServerRefineResponse):void {
        const newAttrs = this.getUnusedAttributes(selections);
        const selectedAligned = this.alignedCorpora.filter(item=>item.selected);

        if (this.selectionSteps.size === 0 && selectedAligned.size > 0) {
            const mainLang = this.pluginApi.getConf<string>('corpname');
            const newStep:AlignedLangSelectionStep = {
                num: 1,
                numPosInfo: newAttrs.length > 0 ? 0 : data.poscount,
                attributes : Immutable.List([]),
                languages : this.alignedCorpora
                                    .splice(0, 0, {
                                        value: mainLang,
                                        label: mainLang,
                                        selected: true,
                                        locked: true
                                    })
                                    .filter((item)=>item.selected)
                                    .map((item)=>item.value).toArray()
            };
            this.selectionSteps = this.selectionSteps.push(newStep);
        }
        if (this.selectionSteps.size > 0 && newAttrs.length > 0 || selectedAligned.size == 0) {
            const newStep:TTSelectionStep = {
                num: this.selectionSteps.size + 1,
                numPosInfo: data.poscount,
                attributes: Immutable.List(newAttrs),
                values: Immutable.Map<string, Array<string>>(newAttrs.map((item) => {
                    return [item, selections[item]];
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

    getAlignedCorpora():Immutable.List<TextTypes.AlignedLanguageItem> {
        if (this.manualAlignCorporaMode) {
            return this.alignedCorpora;

        } else {
            return this.alignedCorpora.filter(v => v.selected).toList();
        }
    }

    hasAvailableAlignedCorpora():boolean {
        return this.alignedCorpora.size > 0;
    }

    /**
     * Return already selected attributes which are not
     * yet present here in selectionSteps. These are
     * expected to compose the latest selection step.
     */
    getUnusedAttributes(selections:TextTypes.ServerCheckedValues):Array<string> {
        const used = this.getUsedAttributes();
        return Object.keys(selections).filter(v => used.indexOf(v) === -1);
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
            }
        );
    }

    private loadFilteredData(selections:TextTypes.ServerCheckedValues):RSVP.Promise<any> {
        let aligned = this.alignedCorpora.filter((item)=>item.selected).map((item)=>item.value).toArray();
        return this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('filter_attributes'),
            {
                corpname: this.pluginApi.getConf<string>('corpname'),
                attrs: JSON.stringify(selections),
                aligned: JSON.stringify(aligned)
            }
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
            }
        );
    }

    getAutoCompleteTrigger():(attrName:string, value:string)=>RSVP.Promise<any> {
        return (attrName:string, value:string) => {
            if (value.length > 2) {
                let prom = this.loadAutocompleteHint(
                    value, attrName, this.textTypesStore.exportSelections(true));
                return prom.then(
                    (v:ServerRefineResponse) => {
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

    isManualAlignCorporaMode():boolean {
        return this.manualAlignCorporaMode;
    }

    canUndoRefine():boolean {
        return this.textTypesStore.canUndoState();
    }

    getIsBusy():boolean {
        return this.isBusy;
    }
}