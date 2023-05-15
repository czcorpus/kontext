/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IActionDispatcher, StatelessModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { pipe, Dict, List, HTTP, tuple, Maths } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { validateSubcProps } from '../../models/subcorp/new';
import { Actions } from './actions';
import {
    SubcMixerExpression, CalculationResults, CalculationResponse,
    TextTypeAttrVal } from './common';
import { Actions as TTActions } from '../../models/textTypes/actions';
import { Actions as SubcActions } from '../../models/subcorp/actions';
import { Actions as GeneralSubcmixerActions } from '../../types/plugins/subcMixer';
import { TTSelOps } from '../../models/textTypes/selectionOps';
import { BaseSubcorpFormState } from '../../models/subcorp/common';
import { IPluginApi } from '../../types/plugins/common';


export interface SubcMixerModelState extends BaseSubcorpFormState {
    shares:Array<SubcMixerExpression>;
    currentResult:CalculationResults|null;
    corpusIdAttr:string;
    alignedCorpora:Array<string>;
    ratioLimit:number;
    isBusy:boolean;
    isVisible:boolean;
    subcIsPublic:boolean;
    numOfErrors:number;
    ttAttributes:Array<TextTypes.AnyTTSelection>; // basically a copy of text type model attributes
    ttInitialAvailableValues:Array<TextTypes.AnyTTSelection>;
    liveattrsSelections:TextTypes.ExportedSelection;
}

/**
 *
 */
export class SubcMixerModel extends StatelessModel<SubcMixerModelState> {

    static DispatchToken:string;

    private readonly pluginApi:IPluginApi;

    constructor(
        dispatcher:IActionDispatcher,
        pluginApi:IPluginApi,
        initialState:SubcMixerModelState
    ) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;

        this.addActionHandler(
            TTActions.SelectionChanged,
            (state, action) => {
                state.ttAttributes = action.payload.attributes;
            }
        );

        this.addActionHandler(
            SubcActions.FormSetSubcName,
            (state, action) => {
                state.subcname = Kontext.updateFormValue(
                    state.subcname,
                    {
                        value: action.payload.value
                    }
                );
            }
        );

        this.addActionHandler(
            SubcActions.FormSetDescription,
            (state, action) => {
                state.description = Kontext.updateFormValue(
                    state.description,
                    {
                        value: action.payload.value
                    }
                );
            }
        );

        this.addActionHandler(
            TTActions.FilterWholeSelection,
            (state, action) => {
                const newSelections:TextTypes.ExportedSelection = action.payload.selectedTypes;
                state.liveattrsSelections = {
                    ...state.liveattrsSelections,
                    ...newSelections,
                };
            }
        );

        this.addActionHandler(
            GeneralSubcmixerActions.ShowWidgetDone,
            (state, action) => {
                if (!action.error) {
                    state.isVisible = true;
                    state.ttAttributes = action.payload.attributes;
                    this.refreshData(state);
                }
            },
            (state, action, dispatch) => {
                if (action.error) {
                    this.pluginApi.showMessage(
                        'error',
                        action.error
                    )
                }
            }
        );

        this.addActionHandler(
            GeneralSubcmixerActions.ShowWidget,
            null,
            (state, action, dispatch) => {
                this.waitForActionWithTimeout(
                    500,
                    {},
                    (sAction, syncData) => {
                        if (GeneralSubcmixerActions.isTextTypesSubcmixerReady(sAction)) {
                            return null;
                        }
                        return syncData;
                    }
                ).subscribe({
                    next: data => {
                        if (GeneralSubcmixerActions.isTextTypesSubcmixerReady(data)) {
                            dispatch(
                                GeneralSubcmixerActions.ShowWidgetDone,
                                {...data.payload}
                            )
                        }
                    },
                    error: error => {
                        dispatch(
                            GeneralSubcmixerActions.ShowWidgetDone,
                            error
                        )
                    }
                })
            }
        );

        this.addActionHandler(
            GeneralSubcmixerActions.HideWidget,
            (state, action) => {
                state.isVisible = false;
                state.currentResult = null;
            }
        );

        this.addActionHandler(
            Actions.SetRatio,
            (state, action) => {
                this.updateRatio(
                    state,
                    action.payload.attrName,
                    action.payload.attrValue,
                    Kontext.newFormValue(action.payload.ratio, true)
                );
            },
            (state, action, dispatch) => {
                const err = this.validateRatio(action.payload.ratio);
                if (err !== null) {
                    this.pluginApi.showMessage('error', err);
                    dispatch<typeof Actions.SetRatioValidate>({
                        name: Actions.SetRatioValidate.name,
                        payload: {
                            attrName: action.payload.attrName,
                            attrValue: action.payload.attrValue,
                            isInvalid: true
                        }
                    });
                }
            }
        );

        this.addActionHandler(
            Actions.SetRatioValidate,
            (state, action) => {
                const val = this.getRatio(state, action.payload.attrName, action.payload.attrValue);
                if (val) {
                    this.updateRatio(
                        state,
                        action.payload.attrName,
                        action.payload.attrValue,
                        Kontext.updateFormValue(val, {isInvalid: action.payload.isInvalid})
                    );
                }
            }
        );

        this.addActionHandler(
            Actions.ClearResult,
            (state, action) => {
                state.currentResult = null;
            }
        )

        this.addActionHandler(
            Actions.SubmitTask,
            (state, action) => {
                state.isBusy = true;
                state.numOfErrors = 0;
            },
            (state, action, dispatch) => {
                this.submitTask(state).subscribe({
                    next: data => {
                        if (!data.attrs || !data.ids) {
                            const [msgType, msgText] = data.messages[0] || ['error', 'global__unknown_error'];
                            this.pluginApi.showMessage(msgType, this.pluginApi.translate(msgText));
                            const error = new Error(msgText);
                            dispatch<typeof Actions.SubmitTaskDone>({
                                name: Actions.SubmitTaskDone.name,
                                error
                            });
                            this.pluginApi.showMessage('error', error);

                        } else {
                            dispatch<typeof Actions.SubmitTaskDone>({
                                name: Actions.SubmitTaskDone.name,
                                payload: {
                                    result: {
                                        attrs: this.importResults(state.shares, state.ratioLimit, data.attrs),
                                        total: data.total,
                                        ids: Array<string>(data.ids),
                                        structs: Array<string>(data.structs)
                                    }
                                }
                            });
                        }
                    },
                    error: err => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<typeof Actions.SubmitTaskDone>({
                            name: Actions.SubmitTaskDone.name,
                            error: err
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.SubmitTaskDone,
            (state, action) => {
                state.isBusy = false;
                if (!action.error) {
                    state.currentResult = action.payload.result;
                    if (state.currentResult) {
                        state.numOfErrors = List.foldl(
                            (prev, curr) => prev + (!curr[2] ? 1 : 0), 0,
                            state.currentResult.attrs
                        );
                    }
                }
            }
        );

        this.addActionHandler(
            Actions.SubmitCreateSubcorpus,
            (state, action) => {
                state.isBusy = true;
                validateSubcProps(
                    state,
                    true,
                    state.ttAttributes.some(item => TTSelOps.hasUserChanges(item, false)),
                    this.pluginApi
                );
            },
            (state, action, dispatch) => {
                this.submitCreateSubcorpus(state).subscribe({
                    next: resp => {
                        window.location.href = this.pluginApi.createActionUrl('subcorpus/list');
                        dispatch<typeof Actions.CreateSubcorpusDone>({
                            name: Actions.CreateSubcorpusDone.name
                        });
                    },
                    error: err => {
                        this.pluginApi.showMessage('error', err);
                        dispatch<typeof Actions.CreateSubcorpusDone>({
                            name: Actions.CreateSubcorpusDone.name,
                            error: err
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.CreateSubcorpusDone,
            (state, action) => {
                state.isBusy = false;
            },
            (state, action, dispatch) => {
                if (!action.error) {
                    // we leave the app here
                    window.location.href = this.pluginApi.createActionUrl('subcorpus/list');
                }
            }
        );
    }

    /**
     * Parse attr value expression strings like
     * "doc.txtype == 'LEI: journalism'"
     * into elements: ['doc.txtype', 'LEI: journalism']
     *
     */
    private parseServerExpression(ex:string):[string, string]|[null, null] {
        const srch = /^([\w_.]+)\s+==\s+'([^']+)'/.exec(ex);
        if (srch) {
            return tuple(srch[1], srch[2]);
        }
        return tuple(null, null);
    }

    private importResults(
        shares:Array<SubcMixerExpression>,
        sizeErrorRatio:number,
        data:Array<[string, number]>
    ):Array<[string, number, boolean]> {

        const evalDist = (v, idx) => {
            const userRatio = parseFloat(shares[idx].ratio.value) / 100;
            return Math.abs(v - userRatio) < sizeErrorRatio;
        };
        // We must first merge the tree-copied conditions back to
        // single ones. Here we assume that the conditions are split
        // in a way ensuring the sum of ratios for each key is actually 100%.
        let tmp:Array<[string, number]> = [];
        List.forEach(
            ([key, value]) => {
                const srchIdx = List.findIndex(([v,]) => v === key, tmp);
                if (srchIdx > -1) {
                    tmp[srchIdx] = tuple(key, tmp[srchIdx][1] + value);

                } else {
                    tmp.push(tuple(key, value));
                }
            },
            data
        );
        const mappedData:Array<[string, number, boolean]> = pipe(
            tmp,
            List.map(
                (item:[string, number]) => {
                    const [attrName, attrValue] = this.parseServerExpression(item[0]);
                    return {
                        data: item,
                        sharesIdx: List.findIndex(
                            x => x.attrName === attrName && x.attrValue === attrValue && !x.zeroFixed,
                            shares
                        )
                    };
                }
            ),
            List.filter(x => x.sharesIdx > - 1 && !shares[x.sharesIdx].zeroFixed),
            List.map((item, _) => tuple(
                item.data[0],
                item.data[1] * 100,
                evalDist(item.data[1], item.sharesIdx)
            ))
        );
        return mappedData;
    }

    private submitCreateSubcorpus(state:SubcMixerModelState):Observable<Kontext.AjaxResponse & {status: boolean}> {
        return this.pluginApi.ajax$<Kontext.AjaxResponse & {status: boolean}>(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl('subcorpus/subcmixer_create_subcorpus'),
            {
                corpname: this.pluginApi.getCorpusIdent().id,
                subcname: state.subcname.value,
                publish: state.subcIsPublic,
                description: state.description.value,
                idAttr: state.corpusIdAttr,
                ids: state.currentResult.ids.join(','),
                structs: state.currentResult.structs.join(',')
            }
        );
    }

    private submitTask(state:SubcMixerModelState):Observable<any> {
        const sums = pipe(
            state.shares,
            List.groupBy(v => v.attrName),
            List.map(
                ([key, items]) => tuple(
                    key,
                    List.foldl(
                        (acc, x) => acc + parseFloat(x.ratio.value || '0'),
                        0,
                        items
                    )
                )
            ),
            Dict.fromEntries()
        );
        for (let k in sums) {
            if (Maths.roundToPos(sums[k], 1) !== 100) {
                return throwError(() => new Error(this.pluginApi.translate(
                    'subcmixer__ratios_cannot_over_100_{struct_name}{over_val}',
                    {struct_name: k, over_val: this.pluginApi.formatNumber(sums[k] - 100)})));
            }
        }
        const args = {};
        args['corpname'] = this.pluginApi.getCorpusIdent().id;
        args['aligned_corpora'] = state.alignedCorpora;
        args['expression'] = JSON.stringify(
            state.shares.map(item => ({
                attrName: item.attrName,
                attrValue: item.attrValue,
                ratio: item.ratio ? parseFloat(item.ratio.value) : null
            }))
        );
        return this.pluginApi.ajax$<CalculationResponse>(
            HTTP.Method.POST,
            this.pluginApi.createActionUrl('subcorpus/subcmixer_run_calc'),
            args
        );
    }

    private getTtAttribute(state:SubcMixerModelState, ident:string):TextTypes.AnyTTSelection {
        return state.ttAttributes.find((val) => val.name === ident);
    }

    private getAvailableValues(state:SubcMixerModelState):Array<TextTypeAttrVal> {

        const getInitialAvailableValues = (attrName:string):Array<TextTypes.AttributeValue> => {
            const srchItem = List.find(
                item => item.name === attrName,
                state.ttInitialAvailableValues
            );
            return srchItem ?
                List.map(item => item, TTSelOps.getValues(srchItem)) : [];
        };

        return pipe(
            state.ttAttributes,
            List.filter(item => TTSelOps.hasUserChanges(item, true)),
            x => [List.last(x)], // we take only the last attr. in refining sequence as the subcmixer cannot handle more
            List.flatMap(item => {
                const attr = this.getTtAttribute(state, item.name);
                const tmp = pipe(
                    TTSelOps.getValues(item),
                    List.filter(item => item.selected),
                    List.map(item => item.value)
                );
                return List.map(
                    subItem => ({
                        attrName: item.name,
                        attrValue: subItem,
                        isSelected: true
                    }),
                    tmp
                );
            })
        );
    }

    private validateRatio(ratio:string):Error|null {
        if (/^(\d*\.\d+|\d+)$/.exec(ratio)) {
            return null;
        }
        return new Error(this.pluginApi.translate('subcmixer__invalid_value'));
    }

    private getRatio(state:SubcMixerModelState, attrName:string, attrValue:string):Kontext.FormValue<string>|undefined {
        const srch = state.shares.find(item => item.attrName === attrName && item.attrValue === attrValue && item.zeroFixed === false);
        return srch ? srch.ratio : undefined;
    }

    private updateRatio(state:SubcMixerModelState, attrName:string, attrValue:string, ratio:Kontext.FormValue<string>):void {
        const idx = state.shares.findIndex(item => item.attrName === attrName
                && item.attrValue === attrValue && item.zeroFixed === false);
        if (idx > -1) {
            const curr = state.shares[idx];
            state.shares[idx] = {
                ...curr,
                ratio: ratio
            };
        }
    }

    getShares(state:SubcMixerModelState):Array<SubcMixerExpression> {
        return state.shares.filter(item => item.zeroFixed === false);
    }

    /**
     * Return the total number of tokens in
     * texts matching all the attribute values
     * belonging to the provided attrName.
     *
     * Please note that individual sizes
     * (and thus the total size) may change
     * during the existence of the object
     * (e.g. by interactive text type selection).
     */
    getTtAttrSize(state:SubcMixerModelState, attrName:string):number {
        const item = state.ttAttributes.find(item => item.name === attrName);
        if (item) {
            return List.foldl(
                (prev, curr) => prev + curr.availItems,
                0,
                TTSelOps.getValues(item)
            );
        }
        return -1;
    }

    /**
     * Avoids splitting to problematic values like 1/3, 1/6 etc.
     * by modifying the last element.
     */
    safeCalcInitialRatio(numItems:number, currIdx:number):number {
        const r = Maths.roundToPos(100 / numItems, 1);
        let sum = pipe(
            List.repeat(_ => r, numItems - 1),
            List.foldl((acc, curr) => acc + curr, 0)
        );
        return currIdx < numItems - 1 ? r : 100 - sum;
    }

    private refreshData(state:SubcMixerModelState):void {
        const availableValues = this.getAvailableValues(state);
        const numValsPerGroup = pipe(
            availableValues,
            List.filter(item => item.isSelected),
            List.foldl(
                (prev, curr) => {
                    if (!Dict.hasKey(curr.attrName, prev)) {
                        prev[curr.attrName] = 0;
                    }
                    prev[curr.attrName] += 1;
                    return prev;
                },
                {} as {[key:string]:number}
            )
        );
        state.shares = pipe(
            availableValues,
            List.filter(item => item.isSelected),
            List.map((item, i) => {
                const srch = List.find(
                    val => val.name === item.attrName,
                    state.ttAttributes
                );

                if (srch) {
                    const attrVal = List.find(
                        item2 => item2.value == item.attrValue,
                        TTSelOps.getValues(srch)
                    );
                    const total = this.getTtAttrSize(state, item.attrName);
                    return {
                        ...item,
                        ratio: Kontext.newFormValue(
                            item.isSelected ? this.safeCalcInitialRatio(numValsPerGroup[item.attrName], i).toFixed(1) : '0',
                            true
                        ),
                        baseRatio: attrVal ? (attrVal.availItems / total * 100).toFixed(1) : '?',
                        zeroFixed: !item.isSelected
                    };
                }
                return null;
            }),
            List.filter(v => v !== null)
        );
    }
}
