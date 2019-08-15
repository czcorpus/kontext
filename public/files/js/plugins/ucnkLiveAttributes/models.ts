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

import {TextTypes, Kontext} from '../../types/common';
import {IPluginApi} from '../../types/plugins';
import RSVP from 'rsvp';
import * as Immutable from 'immutable';
import { SelectedTextTypes, SelectionFilterMap } from '../../models/textTypes/main';
import { IActionDispatcher, Action, StatelessModel, SEDispatcher } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { map } from 'rxjs/operators';


interface ServerBibData {
    error?:string;
    bib_data:Array<Array<string>>;
}

interface ServerRefineResponse extends Kontext.AjaxResponse {
    error?:string;
    aligned:Array<string>;
    poscount:number;
    attr_values:{
        [key:string]:{poscount:number}|Array<[string, string, string, number, number]>
    };
}

export interface TTSelectionStep {
    num:number;
    attributes:Immutable.List<string>;
    numPosInfo:number;
    values:Immutable.Map<string, Array<string>>;
}

export interface AlignedLangSelectionStep {
    num:number;
    attributes:Immutable.List<string>;
    numPosInfo:number;
    languages:Array<string>;
}

export function isAlignedSelectionStep(v:TTSelectionStep|AlignedLangSelectionStep):v is AlignedLangSelectionStep {
    return Array.isArray(v['languages']);
}

export interface LiveAttrsModelState {
    selectionSteps:Immutable.List<TTSelectionStep|AlignedLangSelectionStep>;
    lastRemovedStep:TTSelectionStep|AlignedLangSelectionStep|null;
    alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
    initialAlignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
    bibliographyAttribute:string;
    bibliographyIds:Immutable.OrderedSet<string>;
    manualAlignCorporaMode:boolean;
    controlsEnabled:boolean;
    isBusy:boolean;
    isTTListMinimized:boolean;
    isEnabled:boolean;
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
export class LiveAttrsModel extends StatelessModel<LiveAttrsModelState> {

    private readonly pluginApi:IPluginApi;

    private readonly controlsAlignedCorpora:boolean;

    private readonly getTtSelection:(lockedOnesOnly:boolean)=>TextTypes.ServerCheckedValues;

    /**
     */
    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, initialState:LiveAttrsModelState,
            controlsAlignedCorpora:boolean,
            getTtSelection:(lockedOnesOnly:boolean)=>{[attr:string]:Array<string>}) {
        super(dispatcher,initialState);
        this.pluginApi = pluginApi;
        this.controlsAlignedCorpora = controlsAlignedCorpora;
        this.getTtSelection = getTtSelection;
        this.actionMatch = {
            'LIVE_ATTRIBUTES_REFINE_CLICKED': (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            },
            'LIVE_ATTRIBUTES_REFINE_DONE': (state, action) => {
                const poscount:number = action.payload['poscount'];
                const filterData:SelectionFilterMap = action.payload['filterData'];
                const selectedTypes:TextTypes.ServerCheckedValues = action.payload['selectedTypes'];

                const newState = this.copyState(state);
                newState.isBusy = false;
                newState.alignedCorpora = newState.alignedCorpora.map((value) => {
                    let newVal:TextTypes.AlignedLanguageItem = {
                        label: value.label,
                        value: value.value,
                        locked: value.selected ? true : false,
                        selected: value.selected
                    }
                    return newVal;
                }).filter(item=>item.locked).toList();
                this.updateSelectionSteps(newState, selectedTypes, poscount);
                if (action.payload['bibAttrValsAreListed']) {
                    this.attachBibData(newState, filterData);
                }
                return newState;
            },
            'LIVE_ATTRIBUTES_RESET_CLICKED': (state, action) => {
                if (window.confirm(this.pluginApi.translate('ucnkLA__are_you_sure_to_reset'))) {
                    const newState = this.copyState(state);
                    this.reset(newState);
                    return newState;
                }
                return state;
            },
            'LIVE_ATTRIBUTES_UNDO_CLICKED': (state, action) => {
                const newState = this.copyState(state);
                newState.lastRemovedStep = newState.selectionSteps.last();
                newState.selectionSteps = newState.selectionSteps.pop();
                console.log('after undo, num sel steps: ', newState.selectionSteps.size);
                return newState;
            },
            'TT_MINIMIZE_ALL': (state, action) => {
                const newState = this.copyState(state);
                newState.isTTListMinimized = true;
                return newState;
            },
            'TT_MAXIMIZE_ALL': (state, action) => {
                const newState = this.copyState(state);
                newState.isTTListMinimized = false;
                return newState;
            },
            'LIVE_ATTRIBUTES_TOGGLE_MINIMIZE_ALIGNED_LANG_LIST': (state, action) => {
                const newState = this.copyState(state);
                newState.isTTListMinimized = !newState.isTTListMinimized;
                return newState;
            },
            'LIVE_ATTRIBUTES_ALIGNED_CORP_CHANGED': (state, action) => {
                const newState = this.copyState(state);
                const item = newState.alignedCorpora.get(action.payload['idx']);
                if (item) {
                    const idx = newState.alignedCorpora.indexOf(item);
                    const newItem:TextTypes.AlignedLanguageItem = {
                        value: item.value,
                        label: item.label,
                        locked: item.locked,
                        selected: !item.selected
                    };
                    newState.alignedCorpora = newState.alignedCorpora.set(idx, newItem);
                }
                newState.controlsEnabled = newState.controlsEnabled || this.hasSelectedLanguages(newState);
                return newState;
            },
            'QUERY_INPUT_ADD_ALIGNED_CORPUS': (state, action) => {
                const newState = this.copyState(state);
                this.reset(newState);
                this.updateAlignedItem(
                    newState,
                    action.payload['corpname'],
                    orig => ({
                        value: orig.value,
                        label: orig.label,
                        locked: true,
                        selected: true
                    })
                );
                newState.controlsEnabled = newState.controlsEnabled || this.hasSelectedLanguages(newState);
                return newState;
            },
            'QUERY_INPUT_REMOVE_ALIGNED_CORPUS': (state, action) => {
                const newState = this.copyState(state);
                this.reset(newState);
                this.updateAlignedItem(
                    newState,
                    action.payload['corpname'],
                    orig => ({
                        value: orig.value,
                        label: orig.label,
                        locked: false,
                        selected: false
                    })
                );
                return newState;
            },
            'TT_SELECTION_CHANGED': (state, action) => {
                const newState = this.copyState(state);
                newState.controlsEnabled = action.payload['hasSelectedItems'] || state.alignedCorpora.find(v => v.selected);
                return newState;
            }
        };
    }

    sideEffects(state:LiveAttrsModelState, action:Action, dispatch:SEDispatcher) {
        switch (action.name) {
            case 'LIVE_ATTRIBUTES_REFINE_CLICKED':
                dispatch({
                    name: 'TT_LOCK_SELECTED'
                });
                const selections = this.getTtSelection(false);
                this.loadFilteredData(state, selections).subscribe(
                    (data) => {
                        const filterData = this.importFilter(data.attr_values, dispatch);
                        dispatch({
                            name: 'TT_SNAPSHOT_STATE'
                        });
                        dispatch({
                            name: 'TT_FILTER_WHOLE_SELECTION',
                            payload: {
                                data: filterData
                            }
                        });
                        dispatch({
                            name: 'LIVE_ATTRIBUTES_REFINE_DONE',
                            payload: {
                                poscount: data.poscount,
                                filterData: filterData,
                                selectedTypes: selections,
                                bibAttrValsAreListed: Array.isArray(data.attr_values[state.bibliographyAttribute])
                            }
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch({
                            name: 'LIVE_ATTRIBUTES_REFINE_DONE',
                            error: err
                        });
                    }
                );
            break;
            case 'LIVE_ATTRIBUTES_UNDO_CLICKED':
                if (!isAlignedSelectionStep(state.lastRemovedStep)) {
                    dispatch({
                        name: 'TT_UNDO_STATE'
                    });
                }
            break;
            case 'LIVE_ATTRIBUTES_RESET_CLICKED':
                dispatch({
                    name: 'TT_RESET_STATE'
                });
            break;
            case 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST':
                this.loadAutoComplete(state, action.payload['attrName'], action.payload['value'], dispatch);
            break;
            case 'TT_EXTENDED_INFORMATION_REQUEST':
                const ident:string = action.payload['ident'];
                if (state.bibliographyIds.contains(ident)) {
                    this.loadBibInfo(ident).then(
                        (serverData:ServerBibData) => {
                            dispatch({
                                name: 'TT_EXTENDED_INFORMATION_REQUEST_DONE',
                                payload: {
                                    attrName: state.bibliographyAttribute,
                                    ident: ident,
                                    data: serverData.bib_data
                                }
                            });

                        }
                    ).catch(
                        (err:any) => {
                            this.pluginApi.showMessage('error', err);
                            dispatch({
                                name: 'TT_EXTENDED_INFORMATION_REQUEST_DONE',
                                error: err
                            });

                        }
                    );

                } else {
                    return new RSVP.Promise<any>((resolve:()=>void, reject:(err)=>void) => {
                        reject(new Error('Item not found'));
                    })
                }
            break;
        }
    }

    private updateAlignedItem(
        state:LiveAttrsModelState,
        corpname:string,
        upd:(orig:TextTypes.AlignedLanguageItem)=>TextTypes.AlignedLanguageItem
    ):boolean {
        const srchIdx = state.alignedCorpora.findIndex(v => v.value === corpname);
        console.log('srchIdx: ', srchIdx);
        if (srchIdx > -1) {
            const item = state.alignedCorpora.get(srchIdx);
            state.alignedCorpora = state.alignedCorpora.set(srchIdx, upd(item));
            return true;
        }
        return false;
    }

    private attachBibData(state:LiveAttrsModelState, filterData:SelectionFilterMap) {
        const newBibData = filterData[state.bibliographyAttribute];
        // set the data iff server data are full-fledget (i.e. including unique 'ident')
        if (newBibData.length > 0 && !!newBibData[0].ident) {
            state.bibliographyIds = state.bibliographyIds.union(Immutable.OrderedSet<string>(newBibData.map(v => v.ident)));
        }
    }

    reset(state:LiveAttrsModelState):void {
        state.selectionSteps = state.selectionSteps.clear();
        if (this.controlsAlignedCorpora) {
            state.alignedCorpora = state.initialAlignedCorpora;
        }
        state.bibliographyIds = state.bibliographyIds.clear();
    }

    private updateSelectionSteps(state:LiveAttrsModelState, selections:TextTypes.ServerCheckedValues, poscount:number):void {
        const newAttrs = this.getUnusedAttributes(state, selections);
        const selectedAligned = state.alignedCorpora.filter(item=>item.selected);

        if (state.selectionSteps.size === 0 && selectedAligned.size > 0) {
            const mainLang = this.pluginApi.getCorpusIdent().id;
            const newStep:AlignedLangSelectionStep = {
                num: 1,
                numPosInfo: newAttrs.length > 0 ? 0 : poscount,
                attributes : Immutable.List([]),
                languages : state.alignedCorpora
                    .splice(0, 0, {
                        value: mainLang,
                        label: mainLang,
                        selected: true,
                        locked: true
                    })
                    .filter((item)=>item.selected)
                    .map((item)=>item.value).toArray()
            };
            state.selectionSteps = state.selectionSteps.push(newStep);
        }
        if (state.selectionSteps.size > 0 && newAttrs.length > 0 || selectedAligned.size == 0) {
            const newStep:TTSelectionStep = {
                num: state.selectionSteps.size + 1,
                numPosInfo: poscount,
                attributes: Immutable.List(newAttrs),
                values: Immutable.Map<string, Array<string>>(newAttrs.map((item) => {
                    return [item, selections[item]];
                }))
            };
            state.selectionSteps = state.selectionSteps.push(newStep);
        }
    }

    getAlignedCorpora(state:LiveAttrsModelState):Immutable.List<TextTypes.AlignedLanguageItem> {
        if (state.manualAlignCorporaMode) {
            return state.alignedCorpora;

        } else {
            return state.alignedCorpora.filter(v => v.selected).toList();
        }
    }

    /**
     * Return already selected attributes which are not
     * yet present here in selectionSteps. These are
     * expected to compose the latest selection step.
     */
    private getUnusedAttributes(state:LiveAttrsModelState, selections:TextTypes.ServerCheckedValues):Array<string> {
        const used = state.selectionSteps.flatMap(val => val.attributes).toList();
        return Object.keys(selections).filter(v => used.indexOf(v) === -1);
    }

    hasSelectedLanguages(state:LiveAttrsModelState):boolean {
        return state.alignedCorpora.find((item)=>item.selected) !== undefined;
    }

    hasLockedAlignedLanguages(state:LiveAttrsModelState):boolean {
        return this.hasSelectedLanguages(state) && state.selectionSteps.size > 0;
    }

    private setAttrSummary(attrName:string, value:TextTypes.AttrSummary, dispatch:SEDispatcher):void {
        dispatch({
            name: 'TT_SET_ATTR_SUMMARY',
            payload: {
                attrName: attrName,
                value: value
            }
        });
    }

    private importFilter(data:ServerRefineResponse['attr_values'], dispatch:SEDispatcher):SelectionFilterMap {
        let ans:SelectionFilterMap = {};
        for (let k in data) {
            if (k.indexOf('.') > 0) { // is the key an attribute? (there are other values there too)
                const item = data[k];
                if (Array.isArray(item)) {
                    ans[k] = item.map((v) => {
                        return {
                            ident: v[1],
                            v: v[2], // [0] contains shortened version - cannot use here
                            lock: false,
                            availItems: v[4],
                            numGrouped: v[3]
                        };
                    });
                    this.setAttrSummary(k, null, dispatch);

                } else if (item.poscount) {
                    this.setAttrSummary(
                        k,
                        {
                            text: this.pluginApi.translate('query__tt_{num}_items',
                                {num: item.poscount}),
                            help: this.pluginApi.translate('ucnkLA__bib_list_warning')
                        },
                        dispatch
                    );
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

    private loadFilteredData(state:LiveAttrsModelState, selections:TextTypes.ServerCheckedValues):Observable<ServerRefineResponse> {
        const aligned = state.alignedCorpora.filter((item)=>item.selected).map((item)=>item.value).toArray();
        return this.pluginApi.ajax$<ServerRefineResponse>(
            'POST',
            this.pluginApi.createActionUrl('filter_attributes'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                attrs: JSON.stringify(selections),
                aligned: JSON.stringify(aligned)
            }
        ).pipe(
            map(
                (resp) => {
                    const fixedAttrVals = {};
                    Object.keys(resp.attr_values).forEach(k => {
                        if (Array.isArray(resp.attr_values[k])) {
                            fixedAttrVals[k] = resp.attr_values[k];
                        }
                    });
                    return {
                        error: resp.error,
                        messages: resp.messages,
                        aligned: resp.aligned,
                        poscount: resp.poscount,
                        attr_values: fixedAttrVals
                    };
                }
            )
        )
    }

    private loadAutocompleteHint(state:LiveAttrsModelState, pattern:string, patternAttr:string, selections:SelectedTextTypes):Observable<ServerRefineResponse> {
        const aligned = state.alignedCorpora.filter((item)=>item.selected).map((item)=>item.value).toArray();
        return this.pluginApi.ajax$(
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

    loadAutoComplete(state:LiveAttrsModelState, attrName:string, value:string, dispatch:SEDispatcher):void {
        if (value.length > 2) {
            this.loadAutocompleteHint(state, value, attrName, this.getTtSelection(true)).subscribe(
                (resp) => {
                    const filterData = this.importFilter(resp.attr_values, dispatch);
                    if (Array.isArray(filterData[state.bibliographyAttribute])) {
                        this.attachBibData(state, filterData);
                    }
                    const values = resp.attr_values[attrName];
                    if (Array.isArray(values)) {
                        dispatch({
                            name: 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST_DONE',
                            payload: {
                                attrName: attrName,
                                data: values.map((v) => ({ident: v[1], label: v[2]}))
                            }
                        });

                    } else {
                        dispatch({
                            name: 'TT_ATTRIBUTE_TEXT_INPUT_AUTOCOMPLETE_REQUEST_DONE',
                            error: new Error('Did not recieve list of items but a summary instead')
                        });
                    }
                },
                (err) => {
                    console.error(err);
                    this.pluginApi.showMessage('error', err);
                }
            );

        } else {
            rxOf(null);
        }
    }

    getTextInputPlaceholder():string {
        /*
        if (this.isEnabled) {
            return this.pluginApi.translate('ucnkLA__start_writing_for_suggestions');
        }
        return this.pluginApi.translate('ucnkLA__too_many_values_placeholder');
        */
       throw new Error('getTextInputPlaceholder() called')
    }
}