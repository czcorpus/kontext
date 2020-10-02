/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

/// <reference path="../../vendor.d.ts/cqlParser.d.ts" />

import { IFullActionControl } from 'kombo';
import { EmptyError, Observable, of as rxOf } from 'rxjs';
import { tap, map, concatMap, first, catchError } from 'rxjs/operators';
import { Dict, tuple, List, pipe, HTTP } from 'cnc-tskit';

import { Kontext, TextTypes, ViewOptions } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { GeneralQueryFormProperties, QueryFormModel, appendQuery, QueryFormModelState,
    shouldDownArrowTriggerHistory, ConcQueryArgs, QueryType, QueryContextArgs,
    SuggestionsData } from './common';
import { ActionName, Actions } from './actions';
import { ActionName as GenOptsActionName, Actions as GenOptsActions } from '../options/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { IUnregistrable } from '../common/common';
import { PluginInterfaces } from '../../types/plugins';
import { ConcQueryResponse, ConcServerArgs } from '../concordance/common';


export interface QueryFormUserEntries {
    currQueryTypes:{[corpname:string]:QueryType};
    // current queries values (e.g. when restoring a form state)
    currQueries:{[corpname:string]:string};
    currPcqPosNegValues:{[corpname:string]:'pos'|'neg'};
    currDefaultAttrValues:{[corpname:string]:string};
    currLposValues:{[corpname:string]:string};
    currQmcaseValues:{[corpname:string]:boolean};
    currIncludeEmptyValues:{[corpname:string]:boolean};
}


export interface QueryFormProperties extends GeneralQueryFormProperties, QueryFormUserEntries {
    corpora:Array<string>;
    availableAlignedCorpora:Array<Kontext.AttrItem>;
    textTypesNotes:string;
    subcorpList:Array<Kontext.SubcorpListItem>;
    currentSubcorp:string;
    origSubcorpName:string;
    isForeignSubcorpus:boolean;
    tagBuilderSupport:{[corpname:string]:boolean};
    shuffleConcByDefault:boolean;
    inputLanguages:{[corpname:string]:string};
    selectedTextTypes:TextTypes.ServerCheckedValues;
    hasLemma:{[corpname:string]:boolean};
    isAnonymousUser:boolean;
    suggestionsVisibility:PluginInterfaces.QuerySuggest.SuggestionVisibility;
    simpleQueryAttrSeq:Array<string>;
}

export interface QueryInputSetQueryProps {
    sourceId:string;
    query:string;
}

/**
 *
 * @param data
 */
export const fetchQueryFormArgs = (data:{[ident:string]:AjaxResponse.ConcFormArgs}):
        AjaxResponse.QueryFormArgsResponse => {
    const k = (() => {
        for (let p in data) {
            if (data.hasOwnProperty(p) && data[p].form_type === Kontext.ConcFormTypes.QUERY) {
                return p;
            }
        }
        return null;
    })();

    if (k !== null) {
        return <AjaxResponse.QueryFormArgsResponse>data[k];

    } else {
        return {
            messages: [],
            form_type: Kontext.ConcFormTypes.QUERY,
            op_key: '__new__',
            curr_query_types: {},
            curr_queries: {},
            curr_pcq_pos_neg_values: {},
            curr_include_empty_values: {},
            curr_lpos_values: {},
            curr_qmcase_values: {},
            curr_default_attr_values: {},
            tag_builder_support: {},
            selected_text_types: {},
            bib_mapping: {},
            has_lemma: {},
            tagset_docs:{}
        };
    }
};


function determineSupportedWidgets(
    corpora:Array<string>,
    queryTypes:{[key:string]:QueryType},
    tagBuilderSupport:{[key:string]:boolean},
    isAnonymousUser:boolean

):{[key:string]:Array<string>} {

    const getCorpWidgets = (corpname:string, queryType:QueryType):Array<string> => {
        const ans = ['keyboard'];
        if (!isAnonymousUser) {
            ans.push('history');
        }
        if (queryType === 'advanced') {
            ans.push('within');
            if (tagBuilderSupport[corpname]) {
                ans.push('tag');
            }
        }
        return ans;
    }
    return pipe(
        corpora,
        List.map(
            corpname => tuple(
                corpname,
                getCorpWidgets(corpname, queryTypes[corpname])
            )
        ),
        Dict.fromEntries()
    );
}


export interface FirstQueryFormModelState extends QueryFormModelState {

    corpora:Array<string>;

    availableAlignedCorpora:Array<Kontext.AttrItem>;

    subcorpList:Array<Kontext.SubcorpListItem>;

    origSubcorpName:string;

    isForeignSubcorpus:boolean;

    shuffleConcByDefault:boolean;

    lposValues:{[key:string]:string}; // corpname -> lpos

    matchCaseValues:{[key:string]:boolean}; // corpname -> qmcase

    pcqPosNegValues:{[key:string]:'pos'|'neg'};

    tagBuilderSupport:{[key:string]:boolean};

    inputLanguages:{[key:string]:string};

    hasLemma:{[key:string]:boolean};

    includeEmptyValues:{[key:string]:boolean}; // applies only for aligned languages

    /**
     * Text descriptions of text type structure for end user.
     * (applies for the main corpus)
     */
    textTypesNotes:string;

    /**
     * This does not equal to URL param shuffle=0/1.
     * If false then the decision is up to server
     * (= user settings). If true then shuffle is
     * set to '0' no matter what value is in user's
     * settings. By default this is set to false.
     *
     * We need this when replaying query chain
     * - otherwise the server would append another
     * shuffle to the initial query operation
     * (if applicable).
     */
    shuffleForbidden:boolean;
}


export interface FirstQueryFormModelSwitchPreserve {
    queryTypes:{[key:string]:QueryType};
    lposValues:{[key:string]:string};
    matchCaseValues:{[key:string]:boolean};
    queries:{[key:string]:string};
    includeEmptyValues:{[key:string]:boolean}; // applies only for aligned languages
}


/**
 *
 */
export class FirstQueryFormModel extends QueryFormModel<FirstQueryFormModelState>
        implements IUnregistrable {

    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            textTypesModel:TextTypesModel,
            queryContextModel:QueryContextModel,
            props:QueryFormProperties) {
        const corpora = props.corpora;
        const queryTypes = pipe(
            props.corpora,
            List.map(item => tuple(item, props.currQueryTypes[item] || 'simple')),
            Dict.fromEntries()
        );
        const querySuggestions:SuggestionsData = pipe(
            props.corpora,
            List.map(corp => tuple(corp,
                {
                    data: [] as Array<PluginInterfaces.QuerySuggest.DataAndRenderer<unknown>>,
                    isPartial: false,
                    valuePosStart: 0,
                    valuePosEnd: 0
                }
            )),
            Dict.fromEntries()
        );
        const tagBuilderSupport = props.tagBuilderSupport;
        super(dispatcher, pageModel, textTypesModel, queryContextModel, 'first-query-model', {
            formType: Kontext.ConcFormTypes.QUERY,
            forcedAttr: props.forcedAttr,
            attrList: props.attrList,
            structAttrList: props.structAttrList,
            lemmaWindowSizes: props.lemmaWindowSizes,
            posWindowSizes: props.posWindowSizes,
            wPoSList: props.wPoSList,
            tagAttr: props.tagAttr,
            useCQLEditor: props.useCQLEditor,
            currentAction: 'first_form',
            widgetArgs: {},
            corpora,
            availableAlignedCorpora: props.availableAlignedCorpora,
            subcorpList: props.subcorpList,
            currentSubcorp: props.currentSubcorp || '',
            origSubcorpName: props.origSubcorpName || '',
            isForeignSubcorpus: !!props.isForeignSubcorpus,
            shuffleForbidden: false,
            shuffleConcByDefault: props.shuffleConcByDefault,
            queries: pipe(
                props.corpora,
                List.map(item => tuple(item, props.currQueries[item] || '')),
                Dict.fromEntries()
            ),
            downArrowTriggersHistory: pipe(
                props.corpora,
                List.map(item => tuple(
                    item,
                    shouldDownArrowTriggerHistory(props.currQueries[item], 0, 0))
                ),
                Dict.fromEntries()
            ),
            lposValues: pipe(
                props.corpora,
                List.map(item => tuple(item, props.currLposValues[item] || '')),
                Dict.fromEntries()
            ),
            matchCaseValues: pipe(
                props.corpora,
                List.map(item => tuple(item, props.currQmcaseValues[item] || false)),
                Dict.fromEntries()
            ),
            defaultAttrValues: pipe(
                props.corpora,
                List.map(item => tuple(
                    item,
                    props.currDefaultAttrValues[item] ?
                        props.currDefaultAttrValues[item] :
                        (queryTypes[item] === 'advanced' || List.empty(props.simpleQueryAttrSeq) ? 'word' : '')
                )),
                Dict.fromEntries()
            ),
            queryTypes,
            querySuggestions,
            pcqPosNegValues: pipe(
                props.corpora,
                List.map(item => tuple(item, props.currPcqPosNegValues[item] || 'pos')),
                Dict.fromEntries()
            ),
            includeEmptyValues: pipe(
                props.corpora,
                List.map(item => tuple(item, props.currIncludeEmptyValues[item] || false)),
                Dict.fromEntries()
            ),
            tagBuilderSupport,
            inputLanguages: props.inputLanguages,
            hasLemma: props.hasLemma,
            textTypesNotes: props.textTypesNotes,
            activeWidgets: pipe(
                props.corpora,
                List.map(item => tuple(item, null)),
                Dict.fromEntries()
            ),
            isAnonymousUser: props.isAnonymousUser,
            supportedWidgets: determineSupportedWidgets(
                corpora,
                queryTypes,
                tagBuilderSupport,
                props.isAnonymousUser
            ),
            contextFormVisible: false,
            textTypesFormVisible: false,
            historyVisible: pipe(
                props.corpora,
                List.map(item => tuple(item, false)),
                Dict.fromEntries()
            ),
            suggestionsVisible: pipe(
                props.corpora,
                List.map(c => tuple(c, false)),
                Dict.fromEntries()
            ),
            suggestionsVisibility: props.suggestionsVisibility,
            isBusy: false,
            cursorPos: 0,
            simpleQueryAttrSeq: props.simpleQueryAttrSeq
        });
        this.setUserValues(this.state, props);

        this.addActionHandler<Actions.CQLEditorDisable>(
            ActionName.CQLEditorDisable,
            action => {
                this.emitChange();
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetQType>(
            ActionName.QueryInputSetQType,
            action => action.payload.formType === 'query',
            action => {
                this.changeState(state => {
                    state.queryTypes[action.payload.sourceId] = action.payload.queryType;
                    state.supportedWidgets = determineSupportedWidgets(
                        state.corpora,
                        state.queryTypes,
                        state.tagBuilderSupport,
                        state.isAnonymousUser
                    );
                })
            }
        );

        this.addActionHandler<Actions.QueryInputSelectSubcorp>(
            ActionName.QueryInputSelectSubcorp,
            action => {
                this.changeState(state => {
                    if (action.payload.pubName) {
                        state.currentSubcorp = action.payload.pubName;
                        state.origSubcorpName = action.payload.subcorp;
                        state.isForeignSubcorpus = action.payload.foreign;

                    } else {
                        state.currentSubcorp = action.payload.subcorp;
                        state.origSubcorpName = action.payload.subcorp;
                        state.isForeignSubcorpus = false;
                    }
                    const corpIdent = this.pageModel.getCorpusIdent();
                    this.pageModel.setConf<Kontext.FullCorpusIdent>(
                        'corpusIdent',
                        {
                            id: corpIdent.id,
                            name: corpIdent.name,
                            variant: corpIdent.variant,
                            usesubcorp: state.currentSubcorp,
                            origSubcorpName: state.origSubcorpName,
                            foreignSubcorp: state.isForeignSubcorpus
                        }
                    );
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputAppendQuery>(
            ActionName.QueryInputAppendQuery,
            action => action.payload.formType === 'query',
            action => {
                this.changeState(state => {
                    state.queries[action.payload.sourceId] = appendQuery(
                        state.queries[action.payload.sourceId],
                        action.payload.query,
                        action.payload.prependSpace
                    );
                    if (action.payload.closeWhenDone) {
                        state.activeWidgets[action.payload.sourceId] = null;
                    }
                });
            }
        );

        this.addActionHandler<Actions.QueryInputRemoveLastChar>(
            ActionName.QueryInputRemoveLastChar,
            action => {
                this.changeState(state => {
                    const currQuery2 = state.queries[action.payload.sourceId];
                    if (currQuery2.length > 0) {
                        state.queries[action.payload.sourceId] =
                            currQuery2.substr(0, currQuery2.length - 1);
                    }
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetLpos>(
            ActionName.QueryInputSetLpos,
            action => action.payload.formType === 'query',
            action => {
                this.changeState(state => {
                    state.lposValues[action.payload.sourceId] = action.payload.lpos;
                });
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSetMatchCase>(
            ActionName.QueryInputSetMatchCase,
            action =>  action.payload.formType === 'query',
            action => {
                this.changeState(state => {
                    state.matchCaseValues[action.payload.sourceId] = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.QueryInputAddAlignedCorpus>(
            ActionName.QueryInputAddAlignedCorpus,
            action => {
                this.changeState(state => {
                    this.addAlignedCorpus(state, action.payload.corpname);
                });
            }
        );

        this.addActionHandler<Actions.QueryInputRemoveAlignedCorpus>(
            ActionName.QueryInputRemoveAlignedCorpus,
            action => {
                this.changeState(state => {
                    this.removeAlignedCorpus(state, action.payload.corpname);
                });
            }
        );

        this.addActionHandler<Actions.QueryInputSetIncludeEmpty>(
            ActionName.QueryInputSetIncludeEmpty,
            action => {
                this.changeState(state => {
                    state.includeEmptyValues[action.payload.corpname] = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.QueryInputMakeCorpusPrimary>(
            ActionName.QueryInputMakeCorpusPrimary,
            action => {
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.QueryContextFormPrepareArgsDone ?
                        null : syncData;

                }).subscribe(
                    (wAction:Actions.QueryContextFormPrepareArgsDone) => {
                        this.changeState(state => {
                            this.makeCorpusPrimary(state, action.payload.corpname);
                        });
                        window.location.href = this.pageModel.createActionUrl(
                            this.state.currentAction,
                            Dict.toEntries(this.createSubmitArgs(wAction.payload.data, 0))
                        );
                    }
                );
            }
        );

        this.addActionHandler<Actions.QuerySubmit>(
            ActionName.QuerySubmit,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.QueryContextFormPrepareArgsDone ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        (wAction:Actions.QueryContextFormPrepareArgsDone) => {
                            let err:Error;
                            err = this.testPrimaryQueryNonEmpty();
                            if (err !== null) {
                                throw err;
                            }
                            err = this.testQueryTypeMismatch();
                            if (err !== null) {
                                throw err;
                            }
                            return this.submitQuery(wAction.payload.data);
                        }
                    )

                ).subscribe(
                    (data:ConcQueryResponse|null) => {
                        if (data === null) {
                            if (this.state.defaultAttrValues[List.head(this.state.corpora)]) {
                                this.pageModel.showMessage(
                                    'error',
                                    this.pageModel.translate('query__no_result_found')
                                );

                            } else {
                                this.pageModel.showMessage(
                                    'error',
                                    this.pageModel.translate(
                                        'query__no_result_found_{attrs}',
                                        {attrs: this.state.simpleQueryAttrSeq.join(', ')}
                                    )
                                );
                            }
                            this.changeState(state => {
                                state.isBusy = false;
                            });

                        } else {
                            window.location.href = this.createViewUrl(
                                data.conc_persistence_op_id,
                                data.conc_args,
                                false
                            );
                        }
                    },
                    (err) => {
                        console.log('error: ', err);
                        this.pageModel.showMessage('error', err);
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                    }
                )
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.deserialize(
                            state,
                            action.payload.data[this.getRegistrationId()] as
                                FirstQueryFormModelSwitchPreserve,
                            action.payload.corpora,
                        );
                    });
                }
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            action => {
                dispatcher.dispatch<GlobalActions.SwitchCorpusReady<
                        FirstQueryFormModelSwitchPreserve>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(this.state)
                    }
                });
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

        this.addActionHandler<GenOptsActions.GeneralSetShuffle>(
            GenOptsActionName.GeneralSetShuffle,
            action => {
                this.changeState(state => {
                    state.shuffleConcByDefault = action.payload.value;
                });
            }
        );

        this.addActionHandler<Actions.FilterInputSetPCQPosNeg>(
            ActionName.FilterInputSetPCQPosNeg,
            action => {
                this.changeState(state => {
                    state.pcqPosNegValues[action.payload.filterId] = action.payload.value;
                });
            }
        );
    }

    disableDefaultShuffling():void {
        this.changeState(state => {
            state.shuffleForbidden = true;
        });
    }

    private testPrimaryQueryNonEmpty():Error|null {
        if (this.state.queries[List.head(this.state.corpora)].length === 0) {
            return new Error(this.pageModel.translate('query__query_must_be_entered'));
        }
        return null;
    }

    getRegistrationId():string {
        return 'FirstQueryFormModelState';
    }

    private serialize(state:FirstQueryFormModelState):FirstQueryFormModelSwitchPreserve {
        return {
            queryTypes: {...state.queryTypes},
            lposValues: {...state.lposValues},
            matchCaseValues: {...state.matchCaseValues},
            queries: {...state.queries},
            includeEmptyValues: {...state.includeEmptyValues}
        };
    }

    private deserialize(
        state:FirstQueryFormModelState,
        data:FirstQueryFormModelSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        if (data) {
            pipe(
                corpora,
                List.forEach(
                    ([oldCorp, newCorp], i) => {
                        state.queries[newCorp] = data.queries[oldCorp];
                        state.queryTypes[newCorp] = data.queryTypes[oldCorp];
                        state.matchCaseValues[newCorp] = data.matchCaseValues[oldCorp];
                        if (i > 0) {
                            state.includeEmptyValues[newCorp] = data.includeEmptyValues[oldCorp];
                        }
                    }
                )
            );
            state.supportedWidgets = determineSupportedWidgets(
                state.corpora,
                state.queryTypes,
                state.tagBuilderSupport,
                state.isAnonymousUser
            );
        }
    }

    getActiveWidget(sourceId:string):string {
        return this.state.activeWidgets[sourceId];
    }


    private setUserValues(state:FirstQueryFormModelState, data:QueryFormUserEntries):void {
        state.queries = pipe(
            state.corpora,
            List.map(item => tuple(item, data.currQueries[item] || '')),
            Dict.fromEntries()
        );
        state.lposValues = pipe(
            state.corpora,
            List.map(item => tuple(item, data.currLposValues[item] || '')),
            Dict.fromEntries()
        );
        state.matchCaseValues = pipe(
            state.corpora,
            List.map(item => tuple(item, data.currQmcaseValues[item] || false)),
            Dict.fromEntries()
        );
        state.queryTypes = pipe(
            state.corpora,
            List.map(item => tuple(item, data.currQueryTypes[item] || 'simple')),
            Dict.fromEntries()
        );
        state.defaultAttrValues = pipe(
            state.corpora,
            List.map(item => tuple(
                item,
                data.currDefaultAttrValues[item]?
                    data.currDefaultAttrValues[item] :
                    (state.queryTypes[item] === 'advanced' || List.empty(state.simpleQueryAttrSeq) ? 'word' : '')
            )),
            Dict.fromEntries()
        ),
        state.pcqPosNegValues = pipe(
            state.corpora,
            List.map(item => tuple(item, data.currPcqPosNegValues[item] || 'pos')),
            Dict.fromEntries()
        );
    }

    syncFrom(src:Observable<AjaxResponse.QueryFormArgs>):Observable<AjaxResponse.QueryFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'query') {
                        this.changeState(state => {
                            this.setUserValues(
                                state,
                                {
                                    currQueries: data.curr_queries,
                                    currQueryTypes: data.curr_query_types,
                                    currLposValues: data.curr_lpos_values,
                                    currDefaultAttrValues: data.curr_default_attr_values,
                                    currQmcaseValues: data.curr_qmcase_values,
                                    currPcqPosNegValues: data.curr_pcq_pos_neg_values,
                                    currIncludeEmptyValues: data.curr_include_empty_values
                                }
                            );
                            state.tagBuilderSupport = data.tag_builder_support;
                            state.hasLemma = data.has_lemma;
                            state.supportedWidgets = determineSupportedWidgets(
                                state.corpora,
                                state.queryTypes,
                                state.tagBuilderSupport,
                                state.isAnonymousUser
                            );
                        });
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === Kontext.ConcFormTypes.QUERY) {
                        return data;

                    } else if (data.form_type === Kontext.ConcFormTypes.LOCKED) {
                        return null;

                    } else {
                        throw new Error(
                            'Cannot sync query store - invalid form data type: ' + data.form_type);
                    }
                }
            )
        )
    }

    private makeCorpusPrimary(state:FirstQueryFormModelState, corpname:string):void {
        List.removeValue(corpname, state.corpora);
        state.corpora.unshift(corpname);
        state.currentSubcorp = '';
    }

    private addAlignedCorpus(state:FirstQueryFormModelState, corpname:string):void {
        if (!List.some(v => v === corpname, state.corpora) &&
                List.some(x => x.n === corpname, state.availableAlignedCorpora)) {
            state.corpora.push(corpname);
            if (!Dict.hasKey(corpname, state.queries)) {
                state.queries[corpname] = '';
            }
            if (!Dict.hasKey(corpname, state.lposValues)) {
                state.lposValues[corpname] = '';
            }
            if (!Dict.hasKey(corpname, state.matchCaseValues)) {
                state.matchCaseValues[corpname] = false;
            }
            if (!Dict.hasKey(corpname, state.queryTypes)) {
                state.queryTypes[corpname] = 'simple'; // TODO what about some session-stored stuff?
            }
            if (!Dict.hasKey(corpname, state.pcqPosNegValues)) {
                state.pcqPosNegValues[corpname] = 'pos';
            }
            if (!Dict.hasKey(corpname, state.includeEmptyValues)) {
                state.includeEmptyValues[corpname] = false;
            }
            if (!Dict.hasKey(corpname, state.defaultAttrValues)) {
                state.defaultAttrValues[corpname] = state.queryTypes[corpname] === 'advanced' ?
                    'word' : '';
            }
            state.supportedWidgets = determineSupportedWidgets(state.corpora, state.queryTypes,
                state.tagBuilderSupport, state.isAnonymousUser);

        } else {
            // TODO error
        }
    }

    private removeAlignedCorpus(state:FirstQueryFormModelState, corpname:string):void {
        List.removeValue(corpname, state.corpora);
    }

    createSubmitArgs(contextFormArgs:QueryContextArgs, attrTryIdx:number):ConcQueryArgs {
        const primaryCorpus = List.head(this.state.corpora);
        const currArgs = this.pageModel.exportConcArgs();
        const args:ConcQueryArgs = {
            type:'concQueryArgs',
            maincorp: primaryCorpus,
            usesubcorp: this.state.currentSubcorp || null,
            viewmode: 'kwic',
            pagesize: parseInt(currArgs.head('pagesize')),
            attrs: currArgs.getList('attrs'),
            attr_vmode: currArgs.head('attr_vmode') as ViewOptions.AttrViewMode,
            base_viewattr: currArgs.head('base_viewattr'),
            ctxattrs: currArgs.getList('ctxattrs'),
            structs: currArgs.getList('structs'),
            refs: currArgs.getList('refs'),
            fromp: parseInt(currArgs.head('fromp') || '0'),
            shuffle: this.state.shuffleConcByDefault && !this.state.shuffleForbidden ? 1 : 0,
            queries: [],
            text_types: this.textTypesModel.exportSelections(false),
            context: contextFormArgs
        };

        if (this.state.corpora.length > 1) {
            args.maincorp = primaryCorpus;
            args.viewmode = 'align';
        }

        args.queries = List.map(
            (c, i) => ({
                corpname: c,
                query: this.state.queries[c] ? this.state.queries[c].trim().normalize() : '',
                qtype: this.state.queryTypes[c],
                qmcase: this.state.matchCaseValues[c],
                pcq_pos_neg: this.state.pcqPosNegValues[c],
                include_empty: this.state.includeEmptyValues[c],
                default_attr: this.state.defaultAttrValues[c] || i > 0 ?
                    this.state.defaultAttrValues[c] : this.state.simpleQueryAttrSeq[attrTryIdx]
            }),
            this.state.corpora
        );

        return args;
    }


    createViewUrl(concId:string, args:ConcServerArgs, retJson:boolean):string {
        return this.pageModel.createActionUrl(
            'view', [
                ['q', '~' + concId],
                ['format', retJson ? 'json' : undefined],
                ...pipe(
                    args,
                    Dict.toEntries()
                )
            ]
        );
    }

    submitQuery(contextFormArgs:QueryContextArgs):Observable<ConcQueryResponse|null> {

        return rxOf(...List.repeat(i => i, Math.max(1, this.state.simpleQueryAttrSeq.length))).pipe(
            concatMap(
                (attrIdx) => this.pageModel.ajax$<ConcQueryResponse>(
                    HTTP.Method.POST,
                    this.pageModel.createActionUrl('query_submit', [tuple('format', 'json')]),
                    this.createSubmitArgs(contextFormArgs, attrIdx),
                    {
                        contentType: 'application/json'
                    }
                )
            ),
            first(
                ans => ans.finished !== true || ans.size > 0
            ),
            catchError(
                err => {
                    if (err instanceof EmptyError) {
                        return rxOf(null);

                    } else {
                        throw err;
                    }
                }
            )
        )
    }

}
