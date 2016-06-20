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
/// <reference path="./view.d.ts" />

import util = require('../../util');
import $ = require('jquery');
import {init as viewInit} from './view';


export enum Operator {
    EQ, NE, LTE, GTE
}

export interface CategoryDef {
    id:number;
    parentId:number;
    ratio:number;
    expr:{attr:string; op:string; value:string};
}

export class ValueProportion {
    static DEFAULT_OPERATOR = Operator.EQ; // TODO apply this in JSX view
    static DEFAULT_RATIO = 0;
    static COUNTER = 0;

    private id:number;
    private depth:number;
    private structureName:string;
    private attributeName:string;
    private operator:Operator;
    private value:string;
    private ratio:number;
    private parent:ValueProportion;
    private proportions:Array<ValueProportion>;

    /**
     *
     */
    constructor(parent:ValueProportion, structureName:string, attributeName:string) {
        this.id = ValueProportion.COUNTER;
        ValueProportion.COUNTER += 1;
        this.parent = parent;
        this.depth = this.parent ? this.parent.getDepth() + 1 : 0;
        this.structureName = structureName;
        this.attributeName = attributeName;
        this.operator = ValueProportion.DEFAULT_OPERATOR;
        this.ratio = ValueProportion.DEFAULT_RATIO;
        this.proportions = [];
    }

    setOperator(opId:string):void {
        this.operator = {'EQ': Operator.EQ, 'NE': Operator.NE,
                'LTE': Operator.LTE, 'GTE': Operator.GTE}[opId];
    }

    getRatio():number {
        return this.ratio;
    }

    setRatio(v:number):void {
        this.ratio = v;
    }

    setValue(v:string):void {
        this.value = v;
    }

    setId(id:number) {
        this.id = id;
    }

    getDepth():number {
        return this.depth;
    }

    getExpression():CategoryDef {
        if (this.structureName) {
            let expr = {
                attr: this.structattrToString().replace('.', '_'),
                op: ['==', '<>', '<=', '>='][this.operator],
                value: this.value
            };
            return {
                id: this.id,
                parentId: this.parent.getId(),
                ratio: this.ratio / 100,
                expr: expr
            }
        }
         // root elm
        return {id: 0, parentId: null, ratio: 1, expr:null};
    }

    getId():number {
        return this.id;
    }

    structattrToString() {
        return this.structureName + '.' + this.attributeName;
    }

    append(child:ValueProportion):void {
        this.proportions.push(child);
    }

    removeChild(child:ValueProportion) {
        for (let i = 0; i < this.proportions.length; i += 1) {
            if (this.proportions[i] === child) {
                this.proportions.splice(i, 1);
                break;
            }
        }
    }

    getProportions():Array<ValueProportion> {
        return this.proportions;
    }

    asList():Array<ValueProportion> {
        let self = this;
        let ans:Array<ValueProportion> = [this];
        this.proportions.forEach(function (prop:ValueProportion) {
            ans = ans.concat(prop.asList());
        });
        return ans;
    }

    isStructured():boolean {
        return this.getProportions().length > 0;
    }

    getParent():ValueProportion {
        return this.parent;
    }
}


/**
 * @todo This is more a workaround solving server-side issues
 * (server-side actually provides two possible ways of returning an
 * error state)
 */
function fetchErrorMessage(data) {
    let messages = data['messages'] || [];
    let firstMsg = messages.filter(item => item[0] === 'error')[0];
    return firstMsg ? firstMsg[1] : null;
}


/**
 *
 */
export class SelectedCategoriesStore extends util.SimplePageStore {

    static DispatchToken:string;

    pluginApi:Kontext.PluginApi;

    structure:ValueProportion;

    structAccessMap:{[key:string]:ValueProportion};

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.structure = new ValueProportion(null, null, null);
        this.structAccessMap = {};
        this.structAccessMap[this.structure.getId()] = this.structure;
        SelectedCategoriesStore.DispatchToken = this.dispatcher.register(this.handleEvent);
    }

    private addValueProportion(parentSet:ValueProportion, structattr:string):void {
        var [structName, attrName] = structattr.split('.');
        var p = new ValueProportion(parentSet, structName, attrName);
        this.structAccessMap[p.getId()] = p;
        parentSet.append(p);
        this.notifyChangeListeners('SUBCMIXER_ADD_STRUCTURE');
    }

    private cleanStructure(targetSet:ValueProportion):void {
        let self = this;
        let parent:ValueProportion = targetSet.getParent();

        if (targetSet !== this.structure) {
            function emptyNode(struct:ValueProportion) {
                struct.getProportions().forEach(function (item:ValueProportion) {
                    emptyNode(item);
                });
                delete self.structAccessMap[struct.getId()];
            }
            parent.removeChild(targetSet);
            this.notifyChangeListeners('SUBCMIXER_CLEAN_STRUCTURE');

        } else {
            // TODO error or ignore?
        }
    }

    private runMixer(subcorpusName:string):void {
        let items:Array<ValueProportion> = this.structure.asList();
        let ans = [];
        let self = this;

        if (!subcorpusName) {
            this.pluginApi.showMessage('error', this.pluginApi.translate('defaultSubcmixer__missing_subcname'));
            return;
        }

        // We have to renumber the items to remove potential gaps
        // (user may have removed some nodes and their IDs are not
        // reused).
        items.forEach(function (item:ValueProportion, i) {
            item.setId(i);
        });
        ans = items.map((item:ValueProportion) => {return item.getExpression()});
        let prom = $.ajax(this.pluginApi.createActionUrl('subcorpus/subcmixer_run_calc?corpname='
                + this.pluginApi.getConf('corpname')),
            {
                dataType: 'json',
                method: 'POST',
                data: {
                    'subcname': subcorpusName,
                    'expression': JSON.stringify(ans)
                }
            });
        prom.then(
            function (data:{[key:string]:any}) {
                if (data['contains_errors']) {
                    self.pluginApi.showMessage('error', fetchErrorMessage(data));

                } else {
                    self.pluginApi.showMessage('info', self.pluginApi.translate('Done'));
                }
                console.log(data); // TODO
            },
            function (jqXhr, textErr, err) {
                self.pluginApi.showMessage('error', err);
            }
        )
    }

    private updateSubsetProperties(subset:ValueProportion, values:{[key:string]:any}) {
        let contains = (v) => {return values.hasOwnProperty(v);};
        if (contains('ratio')) {
            subset.setRatio(parseFloat(values['ratio']));
        }
        if (contains('value')) {
            subset.setValue(values['value']);
        }
        if (contains['operator']) {
            subset.setOperator(values['operator']);
        }
    }

    private updateSubsetProperty(subset:ValueProportion, valueType:string, value:any):void {
        switch (valueType) {
            case 'ratio':
                subset.setRatio(parseFloat(value));
                break;
            case 'attr_value':
                subset.setValue(value);
                break;
            case 'operator':
                subset.setOperator(value);
                break;
        }
    }

    private updateAllSubsetsRatios(subset:ValueProportion, values:Array<number>) {
        let proportions = subset.getProportions();
        for (let i = 0; i < proportions.length; i += 1) {
            proportions[i].setRatio(values[i]);
        }
    }

    handleEvent = (payload:Kontext.DispatcherPayload) => {
        switch (payload.actionType) {
            case 'SUBCMIXER_ADD_STRUCTURE':
                this.addValueProportion(this.structAccessMap[payload.props['structId']],
                        payload.props['structattr']);
                break;
            case 'SUBCMIXER_CLEAN_STRUCTURE':
                this.cleanStructure(this.structAccessMap[payload.props['structId']])
                break;
            case 'SUBCMIXER_RUN':
                this.runMixer(payload.props['subcname']);
                break;
            case 'UPDATE_SUBSET_PROP':
                this.updateSubsetProperty(this.structAccessMap[payload.props['structId']],
                    payload.props['valueType'], payload.props['value']);
                break;
            case 'UPDATE_SUBSET_PROPS':
                this.updateSubsetProperties(this.structAccessMap[payload.props['structId']],
                    payload.props);
                break;
            case 'UPDATE_ALL_SUBSETS_RATIOS':
                this.updateAllSubsetsRatios(this.structAccessMap[payload.props['structId']], payload.props['values']);
                this.notifyChangeListeners('UPDATE_ALL_SUBSETS_RATIOS');
                break;
        }
    }

    getRootStructure():ValueProportion {
        return this.structure;
    }
}

export interface TextTypesInfo {
    [key:string]:{type:string, values:Array<string>};
}

/**
 *
 */
export class SubcMixerWidget {

    private pluginApi:Kontext.PluginApi;

    private views:any;

    selectedCategories:SelectedCategoriesStore;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
        this.selectedCategories = new SelectedCategoriesStore(pluginApi.dispatcher(), pluginApi);
        this.views = viewInit(pluginApi.dispatcher(), pluginApi.exportMixins(), this.selectedCategories);
    }

    create(targetElm:HTMLElement, textTypes:TextTypesInfo) {
        let self = this;
        let rootStruct = self.selectedCategories.getRootStructure();
        let structattrs = Object.keys(textTypes).map(function (item) { return [item, item]; });
        let properties:any = {
            numGroups: rootStruct.asList().length,
            rootStruct: rootStruct,
            structattrs: structattrs,
            textTypes: textTypes
        };
        this.pluginApi.renderReactComponent(this.views.Widget, targetElm, properties);
    }

}
