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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../types/ajaxResponses.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../../ts/declarations/cqlParser.d.ts" />


import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';
import {MultiDict} from '../../util';
import {parse as parseQuery} from 'cqlParser/parser';
import {TextTypesStore} from '../textTypes/attrValues';
import {QueryContextStore} from './context';
import {GeneralQueryFormProperties, GeneralQueryStore} from './main';


/**
 *
 */
export interface FilterFormProperties extends GeneralQueryFormProperties {
    filters:Array<number>;
    corpname:string;
    currQueryTypes:{[filterId:number]:string};
    currQueries:{[filterId:number]:string};  // current queries values (e.g. when restoring a form state)
    currPcqPosNegValues:{[filterId:number]:string};
    currDefaultAttrValues:{[filterId:number]:string};
    tagBuilderSupport:{[filterId:number]:boolean};
    currLposValues:{[filterId:number]:string};
    currQmcaseValues:{[filterId:number]:boolean};
    inputLanguage:string;
    currPnFilterValues:{[filterId:number]:string};
}


/**
 *
 */
export type FilterWidgetsMap = Immutable.Map<number, Immutable.List<string>>;


/**
 *
 */
export class FilterStore extends GeneralQueryStore implements Kontext.QuerySetupHandler {

    private corpus:string;

    private queries:Immutable.Map<number, string>;

    private queryTypes:Immutable.Map<number, string>;

    private lposValues:Immutable.Map<number, string>;

    private matchCaseValues:Immutable.Map<number, string>;

    private defaultAttrValues:Immutable.Map<number, string>;

    private pnFilterValues:Immutable.Map<number, string>;

    private filflValues:Immutable.Map<number, string>;

    private filfposValues:Immutable.Map<number, [string, string]>;

    private inclkwicValues:Immutable.Map<number, boolean>;

    private hasTagBuilderSupport:boolean;

    private filters:Immutable.List<number>;

    private inputLanguage:string;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, textTypesStore:TextTypesStore,
            queryContextStore:QueryContextStore, props:FilterFormProperties) {
        super(dispatcher, pageModel, textTypesStore, queryContextStore, props);
        this.corpus = props.corpname;
        this.queries = Immutable.Map<number, string>(props.filters.map(item => [item, ''])); // TODO
        this.queryTypes = Immutable.Map<number, string>(props.filters.map(item => [item, 'iquery'])); // TODO
        this.lposValues = Immutable.Map<number, string>(props.filters.map(item => [item, ''])); // TODO
        this.matchCaseValues = Immutable.Map<number, string>(props.filters.map(item => [item, false])); // TODO
        this.defaultAttrValues = Immutable.Map<number, string>(props.filters.map(item => [item, 'word'])); // TODO
        this.pnFilterValues = Immutable.Map<number, string>(props.filters
                .map(filterId => [filterId, props.currPnFilterValues[filterId] || 'p']));
        this.filflValues = Immutable.Map<number, string>(props.filters.map(item => [item, 'f'])); // TODO !!
        this.filfposValues = Immutable.Map<number, [string, string]>(props.filters.map(item => [item, ['-5', '5']])); // TODO !!
        this.inclkwicValues = Immutable.Map<number, boolean>(props.filters.map(item => [item, true])); // TODO !!

        this.filters = Immutable.List<number>(props.filters);
        this.hasTagBuilderSupport = props.tagBuilderSupport[this.corpus];
        this.inputLanguage = props.inputLanguage;
        this.currentAction = 'filter_form';
        this.targetAction = 'filter';

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FILTER_QUERY_INPUT_SELECT_TYPE':
                    this.queryTypes = this.queryTypes.set(payload.props['sourceId'], payload.props['queryType']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_INPUT_SET_QUERY':
                    this.queries = this.queries.set(payload.props['sourceId'], payload.props['query']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_INPUT_APPEND_QUERY':
                    const currQuery = this.queries.get(payload.props['sourceId'])
                    const newQuery =  currQuery + (currQuery && payload.props['prependSpace'] ? ' ' : '') + payload.props['query'];
                    this.queries = this.queries.set(payload.props['sourceId'], newQuery);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_INPUT_SET_LPOS':
                    this.lposValues = this.lposValues.set(payload.props['sourceId'], payload.props['lpos']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_INPUT_SET_MATCH_CASE':
                    this.matchCaseValues = this.matchCaseValues.set(payload.props['sourceId'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_INPUT_SET_DEFAULT_ATTR':
                    this.defaultAttrValues = this.defaultAttrValues.set(payload.props['sourceId'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_SET_POS_NEG':
                    this.pnFilterValues = this.pnFilterValues.set(payload.props['filterId'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_SET_FILFL':
                    this.filflValues = this.filflValues.set(payload.props['filterId'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_SET_RANGE':
                    const currVal = this.filfposValues.get(payload.props['filterId']);
                    const newVal:[string, string] = [currVal[0], currVal[1]];
                    newVal[payload.props['idx']] = payload.props['value'];
                    this.filfposValues = this.filfposValues.set(payload.props['filterId'], newVal);
                    this.notifyChangeListeners();
                break;
                case'FILTER_QUERY_SET_INCL_KWIC':
                    this.inclkwicValues = this.inclkwicValues.set(payload.props['filterId'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
                case 'FILTER_QUERY_APPLY_FILTER':
                    this.submitQuery(payload.props['filterId']);
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    private createSubmitArgs(filterId:number):MultiDict {
        const args = new MultiDict(this.currentArgs.toArray());
        args.replace('pnfilter', [this.pnFilterValues.get(filterId)]);
        args.replace('filfl', [this.filflValues.get(filterId)]);
        const range = this.filfposValues.get(filterId);
        args.replace('filfpos', [range[0]]);
        args.replace('filtpos', [range[1]]);
        args.replace('inclkwic', [this.inclkwicValues.get(filterId) ? '1' : '0']);
        args.replace('queryselector', [this.queryTypes.get(filterId)]);
        args.replace(this.queryTypes.get(filterId), [this.queries.get(filterId)]);
        return args;
    }

    private submitQuery(filterId:number):void {
        const error = this.validateQuery(this.queries.get(filterId), this.queryTypes.get(filterId));
        if (!error || window.confirm(this.pageModel.translate('global__query_type_mismatch'))) {
            const args = this.createSubmitArgs(filterId);
            window.location.href = this.pageModel.createActionUrl(this.targetAction, args.items());
        }
    }

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.corpus]);
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return Immutable.List<{n:string; label:string}>();
    }

    getQueryTypes():Immutable.Map<number, string> {
        return this.queryTypes;
    }

    getLposValues():Immutable.Map<number, string> {
        return this.lposValues;
    }

    getMatchCaseValues():Immutable.Map<number, string> {
        return this.matchCaseValues;
    }

    getDefaultAttrValues():Immutable.Map<number, string> {
        return this.defaultAttrValues;
    }

    getInputLanguage():string {
        return this.inputLanguage;
    }

    getQuery(filterId:number):string {
        return this.queries.get(filterId);
    }

    getPnFilterValues():Immutable.Map<number, string> {
        return this.pnFilterValues;
    }

    getFilfposValues():Immutable.Map<number, [string, string]> {
        return this.filfposValues;
    }

    getFilflValues():Immutable.Map<number, string> {
        return this.filflValues;
    }

    getInclKwicValues():Immutable.Map<number, boolean> {
        return this.inclkwicValues;
    }

    getSupportedWidgets():FilterWidgetsMap {

        const getWidgets = (queryType:string):Array<string> => {
            switch (queryType) {
                case 'iquery':
                case 'lemma':
                case 'phrase':
                case 'word':
                case 'char':
                    return ['keyboard', 'history'];
                case 'cql':
                    const ans = ['keyboard', 'history', 'within'];
                    if (this.hasTagBuilderSupport) {
                        ans.push('tag');
                    }
                    return ans;
            }
        }
        const ans = Immutable.Map<string, Immutable.List<string>>();

        return Immutable.Map<number, Immutable.List<string>>(this.filters.map(filterId => {
            return [filterId, Immutable.List<string>(getWidgets(this.queryTypes.get(filterId)))];
        }));
    }
}
