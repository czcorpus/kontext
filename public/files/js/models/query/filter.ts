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

import * as Immutable from 'immutable';
import { Action, IFullActionControl } from 'kombo';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { Kontext } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { validateNumber, setFormItemInvalid } from '../../models/base';
import { GeneralQueryFormProperties, QueryFormModel, QueryFormModelState, appendQuery, WidgetsMap, shouldDownArrowTriggerHistory } from './common';
import { ActionName } from './actions';


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
    withinArgValues:Array<[string, number]>;
    opLocks:Array<[string, boolean]>;
    hasLemma:Array<[string, boolean]>;
    tagsetDoc:Array<[string, string]>;
    isAnonymousUser:boolean;
}

/**
 *import {GeneralViewOptionsModel} from '../options/general';
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


function determineSupportedWidgets(queries:Immutable.Map<string, string>, queryTypes:Immutable.Map<string, string>, tagBuilderSupport:Immutable.Map<string, boolean>):WidgetsMap {
    const getWidgets = (filterId:string):Array<string> => {
        switch (queryTypes.get(filterId)) {
            case 'iquery':
            case 'lemma':
            case 'phrase':
            case 'word':
            case 'char':
                return ['keyboard', 'history'];
            case 'cql':
                const ans = ['keyboard', 'history'];
                if (tagBuilderSupport.get(filterId)) {
                    ans.push('tag');
                }
                return ans;
        }
    }

    return new WidgetsMap(
        queries.keySeq()
        .map<[string, Immutable.List<string>]>(filterId =>
            [filterId, Immutable.List<string>(getWidgets(filterId))])
        .toList()
    );
}


export interface FilterFormModelState extends QueryFormModelState {

    maincorps:Immutable.Map<string, string>;

    queryTypes:Immutable.Map<string, string>;

    lposValues:Immutable.Map<string, string>;

    matchCaseValues:Immutable.Map<string, boolean>;

    defaultAttrValues:Immutable.Map<string, string>;

    pnFilterValues:Immutable.Map<string, string>;

    /**
     * Highlighted token FIRST/LAST. Specifies which token is highlighted.
     * This applies in case multiple matching tokens are found.
     */
    filflValues:Immutable.Map<string, string>;

    /**
     * Left range
     */
    filfposValues:Immutable.Map<string, Kontext.FormValue<string>>;

    /**
     * Right range
     */
    filtposValues:Immutable.Map<string, Kontext.FormValue<string>>;

    /**
     * Include kwic checkbox
     */
    inclkwicValues:Immutable.Map<string, boolean>;

    withinArgs:Immutable.Map<string, number>;

    hasLemma:Immutable.Map<string, boolean>;

    tagsetDocs:Immutable.Map<string, string>;

    /**
     * If true for a certain key then the operation cannot be edited.
     * (this applies e.g. for filters generated by manual line
     * selection).
     */
    opLocks:Immutable.Map<string, boolean>;

    inputLanguage:string;
}

/**
 * FilterFormModel handles all the filtsters applied within a query "pipeline".
 * Each filter is identified by its database ID (i.e. a key used by conc_persistence
 * plug-in to store it). Please note that it does not know the order of filters
 * in pipeline (it is up to QueryReplay store to handle this).
 */
export class FilterFormModel extends QueryFormModel<FilterFormModelState> {

    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            textTypesModel:TextTypesModel,
            queryContextModel:QueryContextModel,
            props:FilterFormProperties) {
        const queries = Immutable.Map<string, string>([['__new__', '']]);
        const queryTypes = Immutable.Map<string, string>(props.currQueryTypes).set('__new__', 'iquery');
        const tagBuilderSupport = Immutable.Map<string, boolean>(props.tagBuilderSupport);
        super(dispatcher, pageModel, textTypesModel, queryContextModel, 'filter-form-model', {
            forcedAttr: '', // TODO
            attrList: Immutable.List<Kontext.AttrItem>(), // TODO
            structAttrList: Immutable.List<Kontext.AttrItem>(), // TODO
            lemmaWindowSizes: Immutable.List<number>(), // TODO
            posWindowSizes: Immutable.List<number>(), // TODO
            wPoSList: Immutable.List<{v:string; n:string}>(), // TODO
            currentAction: 'filter_form',
            queries: queries, // corpname|filter_id -> query
            useCQLEditor: props.useCQLEditor,
            tagAttr: props.tagAttr,
            widgetArgs: {}, // TODO
            maincorps: Immutable.Map<string, string>(props.maincorps),
            downArrowTriggersHistory: Immutable.Map<string, boolean>(queries.map((_, sourceId) => [sourceId, false])),
            queryTypes: queryTypes,
            lposValues: Immutable.Map<string, string>(props.currLposValues),
            matchCaseValues: Immutable.Map<string, boolean>(props.currQmcaseValues),
            defaultAttrValues: Immutable.Map<string, string>(props.currDefaultAttrValues),
            pnFilterValues: Immutable.Map<string, string>(props.currPnFilterValues),
            filflValues: Immutable.Map<string, string>(props.currFilflVlaues),
            filfposValues: Immutable.Map<string, Kontext.FormValue<string>>(props.currFilfposValues),
            filtposValues: Immutable.Map<string, Kontext.FormValue<string>>(props.currFiltposValues),
            inclkwicValues: Immutable.Map<string, boolean>(props.currInclkwicValues),
            tagBuilderSupport: tagBuilderSupport,
            opLocks: Immutable.Map<string, boolean>(props.opLocks),
            activeWidgets: Immutable.Map<string, string>(props.filters.map(item => null)),
            withinArgs: Immutable.Map<string, number>(props.withinArgValues),
            hasLemma: Immutable.Map<string, boolean>(props.hasLemma),
            tagsetDocs: Immutable.Map<string, string>(props.tagsetDoc),
            inputLanguage: props.inputLanguage,
            isAnonymousUser: props.isAnonymousUser,
            supportedWidgets: determineSupportedWidgets(queries, queryTypes, tagBuilderSupport),
            contextFormVisible: false,
            textTypesFormVisible: false
        });
    }

    onAction(action:Action) {
        switch (action.name) {
            case 'CQL_EDITOR_DISABLE':
                this.emitChange();
            break;
            case 'FILTER_QUERY_INPUT_SELECT_TYPE':
                this.state.queryTypes = this.state.queryTypes.set(action.payload['sourceId'], action.payload['queryType']);
                this.state.supportedWidgets = determineSupportedWidgets(this.state.queries, this.state.queryTypes, this.state.tagBuilderSupport);
                this.emitChange();
            break;
            case 'FILTER_QUERY_INPUT_SET_QUERY':
                if (action.payload['insertRange']) {
                    this.addQueryInfix(action.payload['sourceId'], action.payload['query'], action.payload['insertRange']);

                } else {
                    this.state.queries = this.state.queries.set(action.payload['sourceId'], action.payload['query']);
                }
                this.state.downArrowTriggersHistory = this.state.downArrowTriggersHistory.set(
                    action.payload['sourceId'],
                    shouldDownArrowTriggerHistory(
                        action.payload['query'],
                        action.payload['rawAnchorIdx'],
                        action.payload['rawFocusIdx']
                    )
                );
                this.emitChange();
            break;
            case 'FILTER_QUERY_INPUT_MOVE_CURSOR':
                this.state.downArrowTriggersHistory = this.state.downArrowTriggersHistory.set(
                    action.payload['sourceId'],
                    shouldDownArrowTriggerHistory(
                        this.state.queries.get(action.payload['sourceId']),
                        action.payload['anchorIdx'],
                        action.payload['focusIdx']
                    )
                );
                this.emitChange();
            break;
            case 'FILTER_QUERY_INPUT_APPEND_QUERY':
                this.state.queries = this.state.queries.set(
                    action.payload['sourceId'],
                    appendQuery(
                        this.state.queries.get(action.payload['sourceId']),
                        action.payload['query'],
                        !!action.payload['prependSpace']
                    )
                );
                this.emitChange();
            break;
            case 'FILTER_QUERY_INPUT_SET_LPOS':
                this.state.lposValues = this.state.lposValues.set(action.payload['sourceId'], action.payload['lpos']);
                this.emitChange();
            break;
            case 'FILTER_QUERY_INPUT_SET_MATCH_CASE':
                this.state.matchCaseValues = this.state.matchCaseValues.set(action.payload['sourceId'], action.payload['value']);
                this.emitChange();
            break;
            case 'FILTER_QUERY_INPUT_SET_DEFAULT_ATTR':
                this.state.defaultAttrValues = this.state.defaultAttrValues.set(action.payload['sourceId'], action.payload['value']);
                this.emitChange();
            break;
            case 'FILTER_QUERY_SET_POS_NEG':
                this.state.pnFilterValues = this.state.pnFilterValues.set(action.payload['filterId'], action.payload['value']);
                this.emitChange();
            break;
            case 'FILTER_QUERY_SET_FILFL':
                this.state.filflValues = this.state.filflValues.set(action.payload['filterId'], action.payload['value']);
                this.emitChange();
            break;
            case 'FILTER_QUERY_SET_RANGE':
                this.setFilPosValue(
                    action.payload['filterId'],
                    action.payload['value'],
                    action.payload['rangeId']
                );
                this.emitChange();
            break;
            case'FILTER_QUERY_SET_INCL_KWIC':
                this.state.inclkwicValues = this.state.inclkwicValues.set(action.payload['filterId'], action.payload['value']);
                this.emitChange();
            break;
            case 'FILTER_QUERY_APPLY_FILTER':
                const err = this.validateForm(action.payload['filterId']);
                if (!err) {
                    this.submitQuery(action.payload['filterId']);
                    this.emitChange();

                } else {
                    this.pageModel.showMessage('error', err);
                    this.emitChange();
                }
            break;
            case ActionName.QueryContextToggleForm:
                this.state.contextFormVisible = !this.state.contextFormVisible;
                this.emitChange();
            break;
            case ActionName.QueryTextTypesToggleForm:
                this.state.textTypesFormVisible = !this.state.textTypesFormVisible;
                this.emitChange();
            break;
        }
    }

    unregister():void {}

    private validateForm(filterId:string):Error|null {
        if (validateNumber(this.state.filfposValues.get(filterId).value)) {
            this.state.filfposValues = this.state.filfposValues.set(filterId,
                        setFormItemInvalid(this.state.filfposValues.get(filterId), false));

        } else {
            this.state.filfposValues = this.state.filfposValues.set(filterId,
                setFormItemInvalid(this.state.filfposValues.get(filterId), true));
            return new Error(this.pageModel.translate('global__invalid_number_format'));
        }

        if (validateNumber(this.state.filtposValues.get(filterId).value)) {
            this.state.filtposValues = this.state.filtposValues.set(filterId,
                        setFormItemInvalid(this.state.filtposValues.get(filterId), false));

        } else {
            this.state.filtposValues = this.state.filtposValues.set(filterId,
                setFormItemInvalid(this.state.filtposValues.get(filterId), true));
            return new Error(this.pageModel.translate('global__invalid_number_format'));
        }
    }

    private setFilPosValue(filterId:string, value:string, rangeId:string):void {
        if (rangeId === 'filfpos') {
            this.state.filfposValues = this.state.filfposValues.set(filterId, {
                value: value,
                isInvalid: false,
                isRequired: true
            });

        } else if (rangeId === 'filtpos') {
            this.state.filtposValues = this.state.filtposValues.set(filterId, {
                value: value,
                isInvalid: false,
                isRequired: true
            });
        }
    }

    externalQueryChange(sourceId:string, query:string):void {
        this.state.queries = this.state.queries.set(sourceId, query);
        this.emitChange();
    }

    getActiveWidget(sourceId:string):string {
        return this.state.activeWidgets.get(sourceId);
    }

    setActiveWidget(sourceId:string, ident:string):void {
        this.state.activeWidgets = this.state.activeWidgets.set(sourceId, ident);
    }

    getSubmitUrl(filterId:string):string {
        return this.pageModel.createActionUrl('filter', this.createSubmitArgs(filterId).items());
    }

    getCurrentSubcorpus():string {
        return undefined;
    }

    getAvailableSubcorpora():Immutable.List<{v:string; n:string}> {
        return Immutable.List<{v:string; n:string}>();
    }

    /**
     * Synchronize user input values from an external source
     * (typically a server response or a local cache).
     */
    syncFrom(fn:Observable<AjaxResponse.FilterFormArgs>):Observable<AjaxResponse.FilterFormArgs> {
        return fn.pipe(
            tap(
                (data) => {
                    const filterId = data.op_key;
                    if (data.form_type === 'filter') {
                        this.state.queries = this.state.queries.set(filterId, data.query);
                        this.state.queryTypes = this.state.queryTypes.set(filterId, data.query_type);
                        this.state.maincorps = this.state.queryTypes.set(filterId, data.maincorp);
                        this.state.pnFilterValues = this.state.pnFilterValues.set(filterId, data.pnfilter);
                        this.state.filflValues = this.state.filflValues.set(filterId, data.filfl);
                        this.state.filfposValues = this.state.filfposValues.set(filterId, {
                            value: data.filfpos, isInvalid: false, isRequired: true});
                        this.state.filtposValues = this.state.filtposValues.set(filterId, {
                            value: data.filtpos, isInvalid: false, isRequired: true});
                        this.state.inclkwicValues = this.state.inclkwicValues.set(filterId, data.inclkwic);
                        this.state.matchCaseValues = this.state.matchCaseValues.set(filterId, data.qmcase);
                        this.state.defaultAttrValues = this.state.defaultAttrValues.set(filterId, data.default_attr_value);
                        this.state.tagBuilderSupport = this.state.tagBuilderSupport.set(filterId, data.tag_builder_support);
                        this.state.withinArgs = this.state.withinArgs.set(filterId, data.within);
                        this.state.lposValues = this.state.lposValues.set(filterId, data.lpos);
                        this.state.hasLemma = this.state.hasLemma.set(filterId, data.has_lemma);
                        this.state.tagsetDocs = this.state.tagsetDocs.set(filterId, data.tagset_doc);
                        this.state.opLocks = this.state.opLocks.set(filterId, false);

                    } else if (data.form_type === 'locked' || data.form_type == 'lgroup') {
                        this.state.opLocks = this.state.opLocks.set(filterId, true);

                    } else {
                        throw new Error('Cannot sync filter model - invalid form data type: ' + data.form_type);
                    }
                }
            )
        );
    }

    private createSubmitArgs(filterId:string):MultiDict {
        const args = this.pageModel.getConcArgs();
        args.set('pnfilter', this.state.pnFilterValues.get(filterId));
        args.set('filfl', this.state.filflValues.get(filterId));
        args.set('filfpos', this.state.filfposValues.get(filterId).value);
        args.set('filtpos', this.state.filtposValues.get(filterId).value);
        args.set('inclkwic', this.state.inclkwicValues.get(filterId) ? '1' : '0');
        args.set('queryselector', `${this.state.queryTypes.get(filterId)}row`);
        if (this.state.withinArgs.get(filterId)) {
            args.set('within', '1');

        } else {
            args.remove('within');
        }
        args.set(this.state.queryTypes.get(filterId), this.getQueryUnicodeNFC(filterId));
        return args;
    }

    private testQueryNonEmpty(filterId:string):boolean {
        if (this.state.queries.get(filterId).length > 0) {
            return true;

        } else {
            this.pageModel.showMessage('error', this.pageModel.translate('query__query_must_be_entered'));
            return false;
        }
    }

    private testQueryTypeMismatch(filterId):boolean {
        const error = this.validateQuery(this.state.queries.get(filterId), this.state.queryTypes.get(filterId));
        return !error || window.confirm(this.pageModel.translate('global__query_type_mismatch'));
    }

    submitQuery(filterId:string):void {
        if (this.testQueryNonEmpty(filterId) && this.testQueryTypeMismatch(filterId)) {
            const args = this.createSubmitArgs(filterId);
            window.location.href = this.pageModel.createActionUrl('filter', args.items());
        }
    }
}
