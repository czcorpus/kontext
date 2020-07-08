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

import { Action, IFullActionControl } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap } from 'rxjs/operators';
import { tuple, pipe, Dict, List } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { validateNumber, setFormItemInvalid } from '../../models/base';
import { GeneralQueryFormProperties, QueryFormModel, QueryFormModelState, appendQuery, WidgetsMap, shouldDownArrowTriggerHistory, FilterServerArgs, QueryTypes, AnyQuery } from './common';
import { ActionName } from './actions';


/**
 * This interface encodes values of multiple filter values. Array indices
 * should match query pipeline with non-filter ones represented by
 * 'undefined'.
 */
export interface FilterFormProperties extends GeneralQueryFormProperties {
    filters:Array<string>;
    maincorps:Array<[string, string]>;
    currQueryTypes:Array<[string, QueryTypes]>;
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
export function fetchFilterFormArgs<T>(args:{[ident:string]:AjaxResponse.ConcFormArgs}, initialArgs:AjaxResponse.FilterFormArgs,
        key:(item:AjaxResponse.FilterFormArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'filter') {
            ans.push([formId, key(<AjaxResponse.FilterFormArgs>args[formId])]);
        }
    }
    if (args['__new__'] === undefined) {
        args['__new__'] = initialArgs;
    }
    return ans;
}


function determineSupportedWidgets(queries:{[key:string]:string}, queryTypes:{[key:string]:QueryTypes}, tagBuilderSupport:{[key:string]:boolean}):WidgetsMap {
    const getWidgets = (filterId:string):Array<string> => {
        switch (queryTypes[filterId]) {
            case 'iquery':
            case 'lemma':
            case 'phrase':
            case 'word':
                return ['keyboard', 'history'];
            case 'cql':
                const ans = ['keyboard', 'history'];
                if (tagBuilderSupport[filterId]) {
                    ans.push('tag');
                }
                return ans;
        }
    }

    return new WidgetsMap(pipe(
        queries,
        Dict.toEntries(),
        List.map(([filterId,]) => tuple(filterId, getWidgets(filterId)))
    ));
}


export interface FilterFormModelState extends QueryFormModelState {

    maincorps:{[key:string]:string};

    queryTypes:{[key:string]:QueryTypes};

    lposValues:{[key:string]:string};

    matchCaseValues:{[key:string]:boolean};

    defaultAttrValues:{[key:string]:string};

    pnFilterValues:{[key:string]:string};

    /**
     * Highlighted token FIRST/LAST. Specifies which token is highlighted.
     * This applies in case multiple matching tokens are found.
     */
    filflValues:{[key:string]:string};

    /**
     * Left range
     */
    filfposValues:{[key:string]:Kontext.FormValue<string>};

    /**
     * Right range
     */
    filtposValues:{[key:string]:Kontext.FormValue<string>};

    /**
     * Include kwic checkbox
     */
    inclkwicValues:{[key:string]:boolean};

    withinArgs:{[key:string]:number};

    hasLemma:{[key:string]:boolean};

    tagsetDocs:{[key:string]:string};

    /**
     * If true for a certain key then the operation cannot be edited.
     * (this applies e.g. for filters generated by manual line
     * selection).
     */
    opLocks:{[key:string]:boolean};

    inputLanguage:string;
}

/**
 * FilterFormModel handles all the filtsters applied within a query "pipeline".
 * Each filter is identified by its database ID (i.e. a key used by conc_persistence
 * plug-in to store it). Please note that it does not know the order of filters
 * in pipeline (it is up to QueryReplay store to handle this).
 */
export class FilterFormModel extends QueryFormModel<FilterFormModelState> {

    private readonly syncInitialArgs:AjaxResponse.FilterFormArgs;

    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            textTypesModel:TextTypesModel,
            queryContextModel:QueryContextModel,
            props:FilterFormProperties,
            syncInitialArgs:AjaxResponse.FilterFormArgs) {
        const queries = [tuple('__new__', '')];
        const queryTypes = pipe(
            [...props.currQueryTypes, ...[tuple<string, QueryTypes>('__new__', 'iquery')]],
            Dict.fromEntries()
        );
        const tagBuilderSupport = props.tagBuilderSupport;
        super(dispatcher, pageModel, textTypesModel, queryContextModel, 'filter-form-model', {
            forcedAttr: '', // TODO
            attrList: [], // TODO
            structAttrList: [], // TODO
            lemmaWindowSizes: [], // TODO
            posWindowSizes: [], // TODO
            wPoSList: [], // TODO
            currentAction: 'filter_form',
            queries: Dict.fromEntries(queries), // corpname|filter_id -> query
            useCQLEditor: props.useCQLEditor,
            tagAttr: props.tagAttr,
            widgetArgs: {}, // TODO
            maincorps: Dict.fromEntries(props.maincorps),
            downArrowTriggersHistory: pipe(
                queries,
                List.map(([sourceId,]) => tuple(sourceId, false)),
                Dict.fromEntries()
            ),
            queryTypes: queryTypes,
            lposValues: pipe(
                props.currLposValues,
                Dict.fromEntries()
            ),
            matchCaseValues: pipe(
                props.currQmcaseValues,
                Dict.fromEntries()
            ),
            defaultAttrValues: pipe(
                props.currDefaultAttrValues,
                Dict.fromEntries()
            ),
            pnFilterValues: pipe(
                props.currPnFilterValues,
                Dict.fromEntries()
            ),
            filflValues:pipe(
                props.currFilflVlaues,
                Dict.fromEntries()
            ),
            filfposValues: pipe(
                props.currFilfposValues,
                List.map(([fid, v]) => tuple(fid, Kontext.newFormValue(v, true))),
                Dict.fromEntries()
            ),
            filtposValues: pipe(
                props.currFiltposValues,
                List.map(([fid, v]) => tuple(fid, Kontext.newFormValue(v, true))),
                Dict.fromEntries()
            ),
            inclkwicValues: pipe(
                props.currInclkwicValues,
                Dict.fromEntries()
            ),
            tagBuilderSupport: pipe(
                tagBuilderSupport,
                Dict.fromEntries()
            ),
            opLocks: pipe(
                props.opLocks,
                Dict.fromEntries()
            ),
            activeWidgets: pipe(
                props.filters,
                List.map(item => null),
                Dict.fromEntries()
            ),
            withinArgs: pipe(
                props.withinArgValues,
                Dict.fromEntries()
            ),
            hasLemma: pipe(
                props.hasLemma,
                Dict.fromEntries()
            ),
            tagsetDocs: pipe(
                props.tagsetDoc,
                Dict.fromEntries()
            ),
            inputLanguage: props.inputLanguage,
            isAnonymousUser: props.isAnonymousUser,
            supportedWidgets: determineSupportedWidgets(
                Dict.fromEntries(queries),
                queryTypes,
                Dict.fromEntries(tagBuilderSupport)
            ),
            contextFormVisible: false,
            textTypesFormVisible: false
        });
        this.syncInitialArgs = syncInitialArgs;
    }

    onAction(action:Action) {
        switch (action.name) {
            case 'QUERY_INPUT_SET_ACTIVE_WIDGET':
                this.setActiveWidget(action.payload['sourceId'], action.payload['value']);
                this.state.widgetArgs = action.payload['widgetArgs'] || {};
                this.emitChange();
            break;
            case 'MAIN_MENU_SHOW_FILTER':
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload}));
                this.emitChange();
            break;
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
                        this.state.maincorps = this.state.maincorps.set(filterId, data.maincorp);
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

    private createSubmitArgs(filterId:string):MultiDict<FilterServerArgs> {
        const args = this.pageModel.getConcArgs() as MultiDict<FilterServerArgs & AnyQuery>;
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
