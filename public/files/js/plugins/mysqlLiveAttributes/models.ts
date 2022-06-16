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
import { concatMap, map, tap } from 'rxjs/operators';
import { pipe, List, Dict, tuple, HTTP } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import * as PluginInterfaces from '../../types/plugins';
import { SelectionFilterMap } from '../../models/textTypes/common';
import { Actions as TTActions } from '../../models/textTypes/actions';
import { Actions as QueryActions } from '../../models/query/actions';
import { Actions as SubcActions } from '../../models/subcorp/actions';
import { Actions as GlobalActions } from '../../models/common/actions';
import { IUnregistrable } from '../../models/common/common';
import { IPluginApi } from '../../types/plugins/common';



interface ServerRefineResponse extends Kontext.AjaxResponse {
    error?:string;
    aligned:Array<string>;
    poscount:number;
    attr_values:TextTypes.ValueDomainsSizes;
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
    initialCorpusSize:number|null; // if null then we need to load the info
    selectionSteps:Array<TTSelectionStep|AlignedLangSelectionStep>;
    lastRemovedStep:TTSelectionStep|AlignedLangSelectionStep|null;
    firstCorpus:string;
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
    resetConfirmed:boolean;
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

    /**
     */
    constructor(
        dispatcher:IActionDispatcher,
        pluginApi:IPluginApi,
        initialState:LiveAttrsModelState,
        controlsAlignedCorpora:boolean
    ) {

        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.controlsAlignedCorpora = controlsAlignedCorpora;

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.RefineClicked,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                dispatch<typeof TTActions.LockSelected>({
                    name: TTActions.LockSelected.name
                });

                this.suspend({}, (action, syncData) => {
                    return action.name === PluginInterfaces.LiveAttributes.Actions.RefineReady.name ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        (action) => {
                            if (PluginInterfaces.LiveAttributes.Actions.isRefineReady(action)) {
                                if (!List.empty(action.payload.newSelections)) {
                                    return this.loadFilteredData(state, action.payload.selections);

                                } else {
                                    return rxOf<[TextTypes.ExportedSelection, ServerRefineResponse]>(tuple({}, null));

                                }

                            } else {
                                throw new Error('Not an instance of RefineReady');
                            }
                        }
                    )
                ).subscribe({
                    next: ([selections, data]) => {
                        if (data) {
                            const filterData = this.importFilter(data.attr_values, dispatch);
                            dispatch(
                                TTActions.FilterWholeSelection,
                                {
                                    poscount: data.poscount,
                                    filterData: filterData,
                                    selectedTypes: selections,
                                    bibAttrValsAreListed: Array.isArray(data.attr_values[state.bibliographyAttribute])
                                }
                            );

                        } else {
                            dispatch(
                                PluginInterfaces.LiveAttributes.Actions.RefineCancelled,
                                {
                                    currentSubcorpSize: List.empty(state.selectionSteps) ?
                                        undefined :
                                        List.head(state.selectionSteps).numPosInfo
                                }
                            );
                        }
                    },
                    error: error => {
                        this.pluginApi.showMessage('error', error);
                        dispatch<typeof TTActions.FilterWholeSelection>({
                            name: TTActions.FilterWholeSelection.name,
                            error
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.RefineCancelled,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler(
            TTActions.FilterWholeSelection,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.alignedCorpora = pipe(
                        state.alignedCorpora,
                        List.map((value) => ({
                            ...value,
                            locked: value.selected
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

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.ResetClicked,
            (state, action) => {
                state.resetConfirmed = window.confirm(this.pluginApi.translate('ucnkLA__are_you_sure_to_reset'));
                if (state.resetConfirmed) {
                    this.reset(state);
                }
            },
            (state, action, dispatch) => {
                if (state.resetConfirmed) {
                    dispatch<typeof TTActions.ResetState>({
                        name: TTActions.ResetState.name
                    });
                }
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.UndoClicked,
            (state, action) => {
                state.lastRemovedStep = List.last(state.selectionSteps);
                state.selectionSteps.pop();
            },
            (state, action, dispatch) => {
                if (!isAlignedSelectionStep(state.lastRemovedStep)) {
                    dispatch<typeof TTActions.UndoState>({
                        name: TTActions.UndoState.name
                    });
                }
            }
        );

        this.addActionHandler(
            TTActions.MinimizeAll,
            (state, action) => {
                state.isTTListMinimized = true;
            }
        );

        this.addActionHandler(
            TTActions.MaximizeAll,
            (state, action) => {
                state.isTTListMinimized = false;
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.ToggleMinimizeAlignedLangList,
            (state, action) => {
                state.isTTListMinimized = !state.isTTListMinimized;
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.AlignedCorpChanged,
            (state, action) => {
                const item = state.alignedCorpora[action.payload.idx];
                if (item) {
                    const idx = state.alignedCorpora.indexOf(item);
                    state.alignedCorpora[idx] = {...item, selected: !item.selected};
                }
                state.controlsEnabled = state.controlsEnabled || this.hasSelectedLanguages(state);
            },
            (state, action, dispatch) => {
                dispatch<typeof SubcActions.FormSetAlignedCorpora>({
                    name: SubcActions.FormSetAlignedCorpora.name,
                    payload: {
                        alignedCorpora: List.filter(v => v.selected, state.alignedCorpora)
                    }
                });
                this.reloadSizes(state, dispatch);
            }
        );

        this.addActionHandler(
            QueryActions.QueryTextTypesToggleForm,
            null,
            (state, action, dispatch) => {
                if (!state.initialCorpusSize) {
                    this.reloadSizes(state, dispatch);
                }
            },
        );

        this.addActionHandler(
            TTActions.SelectionChanged,
            (state, action) => {
                state.controlsEnabled = action.payload.hasSelectedItems ||
                        List.some(v => v.selected, state.alignedCorpora);
            }
        );

        this.addActionHandler(
            TTActions.AttributeTextInputChanged,
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

        this.addActionHandler(
            TTActions.AttributeTextInputAutocompleteRequest,
            null,
            (state, action, dispatch) => {
                this.suspend({}, (action, syncData) => {
                    if (action.name === TTActions.AttributeTextInputAutocompleteReady.name) {
                        return null;
                    }
                    return syncData;
                }).pipe(
                    concatMap(
                        (action) => {
                            if (TTActions.isAttributeTextInputAutocompleteReady(action)) {
                                return this.loadAutocompleteHint(
                                    state,
                                    action.payload.value,
                                    action.payload.attrName,
                                    action.payload.selections
                                );

                            } else {
                                throw new Error('Not an AttributeTextInputAutocompleteReady instance');
                            }
                        }
                    )
                ).subscribe({
                    next: resp => {
                        const filterData = this.importFilter(resp.attr_values, dispatch);
                        const values = resp.attr_values[action.payload.attrName];
                        if (Array.isArray(values)) {
                            dispatch<typeof TTActions.AttributeTextInputAutocompleteRequestDone>({
                                name: TTActions.AttributeTextInputAutocompleteRequestDone.name,
                                payload: {
                                    attrName: action.payload.attrName,
                                    filterData: filterData,
                                    autoCompleteData: List.map(
                                        v => ({ident: v[1], label: v[2]}),
                                        values
                                    )
                                }
                            });

                        } else {
                            dispatch<typeof TTActions.AttributeTextInputAutocompleteRequestDone>({
                                name: TTActions.AttributeTextInputAutocompleteRequestDone.name,
                                error: new Error('Did not recieve list of items but a summary instead')
                            });
                        }
                    },
                    error: err => {
                        console.error(err);
                        this.pluginApi.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler(
            TTActions.ExtendedInformationRequest,
            null,
            (state, action, dispatch) => {
                const ident:string = action.payload.ident;
                if (List.some(v => v === ident, state.bibliographyIds)) {
                    this.loadBibInfo(ident).subscribe({
                        next: serverData => {
                            dispatch<typeof TTActions.ExtendedInformationRequestDone>({
                                name: TTActions.ExtendedInformationRequestDone.name,
                                payload: {
                                    attrName: state.bibliographyAttribute,
                                    ident: ident,
                                    data: serverData.bib_data
                                }
                            })
                        },
                        error: error => {
                            this.pluginApi.showMessage('error', error);
                            dispatch<typeof TTActions.ExtendedInformationRequestDone>({
                                name: TTActions.ExtendedInformationRequestDone.name,
                                error
                            });
                        }
                    });

                } else {
                    return this.pluginApi.showMessage('error', this.pluginApi.translate('ucnkLA__item_not_found'));
                }
            }
        );

        this.addActionHandler(
            TTActions.AttributeTextInputAutocompleteRequestDone,
            (state, action) => {
                if (Array.isArray(action.payload.filterData[state.bibliographyAttribute])) {
                    this.attachBibData(state, action.payload.filterData);
                }
            }
        );

        this.addActionHandler(
            TTActions.ValueDomainsSizesChanged,
            (state, action) => {
                state.initialCorpusSize = action.payload.total;
            }
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            null,
            (state, action, dispatch) => {
                dispatch(
                    GlobalActions.SwitchCorpusReady,
                    {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                );
            }
        );

        this.addActionHandler(
            GlobalActions.CorpusSwitchModelRestore,
            null,
            (state, action, dispatch) => {
                this.reloadSizes(state, dispatch);
            }
        )
    }

    getRegistrationId():string {
        return 'ucnk-live-attributes-plugin';
    }

    private reloadSizes(state:LiveAttrsModelState, dispatch:SEDispatcher):void {
        rxOf(null).pipe(
            tap(
                _ => {
                    dispatch(
                        TTActions.SetWaitingForValueDomainsSizes
                    )
                }
            ),
            concatMap(
                () => this.pluginApi.ajax$<ServerRefineResponse>(
                    HTTP.Method.POST,
                    this.pluginApi.createActionUrl('filter_attributes'),
                    {
                        corpname: this.pluginApi.getCorpusIdent().id,
                        attrs: JSON.stringify({}),
                        aligned: JSON.stringify(pipe(
                            state.alignedCorpora,
                            List.filter(v =>  v.selected),
                            List.map(v => v.value)
                        ))
                    }
                )
            )

        ).subscribe({
            next: data => {
                dispatch(
                    TTActions.ValueDomainsSizesChanged,
                    {
                        sizes: data.attr_values,
                        total: data.poscount
                    }
                );
            },
            error: error => {
                dispatch(
                    TTActions.ValueDomainsSizesChanged,
                    error
                );
            }
        });
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
                List.concat(List.map(v => v.ident, newBibData)),
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

    private updateSelectionSteps(
        state:LiveAttrsModelState,
        selections:TextTypes.ExportedSelection,
        poscount:number
    ):void {

        const newAttrs = this.getUnusedAttributes(state, selections);
        const selectedAligned = state.alignedCorpora.filter(item=>item.selected);

        if (List.empty(state.selectionSteps) && !List.empty(selectedAligned)) {
            state.alignedCorpora = List.map(v => ({...v, locked: true}), state.alignedCorpora);
            const newStep:AlignedLangSelectionStep = {
                num: 1,
                numPosInfo: state.initialCorpusSize,
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
                        attr => {
                            const sels = selections[attr];
                            return tuple<string, SelectedValues|EncodedSelection>(
                                attr,
                                state.selectionTypes[attr] &&
                                    TextTypes.isEncodedSelectionType(state.selectionTypes[attr][0]) ?
                                {
                                    decodedValue: state.selectionTypes[attr][1],
                                    type: 'encoded'
                                } :
                                {
                                    selections: Array.isArray(sels) ? sels : [sels],
                                    type: 'default'
                                }
                            )
                        }
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
    private getUnusedAttributes(
            state:LiveAttrsModelState, selections:TextTypes.ExportedSelection):Array<string> {
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
        dispatch<typeof TTActions.SetAttrSummary>({
            name: TTActions.SetAttrSummary.name,
            payload: {
                attrName: attrName,
                value: value
            }
        });
    }

    private importFilter(data:ServerRefineResponse['attr_values'], dispatch:SEDispatcher):SelectionFilterMap {
        let ans:SelectionFilterMap = {};
        Dict.forEach(
            (item, k) => {
                if (k.indexOf('.') > 0) { // is the key an attribute? (there are other values there too)
                    if (Array.isArray(item)) {
                        ans[k] = List.map(
                            ([,ident, v, numGrouped, availItems]) => ({
                                ident,
                                v,
                                lock: false,
                                availItems,
                                numGrouped
                            }),
                            item
                        );
                        this.setAttrSummary(k, null, dispatch);

                    } else if (item.length) {
                        this.setAttrSummary(
                            k,
                            {
                                text: this.pluginApi.translate('query__tt_{num}_items',
                                    {num: item.length}),
                                help: this.pluginApi.translate('ucnkLA__bib_list_warning')
                            },
                            dispatch
                        );
                    }
                }
            },
            data
        );
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

    private loadFilteredData(
        state:LiveAttrsModelState,
        selections:TextTypes.ExportedSelection
    ):Observable<[TextTypes.ExportedSelection, ServerRefineResponse]> {
        const aligned = pipe(
            state.alignedCorpora,
            List.filter(item => item.selected),
            List.map(item => item.value)
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
                resp => {
                    const fixedAttrVals = {};
                    Object.keys(resp.attr_values).forEach(k => {
                        if (Array.isArray(resp.attr_values[k])) {
                            fixedAttrVals[k] = resp.attr_values[k];
                        }
                    });
                    return tuple(
                        selections,
                        {
                            error: resp.error,
                            messages: resp.messages,
                            aligned: resp.aligned,
                            poscount: resp.poscount,
                            attr_values: fixedAttrVals
                        }
                    )
                }
            )
        );
    }

    private loadAutocompleteHint(
        state:LiveAttrsModelState,
        pattern:string,
        patternAttr:string,
        selections:TextTypes.ExportedSelection
    ):Observable<ServerRefineResponse> {

        const aligned = pipe(
            state.alignedCorpora,
            List.filter(item => item.selected),
            List.map(item => item.value)
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

}