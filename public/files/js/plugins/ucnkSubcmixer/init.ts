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

import {Kontext, TextTypes} from '../../types/common';
import {StatefulModel} from '../../models/base';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {init as viewInit} from './view';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';

declare var require:any;
require('./style.less'); // webpack


export interface TextTypeAttrVal {
    attrName:string;
    attrValue:string;
    isSelected:boolean;
}

export interface SubcMixerExpression {
    attrName:string;
    attrValue:string;
    ratio:string;
    baseRatio:string; // a ratio in the original corpus
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
export class SubcMixerModel extends StatefulModel {

    static DispatchToken:string;

    private static WARNING_SIZE_ERROR_RATIO = 0.01;

    pluginApi:IPluginApi;

    private shares:Immutable.List<SubcMixerExpression>;

    private currentCalculationResult:CalculationResults;

    getAlignedCorporaFn:()=>Immutable.List<TextTypes.AlignedLanguageItem>;

    private subcFormModel:PluginInterfaces.SubcMixer.ISubcorpFormModel;

    private corpusIdAttr:string;

    textTypesModel:TextTypes.ITextTypesModel;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi,
            textTypesModel:TextTypes.ITextTypesModel,
            subcFormModel:PluginInterfaces.SubcMixer.ISubcorpFormModel,
            getAlignedCorporaFn:()=>Immutable.List<TextTypes.AlignedLanguageItem>, corpusIdAttr:string) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.textTypesModel = textTypesModel;
        this.subcFormModel = subcFormModel;
        this.shares = Immutable.List<SubcMixerExpression>();
        this.getAlignedCorporaFn = getAlignedCorporaFn;
        this.corpusIdAttr = corpusIdAttr;
        this.dispatcher.register((payload:ActionPayload) => {
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
            }
        });
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

    private importResults(data:Array<[string, number]>):Immutable.List<[string, number, boolean]> {
        const evalDist = (v, idx) => {
            const userRatio = parseFloat(this.shares.get(idx).ratio) / 100;
            return Math.abs(v - userRatio) < SubcMixerModel.WARNING_SIZE_ERROR_RATIO;
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
                        sharesIdx: this.shares.findIndex(x => x.attrName === ans[0] && x.attrValue === ans[1] && !x.zeroFixed)
                    };
                })
                .filter(x => x.sharesIdx > - 1 && !this.shares.get(x.sharesIdx).zeroFixed)
                .map<[string, number, boolean]>((item, _) => [item.data[0], item.data[1] * 100, evalDist(item.data[1], item.sharesIdx)])
                .toList();

        return Immutable.List<[string, number, boolean]>(mappedData);
    }

    private submitCreateSubcorpus():RSVP.Promise<any> {
        const err = this.subcFormModel.validateForm();
        if (err) {
            return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
                reject(err);
            });
        }
        const args = {};
        args['corpname'] = this.pluginApi.getCorpusIdent().id;
        args['subcname'] = this.subcFormModel.getSubcName().value;
        args['publish'] = this.subcFormModel.getIsPublic() ? '1' : '0';
        args['description'] = this.subcFormModel.getDescription().value;
        args['idAttr'] = this.corpusIdAttr;
        args['ids'] = this.currentCalculationResult.ids.toArray().join(',');
        args['structs'] = this.currentCalculationResult.structs.toArray().join(',');
        return this.pluginApi.ajax<Kontext.AjaxResponse>(
            'POST',
            this.pluginApi.createActionUrl('subcorpus/subcmixer_create_subcorpus'),
            args

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
            if (sums[k] !== 100) {
                return new RSVP.Promise<any>((resolve:(v)=>void, reject:(e:any)=>void) => {
                    reject(new Error(this.pluginApi.translate(
                        'ucnk_subcm__ratios_cannot_over_100_{struct_name}{over_val}',
                        {struct_name: k, over_val: this.pluginApi.formatNumber(sums[k] - 100)})));
                });
            }
        }
        const args = {};
        args['corpname'] = this.pluginApi.getCorpusIdent().id;
        args['subcname'] = this.subcFormModel.getSubcName().value;
        args['aligned_corpora'] = this.getAlignedCorporaFn().map(item => item.value).toArray();
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
                this.currentCalculationResult = {
                    attrs: this.importResults(data.attrs),
                    total: data.total,
                    ids: Immutable.List<string>(data.ids),
                    structs: Immutable.List<string>(data.structs)
                };
            }
        );
    }

    private getAvailableValues():Immutable.List<TextTypeAttrVal> {
        return Immutable.List(this.textTypesModel.getAttributes())
            .filter(item => item.hasUserChanges())
            .flatMap(item => {
                const tmp = this.textTypesModel.getAttribute(item.name)
                        .getValues()
                        .filter(item => item.selected)
                        .map(item => item.value);
                return this.textTypesModel.getInitialAvailableValues(item.name)
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
                    baseRatio: curr.baseRatio,
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

    /**
     * Avoids splitting to problematic values like 1/3, 1/6 etc.
     * by modifying the last element.
     */
    safeCalcInitialRatio(numItems:number, currIdx:number):number {
        const r = Math.round(100 / numItems * 10) / 10;
        return currIdx < numItems - 1 ? r : 100 - (numItems - 1) * r;
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
        this.shares = availableValues.map<SubcMixerExpression>((item, i, arr) => {
            const attrVal = this.textTypesModel.getAttribute(item.attrName).getValues()
                    .find(item2 => item2.value == item.attrValue);
            const total = this.textTypesModel.getAttrSize(item.attrName);
            return {
                attrName: item.attrName,
                attrValue: item.attrValue,
                ratio: item.isSelected ? this.safeCalcInitialRatio(numValsPerGroup.get(item.attrName), i).toFixed(1) : '0',
                baseRatio: attrVal ? (attrVal.availItems / total * 100).toFixed(1) : '?',
                zeroFixed: !item.isSelected
            }
        }).toList();
    }

    getCurrentCalculationResults():CalculationResults {
        return this.currentCalculationResult;
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

    getAlignedCorpora():Immutable.List<TextTypes.AlignedLanguageItem> {
        return this.getAlignedCorporaFn();
    }

    getRatioLimitPercent():number {
        return SubcMixerModel.WARNING_SIZE_ERROR_RATIO * 100;
    }
}


class SubcmixerPlugin implements PluginInterfaces.SubcMixer.IPlugin {

    pluginApi:IPluginApi

    private model:SubcMixerModel;

    private subcorpFormModel:PluginInterfaces.SubcMixer.ISubcorpFormModel;

    constructor(pluginApi:IPluginApi, model:SubcMixerModel, subcorpFormModel:PluginInterfaces.SubcMixer.ISubcorpFormModel) {
        this.pluginApi = pluginApi;
        this.model = model;
        this.subcorpFormModel = subcorpFormModel;
    }

    refreshData():void {
        this.model.refreshData();
    }

    getWidgetView():React.ComponentClass {
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.model,
            this.subcorpFormModel
        ).Widget;
    }

}


const create:PluginInterfaces.SubcMixer.Factory = (pluginApi, textTypesModel, subcorpFormModel,
            getAlignedCorporaFn, corpusIdAttr) => {
    const model = new SubcMixerModel(
        pluginApi.dispatcher(),
        pluginApi,
        textTypesModel,
        subcorpFormModel,
        getAlignedCorporaFn,
        corpusIdAttr
    );
    return new SubcmixerPlugin(pluginApi, model, subcorpFormModel);
}

export default create;
