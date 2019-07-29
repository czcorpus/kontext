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

import {Kontext, TextTypes} from '../../types/common';
import {StatefulModel} from '../../models/base';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {ActionDispatcher, Action} from '../../app/dispatcher';
import RSVP from 'rsvp';
import * as Immutable from 'immutable';
import { SelectedTextTypes } from '../../models/textTypes/main';


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
export class LiveAttrsModel extends StatefulModel implements TextTypes.AttrValueTextInputListener {

    private pluginApi:IPluginApi;

    private textTypesModel:TextTypes.ITextTypesModel;

    private selectionSteps:Immutable.List<SelectionStep>;

    private alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;

    private initialAlignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;

    private bibliographyAttribute:string;

    private bibliographyIds:Immutable.OrderedSet<string>;

    private updateListeners:Immutable.List<()=>void>;

    private manualAlignCorporaMode:boolean;

    private controlsEnabled:boolean;

    private isBusy:boolean;

    private isTTListMinimized:boolean;

    private readonly isEnabled:boolean;

    private selectedCorporaProvider:()=>Immutable.List<string>;

    /**
     * Provides an indication of at least one checked item selected
     * wihin Text types form.
     */
    private ttCheckStatusProvider:()=>boolean;

    /**
     * @param dispatcher an action dispatcher instance
     * @param pluginApi KonText plugin-api provider
     * @param textTypesModel
     * @param selectedCorporaProvider a function returning currently selected corpora (including the primary one)
     * @param ttCheckStatusProvider a function returning true if at least one item is checked within text types
     * @param bibAttr an attribute used to identify a bibliographic item (e.g. something like 'doc.id')
     */
    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi,
            textTypesModel:TextTypes.ITextTypesModel,
            isEnabled:boolean,
            selectedCorporaProvider:()=>Immutable.List<string>,
            ttCheckStatusProvider:()=>boolean,
            args:PluginInterfaces.LiveAttributes.InitArgs) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.bibliographyAttribute = args.bibAttr;
        this.manualAlignCorporaMode = args.manualAlignCorporaMode;
        this.controlsEnabled = false; // it is enabled when user selects one or more items
        this.textTypesModel = textTypesModel;
        this.isEnabled = isEnabled;
        this.isBusy = false;
        this.isTTListMinimized = false;
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
        textTypesModel.setTextInputPlaceholder(this.getTextInputPlaceholder());
        // initial enabled/disabled state:
        this.setControlsEnabled(args.refineEnabled);

        this.dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'LIVE_ATTRIBUTES_REFINE_CLICKED':
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.processRefine().then(
                        (v) => {
                            this.updateListeners.forEach(item => item());
                            this.textTypesModel.snapshotState();
                            this.textTypesModel.notifyChangeListeners();
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
                case 'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED': {
                    const item = this.alignedCorpora.get(action.props['idx']);
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
                }
                break;
                case 'LIVE_ATTRIBUTES_RESET_CLICKED':
                    if (window.confirm(this.pluginApi.translate('ucnkLA__are_you_sure_to_reset'))) {
                        this.reset();
                        this.textTypesModel.notifyChangeListeners();
                    }
                    this.notifyChangeListeners();
                break;
                case 'LIVE_ATTRIBUTES_UNDO_CLICKED':
                    /*
                     * Please note that textTypesModel and selection steps are
                     * coupled only loosely (the two lists must match for all
                     * items). Once some other function starts to call snapshotState()
                     * on TextTypesModel, the UNDO function here gets broken.
                     */
                    this.textTypesModel.undoState();
                    this.textTypesModel.notifyChangeListeners();
                    this.selectionSteps = this.selectionSteps.pop();
                    this.notifyChangeListeners();
                break;
                case 'TT_MINIMIZE_ALL':
                    this.isTTListMinimized = true;
                    this.notifyChangeListeners();
                break;
                case 'TT_MAXIMIZE_ALL':
                    this.isTTListMinimized = false;
                    this.notifyChangeListeners();
                break;
                case 'LIVE_ATTRIBUTES_TOGGLE_MINIMIZE_ALIGNED_LANG_LIST':
                    this.isTTListMinimized = !this.isTTListMinimized;
                    this.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_ADD_ALIGNED_CORPUS_DONE':
                    this.reset();
                    this.updateAlignedItem(action.props['corpname'], orig => ({
                        value: orig.value,
                        label: orig.label,
                        locked: true,
                        selected: true}));
                    this.textTypesModel.notifyChangeListeners();
                    this.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS_DONE':
                    this.reset();
                    this.updateAlignedItem(action.props['corpname'], orig => ({
                        value: orig.value,
                        label: orig.label,
                        locked: false,
                        selected: false}));
                    this.textTypesModel.notifyChangeListeners();
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private updateAlignedItem(corpname:string,
                upd:(orig:TextTypes.AlignedLanguageItem)=>TextTypes.AlignedLanguageItem):boolean {
        const srchIdx = this.alignedCorpora.findIndex(v => v.value === corpname);
        if (srchIdx > -1) {
            const item = this.alignedCorpora.get(srchIdx);
            this.alignedCorpora = this.alignedCorpora.set(srchIdx, upd(item));
            return true;
        }
        return false;
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
        const attrObj = this.textTypesModel.getAttribute(this.bibliographyAttribute);
        const newBibData = filterData[this.bibliographyAttribute];

        // set the data iff server data are full-fledget (i.e. including unique 'ident')
        if (newBibData.length > 0 && !!newBibData[0].ident) {
            this.bibliographyIds = this.bibliographyIds.union(Immutable.OrderedSet<string>(newBibData.map(v => v.ident)));
        }
        this.textTypesModel.setExtendedInfoSupport(
            this.bibliographyAttribute,
            (ident:string) => {
                if (this.bibliographyIds.contains(ident)) {
                    return this.loadBibInfo(ident).then(
                        (serverData:ServerBibData) => {
                            this.textTypesModel.setExtendedInfo(this.bibliographyAttribute,
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
        this.textTypesModel.getAttributesWithSelectedItems(false).forEach((attrName:string) => {
            this.textTypesModel.mapItems(attrName, (item:TextTypes.AttributeValue) => {
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
        const selections = this.textTypesModel.exportSelections(false);
        return this.loadFilteredData(selections).then(
            (data:ServerRefineResponse) => {
                const filterData = this.importFilter(data.attr_values);
                let k; // mut be defined here (ES5 cannot handle for(let k...) here)
                for (k in filterData) {
                    this.textTypesModel.updateItems(k, filterData[k].map(v => v.ident));
                    this.textTypesModel.mapItems(k, (v, i) => {
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
                    this.textTypesModel.filter(k, (item) => item !== null);
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
        this.textTypesModel.reset();
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
            const mainLang = this.pluginApi.getCorpusIdent().id;
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
     * Note: be careful when wiring-up this model with TextTypes model
     * as they listen to each other for different actions which is
     * a possible source of a infinite callback loop.
     */
    addUpdateListener(fn:()=>void):void { // TODO implement this via StatelessModel and side-effects
        this.updateListeners = this.updateListeners.push(fn);
    }

    removeUpdateListener(fn:()=>void):void { // TODO (see above)
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
                    this.textTypesModel.setAttrSummary(k, null);

                } else if (typeof data[k] === 'object' && 'length' in data[k]) {
                    this.textTypesModel.setAttrSummary(k, {
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
                corpname: this.pluginApi.getCorpusIdent().id,
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
                corpname: this.pluginApi.getCorpusIdent().id,
                attrs: JSON.stringify(selections),
                aligned: JSON.stringify(aligned)
            }
        );
    }

    private loadAutocompleteHint(pattern:string, patternAttr:string, selections:SelectedTextTypes):RSVP.Promise<any> {
        const aligned = this.alignedCorpora.filter((item)=>item.selected).map((item)=>item.value).toArray();
        return this.pluginApi.ajax(
            'POST',
            this.pluginApi.createActionUrl('attr_val_autocomplete'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
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
                    value, attrName, this.textTypesModel.exportSelections(true));
                return prom.then(
                    (v:ServerRefineResponse) => {
                        let filterData = this.importFilter(v.attr_values);
                        if (isArr(filterData[this.bibliographyAttribute])) {
                            this.attachBibData(filterData);
                        }
                        this.textTypesModel.setAutoComplete(
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
        if (this.isEnabled) {
            return this.pluginApi.translate('ucnkLA__start_writing_for_suggestions');
        }
        return this.pluginApi.translate('ucnkLA__too_many_values_placeholder');
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
        return this.textTypesModel.canUndoState();
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getIsTTListMinimized():boolean {
        return this.isTTListMinimized;
    }
}