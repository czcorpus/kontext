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

import { IFullActionControl } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap } from 'rxjs/operators';
import { tuple, pipe, Dict, List, HTTP } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { QueryContextModel } from './context';
import { validateNumber, setFormItemInvalid } from '../../models/base';
import { GeneralQueryFormProperties, QueryFormModel, QueryFormModelState, appendQuery,
    FilterServerArgs, QueryType } from './common';
import { ActionName, Actions } from './actions';
import { ActionName as ConcActionName, Actions as ConcActions } from '../concordance/actions';
import { ActionName as MainMenuActionName, Actions as MainMenuActions } from '../mainMenu/actions';
import { PluginInterfaces } from '../../types/plugins';
import { TextTypesModel } from '../textTypes/main';
import { AjaxConcResponse } from '../concordance/common';


/**
 * This interface encodes values of multiple filter values. Array indices
 * should match query pipeline with non-filter ones represented by
 * 'undefined'.
 */
export interface FilterFormProperties extends GeneralQueryFormProperties {
    filters:Array<string>;
    maincorps:Array<[string, string]>;
    currQueryTypes:Array<[string, QueryType]>;
    // current queries values (e.g. when restoring a form state)
    currQueries:Array<[string, string]>;
    currDefaultAttrValues:Array<[string, string]>;
    tagBuilderSupport:Array<[string, boolean]>;
    currLposValues:Array<[string, string]>;
    currQmcaseValues:Array<[string, boolean]>;
    currInclkwicValues:Array<[string, boolean]>;
    inputLanguage:string;
    currPnFilterValues:Array<[string, string]>;
    currFilflVlaues:Array<[string, 'f'|'l']>;
    currFilfposValues:Array<[string, string]>;
    currFiltposValues:Array<[string, string]>;
    withinArgValues:Array<[string, boolean]>;
    opLocks:Array<[string, boolean]>;
    hasLemma:Array<[string, boolean]>;
    isAnonymousUser:boolean;
    suggestionsVisibility:PluginInterfaces.QuerySuggest.SuggestionVisibility;
}

/**
 * import {GeneralViewOptionsModel} from '../options/general';
 */
export function fetchFilterFormArgs<T extends
        AjaxResponse.FilterFormArgs[keyof AjaxResponse.FilterFormArgs]>(
    args:{[ident:string]:AjaxResponse.ConcFormArgs},
    initialArgs:AjaxResponse.FilterFormArgs,
    key:(item:AjaxResponse.FilterFormArgs)=>T

):Array<[string, T]> {
    return pipe(
        args,
        Dict.toEntries(),
        List.filter(([, v]) => v.form_type === Kontext.ConcFormTypes.FILTER),
        List.map(([formId, args]) => tuple(formId, key(<AjaxResponse.FilterFormArgs>args))),
        List.concat([tuple('__new__', key(initialArgs))])
    );
}


function determineSupportedWidgets(
    queries:{[key:string]:string},
    queryTypes:{[key:string]:QueryType},
    tagBuilderSupport:{[key:string]:boolean}

):{[key:string]:Array<string>} {

    const getWidgets = (filterId:string):Array<string> => {
        switch (queryTypes[filterId]) {
            case 'simple':
                return ['keyboard', 'history'];
            case 'advanced':
                const ans = ['keyboard', 'history'];
                if (tagBuilderSupport[filterId]) {
                    ans.push('tag');
                }
                return ans;
        }
    }

    return pipe(
        queries,
        Dict.keys(),
        List.map(filterId => tuple(filterId, getWidgets(filterId))),
        Dict.fromEntries()
    );
}


export interface FilterFormModelState extends QueryFormModelState {

    maincorps:{[key:string]:string};

    lposValues:{[key:string]:string};

    matchCaseValues:{[key:string]:boolean};

    defaultAttrValues:{[key:string]:string};

    pnFilterValues:{[key:string]:string};

    /**
     * Highlighted token FIRST/LAST. Specifies which token is highlighted.
     * This applies in case multiple matching tokens are found.
     */
    filflValues:{[key:string]:'f'|'l'};

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

    withinArgs:{[key:string]:boolean};

    hasLemma:{[key:string]:boolean};

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
        const queries = pipe(
            [...props.currQueries, ...[tuple('__new__', '')]],
            Dict.fromEntries()
        );
        const queryTypes = pipe(
            [...props.currQueryTypes, ...[tuple<string, QueryType>('__new__', 'simple')]],
            Dict.fromEntries()
        );
        const querySuggestions = pipe(
            [...props.currQueries, ...[tuple<string, Array<unknown>>('__new__', [])]],
            List.map(([k,]) => tuple(
                k, tuple(
                    [] as Array<PluginInterfaces.QuerySuggest.DataAndRenderer<unknown>>,
                    false)
            )),
            Dict.fromEntries()
        );

        const tagBuilderSupport = props.tagBuilderSupport;
        super(dispatcher, pageModel, textTypesModel, queryContextModel, 'filter-form-model', {
            formType: Kontext.ConcFormTypes.FILTER,
            forcedAttr: '', // TODO
            attrList: [...props.attrList],
            structAttrList: [...props.structAttrList],
            lemmaWindowSizes: [], // TODO
            posWindowSizes: [], // TODO
            wPoSList: [], // TODO
            currentAction: 'filter_form',
            queries, // corpname|filter_id -> query
            useCQLEditor: props.useCQLEditor,
            tagAttr: props.tagAttr,
            widgetArgs: {}, // TODO
            maincorps: Dict.fromEntries(props.maincorps),
            downArrowTriggersHistory: pipe(
                queries,
                Dict.map(v => false),
            ),
            currentSubcorp: pageModel.getCorpusIdent().usesubcorp,
            queryTypes,
            querySuggestions,
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
                List.map(item => tuple(item, null)),
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
            inputLanguage: props.inputLanguage,
            isAnonymousUser: props.isAnonymousUser,
            supportedWidgets: determineSupportedWidgets(
                queries,
                queryTypes,
                Dict.fromEntries(tagBuilderSupport)
            ),
            contextFormVisible: false,
            textTypesFormVisible: false,
            historyVisible: pipe(
                queries,
                Dict.keys(),
                List.map(k => tuple(k, false)),
                Dict.fromEntries()
            ),
            suggestionsVisible: pipe(
                queries,
                Dict.keys(),
                List.map(k => tuple(k, false)),
                Dict.fromEntries()
            ),
            suggestionsVisibility: props.suggestionsVisibility,
            isBusy: false,
            cursorPos: 0
        });
        this.syncInitialArgs = syncInitialArgs;

        this.addActionHandler<MainMenuActions.ShowFilter>(
            MainMenuActionName.ShowFilter,
            action => {
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload}));
            }
        );

        this.addActionHandler<Actions.CQLEditorDisable>(
            ActionName.CQLEditorDisable,
            action => {
                this.emitChange(); // TODO do we need this?
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetQType>(
            ActionName.QueryInputSetQType,
            action => action.payload.formType === 'filter',
            action => {
                this.changeState(state => {
                    state.queryTypes[action.payload.sourceId] = action.payload.queryType;
                    state.supportedWidgets = determineSupportedWidgets(
                        state.queries,
                        state.queryTypes,
                        state.tagBuilderSupport
                    );
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputAppendQuery>(
            ActionName.QueryInputAppendQuery,
            action => action.payload.formType === 'filter',
            action => {
                this.changeState(state => {
                    state.queries[action.payload.sourceId] = appendQuery(
                        state.queries[action.payload.sourceId],
                        action.payload.query,
                        action.payload.prependSpace
                    );
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetLpos>(
            ActionName.QueryInputSetLpos,
            action => action.payload.formType === 'filter',
            action => {
                this.changeState(state => {
                    state.lposValues[action.payload.sourceId] = action.payload.lpos;
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetMatchCase>(
            ActionName.QueryInputSetMatchCase,
            action => action.payload.formType === 'filter',
            action => {
                this.changeState(state => {
                    state.matchCaseValues[action.payload.sourceId] = action.payload.value;
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetDefaultAttr>(
            ActionName.QueryInputSetDefaultAttr,
            action => action.payload.formType === 'filter',
            action => {
                this.changeState(state => {
                    state.defaultAttrValues[action.payload.sourceId] = action.payload.value;
                });
            }
        );

        this.addActionSubtypeHandler<Actions.FilterInputSetPCQPosNeg>(
            ActionName.FilterInputSetPCQPosNeg,
            action => action.payload.formType === 'filter',
            action => {
                this.changeState(state => {
                    state.pnFilterValues[action.payload.filterId] = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.FilterInputSetFilfl>(
            ActionName.FilterInputSetFilfl,
            action => {
                this.changeState(state => {
                    state.filflValues[action.payload.filterId] = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.FilterInputSetRange>(
            ActionName.FilterInputSetRange,
            action => {
                this.changeState(state => {
                    this.setFilPosValue(
                        state,
                        action.payload.filterId,
                        action.payload.value,
                        action.payload.rangeId
                    );
                });
            }
        );

        this.addActionHandler<Actions.FilterInputSetInclKwic>(
            ActionName.FilterInputSetInclKwic,
            action => {
                this.changeState(state => {
                    state.inclkwicValues[action.payload.filterId] = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.ApplyFilter>(
            ActionName.ApplyFilter,
            action => {
                let err:Error;
                this.changeState(state => {
                    err = this.validateForm(state, action.payload.filterId);
                    if (err) {
                        return;
                    }
                    err = this.testQueryNonEmpty(action.payload.filterId);
                    if (err) {
                        return;
                    }
                    err = this.testQueryTypeMismatch();
                });
                if (!err) {
                    this.changeState(state => {
                        state.isBusy = true;
                    });
                    this.submitQuery(
                        action.payload.filterId,
                        this.pageModel.getConcArgs().q.substr(1)
                    ).pipe(
                        tap(
                            (data) => {
                                this.pageModel.updateConcPersistenceId(data.conc_persistence_op_id);
                                this.changeState(state => {
                                    state.isBusy = false;
                                });
                            }
                        )
                    ).subscribe(
                        (data) => {
                            dispatcher.dispatch<ConcActions.AddedNewOperation>({
                                name: ConcActionName.AddedNewOperation,
                                payload: {
                                    concId: data.conc_persistence_op_id,
                                    data
                                }
                            });

                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                        }
                    )

                } else {
                    this.pageModel.showMessage('error', err);
                }
            }
        );

        this.addActionHandler<Actions.QueryContextToggleForm>(
            ActionName.QueryContextToggleForm,
            action => {
                this.changeState(state => {
                    state.contextFormVisible = !state.contextFormVisible;
                });
            }
        );

        this.addActionHandler<Actions.QueryTextTypesToggleForm>(
            ActionName.QueryTextTypesToggleForm,
            action => {
                this.changeState(state => {
                    state.textTypesFormVisible = !state.textTypesFormVisible;
                });
            }
        );
    }

    private validateForm(state:FilterFormModelState, filterId:string):Error|null {
        if (validateNumber(state.filfposValues[filterId].value)) {
            state.filfposValues[filterId] = setFormItemInvalid(
                state.filfposValues[filterId], false);

        } else {
            state.filfposValues[filterId] = setFormItemInvalid(
                state.filfposValues[filterId], true);
            return new Error(this.pageModel.translate('global__invalid_number_format'));
        }

        if (validateNumber(state.filtposValues[filterId].value)) {
            state.filtposValues[filterId] = setFormItemInvalid(
                state.filtposValues[filterId], false);

        } else {
            state.filtposValues[filterId] = setFormItemInvalid(
                state.filtposValues[filterId], true);
            return new Error(this.pageModel.translate('global__invalid_number_format'));
        }
    }

    private setFilPosValue(state:FilterFormModelState, filterId:string, value:string,
            rangeId:string):void {
        if (rangeId === 'filfpos') {
            state.filfposValues[filterId] = {
                value,
                isInvalid: false,
                isRequired: true
            };

        } else if (rangeId === 'filtpos') {
            state.filtposValues[filterId] = {
                value,
                isInvalid: false,
                isRequired: true
            };
        }
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
                    if (data.form_type === Kontext.ConcFormTypes.FILTER) {
                        this.changeState(state => {
                            state.queries[filterId] = data.query;
                            state.queryTypes[filterId] = data.query_type;
                            state.maincorps[filterId] = data.maincorp;
                            state.pnFilterValues[filterId] = data.pnfilter;
                            state.filflValues[filterId] = data.filfl;
                            state.filfposValues[filterId] = {
                                value: data.filfpos,
                                isInvalid: false,
                                isRequired: true
                            };
                            state.filtposValues[filterId] = {
                                value: data.filtpos,
                                isInvalid: false,
                                isRequired: true
                            };
                            state.inclkwicValues[filterId] = data.inclkwic;
                            state.matchCaseValues[filterId] = data.qmcase;
                            state.defaultAttrValues[filterId] = data.default_attr_value;
                            state.tagBuilderSupport[filterId] = data.tag_builder_support;
                            state.withinArgs[filterId] = data.within;
                            state.lposValues[filterId] = data.lpos;
                            state.hasLemma[filterId] = data.has_lemma;
                            state.opLocks[filterId] = false;
                            state.supportedWidgets = determineSupportedWidgets(
                                state.queries,
                                state.queryTypes,
                                state.tagBuilderSupport
                            );
                        });

                    } else if (data.form_type === Kontext.ConcFormTypes.LOCKED ||
                            data.form_type === Kontext.ConcFormTypes.LGROUP) {
                        this.changeState(state => {
                            state.opLocks[filterId] = true;
                        });

                    } else {
                        throw new Error(
                            'Cannot sync filter model - invalid form data type: ' + data.form_type);
                    }
                }
            )
        );
    }

    private createSubmitArgs(filterId:string, concId:string):FilterServerArgs {
        return {
            type:'filterQueryArgs',
            qtype: this.state.queryTypes[filterId],
            query: this.state.queries[filterId],
            pnfilter: this.state.pnFilterValues[filterId],
            filfl: this.state.filflValues[filterId],
            filfpos: this.state.filfposValues[filterId].value,
            filtpos: this.state.filtposValues[filterId].value,
            inclkwic: this.state.inclkwicValues[filterId] ? 1 : 0,
            within: this.state.withinArgs[filterId],
            qmcase: this.state.matchCaseValues[filterId],
            ...this.pageModel.getConcArgs(),
            q: '~' + concId
        }
    }

    /**
     *
     * @param filterId id of filter operation (__new__ for new, conc ID if already applied)
     * @param concId concID we want to attach the submit to (it may or may not be equal to filterId)
     */
    submitQuery(filterId:string, concId:string):Observable<AjaxConcResponse> {
        const args = this.createSubmitArgs(filterId, concId);
        return this.pageModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.pageModel.createActionUrl(
                'filter',
                [
                    ['format', 'json'],
                    ['q', '~' + concId]
                ]
            ),
            args,
            {
                contentType: 'application/json'
            }
        );
    }
}
