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

import { Kontext, TextTypes } from '../../types/common';
import { IPluginApi } from '../../types/plugins';
import * as Immutable from 'immutable';
import { IActionDispatcher, Action, StatelessModel, SEDispatcher } from 'kombo';
import { Observable, throwError as rxThrowError } from 'rxjs';
import { validateSubcProps } from '../../models/subcorp/form';

export interface SubcMixerExpression {
    attrName:string;
    attrValue:string;
    ratio:string;
    baseRatio:string; // a ratio in the original corpus
    zeroFixed:boolean;
}

export interface CalculationResults {
    attrs:Immutable.List<[string, number, boolean]>;
    total:number;
    ids:Immutable.List<string>;
    structs:Immutable.List<string>;
}

export interface CalculationResponse extends Kontext.AjaxResponse {
    attrs?:Array<[string,number]>;
    total:number;
    ids?:Array<string>;
    structs:Array<string>;
}

export interface TextTypeAttrVal {
    attrName:string;
    attrValue:string;
    isSelected:boolean;
}

export interface SubcMixerModelState {
    currentSubcname:Kontext.FormValue<string>;
    shares:Immutable.List<SubcMixerExpression>;
    currentResult:CalculationResults|null;
    corpusIdAttr:string;
    alignedCorpora:Immutable.List<string>;
    ratioLimit:number;
    isBusy:boolean;
    isVisible:boolean;
    subcIsPublic:boolean;
    subcDescription:Kontext.FormValue<string>;
    numOfErrors:number;
    ttAttributes:Immutable.List<TextTypes.AttributeSelection>; // basically a copy of text type model attributes
    ttInitialAvailableValues:Immutable.List<TextTypes.AttributeSelection>;
    liveattrsSelections:Immutable.Map<string, Immutable.List<string>>;
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
            initialState:SubcMixerModelState) {
        super(dispatcher, initialState);
        this.pluginApi = pluginApi;
        this.actionMatch = {
            'QUERY_INPUT_ADD_ALIGNED_CORPUS': (state, action) => {
                const newState = this.copyState(state);
                console.log('add ', action.payload);
                return newState;
            },
            'QUERY_INPUT_REMOVE_ALIGNED_CORPUS': (state, action) => {
                const newState = this.copyState(state);
                console.log('remove ', action.payload);
                return newState;
            },
            'TT_SELECTION_CHANGED': (state, action) => {
                // we have to keep track of tt model selection changes
                const newState = this.copyState(state);
                newState.ttAttributes = action.payload['attributes'];
                return newState;
            },
            'SUBCORP_FORM_SET_SUBCNAME': (state, action) => {
                const newState = this.copyState(state);
                newState.currentSubcname = Kontext.updateFormValue(newState.currentSubcname, {value: action.payload['value']});
                return newState;
            },
            'SUBCORP_FORM_SET_SUBC_AS_PUBLIC': (state, action) => {
                const newState = this.copyState(state);
                newState.subcIsPublic = !!action.payload['value'];
                return newState;
            },
            'SUBCORP_FORM_SET_DESCRIPTION': (state, action) => {
                const newState = this.copyState(state);
                newState.subcDescription = Kontext.updateFormValue(newState.subcDescription, {value: action.payload['value']});
                return newState;
            },
            'LIVE_ATTRIBUTES_REFINE_DONE': (state, action) => {
                const newState = this.copyState(state);
                const newSelections:TextTypes.ServerCheckedValues = action.payload['selectedTypes'];
                Object.keys(newSelections).forEach(attrName => {
                    newState.liveattrsSelections = newState.liveattrsSelections.set(
                        attrName, Immutable.List<string>(newSelections[attrName])
                    );
                });
                return newState;
            },
            'UCNK_SUBCMIXER_SHOW_WIDGET': (state, action) => {
                const newState = this.copyState(state);
                newState.isVisible = true;
                this.refreshData(newState);
                return newState;
            },
            'UCNK_SUBCMIXER_HIDE_WIDGET': (state, action) => {
                const newState = this.copyState(state);
                newState.isVisible = false;
                newState.currentResult = null;
                return newState;
            },
            'UCNK_SUBCMIXER_SET_RATIO': (state, action) => {
                const newState = this.copyState(state);
                try {
                    this.updateRatio(
                        state,
                        action.payload['attrName'],
                        action.payload['attrValue'],
                        action.payload['ratio']
                    );

                } catch (e) {
                    this.pluginApi.showMessage('error', e);
                }
                return newState;
            },
            'UCNK_SUBCMIXER_SUBMIT_TASK': (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = true;
                newState.numOfErrors = 0;
                return newState;
            },
            'UCNK_SUBCMIXER_SUBMIT_TASK_DONE': (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = false;
                if (!action.error) {
                    newState.currentResult = action.payload['result'];
                    if (newState.currentResult) {
                        newState.numOfErrors =  newState.currentResult.attrs.reduce(
                                (prev, curr) => prev + (!curr[2] ? 1 : 0), 0);
                    }
                }
                return newState;
            },
            'UCNK_SUBCMIXER_CREATE_SUBCORPUS': (state, action) => {
                const newState = this.copyState(state);
                newState.isBusy = true;
                return newState;
            },
            'UCNK_SUBCMIXER_CREATE_SUBCORPUS_DONE': (state, action) => {
                console.log('>>> DONE');
                const newState = this.copyState(state);
                newState.isBusy = false;
                if (!action.error) {
                    // we leave the app here
                    window.location.href = this.pluginApi.createActionUrl('subcorpus/subcorp_list');
                }
                return newState;
            }
        };
    }

    sideEffects(state:SubcMixerModelState, action:Action, dispatch:SEDispatcher):void {
        switch (action.name) {
            case 'UCNK_SUBCMIXER_SUBMIT_TASK':
                this.submitTask(state).subscribe(
                    (data) => {
                        if (!data.attrs || !data.ids) {
                            const [msgType, msgText] = data.messages[0] || ['error', 'global__unknown_error'];
                            this.pluginApi.showMessage(msgType, this.pluginApi.translate(msgText));
                            const err = new Error(msgText);
                            dispatch({
                                name: 'UCNK_SUBCMIXER_SUBMIT_TASK_DONE',
                                error: err
                            });
                            this.pluginApi.showMessage('error', err);

                        } else {
                            dispatch({
                                name: 'UCNK_SUBCMIXER_SUBMIT_TASK_DONE',
                                payload: {
                                    result: {
                                        attrs: this.importResults(state.shares, state.ratioLimit, data.attrs),
                                        total: data.total,
                                        ids: Immutable.List<string>(data.ids),
                                        structs: Immutable.List<string>(data.structs)
                                    }
                                }
                            });
                        }
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch({
                            name: 'UCNK_SUBCMIXER_SUBMIT_TASK_DONE',
                            error: err
                        });
                    }
                );
            break;
            case 'UCNK_SUBCMIXER_CREATE_SUBCORPUS':
                this.submitCreateSubcorpus(state).subscribe(
                    (resp) => {
                        window.location.href = this.pluginApi.createActionUrl('subcorpus/subcorp_list');
                        dispatch({
                            name: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS_DONE'
                        });
                    },
                    (err) => {
                        this.pluginApi.showMessage('error', err);
                        dispatch({
                            name: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS_DONE',
                            error: err
                        });
                    }
                );
            break;
        }
    }

    /**
     * Parse attr value expression strings like
     * "doc_txtype == 'LEI: journalism'"
     * into elements: ['doc.txtype', 'LEI: journalism']
     *
     */
    private parseServerExpression(ex:string):[string, string] {
        const srch = /^([\w_]+)\s+==\s+'([^']+)'/.exec(ex);
        if (srch) {
            return [srch[1].replace('_', '.'), srch[2]];
        }
        return [null, null];
    }

    private importResults(shares:Immutable.List<SubcMixerExpression>,
            sizeErrorRatio:number, data:Array<[string, number]>):Immutable.List<[string, number, boolean]> {
        const evalDist = (v, idx) => {
            const userRatio = parseFloat(shares.get(idx).ratio) / 100;
            return Math.abs(v - userRatio) < sizeErrorRatio;
        };
        // We must first merge the tree-copied conditions back to
        // single ones. Here we assume that the conditions are split
        // in a way ensuring the sum of ratios for each key is actually 100%.
        let tmp = Immutable.OrderedMap<string, number>();
        data.forEach(item => {
            if (!tmp.has(item[0])) {
                tmp = tmp.set(item[0], item[1]);

            } else {
                tmp = tmp.set(item[0], tmp.get(item[0]) + item[1]);
            }
        });

        const mappedData:Immutable.List<[string, number, boolean]> =
            tmp.entrySeq()
                .map((item:[string, number]) => {
                    const ans = this.parseServerExpression(item[0]);
                    return {
                        data: item,
                        sharesIdx: shares.findIndex(x => x.attrName === ans[0] && x.attrValue === ans[1] && !x.zeroFixed)
                    };
                })
                .filter(x => x.sharesIdx > - 1 && !shares.get(x.sharesIdx).zeroFixed)
                .map<[string, number, boolean]>((item, _) => [item.data[0], item.data[1] * 100, evalDist(item.data[1], item.sharesIdx)])
                .toList();

        return Immutable.List<[string, number, boolean]>(mappedData);
    }

    private submitCreateSubcorpus(state:SubcMixerModelState):Observable<any> {
        const err = validateSubcProps(
            state.currentSubcname,
            state.subcDescription,
            true,
            state.ttAttributes.some(item => item.hasUserChanges()),
            this.pluginApi
        );

        if (err) {
            return rxThrowError(err);
        }
        const args = {};
        args['corpname'] = this.pluginApi.getCorpusIdent().id;
        args['subcname'] = state.currentSubcname.value;
        args['publish'] = state.subcIsPublic ? '1' : '0';
        args['description'] = state.subcDescription.value;
        args['idAttr'] = state.corpusIdAttr;
        args['ids'] = state.currentResult.ids.toArray().join(',');
        args['structs'] = state.currentResult.structs.toArray().join(',');
        return this.pluginApi.ajax$<Kontext.AjaxResponse>(
            'POST',
            this.pluginApi.createActionUrl('subcorpus/subcmixer_create_subcorpus'),
            args
        );
    }

    private submitTask(state:SubcMixerModelState):Observable<any> {
        const sums = {};
        state.shares.forEach(item => {
            if (!sums.hasOwnProperty(item.attrName)) {
                sums[item.attrName] = 0;
            }
            sums[item.attrName] += parseFloat(item.ratio || '0');
        });
        for (let k in sums) {
            if (sums[k] !== 100) {
                return rxThrowError(new Error(this.pluginApi.translate(
                    'ucnk_subcm__ratios_cannot_over_100_{struct_name}{over_val}',
                    {struct_name: k, over_val: this.pluginApi.formatNumber(sums[k] - 100)})));
            }
        }
        const args = {};
        args['corpname'] = this.pluginApi.getCorpusIdent().id;
        //args['subcname'] = this.subcFormModel.getSubcName().value;
        args['aligned_corpora'] = state.alignedCorpora.toArray();
        args['expression'] = JSON.stringify(
            state.shares.map(item => ({
                attrName: item.attrName,
                attrValue: item.attrValue,
                ratio: item.ratio ? parseFloat(item.ratio) : null
            })).toJS()
        );
        return this.pluginApi.ajax$<CalculationResponse>(
            'POST',
            this.pluginApi.createActionUrl('subcorpus/subcmixer_run_calc'),
            args
        );
    }

    private getTtAttribute(state:SubcMixerModelState, ident:string):TextTypes.AttributeSelection {
        return state.ttAttributes.find((val) => val.name === ident);
    }

    private getAvailableValues(state:SubcMixerModelState):Immutable.List<TextTypeAttrVal> {

        const getInitialAvailableValues = (attrName:string):Immutable.List<TextTypes.AttributeValue> => {
            const idx = state.ttInitialAvailableValues.findIndex(item => item.name === attrName);
            if (idx > -1) {
                return state.ttInitialAvailableValues.get(idx).getValues().map(item => item).toList();
            }
            return Immutable.List<TextTypes.AttributeValue>();
        };

        return state.ttAttributes
            .filter(item => item.hasUserChanges())
            .flatMap(item => {
                const tmp = this.getTtAttribute(state, item.name)
                        .getValues()
                        .filter(item => item.selected)
                        .map(item => item.value);
                return getInitialAvailableValues(item.name)
                    .map(subItem => {
                        return {
                            attrName: item.name,
                            attrValue: subItem.value,
                            isSelected: tmp.contains(subItem.value)
                        };
                    });
            })
            .toList();
    }

    private updateRatio(state:SubcMixerModelState, attrName:string, attrValue:string, ratio:string):void {
        if (!isNaN(parseFloat(ratio)) || ratio.lastIndexOf('.') === ratio.length - 1) {
            const idx = state.shares.findIndex(item => item.attrName === attrName
                    && item.attrValue === attrValue && item.zeroFixed === false);
            if (idx > -1) {
                const curr = state.shares.get(idx);
                state.shares = state.shares.set(idx, {
                    attrName: curr.attrName,
                    attrValue: curr.attrValue,
                    ratio: ratio,
                    baseRatio: curr.baseRatio,
                    zeroFixed: curr.zeroFixed
                });
            }

        } else {
            throw new Error(this.pluginApi.translate('ucnk_subcm__invalid_value'));
        }
    }

    getShares(state:SubcMixerModelState):Immutable.List<SubcMixerExpression> {
        return state.shares.filter(item => item.zeroFixed === false).toList();
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
            return item.getValues().reduce((prev, curr) => prev + curr.availItems, 0);
        }
        return -1;
    }

    /**
     * Avoids splitting to problematic values like 1/3, 1/6 etc.
     * by modifying the last element.
     */
    safeCalcInitialRatio(numItems:number, currIdx:number):number {
        const r = Math.round(100 / numItems * 10) / 10;
        return currIdx < numItems - 1 ? r : 100 - (numItems - 1) * r;
    }

    private refreshData(state:SubcMixerModelState):void {
        const availableValues = this.getAvailableValues(state);
        const numValsPerGroup = availableValues
            .filter(item => item.isSelected)
            .reduce(
                (prev:Immutable.Map<string, number>, curr:TextTypeAttrVal) => {
                    const ans = prev.has(curr.attrName) ? prev : prev.set(curr.attrName, 0);
                    return ans.set(curr.attrName, ans.get(curr.attrName) + 1);
                },
                Immutable.Map<string, number>()
            );
        state.shares = availableValues.filter(item => item.isSelected).map<SubcMixerExpression>((item, i, arr) => {
            const attrVal = state.ttAttributes
                    .find(val => val.name === item.attrName)
                    .getValues()
                    .find(item2 => item2.value == item.attrValue);
            const total = this.getTtAttrSize(state, item.attrName);
            return {
                attrName: item.attrName,
                attrValue: item.attrValue,
                ratio: item.isSelected ? this.safeCalcInitialRatio(numValsPerGroup.get(item.attrName), i).toFixed(1) : '0',
                baseRatio: attrVal ? (attrVal.availItems / total * 100).toFixed(1) : '?',
                zeroFixed: !item.isSelected
            }
        }).toList();
    }
}
