/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

import { IActionDispatcher, StatelessModel, SEDispatcher } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { map } from 'rxjs/operators';
import { pipe, List, Dict, tuple, HTTP } from 'cnc-tskit';

import { TextTypes, Kontext } from '../../types/common';
import { IPluginApi } from '../../types/plugins';
import { SelectionFilterMap, SelectedTextTypes } from '../../models/textTypes/common';
import { Actions, ActionName } from './actions';
import { Actions as TTActions, ActionName as TTActionName } from '../../models/textTypes/actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../../models/query/actions';
import { Actions as SubcActions, ActionName as SubcActionName } from '../../models/subcorp/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../../models/common/actions';
import { IUnregistrable } from '../../models/common/common';


interface ServerRefineResponse extends Kontext.AjaxResponse {
    error?:string;
    aligned:Array<string>;
    poscount:number;
    attr_values:{
        [key:string]:{poscount:number}|Array<[string, string, string, number, number]>
    };
}

interface ServerBibInfoResponse extends Kontext.AjaxResponse {
    bib_data:Array<[string, string]>;
}

export interface SelectedValues {
    selections:Array<string>;
    type:'default';
}

export interface EncodedSelection {
    decodedValue:string;
    type:'encoded';
}

export interface TTSelectionStep {
    num:number;
    attributes:Array<string>;
    numPosInfo:number;
    values:{[key:string]:SelectedValues|EncodedSelection};
}

export interface AlignedLangSelectionStep {
    num:number;
    attributes:Array<string>;
    numPosInfo:number;
    languages:Array<string>;
}

export function isAlignedSelectionStep(v:TTSelectionStep|AlignedLangSelectionStep):v is AlignedLangSelectionStep {
    return Array.isArray(v['languages']);
}

export interface LiveAttrsModelState {
    selectionSteps:Array<TTSelectionStep|AlignedLangSelectionStep>;
    lastRemovedStep:TTSelectionStep|AlignedLangSelectionStep|null;
    alignedCorpora:Array<TextTypes.AlignedLanguageItem>;
    initialAlignedCorpora:Array<TextTypes.AlignedLanguageItem>;
    bibliographyAttribute:string;
    bibliographyIds:Array<string>;
    selectionTypes:{[attr:string]:[TextTypes.TTSelectionTypes, string]}; // 2nd val = decoded val.
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
export class LiveAttrsModel extends StatelessModel<LiveAttrsModelState> implements IUnregistrable {

    private readonly pluginApi:IPluginApi;

    private readonly controlsAlignedCorpora:boolean;

    private readonly getTtSelection:(lockedOnesOnly:boolean)=>TextTypes.ServerCheckedValues;

    /**
     */
    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, initialState:LiveAttrsModelState,
            controlsAlignedCorpora:boolean,
            getTtSelection:(lockedOnesOnly:boolean)=>{[attr:string]:Array<string>}) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.controlsAlignedCorpora = controlsAlignedCorpora;
        this.getTtSelection = getTtSelection;

        this.addActionHandler<Actions.RefineClicked>(
            ActionName.RefineClicked,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                dispatch<TTActions.LockSelected>({
                    name: TTActionName.LockSelected
                });
                const selections = this.getTtSelection(false);
                this.loadFilteredData(state, selections).subscribe(
                    (data) => {
                        const filterData = this.importFilter(data.attr_values, dispatch);
                        dispatch<TTActions.FilterWholeSelection>({
                            name: TTActionName.FilterWholeSelection,
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
                        dispatch<TTActions.FilterWholeSelection>({
                            name: TTActionName.FilterWholeSelection,
                            error: err
                        });
                    }
                );
            }
        );

        this.addActionHandler<TTActions.FilterWholeSelection>(
            TTActionName.FilterWholeSelection,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.alignedCorpora = pipe(
                        state.alignedCorpora,
                        List.map((value) => ({
                            ...value,
                            locked: value.selected ? true : false
                        })),
                        List.filter(item=>item.locked)
                    );
                    this.updateSelectionSteps(state, action.payload.selectedTypes, action.payload.poscount);
                    if (action.payload.bibAttrValsAreListed) {
                        this.attachBibData(state, action.payload.filterData);
                    }
                }
            }
        );

        this.addActionHandler<Actions.ResetClicked>(
            ActionName.ResetClicked,
            (state, action) => {
                if (window.confirm(this.pluginApi.translate('ucnkLA__are_you_sure_to_reset'))) {
                    this.reset(state);
                }
            },
            (state, action, dispatch) => {
                dispatch<TTActions.ResetState>({
                    name: TTActionName.ResetState
                });
            }
        );

        this.addActionHandler<Actions.UndoClicked>(
            ActionName.UndoClicked,
            (state, action) => {
                state.lastRemovedStep = List.last(state.selectionSteps);
                state.selectionSteps.pop();
            },
            (state, action, dispatch) => {
                if (!isAlignedSelectionStep(state.lastRemovedStep)) {
                    dispatch<TTActions.UndoState>({
                        name: TTActionName.UndoState
                    });
                }
            }
        );

        this.addActionHandler<TTActions.MinimizeAll>(
            TTActionName.MinimizeAll,
            (state, action) => {
                state.isTTListMinimized = true;
            }
        );

        this.addActionHandler<TTActions.MaximizeAll>(
            TTActionName.MaximizeAll,
            (state, action) => {
                state.isTTListMinimized = false;
            }
        );

        this.addActionHandler<Actions.ToggleMinimizeAlignedLangList>(
            ActionName.ToggleMinimizeAlignedLangList,
            (state, action) => {
                state.isTTListMinimized = !state.isTTListMinimized;
            }
        );

        this.addActionHandler<Actions.AlignedCorpChanged>(
            ActionName.AlignedCorpChanged,
            (state, action) => {
                const item = state.alignedCorpora[action.payload.idx];
                if (item) {
                    const idx = state.alignedCorpora.indexOf(item);
                    state.alignedCorpora[idx] = {
                        value: item.value,
                        label: item.label,
                        locked: item.locked,
                        selected: !item.selected
                    };
                }
                state.controlsEnabled = state.controlsEnabled || this.hasSelectedLanguages(state);
            }
        );

        this.addActionHandler<QueryActions.QueryInputAddAlignedCorpus>(
            QueryActionName.QueryInputAddAlignedCorpus,
            (state, action) => {
                this.reset(state);
                this.updateAlignedItem(
                    state,
                    action.payload.corpname,
                    orig => ({
                        ...orig,
                        locked: true,
                        selected: true
                    })
                );
                state.controlsEnabled = state.controlsEnabled || this.hasSelectedLanguages(state);
            }
        );

        this.addActionHandler<QueryActions.QueryInputRemoveAlignedCorpus>(
            QueryActionName.QueryInputRemoveAlignedCorpus,
            (state, action) => {
                this.reset(state);
                this.updateAlignedItem(
                    state,
                    action.payload.corpname,
                    orig => ({
                        value: orig.value,
                        label: orig.label,
                        locked: false,
                        selected: false
                    })
                );
            }
        );

        this.addActionHandler<TTActions.SelectionChanged>(
            TTActionName.SelectionChanged,
            (state, action) => {
                state.controlsEnabled = action.payload.hasSelectedItems ||
                        List.some(v => v.selected, state.alignedCorpora);
            }
        );

        this.addActionHandler<TTActions.AttributeTextInputChanged>(
            TTActionName.AttributeTextInputChanged,
            (state, action) => {
                // we must gather information about selection types involved in refined selection
                // to be able to present properly rendered selection steps (if some attributes
                // provide 'decoded value' for better human readability)
                state.selectionTypes[action.payload.attrName] = tuple(
                    action.payload.type,
                    action.payload.decodedValue
                );''
            }
        );

        this.addActionHandler<TTActions.AttributeTextInputAutocompleteRequest>(
            TTActionName.AttributeTextInputAutocompleteRequest,
            null,
            (state, action, dispatch) => {
                this.loadAutoComplete(
                    state,
                    action.payload.attrName,
                    action.payload.value,
                    dispatch
                );
            }
        );

        this.addActionHandler<TTActions.ExtendedInformationRequest>(
            TTActionName.ExtendedInformationRequest,
            null,
            (state, action, dispatch) => {
                const ident:string = action.payload.ident;
                if (List.some(v => v === ident, state.bibliographyIds)) {
                    this.loadBibInfo(ident).subscribe(
                        (serverData) => {
                            dispatch<TTActions.ExtendedInformationRequestDone>({
                                name: TTActionName.ExtendedInformationRequestDone,
                                payload: {
                                    attrName: state.bibliographyAttribute,
                                    ident: ident,
                                    data: serverData.bib_data
                                }
                            })
                        },
                        (err:Error) => {
                            this.pluginApi.showMessage('error', err);
                            dispatch<TTActions.ExtendedInformationRequestDone>({
                                name: TTActionName.ExtendedInformationRequestDone,
                                error: err
                            });

                        }
                    );

                } else {
                    return this.pluginApi.showMessage('error', this.pluginApi.translate('ucnkLA__item_not_found'));
                }
            }
        );

        this.addActionHandler<Actions.AlignedCorpChanged>(
            ActionName.AlignedCorpChanged,
            null,
            (state, action, dispatch) => {
                dispatch<SubcActions.FormSetAlignedCorpora>({
                    name: SubcActionName.FormSetAlignedCorpora,
                    payload: {
                        alignedCorpora: state.alignedCorpora.filter(v => v.selected)
                    }
                });
            }
        );

        this.addActionHandler<TTActions.AttributeTextInputAutocompleteRequestDone>(
            TTActionName.AttributeTextInputAutocompleteRequestDone,
            (state, action) => {
                if (Array.isArray(action.payload.filterData[state.bibliographyAttribute])) {
                    this.attachBibData(state, action.payload.filterData);
                }
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch<GlobalActions.SwitchCorpusReady<{}>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'ucnk-live-attributes-plugin';
    }

    private updateAlignedItem(
        state:LiveAttrsModelState,
        corpname:string,
        upd:(orig:TextTypes.AlignedLanguageItem)=>TextTypes.AlignedLanguageItem
    ):boolean {
        const srchIdx = state.alignedCorpora.findIndex(v => v.value === corpname);
        if (srchIdx > -1) {
            const item = state.alignedCorpora[srchIdx];
            state.alignedCorpora[srchIdx] = upd(item);
            return true;
        }
        return false;
    }

    private attachBibData(state:LiveAttrsModelState, filterData:SelectionFilterMap) {
        const newBibData = filterData[state.bibliographyAttribute];
        // set the data iff server data are full-fledget (i.e. including unique 'ident')
        if (newBibData.length > 0 && !!newBibData[0].ident) {
            state.bibliographyIds = pipe(
                state.bibliographyIds,
                List.concat(newBibData.map(v => v.ident)),
                List.groupBy(v => v),
                List.map(([k,]) => k)
            );
        }
    }

    reset(state:LiveAttrsModelState):void {
        state.selectionSteps = [];
        if (this.controlsAlignedCorpora) {
            state.alignedCorpora = state.initialAlignedCorpora;
        }
        state.bibliographyIds = [];
    }

    private updateSelectionSteps(state:LiveAttrsModelState, selections:TextTypes.ServerCheckedValues, poscount:number):void {
        const newAttrs = this.getUnusedAttributes(state, selections);
        const selectedAligned = state.alignedCorpora.filter(item=>item.selected);

        if (List.empty(state.selectionSteps) && !List.empty(selectedAligned)) {
            const mainLang = this.pluginApi.getCorpusIdent().id;
            state.alignedCorpora.splice(0, 0, {
                value: mainLang,
                label: mainLang,
                selected: true,
                locked: true
            });
            const newStep:AlignedLangSelectionStep = {
                num: 1,
                numPosInfo: newAttrs.length > 0 ? 0 : poscount,
                attributes : [],
                languages : pipe(
                    state.alignedCorpora,
                    List.filter((item)=>item.selected),
                    List.map(item=>item.value)
                )
            };
            state.selectionSteps.push(newStep);
        }
        if (!List.empty(state.selectionSteps) && !List.empty(newAttrs) || List.empty(selectedAligned)) {
            const newStep:TTSelectionStep = {
                num: state.selectionSteps.length + 1,
                numPosInfo: poscount,
                attributes: newAttrs,
                values: pipe(
                    newAttrs,
                    List.map(
                        attr => tuple<string, SelectedValues|EncodedSelection>(
                            attr,
                            state.selectionTypes[attr] &&
                                TextTypes.isEncodedSelectionType(state.selectionTypes[attr][0]) ?
                            {
                                decodedValue: state.selectionTypes[attr][1],
                                type: 'encoded'
                            } :
                            {
                                selections: selections[attr],
                                type: 'default'
                            }
                        )
                    ),
                    Dict.fromEntries()
                )
            };
            state.selectionSteps.push(newStep);
        }
    }

    getAlignedCorpora(state:LiveAttrsModelState):Array<TextTypes.AlignedLanguageItem> {
        if (state.manualAlignCorporaMode) {
            return state.alignedCorpora;

        } else {
            return List.filter(
                v => v.selected,
                state.alignedCorpora
            );
        }
    }

    /**
     * Return already selected attributes which are not
     * yet present here in selectionSteps. These are
     * expected to compose the latest selection step.
     */
    private getUnusedAttributes(state:LiveAttrsModelState, selections:TextTypes.ServerCheckedValues):Array<string> {
        const used = List.flatMap(
            val => val.attributes,
            state.selectionSteps
        );
        return Object.keys(selections).filter(v => used.indexOf(v) === -1);
    }

    hasSelectedLanguages(state:LiveAttrsModelState):boolean {
        return state.alignedCorpora.find((item)=>item.selected) !== undefined;
    }

    hasLockedAlignedLanguages(state:LiveAttrsModelState):boolean {
        return this.hasSelectedLanguages(state) && !List.empty(state.selectionSteps);
    }

    private setAttrSummary(attrName:string, value:TextTypes.AttrSummary, dispatch:SEDispatcher):void {
        dispatch<TTActions.SetAttrSummary>({
            name: TTActionName.SetAttrSummary,
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

    private loadBibInfo(bibId:string):Observable<ServerBibInfoResponse> {
        return this.pluginApi.ajax$<ServerBibInfoResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('corpora/bibliography'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                id: bibId
            }
        );
    }

    private loadFilteredData(state:LiveAttrsModelState, selections:TextTypes.ServerCheckedValues):Observable<ServerRefineResponse> {
        const aligned = pipe(
            state.alignedCorpora,
            List.filter(item=>item.selected),
            List.map((item)=>item.value)
        );
        return this.pluginApi.ajax$<ServerRefineResponse>(
            HTTP.Method.POST,
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
        const aligned = pipe(
            state.alignedCorpora,
            List.filter(item=>item.selected),
            List.map(item=>item.value)
        );
        return this.pluginApi.ajax$(
            HTTP.Method.POST,
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

    private loadAutoComplete(state:LiveAttrsModelState, attrName:string, value:string, dispatch:SEDispatcher):void {
        if (value.length > 2) {
            this.loadAutocompleteHint(state, value, attrName, this.getTtSelection(true)).subscribe(
                (resp) => {
                    const filterData = this.importFilter(resp.attr_values, dispatch);
                    const values = resp.attr_values[attrName];
                    if (Array.isArray(values)) {
                        dispatch<TTActions.AttributeTextInputAutocompleteRequestDone>({
                            name: TTActionName.AttributeTextInputAutocompleteRequestDone,
                            payload: {
                                attrName: attrName,
                                filterData: filterData,
                                autoCompleteData: values.map((v) => ({ident: v[1], label: v[2]}))
                            }
                        });

                    } else {
                        dispatch<TTActions.AttributeTextInputAutocompleteRequestDone>({
                            name: TTActionName.AttributeTextInputAutocompleteRequestDone,
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
}