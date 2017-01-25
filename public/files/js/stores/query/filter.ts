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
 * This interface encodes values of multiple filter values. Array indices
 * should match query pipeline with non-filter ones represented by
 * 'undefined'.
 */
export interface FilterFormProperties extends GeneralQueryFormProperties {
    filters:Array<string>;
    maincorps:Array<[string, string]>;
    currQueryTypes:Array<[string, string]>;
    currQueries:Array<[string, string]>;  // current queries values (e.g. when restoring a form state)
    currDefaultAttrValues:Array<[string, string]>;
    tagBuilderSupport:Array<[string, boolean]>;
    currLposValues:Array<[string, string]>;
    currQmcaseValues:Array<[string, boolean]>;
    currInclkwicValues:Array<[string, boolean]>;
    inputLanguage:string;
    currPnFilterValues:Array<[string, string]>;
    currFilflVlaues:Array<[string, string]>;
    currFilfposValues:Array<[string, string]>;
    currFiltposValues:Array<[string, string]>;
    isWithin:boolean;
    opLocks:Array<[string, boolean]>;
}

/**
 *
 */
export type FilterWidgetsMap = Immutable.Map<string, Immutable.List<string>>;

/**
 *
 */
export function fetchFilterFormArgs<T>(args:{[ident:string]:AjaxResponse.ConcFormArgs},
        key:(item:AjaxResponse.FilterFormArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'filter') {
            ans.push([formId, key(<AjaxResponse.FilterFormArgs>args[formId])]);
        }
    }
    return ans;
}

/**
 * FilterStore handles all the filpublic/files/js/stores/query/replay.tsters applied within a query "pipeline".
 * Each filter is identified by its database ID (i.e. a key used by conc_persistence
 * plug-in to store it). Please note that it does not know the order of filters
 * in pipeline (it is up to QueryReplay store to handle this).
 */
export class FilterStore extends GeneralQueryStore implements Kontext.QuerySetupHandler {

    private maincorps:Immutable.Map<string, string>;

    private queries:Immutable.Map<string, string>;

    private queryTypes:Immutable.Map<string, string>;

    private lposValues:Immutable.Map<string, string>;

    private matchCaseValues:Immutable.Map<string, boolean>;

    private defaultAttrValues:Immutable.Map<string, string>;

    private pnFilterValues:Immutable.Map<string, string>;

    private filflValues:Immutable.Map<string, string>;

    private filfposValues:Immutable.Map<string, string>;

    private filtposValues:Immutable.Map<string, string>;

    private inclkwicValues:Immutable.Map<string, boolean>;

    private tagBuilderSupport:Immutable.Map<string, boolean>;

    /**
     * If true for a certain key then the operation cannot be edited.
     * (this applies e.g. for filters generated by manual line
     * selection).
     */
    private opLocks:Immutable.Map<string, boolean>;

    private inputLanguage:string;

    private isWithin:boolean;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, textTypesStore:TextTypesStore,
            queryContextStore:QueryContextStore, props:FilterFormProperties) {
        super(dispatcher, pageModel, textTypesStore, queryContextStore, props);

        this.maincorps = Immutable.Map<string, string>(props.maincorps);
        this.queries = Immutable.Map<string, string>(props.currQueries);
        this.queryTypes = Immutable.Map<string, string>(props.currQueryTypes);
        this.lposValues = Immutable.Map<string, string>(props.currLposValues);
        this.matchCaseValues = Immutable.Map<string, boolean>(props.currQmcaseValues);
        this.defaultAttrValues = Immutable.Map<string, string>(props.currDefaultAttrValues);
        this.pnFilterValues = Immutable.Map<string, string>(props.currPnFilterValues);
        this.filflValues = Immutable.Map<string, string>(props.currFilflVlaues);
        this.filfposValues = Immutable.Map<string, string>(props.currFilfposValues);
        this.filtposValues = Immutable.Map<string, string>(props.currFiltposValues);
        this.inclkwicValues = Immutable.Map<string, boolean>(props.currInclkwicValues);
        this.tagBuilderSupport = Immutable.Map<string, boolean>(props.tagBuilderSupport);
        this.opLocks = Immutable.Map<string, boolean>(props.opLocks);


        this.inputLanguage = props.inputLanguage;
        this.currentAction = 'filter_form';
        this.isWithin = props.isWithin;

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
                    if (payload.props['rangeId'] === 'filfpos') {
                        this.filfposValues = this.filfposValues.set(payload.props['filterId'], payload.props['value']);

                    } else if (payload.props['rangeId'] === 'filtpos') {
                        this.filtposValues = this.filtposValues.set(payload.props['filterId'], payload.props['value']);
                    }
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

    getSubmitUrl(filterId:string):string {
        return this.pageModel.createActionUrl('filter', this.createSubmitArgs(filterId).items());
    }

    /**
     * Synchronize user input values from an external source
     * (typically a server response or a local cache).
     */
    syncFrom(fn:()=>RSVP.Promise<AjaxResponse.FilterFormArgs>):RSVP.Promise<AjaxResponse.FilterFormArgs> {
        return fn().then(
            (data) => {
                const filterId = data.op_key;
                if (data.form_type === 'filter') {
                    this.queries = this.queries.set(filterId, data.query);
                    this.queryTypes = this.queryTypes.set(filterId, data.query_type);
                    this.maincorps = this.queryTypes.set(filterId, data.maincorp);
                    this.pnFilterValues = this.pnFilterValues.set(filterId, data.pnfilter);
                    this.filflValues = this.filflValues.set(filterId, data.filfl);
                    this.filfposValues = this.filfposValues.set(filterId, data.filfpos);
                    this.filtposValues = this.filtposValues.set(filterId, data.filtpos);
                    this.inclkwicValues = this.inclkwicValues.set(filterId, data.inclkwic);
                    this.matchCaseValues = this.matchCaseValues.set(filterId, data.qmcase);
                    this.defaultAttrValues = this.defaultAttrValues.set(filterId, data.default_attr_value);
                    this.tagBuilderSupport = this.tagBuilderSupport.set(filterId, data.tag_builder_support);
                    this.lposValues = this.lposValues.set(filterId, data.lpos);
                    this.opLocks = this.opLocks.set(filterId, false);
                    return data;

                } else if (data.form_type === 'locked') {
                    this.opLocks = this.opLocks.set(filterId, true);
                    return data;

                } else {
                    throw new Error('Cannot sync filter store - invalid form data type: ' + data.form_type);
                }
            }
        );
    }

    private createSubmitArgs(filterId:string):MultiDict {
        const args = this.pageModel.getConcArgs();
        args.replace('pnfilter', [this.pnFilterValues.get(filterId)]);
        args.replace('filfl', [this.filflValues.get(filterId)]);
        args.replace('filfpos', [this.filfposValues.get(filterId)]);
        args.replace('filtpos', [this.filtposValues.get(filterId)]);
        args.replace('inclkwic', [this.inclkwicValues.get(filterId) ? '1' : '0']);
        args.replace('queryselector', [`${this.queryTypes.get(filterId)}row`]);
        if (this.isWithin) {
            args.replace('within', ['1']);

        } else {
            args.remove('within');
        }
        args.replace(this.queryTypes.get(filterId), [this.queries.get(filterId)]);
        return args;
    }

    submitQuery(filterId:string):void {
        const error = this.validateQuery(this.queries.get(filterId), this.queryTypes.get(filterId));
        if (!error || window.confirm(this.pageModel.translate('global__query_type_mismatch'))) {
            const args = this.createSubmitArgs(filterId);
            window.location.href = this.pageModel.createActionUrl('filter', args.items());
        }
    }

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.maincorps]);
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return Immutable.List<{n:string; label:string}>();
    }

    getQueryTypes():Immutable.Map<string, string> {
        return this.queryTypes;
    }

    getLposValues():Immutable.Map<string, string> {
        return this.lposValues;
    }

    getMatchCaseValues():Immutable.Map<string, boolean> {
        return this.matchCaseValues;
    }

    getDefaultAttrValues():Immutable.Map<string, string> {
        return this.defaultAttrValues;
    }

    getInputLanguage():string {
        return this.inputLanguage;
    }

    getQuery(filterId:string):string {
        return this.queries.get(filterId);
    }

    getPnFilterValues():Immutable.Map<string, string> {
        return this.pnFilterValues;
    }

    getFilfposValues():Immutable.Map<string, string> {
        return this.filfposValues;
    }

    getFiltposValues():Immutable.Map<string, string> {
        return this.filtposValues;
    }

    getFilflValues():Immutable.Map<string, string> {
        return this.filflValues;
    }

    getInclKwicValues():Immutable.Map<string, boolean> {
        return this.inclkwicValues;
    }

    getOpLocks():Immutable.Map<string, boolean> {
        return this.opLocks;
    }

    getSupportedWidgets():FilterWidgetsMap {
        const getWidgets = (filterId:string):Array<string> => {
            switch (this.queryTypes.get(filterId)) {
                case 'iquery':
                case 'lemma':
                case 'phrase':
                case 'word':
                case 'char':
                    return ['keyboard', 'history'];
                case 'cql':
                    const ans = ['keyboard', 'history'];
                    if (this.tagBuilderSupport.get(filterId)) {
                        ans.push('tag');
                    }
                    return ans;
            }
        }
        return Immutable.Map<string, Immutable.List<string>>(
            this.queries.keySeq().map(filterId => {
                return [filterId, Immutable.List<string>(
                getWidgets(filterId))];
            })
        );
    }
}
