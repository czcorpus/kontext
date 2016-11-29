/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../types/plugins/subcmixer.d.ts" />


import {SimplePageStore} from '../../util';
import {init as viewInit} from './view';
import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';


export interface TextTypeAttrVal {
    attrName:string;
    attrValue:string;
    isSelected:boolean;
}

export interface SubcMixerExpression {
    attrName:string;
    attrValue:string;
    ratio:string;
    zeroFixed:boolean;
}

export interface CalculationResponse extends Kontext.AjaxResponse {
    attrs:Array<[string,number]>;
    total:number;
    ids:Array<string>;
    structs:Array<string>;
}

export interface CalculationResults {
    attrs:Immutable.List<[string, number, boolean]>;
    total:number;
    ids:Immutable.List<string>;
    structs:Immutable.List<string>;
}

/**
 *
 */
export class SubcMixerStore extends SimplePageStore implements Subcmixer.ISubcMixerStore {

    static DispatchToken:string;

    static CATEGORY_SIZE_ERROR_TOLERANCE = 0.5; // in %

    pluginApi:Kontext.PluginApi;

    private shares:Immutable.List<SubcMixerExpression>;

    private currentCalculationResult:CalculationResults;

    getCurrentSubcnameFn:()=>string;

    private currentSubcname:string;

    private corpusIdAttr:string;

    textTypesStore:TextTypes.ITextTypesStore;

    private errorTolerance:number = SubcMixerStore.CATEGORY_SIZE_ERROR_TOLERANCE;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pluginApi:Kontext.PluginApi,
            textTypesStore:TextTypes.ITextTypesStore, getCurrentSubcnameFn:()=>string,
            corpusIdAttr:string) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.textTypesStore = textTypesStore;
        this.shares = Immutable.List<SubcMixerExpression>();
        this.getCurrentSubcnameFn = getCurrentSubcnameFn; // connects us with and old, non-React form
        this.corpusIdAttr = corpusIdAttr;
        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'UCNK_SUBCMIXER_SET_RATIO':
                    try {
                        this.updateRatio(payload.props['attrName'], payload.props['attrValue'],
                            payload.props['ratio']);
                        this.notifyChangeListeners();

                    } catch (e) {
                        this.pluginApi.showMessage('error', e);
                    }
                break;
                case 'UCNK_SUBCMIXER_FETCH_CURRENT_SUBCNAME':
                    this.currentSubcname = this.getCurrentSubcnameFn();
                    this.notifyChangeListeners();
                break;
                case 'UCNK_SUBCMIXER_SET_SUBCNAME':
                    this.currentSubcname = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'UCNK_SUBCMIXER_CLEAR_RESULT':
                    this.currentCalculationResult = null;
                    this.notifyChangeListeners();
                break;
                case 'UCNK_SUBCMIXER_SUBMIT_TASK':
                    this.submitTask().then(
                        () => {
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.pluginApi.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'UCNK_SUBCMIXER_CREATE_SUBCORPUS':
                    this.submitCreateSubcorpus().then(
                        (resp) => {
                            window.location.href = this.pluginApi.createActionUrl('subcorpus/subcorp_list');
                        },
                        (err) => {
                            this.pluginApi.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    )
                break;
                case 'UCNK_SUBCMIXER_SET_ERROR_TOLERANCE':
                    const val = parseFloat(payload.props['value']);
                    if (!isNaN(val) && val > 0 && val <= 100) {
                        this.errorTolerance = val;

                    } else {
                        this.pluginApi.showMessage('error',
                                this.pluginApi.translate('ucnk_subcm__invalid_value'));
                    }
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private importResults(data:Array<[string, number]>):Immutable.List<[string, number, boolean]> {
        const evalDist = (v, idx) => {
            const userRatio = parseFloat(this.shares.get(idx).ratio) / 100;
            return Math.abs(v - userRatio) < this.errorTolerance / 100;
        }
        return Immutable.List<[string, number, boolean]>(
            data.slice(0, this.shares.size).map((item, i) => {
                return [item[0], item[1] * 100, evalDist(item[1], i)];
            })
        );
    }

    private submitCreateSubcorpus():RSVP.Promise<any> {
        if (!this.currentSubcname) {
            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                reject(new Error(this.pluginApi.translate('ucnk_subc__missing_subc_name')));
            });
        }
        const args = {};
        args['corpname'] = this.pluginApi.getConf<string>('corpname');
        args['subcname'] = this.currentSubcname;
        args['idAttr'] = this.corpusIdAttr;
        args['ids'] = this.currentCalculationResult.ids.toArray().join(',');
        args['structs'] = this.currentCalculationResult.structs.toArray().join(',');
        return this.pluginApi.ajax<Kontext.AjaxResponse>(
            'POST',
            this.pluginApi.createActionUrl('subcorpus/subcmixer_create_subcorpus'),
            args

        ).then(
            (resp) => {
                if (resp.contains_errors) {
                    throw new Error(resp.messages[0]);
                }
            }
        );
    }

    private submitTask():RSVP.Promise<any> {
        const sums = {};
        this.shares.forEach(item => {
            if (!sums.hasOwnProperty(item.attrName)) {
                sums[item.attrName] = 0;
            }
            sums[item.attrName] += parseFloat(item.ratio || '0');
        });
        const errors = [];
        for (let k in sums) {
            if (sums[k] > 100) {
                return new RSVP.Promise<any>((resolve:(v)=>void, reject:(e:any)=>void) => {
                    reject(new Error(this.pluginApi.translate(
                        'ucnk_subcm__ratios_cannot_over_100_{struct_name}{over_val}',
                        {struct_name: k, over_val: this.pluginApi.formatNumber(sums[k] - 100)})));
                });
            }
        }
        const args = {};
        args['corpname'] = this.pluginApi.getConf<string>('corpname');
        args['subcname'] = this.currentSubcname;
        args['expression'] = JSON.stringify(
                this.shares.map(item => ({
                    attrName: item.attrName,
                    attrValue: item.attrValue,
                    ratio: item.ratio ? parseFloat(item.ratio) : null
                })).toJS());
        return this.pluginApi.ajax<CalculationResponse>(
            'POST',
            this.pluginApi.createActionUrl('subcorpus/subcmixer_run_calc'),
            args

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.currentCalculationResult = {
                        attrs: this.importResults(data.attrs),
                        total: data.total,
                        ids: Immutable.List<string>(data.ids),
                        structs: Immutable.List<string>(data.structs)
                    }

                } else {
                    throw new Error(data.messages[0]);
                }
            }
        );
    }

    private getAvailableValues():Immutable.List<TextTypeAttrVal> {
        return Immutable.List(this.textTypesStore.getAttributes())
            .filter(item => item.hasUserChanges())
            .flatMap(item => {
                const tmp = this.textTypesStore.getAttribute(item.name)
                        .getValues()
                        .filter(item => item.selected)
                        .map(item => item.value);
                return this.textTypesStore.getInitialAvailableValues(item.name)
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

    private updateRatio(attrName:string, attrValue:string, ratio:string):void {
        if (!isNaN(parseFloat(ratio)) || ratio.lastIndexOf('.') === ratio.length - 1) {
            const idx = this.shares.findIndex(item => item.attrName === attrName
                    && item.attrValue === attrValue && item.zeroFixed === false);
            if (idx > -1) {
                const curr = this.shares.get(idx);
                this.shares = this.shares.set(idx, {
                    attrName: curr.attrName,
                    attrValue: curr.attrValue,
                    ratio: ratio,
                    zeroFixed: curr.zeroFixed
                });
            }

        } else {
            throw new Error(this.pluginApi.translate('ucnk_subcm__invalid_value'));
        }
    }

    getShares():Immutable.List<SubcMixerExpression> {
        return this.shares.filter(item => item.zeroFixed === false).toList();
    }

    refreshData():void {
        const availableValues = this.getAvailableValues();
        const numValsPerGroup = availableValues
            .filter(item => item.isSelected)
            .reduce(
                (prev:Immutable.Map<string, number>, curr:TextTypeAttrVal) => {
                    const ans = prev.has(curr.attrName) ? prev : prev.set(curr.attrName, 0);
                    return ans.set(curr.attrName, ans.get(curr.attrName) + 1);
                },
                Immutable.Map<string, number>()
            );
        this.shares = availableValues.map<SubcMixerExpression>((item, _, arr) => {
            return {
                attrName: item.attrName,
                attrValue: item.attrValue,
                ratio: item.isSelected ? (100 / numValsPerGroup.get(item.attrName)).toFixed(1) : '0',
                zeroFixed: !item.isSelected
            }
        }).toList();
    }

    getCurrentCalculationResults():CalculationResults {
        return this.currentCalculationResult;
    }

    getCurrentSubcname():string {
        return this.currentSubcname;
    }

    getUsedAttributes():Immutable.Set<string> {
        return Immutable.Set<string>(this.shares.map(item => item.attrName));
    }

    getNumOfErrors():number {
        if (this.currentCalculationResult) {
            return this.currentCalculationResult.attrs.reduce((prev, curr) => prev + (!curr[2] ? 1 : 0), 0);
        }
        return 0;
    }

    getErrorTolerance():number {
        return this.errorTolerance;
    }
}


export function getViews(dispatcher:Dispatcher.Dispatcher<any>,
        mixins:Kontext.ComponentCoreMixins, layoutViews:any,
        subcmixerStore:SubcMixerStore):{[name:string]:any} {
    return viewInit(dispatcher, mixins, layoutViews, subcmixerStore);
}


export function create(pluginApi:Kontext.PluginApi,
        textTypesStore:TextTypes.ITextTypesStore,
        getCurrentSubcnameFn:()=>string,
        corpusIdAttr:string):Subcmixer.ISubcMixerStore {
    return new SubcMixerStore(pluginApi.dispatcher(), pluginApi,
            textTypesStore, getCurrentSubcnameFn, corpusIdAttr);
}
