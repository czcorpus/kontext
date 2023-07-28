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
import { extractTTSelectionValue, SelectionFilterMap } from '../../models/textTypes/common';
import { Actions as TTActions } from '../../models/textTypes/actions';
import { Actions as QueryActions } from '../../models/query/actions';
import { Actions as SubcActions } from '../../models/subcorp/actions';
import { Actions as GlobalActions } from '../../models/common/actions';
import { IUnregistrable } from '../../models/common/common';
import { IPluginApi } from '../../types/plugins/common';
import { isTTSelection } from '../../models/subcorp/common';
import { DataSaveFormat } from '../../app/navigation/save';
import { DownloadType } from '../../app/page';



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
    structAttrs:Array<{n:string; selected:boolean}>;
    selectionSteps:Array<TTSelectionStep|AlignedLangSelectionStep>;
    lastRemovedStep:TTSelectionStep|AlignedLangSelectionStep|null;
    firstCorpus:string;
    alignedCorpora:Array<TextTypes.AlignedLanguageItem>;
    initialAlignedCorpora:Array<TextTypes.AlignedLanguageItem>;
    bibIdAttr:string;
    bibLabelAttr:string;
    bibliographyIds:Array<string>;
    selectionTypes:{[attr:string]:[TextTypes.TTSelectionTypes, string]}; // 2nd val = decoded val.
    manualAlignCorporaMode:boolean;
    controlsEnabled:boolean;
    isBusy:boolean;
    docSaveIsBusy:boolean;
    isTTListMinimized:boolean;
    isEnabled:boolean;
    resetConfirmed:boolean;
    subcorpDefinition:TextTypes.ExportedSelection;
    documentListWidgetVisible:boolean;
    documentListSaveFormat:DataSaveFormat;
    documentListTotalSize:number|undefined;
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

    /**
     */
    constructor(
        dispatcher:IActionDispatcher,
        pluginApi:IPluginApi,
        initialState:LiveAttrsModelState,
    ) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.RefineClicked,
            (state, action) => {
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                dispatch<typeof TTActions.LockSelected>({
                    name: TTActions.LockSelected.name
                });

                this.waitForAction({}, (action, syncData) => {
                    return action.name === PluginInterfaces.LiveAttributes.Actions.RefineReady.name ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        (action) => {
                            if (PluginInterfaces.LiveAttributes.Actions.isRefineReady(action)) {
                                if (!List.empty(action.payload.newSelections)) {
                                    return this.loadFilteredData(state, action.payload.selections, dispatch);

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
                            const filterData = this.importFilter(data.attr_values);
                            dispatch(
                                TTActions.FilterWholeSelection,
                                {
                                    poscount: data.poscount,
                                    filterData: filterData,
                                    selectedTypes: selections,
                                    bibAttrValsAreListed: Array.isArray(data.attr_values[state.bibIdAttr]),
                                    isSubcorpDefinitionFilter: false,
                                }
                            );

                        } else {
                            dispatch(
                                PluginInterfaces.LiveAttributes.Actions.RefineCancelled,
                                {
                                    currentSubcorpSize: List.empty(state.selectionSteps) ?
                                        undefined :
                                        List.last(state.selectionSteps).numPosInfo
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
                    if (List.some(item => item.selected, state.alignedCorpora)) {
                        state.alignedCorpora = pipe(
                            state.alignedCorpora,
                            List.map((value) => ({
                                ...value,
                                locked: value.selected
                            })),
                            List.filter(item=>item.locked)
                        );
                    }
                    if (!action.payload.isSubcorpDefinitionFilter) {
                        this.updateSelectionSteps(state, action.payload.selectedTypes, action.payload.poscount);
                    }
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
                    this.reloadSizes(state, dispatch);
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
                if (state.selectionSteps.length === 0) {
                    this.reloadSizes(state, dispatch);
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
                //
                if (!state.manualAlignCorporaMode) {
                    this.reloadSizes(state, dispatch);
                }
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
                state.controlsEnabled = action.payload.hasSelectedItems || this.hasSelectedLanguages(state);
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
                this.waitForAction({}, (action, syncData) => {
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
                        const filterData = this.importFilter(resp.attr_values);
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
                        dispatch<typeof TTActions.AttributeTextInputAutocompleteRequestDone>({
                            name: TTActions.AttributeTextInputAutocompleteRequestDone.name,
                            error: err
                        });
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
                    this.loadBibInfo(state, ident).subscribe({
                        next: serverData => {
                            dispatch<typeof TTActions.ExtendedInformationRequestDone>({
                                name: TTActions.ExtendedInformationRequestDone.name,
                                payload: {
                                    attrName: state.bibLabelAttr,
                                    ident: ident,
                                    data: serverData.bib_data
                                }
                            })
                        },
                        error: error => {
                            dispatch<typeof TTActions.ExtendedInformationRequestDone>({
                                name: TTActions.ExtendedInformationRequestDone.name,
                                error
                            });
                        }
                    });

                } else {
                    dispatch<typeof TTActions.ExtendedInformationRequestDone>({
                        name: TTActions.ExtendedInformationRequestDone.name,
                        error: new Error(this.pluginApi.translate('ucnkLA__item_not_found')),
                    });
                }
            }
        );

        this.addActionHandler(
            TTActions.AttributeTextInputAutocompleteRequestDone,
            (state, action) => {
                if (!action.error && Array.isArray(action.payload.filterData[state.bibIdAttr])) {
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
                if (!state.initialCorpusSize) {
                    this.reloadSizes(state, dispatch);
                }
            }
        );

        this.addActionHandler(
            SubcActions.LoadSubcorpusDone,
            (state, action) => {
                if (!action.error) {
                    const selections = action.payload.data.selections;
                    if (isTTSelection(selections)) {
                        this.reset(state)
                        state.firstCorpus = action.payload.data.corpname;
                        state.bibIdAttr = action.payload.textTypes.bib_id_attr;
                        state.bibLabelAttr = action.payload.textTypes.bib_label_attr;
                        state.controlsEnabled = Dict.size(selections) > 0;
                        state.structAttrs = pipe(
                            action.payload.textTypes,
                            x => x.Blocks[0].Line,
                            List.map(x => x.name),
                            List.map(n => ({n, selected: n === action.payload.data.bibLabelAttr}))
                        );
                        state.manualAlignCorporaMode = action.payload.data.isDraft;
                        state.initialAlignedCorpora = action.payload.alignedSelection;
                        state.alignedCorpora = action.payload.alignedSelection;
                    }
                }
            },
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.ToggleDocumentListWidget,
            (state, action) => {
                state.documentListWidgetVisible = !state.documentListWidgetVisible;
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.SelectDownloadStructAttr,
            (state, action) => {
                const srch = List.find(x => x.n === action.payload.name, state.structAttrs);
                if (srch) {
                    srch.selected = action.payload.checked;
                }
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.DownloadNumMatchingDocuments,
            (state, action) => {
                state.docSaveIsBusy = true;
            },
            (state, action, dispatch) => {
                this.pluginApi.ajax$<{num_documents:number}>(
                    HTTP.Method.POST,
                    this.pluginApi.createActionUrl(
                        '/num_matching_documents',
                        {corpname: state.firstCorpus}
                    ),
                    {...this.selectionStepsToAttrSel(state)},
                    {contentType: 'application/json'}

                ).subscribe({
                    next: data => {
                        dispatch(
                            PluginInterfaces.LiveAttributes.Actions.DownloadNumMatchingDocumentsDone,
                            {
                                value: data.num_documents
                            }
                        );
                    },
                    error: error => {
                        this.pluginApi.showMessage('error', error);
                    }
                })
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.DownloadNumMatchingDocumentsDone,
            (state, action) => {
                state.docSaveIsBusy = false;
                state.documentListTotalSize = action.payload.value;
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.pluginApi.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.SetDocumentListDataFormat,
            (state, action) => {
                state.documentListSaveFormat = action.payload.value;
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.DownloadDocumentList,
            (state, action) => {
                state.docSaveIsBusy = true;
            },
            (state, action, dispatch) => {
                const args = this.selectionStepsToAttrSel(state);
                this.pluginApi.bgDownload({
                    format: state.documentListSaveFormat,
                    datasetType: DownloadType.DOCUMENT_LIST,
                    url: this.pluginApi.createActionUrl(
                        'save_document_list',
                        {
                            lattr: pipe(
                                state.structAttrs,
                                List.filter(x => x.selected),
                                List.map(x => x.n)
                            ),
                            save_format: state.documentListSaveFormat
                        }
                    ),
                    contentType: 'application/json',
                    args,

                }).subscribe(() => {
                    dispatch(
                        PluginInterfaces.LiveAttributes.Actions.DownloadDocumentListDone
                    )
                })
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.DownloadDocumentListDone,
            (state, action) => {
                state.docSaveIsBusy = false;
                state.documentListWidgetVisible = false;
            }
        );
    }

    getRegistrationId():string {
        return 'ucnk-live-attributes-plugin';
    }

    private selectionStepsToAttrSel(state:LiveAttrsModelState):{
        corpname:string;
        laligned:Array<string>;
        lattrs:{[k:string]:Array<string>};
    } {
        let initData = {
            corpname: state.firstCorpus,
            laligned: pipe(
                state.initialAlignedCorpora,
                List.filter(v => v.selected),
                List.map(v => v.value),
            ),
            lattrs: pipe(
                state.subcorpDefinition,
                Dict.map((selections, k) => {
                    if (Array.isArray(selections))
                        return selections
                    return [TextTypes.isExportedRegexpSelection(selections) ? selections.regexp : selections]
                })
            ),
        };
        return state.selectionSteps.length == 0 ?
            initData :
            pipe(
                state.selectionSteps,
                List.foldl<
                    TTSelectionStep|AlignedLangSelectionStep,
                    {
                        corpname:string,
                        laligned:Array<string>,
                        lattrs: {[k:string]:Array<string>}
                    }
                >(
                    (acc, v) => {
                        if (isAlignedSelectionStep(v)) {
                            acc.laligned = acc.laligned.concat(v.attributes);
                            return acc;

                        } else {
                            acc.lattrs = Dict.mergeDict(
                                (o, n) => n,
                                Dict.map(
                                    (v, k) => {
                                        if (v.type === 'encoded') {
                                            return [v.decodedValue];
                                        }
                                        return v.selections;
                                    },
                                    v.values
                                ),
                                acc.lattrs,
                            );
                            return acc;
                        }
                    },
                    initData
                )
            );
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
                        corpname: state.firstCorpus,
                        attrs: JSON.stringify(state.subcorpDefinition || {}),
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
                this.updateSummary(state, data.attr_values, dispatch);
                if (state.subcorpDefinition || (state.alignedCorpora && !state.manualAlignCorporaMode)) {
                    dispatch(
                        TTActions.FilterWholeSelection,
                        {
                            poscount: data.poscount,
                            filterData: this.importFilter(data.attr_values),
                            selectedTypes: state.subcorpDefinition,
                            bibAttrValsAreListed: Array.isArray(data.attr_values[state.bibIdAttr]),
                            isSubcorpDefinitionFilter: true,
                        }
                    );
                }
            },
            error: error => {
                this.pluginApi.showMessage('error', error);
                dispatch(
                    TTActions.ValueDomainsSizesChanged,
                    error
                );
            }
        });
    }

    private attachBibData(state:LiveAttrsModelState, filterData:SelectionFilterMap) {
        const newBibData = filterData[state.bibIdAttr];
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
        if (state.manualAlignCorporaMode) {
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
                                    selections: Array.isArray(sels) ?
                                        sels :
                                        [extractTTSelectionValue(sels)],
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
        const subcorpDefAttrs = Object.keys(state.subcorpDefinition||{});
        return Object.keys(selections).filter(v =>
            used.indexOf(v) === -1 && subcorpDefAttrs.indexOf(v) === -1
        );
    }

    hasSelectedLanguages(state:LiveAttrsModelState):boolean {
        return List.some(item => item.selected && !item.locked, state.alignedCorpora);
    }

    private setAttrSummary(attrName:string, value:TextTypes.AttrSummary, dispatch:SEDispatcher):void {
        dispatch(
            TTActions.SetAttrSummary,
            {
                attrName,
                value
            }
        );
    }

    private updateSummary(
        state:LiveAttrsModelState,
        data:ServerRefineResponse['attr_values'],
        dispatch:SEDispatcher
    ) {
        Dict.forEach(
            (item, k) => {
                // is the key an attribute? (there are other values there too)
                if (k.indexOf('.') > 0 && k !== state.bibIdAttr) {
                    if (Array.isArray(item) || !item.length) {
                        this.setAttrSummary(k, null, dispatch);

                    } else {
                        this.setAttrSummary(
                            k,
                            {
                                text: this.pluginApi.translate(
                                    'query__tt_{num}_items',
                                    {num: item.length}
                                ),
                                help: this.pluginApi.translate('ucnkLA__bib_list_warning')
                            },
                            dispatch
                        );
                    }
                }
            },
            data
        );
    }

    private importFilter(data:ServerRefineResponse['attr_values']):SelectionFilterMap {
        return pipe(
            data,
            Dict.filter((item, k) => k.indexOf('.') > 0 && Array.isArray(item)),
            Dict.map((item, k) => List.map(
                ([,ident, v, numGrouped, availItems]) => ({
                    ident,
                    v,
                    lock: false,
                    availItems,
                    numGrouped
                }),
                item as TextTypes.AvailItemsList
            ))
        );
    }

    private loadBibInfo(state:LiveAttrsModelState, bibId:string):Observable<ServerBibInfoResponse> {
        return this.pluginApi.ajax$<ServerBibInfoResponse>(
            HTTP.Method.GET,
            this.pluginApi.createActionUrl('corpora/bibliography'),
            {
                corpname: state.firstCorpus,
                id: bibId
            }
        );
    }

    private loadFilteredData(
        state:LiveAttrsModelState,
        selections:TextTypes.ExportedSelection,
        dispatch:SEDispatcher,
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
                corpname: state.firstCorpus,
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
                    this.updateSummary(state, resp.attr_values, dispatch);
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
                corpname: state.firstCorpus,
                pattern: pattern,
                patternAttr: patternAttr,
                attrs: JSON.stringify(selections),
                aligned: JSON.stringify(aligned)
            }
        );
    }

}