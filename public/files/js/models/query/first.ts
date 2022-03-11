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
import { Observable } from 'rxjs';
import { tap, map, concatMap } from 'rxjs/operators';
import { Dict, tuple, List, pipe, HTTP } from 'cnc-tskit';

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { GeneralQueryFormProperties, QueryFormModel, QueryFormModelState,
    ConcQueryArgs, QueryContextArgs, determineSupportedWidgets, getTagBuilderSupport, suggestionsEnabled } from './common';
import { Actions } from './actions';
import { Actions as GenOptsActions } from '../options/actions';
import { Actions as TTActions } from '../../models/textTypes/actions';
import { Actions as GlobalActions } from '../common/actions';
import { IUnregistrable } from '../common/common';
import * as PluginInterfaces from '../../types/plugins';
import { ConcQueryResponse, ConcServerArgs } from '../concordance/common';
import { AdvancedQuery, advancedToSimpleQuery, AnyQuery, AnyQuerySubmit, parseSimpleQuery,
    QueryType, SimpleQuery, simpleToAdvancedQuery} from './query';
import { ajaxErrorMapped } from '../../app/navigation';
import { AttrHelper } from '../cqleditor/attrs';
import { highlightSyntaxStatic } from '../cqleditor/parser';
import { ConcFormArgs, QueryFormArgs, QueryFormArgsResponse, SubmitEncodedSimpleTokens } from './formArgs';
import { QuickSubcorpModel } from '../subcorp/quickSubcorp';


export interface QueryFormUserEntries {
    currQueryTypes:{[sourceId:string]:QueryType};
    // current queries values (e.g. when restoring a form state)
    currQueries:{[sourceId:string]:string};
    currParsedQueries:{[sourceId:string]:SubmitEncodedSimpleTokens};
    currPcqPosNegValues:{[sourceId:string]:'pos'|'neg'};
    currDefaultAttrValues:{[sourceId:string]:string};
    currUseRegexpValues:{[sourceId:string]:boolean};
    currLposValues:{[sourceId:string]:string};
    currQmcaseValues:{[sourceId:string]:boolean};
    currIncludeEmptyValues:{[sourceId:string]:boolean};
}


export interface QueryFormProperties extends GeneralQueryFormProperties, QueryFormUserEntries {
    corpora:Array<string>;
    availableAlignedCorpora:Array<Kontext.AttrItem>;
    textTypesNotes:string;
    subcorpList:Array<Kontext.SubcorpListItem>;
    currentSubcorp:string;
    origSubcorpName:string;
    isForeignSubcorpus:boolean;
    shuffleConcByDefault:boolean;
    inputLanguages:{[corpname:string]:string};
    selectedTextTypes:TextTypes.ExportedSelection;
    hasLemma:{[corpname:string]:boolean};
    tagsets:{[corpname:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>};
    isAnonymousUser:boolean;
    isLocalUiLang:boolean;
    suggestionsConfigured:boolean;
    simpleQueryDefaultAttrs:{[corpname:string]:Array<string|Array<string>>};
    concViewPosAttrs:Array<string>;
    alignCommonPosAttrs:Array<string>;
}

export interface QueryInputSetQueryProps {
    sourceId:string;
    query:string;
}

/**
 *
 * @param data
 */
export const fetchQueryFormArgs = (data:{[ident:string]:ConcFormArgs}):
        QueryFormArgsResponse => {
    const k = (() => {
        for (let p in data) {
            if (data.hasOwnProperty(p) && data[p].form_type === Kontext.ConcFormTypes.QUERY) {
                return p;
            }
        }
        return null;
    })();

    if (k !== null) {
        return data[k] as QueryFormArgsResponse;

    } else {
        return {
            messages: [],
            form_type: Kontext.ConcFormTypes.QUERY,
            op_key: '__new__',
            curr_query_types: {},
            curr_queries: {},
            curr_parsed_queries: {},
            curr_pcq_pos_neg_values: {},
            curr_include_empty_values: {},
            curr_lpos_values: {},
            curr_qmcase_values: {},
            curr_default_attr_values: {},
            curr_use_regexp_values: {},
            selected_text_types: {},
            bib_mapping: {},
            has_lemma: {},
            tagsets: {},
            fc_lemword_type: 'none',
            fc_lemword_wsize: [-1, 1],
            fc_lemword: '',
            fc_pos_type: 'none',
            fc_pos_wsize: [-1, 1],
            fc_pos: []
        };
    }
};

function determineDefaultAttr(
    data:QueryFormUserEntries,
    sourceId:string,
    simpleQueryDefaultAttrs:string|Array<string>,
    attrList:Array<Kontext.AttrItem>
):string|Array<string> {

    const qtype = data.currQueryTypes[sourceId] || 'simple';
    const defaultAttr = data.currDefaultAttrValues[sourceId];
    if (defaultAttr) {
        return defaultAttr;
    }
    return qtype === 'simple' ? simpleQueryDefaultAttrs : List.head(attrList).n;
}

function importUserQueries(
    corpora:Array<string>,
    data:QueryFormUserEntries,
    simpleQueryDefaultAttrs:{[sourceId:string]:Array<string|Array<string>>},
    attrList:Array<Kontext.AttrItem>
):{[corpus:string]:AnyQuery} {

    return pipe(
        corpora,
        List.filter(corpus => Dict.hasKey(corpus, data.currQueryTypes)),
        List.map<string, [string, AnyQuery]>(corpus => {
            const qtype = data.currQueryTypes[corpus];
            const defaultAttr = determineDefaultAttr(
                data,
                corpus,
                List.head(simpleQueryDefaultAttrs[corpus]),
                attrList
            );
            const query = data.currQueries[corpus] || '';

            if (qtype === 'advanced') {
                const [queryHtml, parsedAttrs] = highlightSyntaxStatic({
                    query,
                    querySuperType: 'conc',
                    he: {
                        translate: (s:string, values?:any) => s
                    }
                });
                return tuple<string, AdvancedQuery>(
                    corpus,
                    {
                        corpname: corpus,
                        qtype: 'advanced',
                        query,
                        queryHtml,
                        rawAnchorIdx: 0,
                        rawFocusIdx: 0,
                        parsedAttrs,
                        focusedAttr: undefined,
                        pcq_pos_neg: data.currPcqPosNegValues[corpus] || 'pos',
                        include_empty: data.currIncludeEmptyValues[corpus] || false,
                        default_attr: Array.isArray(defaultAttr) ? List.head(defaultAttr) : defaultAttr // determineDefaultAttr always returns string for advanced query
                    }
                );

            } else {
                return tuple<string, SimpleQuery>(
                    corpus,
                    {
                        corpname: corpus,
                        qtype: 'simple',
                        query,
                        queryParsed: pipe(
                            parseSimpleQuery(data.currQueries[corpus], defaultAttr),
                            List.map(
                                (token, tokenIdx) => {
                                    const parsed = data.currParsedQueries[corpus];
                                    if (parsed) {
                                        const [args, isExtended] = data.currParsedQueries[corpus][tokenIdx];
                                        return {
                                            ...token,
                                            args,
                                            isExtended
                                        };
                                    }
                                    return token;
                                }
                            )
                        ),
                        queryHtml: query,
                        rawAnchorIdx: 0,
                        rawFocusIdx: 0,
                        qmcase: data.currQmcaseValues[corpus] || false,
                        use_regexp: data.currUseRegexpValues[corpus] || false,
                        pcq_pos_neg: data.currPcqPosNegValues[corpus] || 'pos',
                        include_empty: data.currIncludeEmptyValues[corpus] || false,
                        default_attr: defaultAttr
                    }
                );
            }
        }),
        Dict.fromEntries()
    );
}


export interface FirstQueryFormModelState extends QueryFormModelState {

    corpora:Array<string>;

    availableAlignedCorpora:Array<Kontext.AttrItem>;

    subcorpList:Array<Kontext.SubcorpListItem>;

    /**
     * In case this is current user's own corpus, the name corresponds to
     * the user-defined name. Otherwise (foreign published subc.) a public
     * identifier/code is used.
     */
    origSubcorpName:string;

    isForeignSubcorpus:boolean;

    shuffleConcByDefault:boolean;

    lposValues:{[key:string]:string}; // corpname -> lpos

    tagsets:{[key:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>};

    inputLanguages:{[key:string]:string};

    hasLemma:{[key:string]:boolean};

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

    alignedCorporaVisible:boolean;

    quickSubcorpVisible:boolean;

    quickSubcorpActive:boolean;

    /**
     * Attributes user wants to display
     */
     concViewPosAttrs:Array<string>;

     alignCommonPosAttrs:Array<string>;
}


export interface FirstQueryFormModelSwitchPreserve {
    queries:{[sourceId:string]:AnyQuery};
    lposValues:{[key:string]:string};
    alignedCorporaVisible:boolean;
    cqlEditorMessages:{[key:string]:Array<string>};
}


/**
 *
 */
export class FirstQueryFormModel extends QueryFormModel<FirstQueryFormModelState>
    implements IUnregistrable {

    protected readonly quickSubcorpModel:QuickSubcorpModel;

    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            textTypesModel: TextTypesModel,
            quickSubcorpModel:QuickSubcorpModel,
            queryContextModel:QueryContextModel,
            qsPlugin:PluginInterfaces.QuerySuggest.IPlugin,
            props:QueryFormProperties
    ) {
        const corpora = props.corpora;
        const queries = importUserQueries(
            corpora, props, props.simpleQueryDefaultAttrs, props.attrList);
        const attrHelper = new AttrHelper( // TODO this is only for the primary corpus
            props.attrList,
            props.structAttrList,
            props.structList,
            props.tagsets[List.head(props.corpora)]
        );
        super(
            dispatcher,
            pageModel,
            textTypesModel,
            queryContextModel,
            qsPlugin,
            attrHelper,
            'first-query-model',
            {
                formType: Kontext.ConcFormTypes.QUERY,
                forcedAttr: props.forcedAttr,
                attrList: props.attrList,
                structAttrList: props.structAttrList,
                wPoSList: props.wPoSList,
                useRichQueryEditor: props.useRichQueryEditor,
                currentAction: 'query',
                corpora,
                availableAlignedCorpora: props.availableAlignedCorpora,
                subcorpList: props.subcorpList,
                currentSubcorp: props.currentSubcorp || '',
                origSubcorpName: props.origSubcorpName || '',
                isForeignSubcorpus: !!props.isForeignSubcorpus,
                shuffleForbidden: false,
                shuffleConcByDefault: props.shuffleConcByDefault,
                queries,
                cqlEditorMessages: {},
                downArrowTriggersHistory: pipe(
                    props.corpora,
                    List.map(item => tuple(
                        item,
                        true)
                    ),
                    Dict.fromEntries()
                ),
                lposValues: pipe(
                    props.corpora,
                    List.map(item => tuple(item, props.currLposValues[item] || '')),
                    Dict.fromEntries()
                ),
                inputLanguages: props.inputLanguages,
                hasLemma: props.hasLemma,
                tagsets: props.tagsets,
                textTypesNotes: props.textTypesNotes,
                activeWidgets: pipe(
                    props.corpora,
                    List.map(item => tuple(item, null)),
                    Dict.fromEntries()
                ),
                isAnonymousUser: props.isAnonymousUser,
                supportedWidgets: determineSupportedWidgets(
                    queries,
                    getTagBuilderSupport(props.tagsets),
                    props.isAnonymousUser
                ),
                contextFormVisible: false,   // TODO load from previous state ?
                textTypesFormVisible: false, // dtto
                queryOptionsVisible: pipe(
                    props.corpora,
                    List.map(item => tuple(item, true)),
                    Dict.fromEntries()
                ),   // dtto
                historyVisible: pipe(
                    props.corpora,
                    List.map(item => tuple(item, false)),
                    Dict.fromEntries()
                ),
                suggestionsVisible: pipe(
                    props.corpora,
                    List.map(c => tuple(c, null)),
                    Dict.fromEntries()
                ),
                suggestionsConfigured: props.suggestionsConfigured,
                suggestionsEnabled: pipe(
                    queries,
                    Dict.map(
                        query => suggestionsEnabled(
                            qsPlugin,
                            props.suggestionsConfigured,
                            Kontext.ConcFormTypes.QUERY,
                            query
                        )
                    )
                ),
                suggestionsLoading: pipe(
                    props.corpora,
                    List.map(c => tuple(c, {})),
                    Dict.fromEntries()
                ),
                isBusy: false,
                simpleQueryDefaultAttrs: props.simpleQueryDefaultAttrs,
                alignedCorporaVisible: List.size(corpora) > 1,
                isLocalUiLang: props.isLocalUiLang,
                quickSubcorpVisible: false,
                quickSubcorpActive: Dict.size(textTypesModel.UNSAFE_exportSelections(false)) > 0,
                concViewPosAttrs: props.concViewPosAttrs,
                alignCommonPosAttrs: props.alignCommonPosAttrs
        });
        this.quickSubcorpModel = quickSubcorpModel;

        this.addActionHandler(
            Actions.QueryInputSelectSubcorp,
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
                            ...corpIdent,
                            usesubcorp: state.currentSubcorp,
                            origSubcorpName: state.origSubcorpName,
                            foreignSubcorp: state.isForeignSubcorpus
                        }
                    );
                });
            }
        );

        this.addActionSubtypeHandler(
            Actions.QueryInputSetLpos,
            action => action.payload.formType === 'query',
            action => {
                this.changeState(state => {
                    state.lposValues[action.payload.sourceId] = action.payload.lpos;
                });
            }
        );

        this.addActionHandler(
            Actions.QueryToggleAlignedCorpora,
            action => {
                this.changeState(state => {
                    state.alignedCorporaVisible = !state.alignedCorporaVisible;
                });
            }
        );

        this.addActionHandler(
            Actions.QueryInputSetIncludeEmpty,
            action => {
                this.changeState(state => {
                    state.queries[action.payload.corpname].include_empty = action.payload.value;
                });
            }
        );

        this.addActionHandler(
            Actions.QuerySubmit,
            action => {
                this.changeState(state => {
                    state.isBusy = true;
                });
                this.suspend({}, (action, syncData) => {
                    return action.name === Actions.QueryContextFormPrepareArgsDone.name ?
                        null : syncData;

                }).pipe(
                    concatMap(
                        (wAction) => {
                            let err:Error;
                            err = this.testPrimaryQueryNonEmpty();
                            if (err !== null) {
                                throw err;
                            }
                            err = this.testQueryTypeMismatch();
                            if (err !== null) {
                                throw err;
                            }
                            return this.submitQuery(
                                (wAction as typeof Actions.QueryContextFormPrepareArgsDone).payload.data,
                                true
                            );
                        }
                    )

                ).subscribe({
                    next: ([data, messages]) => {
                        if (data === null) {
                            if (!List.empty(messages)) {
                                List.forEach(
                                    ([msgType, msg]) => {
                                        this.pageModel.showMessage(msgType, msg);
                                    },
                                    messages
                                );

                            } else {
                                this.pageModel.showMessage(
                                    'error',
                                    this.pageModel.translate('query__no_result_found')
                                );
                            }

                            this.changeState(state => {
                                state.isBusy = false;
                            });

                        } else {
                            window.location.href = this.createViewUrl(
                                data.conc_persistence_op_id,
                                data.conc_args,
                                false,
                                true
                            );
                        }
                    },
                    error: error => {
                        this.pageModel.showMessage('error', error);
                        this.changeState(state => {
                            state.isBusy = false;
                        });
                    }
                });
            }
        );

        this.addActionHandler(
            GlobalActions.CorpusSwitchModelRestore,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        this.deserialize(
                            state,
                            action.payload.data[this.getRegistrationId()] as
                                FirstQueryFormModelSwitchPreserve,
                            action.payload.corpora
                        );
                    });
                    this.autoSuggestTrigger.next(tuple(List.head(action.payload.corpora)[1], 0, 0));
                }
            }
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus,
            action => {
                if (this.qsSubscription) {
                    this.qsSubscription.unsubscribe();
                }
                dispatcher.dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(
                            this.state,
                            action.payload.corpora,
                            action.payload.newPrimaryCorpus
                        )
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.QueryContextToggleForm,
            action => {
                this.changeState(state => {
                    state.contextFormVisible = !state.contextFormVisible;
                });
            }
        );

        this.addActionHandler(
            Actions.QueryTextTypesToggleForm,
            action => {
                this.changeState(state => {
                    state.textTypesFormVisible = !state.textTypesFormVisible;
                });
            }
        );

        this.addActionHandler(
            GenOptsActions.GeneralSetShuffle,
            action => {
                this.changeState(state => {
                    state.shuffleConcByDefault = action.payload.value;
                });
            }
        );

        this.extendActionHandler(
            GenOptsActions.SaveSettingsDone,
            action => {
                if (!action.error) {
                    this.changeState(state => {
                        state.concViewPosAttrs = [...action.payload.posAttrs];
                    });
                }
            }
        );

        this.addActionHandler(
            Actions.QueryInputSetPCQPosNeg,
            action => {
                this.changeState(state => {
                    const queryObj = state.queries[action.payload.sourceId];
                    queryObj.pcq_pos_neg = action.payload.value;
                });
            }
        );

        this.addActionHandler(
            Actions.QueryShowQuickSubcorpWidget,
            action => {
                this.changeState(state => {
                    state.quickSubcorpVisible = true;
                });
            }
        );

        this.addActionHandler(
            Actions.QueryHideQuickSubcorpWidget,
            action => {
                this.changeState(state => {
                    state.quickSubcorpVisible = false;
                });
            }
        );

        this.addActionHandler(
            TTActions.SelectionChanged,
            action => {
                this.changeState(state => {
                    state.quickSubcorpActive = action.payload.hasSelectedItems
                });
            }
        );

        this.addActionHandler(
            Actions.QueryAddSubcorp,
            action => {
                this.changeState(state => {
                    state.subcorpList.push(action.payload);
                    state.quickSubcorpVisible = false;
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
        if (this.state.queries[List.head(this.state.corpora)].query.length === 0) {
            return new Error(this.pageModel.translate('query__query_must_be_entered'));
        }
        return null;
    }

    getRegistrationId():string {
        return 'FirstQueryFormModelState';
    }

    private serialize(
        state:FirstQueryFormModelState,
        newCorpora:Array<string>,
        newPrimaryCorpus:string|undefined
    ):FirstQueryFormModelSwitchPreserve {

        const getSrcCorp = newPrimaryCorpus ?
            (oldc:string) => {
                if (oldc === newPrimaryCorpus) {
                    return List.head(state.corpora);

                } else if (newPrimaryCorpus && oldc === List.head(state.corpora)) {
                    return newPrimaryCorpus;
                }
                return oldc;
            } :
            (oldc:string) => oldc;

        const commonCorps = List.zip(newCorpora, state.corpora);
        return {
            queries: pipe(
                commonCorps,
                List.map(
                    // here we force new corpname to otherwise old query to make
                    // the deserialization easier (no need to know the prev. corpus
                    // when restoring model; there were even some problems with using prev. corpname)
                    ([oldCorp, newCorp]) => tuple(
                        newCorp,
                        {...state.queries[getSrcCorp(oldCorp)], corpname: newCorp}
                    )
                ),
                Dict.fromEntries()
            ),
            lposValues: pipe(
                commonCorps,
                List.map(
                    ([oldCorp, newCorp]) => tuple(newCorp, state.lposValues[getSrcCorp(oldCorp)])
                ),
                Dict.fromEntries()
            ),
            alignedCorporaVisible: state.alignedCorporaVisible,
            cqlEditorMessages: pipe(
                commonCorps,
                List.map(
                    ([oldCorp, newCorp]) => tuple(newCorp, state.cqlEditorMessages[getSrcCorp(oldCorp)])
                ),
                Dict.fromEntries()
            )
        };
    }

    private transferFormValues(
        state:FirstQueryFormModelState,
        data:FirstQueryFormModelSwitchPreserve,
        corp:string,
        isAligned?:boolean
    ) {
        const oldQuery = data.queries[corp];
        let newQuery = state.queries[corp];
        if (newQuery.qtype === 'advanced' && oldQuery.qtype === 'simple') {
            newQuery = advancedToSimpleQuery(newQuery, List.head(state.simpleQueryDefaultAttrs[corp]));

        } else if (newQuery.qtype === 'simple' && oldQuery.qtype === 'advanced') {
            newQuery = simpleToAdvancedQuery(newQuery, List.head(state.attrList).n);

        } else if (newQuery.qtype === 'simple' && oldQuery.qtype === 'simple') {
            newQuery.qmcase = oldQuery.qmcase;
            newQuery.use_regexp = oldQuery.use_regexp;
        }
        state.queries[corp] = newQuery;
        this.setRawQuery(state, corp, oldQuery.query, null);
        state.cqlEditorMessages[corp] = [];
        if (!isAligned) {
            state.queries[corp].include_empty = false; // this is rather a formal stuff
        }
    }

    private deserialize(
        state:FirstQueryFormModelState,
        data:FirstQueryFormModelSwitchPreserve,
        corpora:Array<[string|undefined, string|undefined]>
    ):void {

        if (data) {
            pipe(
                corpora,
                List.filter(([oldCorp, newCorp]) => !!oldCorp && !!newCorp), // add/remove aligned corp
                List.forEach(([,newCorp], i) => this.transferFormValues(state, data, newCorp, i > 0))
            );
            state.alignedCorporaVisible = data.alignedCorporaVisible;
            state.supportedWidgets = determineSupportedWidgets(
                state.queries,
                getTagBuilderSupport(this.getTagsets(state)),
                state.isAnonymousUser
            );
        }
    }

    getActiveWidget(sourceId:string):string {
        return this.state.activeWidgets[sourceId];
    }

    syncFrom(src:Observable<QueryFormArgs>):Observable<QueryFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'query') {
                        this.changeState(state => {
                            state.queries = importUserQueries(
                                state.corpora,
                                {
                                    currQueries: data.curr_queries,
                                    currParsedQueries: data.curr_parsed_queries,
                                    currQueryTypes: data.curr_query_types,
                                    currLposValues: data.curr_lpos_values,
                                    currDefaultAttrValues: data.curr_default_attr_values,
                                    currUseRegexpValues: data.curr_use_regexp_values,
                                    currQmcaseValues: data.curr_qmcase_values,
                                    currPcqPosNegValues: data.curr_pcq_pos_neg_values,
                                    currIncludeEmptyValues: data.curr_include_empty_values
                                },
                                state.simpleQueryDefaultAttrs,
                                state.attrList
                            );
                            state.tagsets = data.tagsets;
                            state.hasLemma = data.has_lemma;
                            state.supportedWidgets = determineSupportedWidgets(
                                state.queries,
                                getTagBuilderSupport(this.getTagsets(state)),
                                state.isAnonymousUser
                            );
                            Dict.forEach(
                                (queryObj, corpusId) => {
                                    if (queryObj.qtype === 'advanced') {
                                        this.reparseAdvancedQuery(state, corpusId, true);

                                    } else {
                                        this.rehighlightSimpleQuery(queryObj);
                                    }
                                },
                                state.queries
                            )
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

    getTagsets(state:FirstQueryFormModelState):{[sourceId:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>} {
        return state.tagsets;
    }

    private exportQuery(query:AnyQuery):AnyQuerySubmit {
        if (query.qtype === 'advanced') {
            return {
                qtype: 'advanced',
                corpname: query.corpname,
                query: query.query.trim().normalize(),
                pcq_pos_neg: query.pcq_pos_neg,
                include_empty: query.include_empty,
                default_attr: !Array.isArray(query.default_attr) ?
                                    query.default_attr : ''
            };

        } else {
            return {
                qtype: 'simple',
                corpname: query.corpname,
                query: query.query.trim().normalize(),
                queryParsed: pipe(
                    query.queryParsed,
                    List.map(
                        token => tuple(
                            token.args.length > 0 && token.args[0][0] ?
                                token.args :
                                [tuple(query.default_attr, token.args[0][1])],
                            token.isExtended
                        )
                    )
                ),
                qmcase: query.qmcase,
                pcq_pos_neg: query.pcq_pos_neg,
                include_empty: query.include_empty,
                default_attr: Array.isArray(query.default_attr) ? '' : query.default_attr,
                use_regexp: query.use_regexp
            }
        }
    }

    createSubmitArgs(
        contextFormArgs:QueryContextArgs,
        async:boolean,
        noQueryHistory:boolean
    ):ConcQueryArgs {

        const currArgs = this.pageModel.getConcArgs();
        const args:ConcQueryArgs = {
            type: 'concQueryArgs',
            usesubcorp: this.state.currentSubcorp || undefined,
            viewmode: 'kwic',
            pagesize: currArgs.pagesize,
            attrs: currArgs.attrs,
            attr_vmode: currArgs.attr_vmode,
            base_viewattr: currArgs.base_viewattr,
            ctxattrs: currArgs.ctxattrs,
            structs: currArgs.structs,
            refs: currArgs.refs,
            fromp: currArgs.fromp || 0,
            shuffle: this.state.shuffleConcByDefault && !this.state.shuffleForbidden ? 1 : 0,
            queries: [],
            text_types: this.disableRestrictSearch(this.state) ? {} : this.textTypesModel.UNSAFE_exportSelections(false),
            context: contextFormArgs,
            async,
            no_query_history: noQueryHistory
        };

        if (this.state.corpora.length > 1) {
            args.viewmode = 'align';
        }

        args.queries = List.map(
            corpus => this.exportQuery(this.state.queries[corpus]),
            this.state.corpora
        );

        return args;
    }


    createViewUrl(concId:string, args:ConcServerArgs, retJson:boolean, async:boolean):string {
        return this.pageModel.createActionUrl(
            'view',
            {
                q: ['~' + concId],
                asnc: async,
                format: retJson ? 'json' : undefined,
                ...args
            }
        );
    }


    submitQuery(
        contextFormArgs:QueryContextArgs,
        async:boolean,
        noQueryHistory?:boolean
    ):Observable<[ConcQueryResponse|null, Array<[Kontext.UserMessageTypes, string]>]> {

        return this.pageModel.ajax$<ConcQueryResponse>(
            HTTP.Method.POST,
            this.pageModel.createActionUrl(
                'query_submit',
                {format: 'json'}
            ),
            this.createSubmitArgs(contextFormArgs, async, noQueryHistory),
            {
                contentType: 'application/json'
            }
        ).pipe(
            ajaxErrorMapped({
                502: this.pageModel.translate('global__human_readable_502')
            }),
            map(
                ans => tuple(
                    ans.finished !== true || ans.size > 0 ? ans : null,
                    ans.messages || []
                )
            )
        );
    }

    disableRestrictSearch(state:QueryFormModelState):boolean {
        return !!state.currentSubcorp
    }

}
