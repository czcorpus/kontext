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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { List, Dict, pipe, tuple, HTTP, Strings } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import * as PluginInterfaces from '../../types/plugins';
import { TTSelOps } from './selectionOps';
import {
    SelectionFilterMap, IntervalChar, WidgetView, importInitialTTData,
    textTypeSelectionEquals, extractTTSelectionValue
} from './common';
import { Actions } from './actions';
import { IUnregistrable } from '../common/common';
import { Actions as GlobalActions } from '../common/actions';
import { Actions as ConcActions } from '../concordance/actions';
import { Actions as QueryActions } from '../query/actions';
import { Actions as SubcActions } from '../subcorp/actions';
import { Actions as GeneralSubcmixerActions } from '../../types/plugins/subcMixer';
import { PluginName } from '../../app/plugin';
import { QueryFormArgs } from '../query/formArgs';
import { IPluginApi } from '../../types/plugins/common';
import { isTTSelection } from '../subcorp/common';



export interface TextTypesModelState {

    attributes:Array<TextTypes.AnyTTSelection>;

    /**
     * A text type attribute which serves as a title (possibly non-unique)
     * of a bibliography item. The value can be undefined.
     */
    bibLabelAttr:string;

    /**
     * A text type attribute which is able to uniquely determine a single document.
     * The value can be undefined (in such case we presume there are no bibliography
     * items present)
     */
    bibIdAttr:string;

    /**
     * A list of selection snapshots generated when values are filtered out.
     *  At least one item (initial state) is always present.
     */
    selectionHistory:Array<Array<TextTypes.AnyTTSelection>>;

    /**
     * Select-all request flags
     */
    selectAll:{[key:string]:boolean};

    minimizedBoxes:{[key:string]:boolean};

    textInputPlaceholder:string;

    busyAttributes:{[attr:string]:boolean};

    autoCompleteSupport:boolean;

    hasSelectedItems:boolean;

    attributeWidgets:{[key:string]:{
        widget:WidgetView;
        active:boolean;
    }};

    intervalChars:Array<string>;

    firstDayOfWeek:'mo'|'su'|'sa';

    isLiveAttrsActive:boolean;
}


interface TextTypesModelStatePreserve {
    attributes:Array<TextTypes.AnyTTSelection>;
}


export interface TextTypesModelArgs {
    dispatcher:IFullActionControl;
    pluginApi:IPluginApi;
    attributes:Array<TextTypes.AnyTTSelection>;
    readonlyMode:boolean;
    bibLabelAttr:string;
    bibIdAttr:string;
}


/**
 * Provides essential general operations on available text types
 * (filtering values, updating status - checked/locked, ...).
 */
export class TextTypesModel extends StatefulModel<TextTypesModelState>
    implements IUnregistrable {


    /**
     * true value is used on the 'view' page where no additional changes are
     * allowed in the selected text types. Please note that setting of the
     * value to true does not prevent
     */
    private readonly readonlyMode:boolean;

    private readonly pluginApi:IPluginApi;

    private readonly notifySelectionChange:()=>void; // TODO this is an ungly antipattern;


    constructor({
        dispatcher,
        pluginApi,
        attributes,
        readonlyMode,
        bibLabelAttr,
        bibIdAttr,
    }:TextTypesModelArgs) {
        super(
            dispatcher,
            {
                attributes,
                bibLabelAttr,
                bibIdAttr,
                selectionHistory: [List.map(
                    x => TTSelOps.mapValues(x, x => x),
                    attributes
                )],
                selectAll: pipe(
                    attributes,
                    List.map(
                        item => tuple(item.name, false)
                    ),
                    Dict.fromEntries()
                ),
                textInputPlaceholder: pluginApi.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES) ?
                    pluginApi.translate('query__tt_search_by_value') :
                    pluginApi.translate('query__tt_exact_value'),
                busyAttributes: {},
                minimizedBoxes: pipe(
                    attributes,
                    List.map(v => tuple(v.name, false)),
                    Dict.fromEntries()
                ),
                // the autocomplete is enabled by external conditions (e.g. liveattrs plug-in
                // is enabled) so it must be turned on via enableAutoCompleteSupport() by the
                // user of this model.
                autoCompleteSupport: false,
                hasSelectedItems: false,
                attributeWidgets: pipe(
                    attributes,
                    List.map(item => tuple(item.name, {widget: item.widget, active: false})),
                    Dict.fromEntries(),
                ),
                intervalChars: pluginApi.getConf<Array<string>>('ttIntervalChars'),
                firstDayOfWeek: pluginApi.getConf<'mo'|'su'|'sa'>('firstDayOfWeek'),
                isLiveAttrsActive: pluginApi.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES),
            }
        );
        this.readonlyMode = readonlyMode;
        this.pluginApi = pluginApi;

        // kind of anti-pattern but for now we have no other choice
        this.notifySelectionChange = ():void => {
            dispatcher.dispatch(
                Actions.SelectionChanged,
                {
                    attributes,
                    hasSelectedItems: TextTypesModel.findHasSelectedItems(this.state.attributes)
                }
            );
        }

        this.addActionSubtypeHandler(
            Actions.NegativeSelectionClicked,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    const attrIdx = this.getAttributeIdx(state, action.payload.attrName);
                    state.attributes[attrIdx].excludeSelection = action.payload.checked;
                });
                this.notifySelectionChange();
            }
        );

        this.addActionSubtypeHandler(
            Actions.ValueCheckboxClicked,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    this.changeValueSelection(
                        state,
                        action.payload.attrName,
                        action.payload.itemIdx
                    );
                });
                this.notifySelectionChange();
            }
        );

        this.addActionSubtypeHandler(
            Actions.SelectAllClicked,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    this.applySelectAll(state, action.payload.attrName);
                });
                this.notifySelectionChange();
            }
        );

        this.addActionSubtypeHandler(
            Actions.RangeButtonClicked,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    this.applyRange(
                        state,
                        action.payload.attrName,
                        action.payload.fromVal,
                        action.payload.toVal,
                        action.payload.strictInterval,
                        action.payload.keepCurrent
                    );
                });
                this.notifySelectionChange();
            }
        );

        this.addActionSubtypeHandler(
            Actions.ToggleRangeMode,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    state.attributeWidgets[action.payload.attrName].active =
                            !state.attributeWidgets[action.payload.attrName].active
                });
            }
        );

        this.addActionHandler(
            Actions.ExtendedInformationRequest,
            action => {
                this.changeState(state => {
                    state.busyAttributes[action.payload.attrName] = true;
                    const attrIdx = this.getAttributeIdx(state, action.payload.attrName);
                    if (attrIdx > -1) {
                        const ident = action.payload.ident;
                        const attr = state.attributes[attrIdx];
                        if (attr.type !== 'regexp') {
                            const srchIdx = attr.values.findIndex(v => v.ident === ident);
                            if (srchIdx > - 1 && attr.values[srchIdx].numGrouped < 2) {
                                state.attributes[attrIdx] = TTSelOps.mapValues(
                                    attr,
                                    item => ({
                                        ...item,
                                        extendedInfo: undefined
                                    })
                                );

                            } else if (srchIdx > -1) {
                                const message = this.pluginApi.translate(
                                    'query__tt_multiple_items_same_name_{num_items}',
                                    {num_items: attr.values[srchIdx].numGrouped}
                                );
                                this.setExtendedInfo(state, attr.name, ident, {__message__: message});
                            }
                        }
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.ExtendedInformationRequestDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.busyAttributes[action.payload.attrName] = false;
                        this.setExtendedInfo(
                            state,
                            action.payload.attrName,
                            action.payload.ident,
                            // TODO type?? !!!!
                            action.payload.data
                        );
                    });
                } else {
                    this.pluginApi.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.ExtendedInformationRemoveRequest,
            action => {
                this.changeState(state => {
                    this.clearExtendedInfo(
                        state,
                        action.payload.attrName,
                        action.payload.ident
                    );
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.AttributeAutoCompleteHintClicked,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    const attrIdx = this.getAttributeIdx(state, action.payload.attrName);
                    if (attrIdx > -1) {
                        const attr = state.attributes[attrIdx];
                        if (attr.type === 'text') {
                            attr.textFieldValue = '';
                        }
                    }
                    this.setTextInputAttrValue(
                        state,
                        action.payload.attrName,
                        action.payload.ident,
                        action.payload.label,
                        action.payload.append
                    );
                });
                this.notifySelectionChange();
            }
        );

        this.addActionSubtypeHandler(
            Actions.AttributeTextInputChanged,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    this.handleAttrTextInputChange(
                        state,
                        action.payload.attrName,
                        action.payload.value,
                        action.payload.decodedValue
                    );
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.AttributeAutoCompleteReset,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    this.resetAutoComplete(state, action.payload.attrName);
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.AttributeTextInputAutocompleteRequest,
            _ => !this.readonlyMode,
            action => {
                if (action.payload.value.length > 2) {
                    this.changeState(state => {
                        state.busyAttributes[action.payload.attrName] = true;
                    });
                    this.dispatchSideEffect(
                        Actions.AttributeTextInputAutocompleteReady,
                        {
                            ...action.payload,
                            selections: TextTypesModel.exportSelections(
                                this.state.attributes,
                                this.state.bibIdAttr,
                                this.state.bibLabelAttr,
                                false,
                                true,
                            )
                        }
                    );
                }
            }
        );

        this.addActionHandler(
            ConcActions.CalculateIpmForAdHocSubc,
            action => {
                this.dispatchSideEffect(
                    ConcActions.CalculateIpmForAdHocSubcReady,
                    {
                        ttSelection: TextTypesModel.exportSelections(
                            this.state.attributes,
                            this.state.bibIdAttr,
                            this.state.bibLabelAttr,
                            false,
                            true,
                        )
                    }
                );
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.RefineClicked,
            action => {
                this.changeState(state => {
                    this.setAllAttributesBusy(state, true);
                });
                this.dispatchSideEffect(
                    PluginInterfaces.LiveAttributes.Actions.RefineReady,
                    {
                        selections: TextTypesModel.exportSelections(
                            this.state.attributes,
                            this.state.bibIdAttr,
                            this.state.bibLabelAttr,
                            false,
                            true,
                        ),
                        newSelections: this.getSelectedValues(
                            this.state, action.payload.onlyUnlockedSelections)
                    }
                );
            }
        );

        this.addActionHandler(
            PluginInterfaces.LiveAttributes.Actions.RefineCancelled,
            action => {
                this.changeState(state => {
                    this.setAllAttributesBusy(state, false);
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.AttributeTextInputAutocompleteRequestDone,
            _ => !this.readonlyMode,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.busyAttributes[action.payload.attrName] = false;
                        this.setAutoComplete(
                            state,
                            action.payload.attrName,
                            action.payload.autoCompleteData,
                        );
                    });
                } else {
                    this.pluginApi.showMessage('error', action.error);
                }
            }
        );

        this.addActionHandler(
            Actions.MinimizeAll,
            action => {
                this.changeState(state => {
                    state.minimizedBoxes = Dict.map(
                        (v, k) => true,
                        state.minimizedBoxes
                    );
                })
            }
        );

        this.addActionHandler(
            Actions.MaximizeAll,
            action => {
                this.changeState(state => {
                    state.minimizedBoxes = Dict.map(
                        (v, k) => false,
                        this.state.minimizedBoxes
                    );
                });
            }
        );

        this.addActionHandler(
            Actions.ToggleMinimizeItem,
            action => {
                this.changeState(state => {
                    state.minimizedBoxes[action.payload.ident] =
                        !this.state.minimizedBoxes[action.payload.ident];
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.UndoState,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    state.selectionHistory.pop();
                    state.attributes = List.last(state.selectionHistory);
                });
                this.notifySelectionChange();
            }
        );

        this.addActionSubtypeHandler(
            Actions.ResetState,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    this.reset(state);
                });
                this.notifySelectionChange();
            }
        );

        this.addActionSubtypeHandler(
            Actions.LockSelected,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    List.forEach(
                        (attrName:string) => {
                            const attrIdx = this.getAttributeIdx(state, attrName);
                            if (attrIdx > -1) {
                                if (state.attributes[attrIdx].type === 'regexp') {
                                    state.attributes[attrIdx]['isLocked'] = true;

                                } else {
                                    state.attributes[attrIdx] = TTSelOps.mapValues(
                                        state.attributes[attrIdx],
                                        (item:TextTypes.AttributeValue) => ({
                                            ...item,
                                            locked: true,
                                        })
                                    );
                                }
                            }
                        },
                        this.getAttributesWithSelectedItems(state, false)
                    );
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.FilterWholeSelection,
            _ => !this.readonlyMode,
            action => {
                this.changeState(state => {
                    this.setAllAttributesBusy(state, false);
                    if (action.error) {
                        this.reset(state);

                    } else {
                        this.snapshotState(state);
                        this.filterWholeSelection(state, action.payload.filterData);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.SetAttrSummary,
            action => {
                const index = List.findIndex(
                    v => v.name === action.payload.attrName,
                    this.state.attributes,
                );
                if (index === -1) {
                    console.warn(`LiveAttrs: attribute '${action.payload.attrName}' not found`);

                } else {
                    this.changeState(state => {
                        state.attributes[index].metaInfo = action.payload.value;
                    });
                }
            }
        );

        this.addActionHandler(
            Actions.SetWaitingForValueDomainsSizes,
            action => {
                this.changeState(
                    state => {
                        this.setAllAttributesBusy(state, true);
                        this.clearInitialSizes(state);
                    }
                );
            }
        )

        this.addActionHandler(
            Actions.ValueDomainsSizesChanged,
            action => {
                this.changeState(
                    state => {
                        if (action.error) {
                            this.pluginApi.showMessage('error', action.error);

                        } else {
                            this.updateInitialSizes(state, action.payload.sizes);
                        }
                        this.setAllAttributesBusy(state, false);
                    }
                );
            }
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            action => {
                dispatcher.dispatch({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(
                            this.state,
                            action.payload.corpora,
                            action.payload.newPrimaryCorpus
                        )
                    }
                });
            }
        );

        this.addActionHandler(
            GlobalActions.CorpusSwitchModelRestore,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.deserialize(
                            state,
                            action.payload.data[this.getRegistrationId()] as
                                TextTypesModelStatePreserve,
                            action.payload.corpora
                        );
                    });
                }
            }
        );

        this.addActionHandler(
            [
                QueryActions.QuerySubmit,
                QueryActions.BranchQuery,
                SubcActions.FormSubmit,
                SubcActions.QuickSubcorpSubmit,
                SubcActions.ReuseQuery,
            ],
            action => {
                if (SubcActions.isReuseQuery(action) && action.payload.selectionType !== 'tt-sel') {
                    return;
                }
                this.dispatchSideEffect<typeof Actions.TextTypesQuerySubmitReady>({
                    name: Actions.TextTypesQuerySubmitReady.name,
                    payload: {
                        selections: TextTypesModel.exportSelections(
                            this.state.attributes,
                            this.state.bibIdAttr,
                            this.state.bibLabelAttr,
                            false,
                            false,
                        )
                    }
                })
            }
        );

        this.addActionHandler(
            SubcActions.LoadSubcorpusDone,
            action => {
                if (!action.error) {
                    const selection = action.payload.data.selections;
                    if (isTTSelection(selection)) {
                        const attributes = importInitialTTData(
                            action.payload.textTypes,
                            selection,
                            selection
                        );
                        this.changeState(state => {
                            state.attributes = attributes;
                            state.bibIdAttr = action.payload.data.bibIdAttr;
                            state.bibLabelAttr = action.payload.data.bibLabelAttr;
                            state.attributeWidgets = pipe(
                                attributes,
                                List.map(item => tuple(item.name, {widget: item.widget, active: false})),
                                Dict.fromEntries(),
                            );
                            state.autoCompleteSupport = action.payload.liveAttrsEnabled;
                            state.selectionHistory = [attributes];
                            state.minimizedBoxes = pipe(
                                attributes,
                                List.map(v => tuple(v.name, false)),
                                Dict.fromEntries()
                            );
                        });
                    }
                }
            }
        );

        this.addActionHandler(
            GeneralSubcmixerActions.ShowWidget,
            action => {
                this.dispatchSideEffect<typeof GeneralSubcmixerActions.TextTypesSubcmixerReady>({
                    name: GeneralSubcmixerActions.TextTypesSubcmixerReady.name,
                    payload: {
                        attributes: [...this.state.attributes]
                    }
                });
            }
        )
    }

    private serialize(
        state:TextTypesModelState,
        newCorpora:Array<string>,
        newPrimaryCorpus:string|undefined
    ):TextTypesModelStatePreserve {
        return {
            attributes: state.attributes
        };
    }

    private deserialize(
        state:TextTypesModelState,
        data:TextTypesModelStatePreserve,
        corpora:Array<[string, string]>
    ):void {
        if (corpora.length > 1 && corpora[0][0] === corpora[0][1]) { // main corp. is the same
            state.attributes = data.attributes;
            state.hasSelectedItems = TextTypesModel.findHasSelectedItems(state.attributes);
        }
    }

    private snapshotState(state:TextTypesModelState):void {
        state.selectionHistory.push(pipe(
            state.attributes,
            List.map(attr => TTSelOps.mapValues(attr, v => ({...v})))
        ));
    }

    enableAutoCompleteSupport():void {
        this.changeState(state => {
            state.autoCompleteSupport = true;
        });
    }

    applyCheckedItems(checkedItems:TextTypes.ExportedSelection,
            bibMapping:TextTypes.BibMapping):boolean {
        this.changeState(state => {
            pipe(
                checkedItems,
                Dict.forEach((checkedOfAttr, k) => {
                    const exclude = k[0] === '!';
                    if (exclude) {
                        k = k.slice(1);
                    }
                    const checkedOfAttrNorm = Array.isArray(checkedOfAttr) ?
                             checkedOfAttr : [checkedOfAttr];
                    const attrIdx = state.attributes.findIndex(
                        v => k === state.bibIdAttr ?
                            v.name === state.bibLabelAttr : v.name === k);
                    if (attrIdx === -1) {
                        console.warn(`Cannot apply checked value for ${k}`);
                        return;
                    }
                    let attr = state.attributes[attrIdx];
                    attr.excludeSelection = exclude;
                    // now we must distinguish 4 cases:
                    // [structattr box is configured as bibliography list] x
                    // [structattr box is a list of items or a text input box]
                    if (attr.name === state.bibLabelAttr) {
                        if (attr.type === 'text') {
                            List.forEach(
                                checkedVal => {
                                    const extractedVal = typeof checkedVal === 'string' ?
                                        checkedVal :
                                        checkedVal.regexp;
                                    attr = TTSelOps.addValue(
                                        attr,
                                        {
                                            ident: extractedVal,
                                            value: extractedVal in bibMapping ?
                                                bibMapping[extractedVal] : extractedVal,
                                            selected: true,
                                            locked: false,
                                            numGrouped: 0
                                        }
                                    );
                                },
                                checkedOfAttrNorm
                            );
                            state.attributes[attrIdx] = attr;

                        } else {
                            state.attributes[attrIdx] =
                                TTSelOps.mapValues(
                                    attr,
                                    item => ({
                                        ...item,
                                        value: item.ident in bibMapping ?
                                            bibMapping[item.ident] : item.value,
                                        selected: textTypeSelectionEquals(checkedOfAttr, item.value),
                                        locked: false
                                    })
                                );
                        }

                    } else {
                        if (attr.type === 'text') {
                            List.forEach(
                                checkedVal => {
                                    attr = TTSelOps.addValue(
                                        attr,
                                        {
                                            ident: extractTTSelectionValue(checkedVal),
                                            value: extractTTSelectionValue(checkedVal),
                                            selected: true,
                                            locked: false,
                                            numGrouped: 0
                                        }
                                    );
                                },
                                checkedOfAttrNorm
                            );
                            state.attributes[attrIdx] = attr;

                        } else if (attr.type === 'regexp') {
                            state.attributes[attrIdx] = {
                                ...attr,
                                textFieldValue: extractTTSelectionValue(checkedOfAttrNorm[0]),
                                textFieldDecoded: Strings.shortenText(
                                    extractTTSelectionValue(checkedOfAttrNorm[0]), 50, '\u2026')
                            };

                        } else {
                            state.attributes[attrIdx] = TTSelOps.mapValues(
                                attr,
                                item => ({
                                    ...item,
                                    selected: textTypeSelectionEquals(checkedOfAttr, item.value),
                                    locked: false
                                })
                            );
                        }
                    }
                }
            ));
            state.hasSelectedItems = TextTypesModel.findHasSelectedItems(state.attributes);
        });
        return this.state.hasSelectedItems;
    }

    getRegistrationId():string {
        return 'text-types-model';
    }

    private clearExtendedInfo(state:TextTypesModelState, attrName:string, ident:string):void {
        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            const attr = state.attributes[attrIdx];
            const newAttr = TTSelOps.setExtendedInfo(attr, ident, null);
            state.attributes[attrIdx] = newAttr;

        } else {
            throw new Error('Attribute not found: ' + attrName);
        }
    }

    private resetAutoComplete(state:TextTypesModelState, attrName:string):void {
        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.resetAutoComplete(state.attributes[attrIdx]);
        }
    }

    private handleAttrTextInputChange(
        state:TextTypesModelState,
        attrName:string,
        value:string,
        decodedValue?:string
    ) {

        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.setTextFieldValue(
                state.attributes[attrIdx], value, decodedValue);
            state.hasSelectedItems = TextTypesModel.findHasSelectedItems(state.attributes);
        }
    }

    private setTextInputAttrValue(
        state:TextTypesModelState,
        attrName:string,
        ident:string,
        label:string,
        append:boolean
    ):void {
        const attrIdx = this.getAttributeIdx(state, attrName);
        const newVal:TextTypes.AttributeValue = {
            ident,
            value: label,
            selected: true,
            locked: false,
            numGrouped: 1
        };
        state.attributes[attrIdx] = append ?
            TTSelOps.addValue(state.attributes[attrIdx], newVal) :
            TTSelOps.addValue(TTSelOps.clearValues(state.attributes[attrIdx]), newVal);
    }

    syncFrom(src:Observable<QueryFormArgs>):Observable<QueryFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    this.applyCheckedItems(data.selected_text_types, data.bib_mapping);
                }
            )
        );
    }

    private changeValueSelection(state:TextTypesModelState, attrIdent:string, itemIdx:number):void {
        const attrIdx = this.getAttributeIdx(state, attrIdent);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.toggleValueSelection(state.attributes[attrIdx], itemIdx);

        } else {
            throw new Error('no such attribute value: ' + attrIdent);
        }
        state.hasSelectedItems = TextTypesModel.findHasSelectedItems(state.attributes);

    }

    // TODO move notify... out of the method
    private applyRange(
        state:TextTypesModelState,
        attrName:string,
        fromVal:number,
        toVal: number,
        strictInterval:boolean,
        keepCurrent:boolean
    ):void {
        this._applyRange(state, attrName, fromVal, toVal, strictInterval, keepCurrent)
            .subscribe({
                next: (newSelection:TextTypes.AnyTTSelection) => {
                    this.emitChange();
                },
                error: error => {
                    this.pluginApi.showMessage('error', error);
                }
            });
    }

    private applySelectAll(state:TextTypesModelState, ident:string) {
        const attrIdx = this.getAttributeIdx(state, ident);
        const item = state.attributes[attrIdx];
        if (TTSelOps.containsFullList(item)) {
            state.selectAll[ident] = !state.selectAll[ident];
            const newVal = state.selectAll[ident];
            state.attributes[attrIdx] = TTSelOps.mapValues(
                item,
                item => ({
                    ...item,
                    selected: newVal,
                })
            );
            state.hasSelectedItems = TextTypesModel.findHasSelectedItems(state.attributes);
        }
    }

    canUndoState():boolean {
        return this.state.selectionHistory.length > 1;
    }

    private reset(state:TextTypesModelState):void {
        state.attributes = List.head(state.selectionHistory);
        state.selectionHistory = [List.head(state.selectionHistory)];
        state.selectAll = Dict.map(_ => false, state.selectAll);
        state.hasSelectedItems = false;
    }

    private getAttribute(state:TextTypesModelState, ident:string):TextTypes.AnyTTSelection {
        return state.attributes.find((val) => val.name === ident);
    }

    private getAttributeIdx(state:TextTypesModelState, ident:string):number {
        return List.findIndex(val => val.name === ident, state.attributes);
    }

    replaceAttribute(
        state:TextTypesModelState,
        ident:string,
        val:TextTypes.AnyTTSelection
    ):void {
        const attrIdx = this.getAttributeIdx(state, ident);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = val;

        } else {
            throw new Error('Failed to find attribute ' + ident);
        }
    }

    static exportSelections(
        attributes:Array<TextTypes.AnyTTSelection>,
        bibIdAttr:string,
        bibLabelAttr: string,
        lockedOnesOnly:boolean,
        includeSubcorpDefinition:boolean,
    ):TextTypes.ExportedSelection {
        const ans = {};
        List.forEach(
            (attrSel:TextTypes.AnyTTSelection) => {
                const trueAttr = attrSel.name !== bibLabelAttr ?
                        attrSel.name : bibIdAttr;
                if (TTSelOps.hasUserChanges(attrSel, includeSubcorpDefinition)) {
                    ans[attrSel.excludeSelection ? `!${trueAttr}` : trueAttr] = TTSelOps.exportSelections(attrSel, lockedOnesOnly, includeSubcorpDefinition);
                }
            },
            attributes
        );
        return ans;
    }

    private filterWholeSelection(state:TextTypesModelState, filterData:SelectionFilterMap) {
        Dict.forEach(
            (block, k) => {
                this.attachItemList(state, k, block.map(v => v.ident));
                this.mapItems(
                    state,
                    k,
                    (attrVal, _) => {
                        // we can't use index _, order might not be the same
                        const b = List.find(v => v.ident === attrVal.ident, block);
                        if (b) {
                            return {
                                ident: b.ident,
                                value: b.v,
                                selected: attrVal.selected,
                                locked: attrVal.locked,
                                numGrouped: b.numGrouped,
                                availItems: b.availItems,
                                extendedInfo: attrVal.extendedInfo,
                            };

                        } else {
                            // this handles excluded items
                            return {
                                ...attrVal,
                                availItems: 0,
                            }
                        }
                    }
                );
                this.filter(state, k, item => item !== null);
            },
            filterData
        );
    }

    /**
     * Remove values of attribute 'attrName' if they're not present in 'items'.
     */
    private attachItemList(state:TextTypesModelState, attrName:string, items:Array<string>):void {
        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.attachItemList(state.attributes[attrIdx], items);
        }
    }

    filter(
        state:TextTypesModelState,
        attrName:string,
        fn:(v:TextTypes.AttributeValue)=>boolean
    ):void {
        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.filter(state.attributes[attrIdx], fn);
        }
    }

    private mapItems(
        state:TextTypesModelState,
        attrName:string,
        mapFn:(v:TextTypes.AttributeValue, i?:number)=>TextTypes.AttributeValue
    ):void {

        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            // in case of raw text input (produced initially due to large num of items)
            // we have to transform the selection into a 'full' one as mapItems is called
            // iff there are all the avail. items fetched from server.
            const srchAttr = state.attributes[attrIdx];
            const srcAttr:TextTypes.AnyTTSelection = srchAttr.type === 'text' ?
                {
                    attrInfo: srchAttr.attrInfo,
                    isInterval: false,
                    widget: null,
                    isNumeric: false,
                    label: srchAttr.label,
                    name: srchAttr.name,
                    values: [...srchAttr.values],
                    definesSubcorpus: srchAttr.definesSubcorpus,
                    excludeSelection: srchAttr.excludeSelection,
                    type: 'full',
                    metaInfo: null,
                } :
                state.attributes[attrIdx];

            state.attributes[attrIdx] = TTSelOps.mapValues(srcAttr, mapFn);
        }
    }

    private setValues(state:TextTypesModelState, attrName:string, values:Array<string>):void {
        const attrIdx = this.getAttributeIdx(state, attrName);
        const values2:Array<TextTypes.AttributeValue> = values.map((item:string) => ({
            ident: item, // TODO what about bib items?
            value: item,
            selected: false,
            locked: false,
            numGrouped: 1 // TODO is it always OK here?
        }));
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.setValues(state.attributes[attrIdx], values2);

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    /**
     * This applies only for TextInputAttributeSelection boxes. In other
     * cases the function has no effect.
     */
    setAutoComplete(
        state:TextTypesModelState,
        attrName:string,
        values:Array<TextTypes.AutoCompleteItem>
    ):void {
        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.setAutoComplete(state.attributes[attrIdx], values);
        }
    }

    static findHasSelectedItems(attributes:Array<TextTypes.AnyTTSelection>, attrName?:string):boolean {
        if (attrName !== undefined) {
            const attr = List.find((val) => val.name === attrName, attributes);
            if (attr) {
                return TTSelOps.hasUserChanges(attr, false);

            } else {
                throw new Error('Failed to find attribute ' + attrName);
            }

        } else {
            return List.some(item => TTSelOps.hasUserChanges(item, false), attributes);
        }
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

    private checkIntervalRange(
        state:TextTypesModelState,
        attribName:string,
        fromVal:number,
        toVal:number,
        strictMode:boolean,
        keepCurrent:boolean
    ):void {

        function isEmpty(v) {
            return isNaN(v) || v === null || v === undefined;
        }

        if (isEmpty(fromVal) && isEmpty(toVal)) {
            throw new Error(this.pluginApi.translate('ucnkLA__at_least_one_required'));
        }

        this.mapItems(state, attribName, (item:TextTypes.AttributeValue) => {
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

    private isEmptyAttr(state:TextTypesModelState, attrName:string):boolean {
        return !TTSelOps.containsFullList(this.getAttribute(state, attrName));
    }

    private loadAndReplaceRawInput(
        state:TextTypesModelState,
        attribName:string,
        from:number,
        to:number
    ):Observable<Kontext.GeneralProps> {
        let args:{[key:string]:any} = {};
        args[attribName] = {from, to};
        return this.loadData(args).pipe(
            // TODO data type relies on liveattrs specific returned data
            tap((data:{attr_values:{[key:string]:any}}) => {
                this.setValues(state, attribName,
                        data.attr_values[attribName].map(item=>item[0]));
            }),
            map((data) => data.attr_values)
        );
    }

    /**
     * @param attribArgs Custom attributes overwriting the implicit ones plug-in collects itself
     * @param alignedCorpnames Optional list of aligned corpora
     */
    private loadData(
        attribArgs:{[key:string]:any},
        alignedCorpnames?:Array<string>
    ):Observable<any> { // TODO type
        const requestURL:string = this.pluginApi.createActionUrl('filter_attributes');
        const args = {corpname: this.pluginApi.getCorpusIdent().id};

        if (alignedCorpnames !== undefined) {
            args['aligned'] = JSON.stringify(alignedCorpnames);
        }

        const attrs = TextTypesModel.exportSelections(
            this.state.attributes,
            this.state.bibIdAttr,
            this.state.bibLabelAttr,
            false,
            true,
        );
        for (let p in attribArgs) {
            attrs[p] = attribArgs[p];
        }
        args['attrs'] = JSON.stringify(attrs);

        return this.pluginApi.ajax$(
            HTTP.Method.GET,
            requestURL,
            args
        );
    }

    private _applyRange(
        state:TextTypesModelState,
        attrName:string,
        fromVal:number,
        toVal:number,
        strictInterval:boolean,
        keepCurrent:boolean
    ):Observable<TextTypes.AnyTTSelection> {

        if (isNaN(fromVal) && isNaN(toVal)) {
            this.pluginApi.showMessage('warning',
                    this.pluginApi.translate('ucnkLA__at_least_one_required'));
            return rxOf(this.getAttribute(state, attrName));

        } else {
            return (this.isEmptyAttr(state, attrName) ?
                this.loadAndReplaceRawInput(state, attrName, fromVal, toVal) :
                rxOf(null)
            ).pipe(
                map(() => this.getAttribute(state, attrName)),
                tap(() => {
                    this.checkIntervalRange(
                        state, attrName, fromVal, toVal, strictInterval, keepCurrent);
                }),
                map(currSelection => tuple(currSelection, this.getAttribute(state, attrName))),
                tap(([currSelection, updatedSelection]) => {
                    if (TTSelOps.getNumOfSelectedItems(currSelection) ===
                            TTSelOps.getNumOfSelectedItems(updatedSelection)) {
                        this.pluginApi.showMessage(
                            'warning',
                            this.pluginApi.translate('ucnkLA__nothing_selected')
                        );

                    } else {
                        state.attributeWidgets[attrName].active = false;
                    }
                }),
                map(([,updatedSelection]) => updatedSelection)
            );
        }
    }

    private getAttributesWithSelectedItems(state:TextTypesModelState, includeLocked:boolean):Array<string> {
        return pipe(
            state.attributes,
            List.filter(
                (item:TextTypes.AnyTTSelection) => TTSelOps.hasUserChanges(item, false) &&
                    (!TTSelOps.isLocked(item) || includeLocked)
            ),
            List.map((item:TextTypes.AnyTTSelection)=>item.name)
        );
    }

    private setExtendedInfo(
        state:TextTypesModelState,
        attrName:string,
        ident:string,
        data:TextTypes.ExtendedInfo
    ):void {

        const attrIdx = this.getAttributeIdx(state, attrName);
        if (attrIdx > -1) {
            state.attributes[attrIdx] = TTSelOps.setExtendedInfo(state.attributes[attrIdx], ident, data);

        } else {
            throw new Error('Failed to find attribute ' + attrName);
        }
    }

    private clearInitialSizes(
        state:TextTypesModelState
    ):void {
        List.forEach(
            attr => {
                if (attr.type === 'full') {
                    List.forEach(
                        item => {
                            item.availItems = -1;
                        },
                        attr.values
                    )
                }
            },
            state.attributes
        );
    }

    private updateInitialSizes(
        state:TextTypesModelState,
        newValues:TextTypes.ValueDomainsSizes

    ):void {
        const nwLookup = pipe(
            newValues,
            Dict.map(v => {
                if (Array.isArray(v)) {
                    return pipe(
                        v,
                        List.map(
                            ([,ident,,,size]) => tuple(ident, size)
                        ),
                        Dict.fromEntries()
                    );

                } else {
                    return v.length;
                }
            })
        );
        List.forEach(
            attr => {
                if (attr.type === 'full') {
                    const sizes = nwLookup[attr.name];
                    List.forEach(
                        item => {
                            if (typeof sizes === 'object') {
                                item.availItems = sizes[item.ident] || 0;

                            } else {
                                item.availItems = 0;
                            }
                        },
                        attr.values
                    )
                }
            },
            state.attributes
        );
    }

    private setAllAttributesBusy(state:TextTypesModelState, val:boolean):void {
        state.busyAttributes = pipe(
            state.attributes,
            List.map(v => tuple(v.name, val)),
            Dict.fromEntries()
        );
    }

    private getSelectedValues(
        state:TextTypesModelState,
        unlockedOnly:boolean
    ):Array<[string, string]> {
        return pipe(
            state.attributes,
            List.flatMap(attr => {
                if (attr.type === 'regexp' && !attr.isLocked && attr.textFieldValue) {
                    return [tuple(attr.name, attr.textFieldValue)];

                } else if (attr.type === 'full' || attr.type === 'text') {
                    if (!List.some(v => v.locked, attr.values) || !unlockedOnly) {
                        return pipe(
                            attr.values,
                            List.filter(val => val.selected),
                            List.map(val => tuple(attr.name, val.value))
                        );
                    }
                }
                return [];
            })
        );
    }
}