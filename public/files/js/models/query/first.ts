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
import { tap, map } from 'rxjs/operators';
import { Dict, tuple, List, pipe } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { GeneralQueryFormProperties, QueryFormModel, appendQuery, QueryFormModelState,
    shouldDownArrowTriggerHistory, ConcQueryArgs, QueryType, QueryContextArgs } from './common';
import { ActionName, Actions } from './actions';
import { ActionName as GenOptsActionName, Actions as GenOptsActions } from '../options/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { IUnregistrable } from '../common/common';
import { PluginInterfaces } from '../../types/plugins';


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
    selectedTextTypes:{[structattr:string]:Array<string>};
    hasLemma:{[corpname:string]:boolean};
    tagsetDocs:{[corpname:string]:string};
    isAnonymousUser:boolean;
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


function determineSupportedWidgets(corpora:Array<string>, queryTypes:{[key:string]:string},
        tagBuilderSupport:{[key:string]:boolean},
        isAnonymousUser:boolean):{[key:string]:Array<string>} {

    const getCorpWidgets = (corpname:string, queryType:string):Array<string> => {
        const ans = ['keyboard'];
        if (!isAnonymousUser) {
            ans.push('history');
        }
        if (queryType === 'cql') {
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

    currentSubcorp:string;

    origSubcorpName:string;

    isForeignSubcorpus:boolean;

    shuffleConcByDefault:boolean;

    lposValues:{[key:string]:string}; // corpname -> lpos

    matchCaseValues:{[key:string]:boolean}; // corpname -> qmcase

    defaultAttrValues:{[key:string]:string};

    pcqPosNegValues:{[key:string]:'pos'|'neg'};

    tagBuilderSupport:{[key:string]:boolean};

    inputLanguages:{[key:string]:string};

    hasLemma:{[key:string]:boolean};

    tagsetDocs:{[key:string]:string};

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
            List.map(item => tuple(item, props.currQueryTypes[item] || 'iquery')),
            Dict.fromEntries()
        );
        const querySuggestions = pipe(
            props.corpora,
            List.map(corp => tuple(corp,
                [] as Array<PluginInterfaces.QuerySuggest.DataAndRenderer>)),
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
                List.map(item => tuple(item, props.currDefaultAttrValues[item] || 'word')),
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
            tagsetDocs: props.tagsetDocs,
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
            historyVisible: false
        });
        this.setUserValues(this.state, props);

        this.addActionHandler<Actions.CQLEditorDisable>(
            ActionName.CQLEditorDisable,
            action => {
                this.emitChange();
            }
        );

        this.addActionSubtypeHandler<Actions.QueryInputSelectType>(
            ActionName.QueryInputSelectType,
            action => action.payload.formType === 'query',
            action => {
                this.changeState(state => {
                    let qType = action.payload.queryType;
                    if (!state.hasLemma[action.payload.sourceId] &&  qType === 'lemma') {
                        qType = 'phrase';
                        this.pageModel.showMessage(
                            'warning',
                            'Lemma attribute not available, using "phrase"'
                        );
                    }
                    state.queryTypes[action.payload.sourceId] = qType;
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

        this.addActionSubtypeHandler<Actions.QueryInputSetDefaultAttr>(
            ActionName.QueryInputSetDefaultAttr,
            action => action.payload.formType === 'query',
            action => {
                this.changeState(state => {
                    state.defaultAttrValues[action.payload.sourceId] = action.payload.value;
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
                            this.createSubmitArgs(wAction.payload.data).items()
                        );
                    }
                );
            }
        );

        this.addActionHandler<Actions.QuerySubmit>(
            ActionName.QuerySubmit,
            action => {
                this.suspend({}, (action, syncData) => {
                    return action.name === ActionName.QueryContextFormPrepareArgsDone ?
                        null : syncData;

                }).subscribe(
                    (wAction:Actions.QueryContextFormPrepareArgsDone) => {
                        if (this.testPrimaryQueryNonEmpty() && this.testQueryTypeMismatch()) {
                            this.submitQuery(wAction.payload.data);
                        }
                    }
                );
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
    }

    disableDefaultShuffling():void {
        this.changeState(state => {
            state.shuffleForbidden = true;
        });
    }

    private testPrimaryQueryNonEmpty():boolean {
        if (this.state.queries[this.state.corpora[0]].length > 0) {
            return true;

        } else {
            this.pageModel.showMessage(
                'error',
                this.pageModel.translate('query__query_must_be_entered')
            );
            return false;
        }
    }

    private testQueryTypeMismatch():boolean {
        const errors = pipe(
            this.state.corpora,
            List.map(corpname => this.isPossibleQueryTypeMismatch(corpname)),
            List.filter(err => !!err)
        );
        return errors.length === 0 || window.confirm(
            this.pageModel.translate('global__query_type_mismatch'));
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
        state.defaultAttrValues = pipe(
            state.corpora,
            List.map(item => tuple(item, data.currDefaultAttrValues[item] || 'word')),
            Dict.fromEntries()
        );
        state.queryTypes = pipe(
            state.corpora,
            List.map(item => tuple(item, data.currQueryTypes[item] || 'iquery')),
            Dict.fromEntries()
        );
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
                            state.tagsetDocs = data.tagset_docs;
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
                state.queryTypes[corpname] = 'iquery'; // TODO what about some session-stored stuff?
            }
            if (!Dict.hasKey(corpname, state.pcqPosNegValues)) {
                state.pcqPosNegValues[corpname] = 'pos';
            }
            if (!Dict.hasKey(corpname, state.includeEmptyValues)) {
                state.includeEmptyValues[corpname] = false;
            }
            if (!Dict.hasKey(corpname, state.defaultAttrValues)) {
                state.defaultAttrValues[corpname] = 'word';
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

    private createSubmitArgs(contextFormArgs:QueryContextArgs):MultiDict {
        const primaryCorpus = this.state.corpora[0];
        const args = this.pageModel.getConcArgs() as MultiDict<ConcQueryArgs>;
        args.set('corpname', primaryCorpus);
        args.set('usesubcorp', this.state.currentSubcorp);

        if (this.state.corpora.length > 1) {
            args.set('maincorp', primaryCorpus);
            args.replace('align', List.tail(this.state.corpora));
            args.set('viewmode', 'align');

        } else {
            args.remove('maincorp');
            args.remove('align');
            args.set('viewmode', 'kwic');
        }

        Dict.forEach(
            (v, k) => {
                if (Array.isArray(v)) {
                    args.replace(k, v);

                } else {
                    args.set(k, v);
                }
            },
            contextFormArgs
        )

        function createArgname(name, corpname) {
            return corpname !== primaryCorpus ? name + '_' + corpname : name;
        }

        this.state.corpora.forEach(corpname => {
            args.add(
                createArgname('queryselector', corpname),
                `${this.state.queryTypes[corpname]}row`
            );
            // now we set the query; we have to remove possible new-line
            // characters as while the client's cql parser and CQL widget are ok with that
            // server is unable to parse this
            args.add(createArgname(this.state.queryTypes[corpname], corpname),
                     this.getQueryUnicodeNFC(corpname));

            if (this.state.lposValues[corpname]) {
                switch (this.state.queryTypes[corpname]) {
                    case 'lemma':
                        args.add(createArgname('lpos', corpname), this.state.lposValues[corpname]);
                    break;
                    case 'word':
                        args.add(createArgname('wpos', corpname), this.state.lposValues[corpname]);
                    break;
                }
            }
            if (this.state.matchCaseValues[corpname]) {
                args.add(
                    createArgname('qmcase', corpname),
                    this.state.matchCaseValues[corpname] ? '1' : '0'
                );
            }
            args.set(
                createArgname('pcq_pos_neg', corpname),
                this.state.pcqPosNegValues[corpname]
            );
            args.set(
                createArgname('include_empty', corpname),
                this.state.includeEmptyValues[corpname] ? '1' : '0'
            );
            args.set(
                createArgname('default_attr', corpname),
                this.state.defaultAttrValues[corpname]
            );
        });

        // text types
        const ttData = this.textTypesModel.exportSelections(false);
        for (let k in ttData) {
            if (ttData.hasOwnProperty(k)) {
                args.replace('sca_' + k, ttData[k]);
            }
        }

        // default shuffle
        if (this.state.shuffleConcByDefault) {
            args.set('shuffle', 1);

        } else {
            args.remove('shuffle');
        }

        // default shuffling
        if (this.state.shuffleForbidden) {
            args.set('shuffle', 0);
        }
        return args;
    }

    submitQuery(contextFormArgs:QueryContextArgs):void {
        const args = this.createSubmitArgs(contextFormArgs).items();
        const url = this.pageModel.createActionUrl('first', args);
        if (url.length < 2048) {
            window.location.href = url;

        } else {
            this.pageModel.setLocationPost(this.pageModel.createActionUrl('first'), args);
        }
    }

    getSubmitUrl(contextFormArgs:QueryContextArgs):string {
        const args = this.createSubmitArgs(contextFormArgs).items();
        return this.pageModel.createActionUrl('first', args);
    }

    isPossibleQueryTypeMismatch(corpname:string):boolean {
        const query = this.state.queries[corpname];
        const queryType = this.state.queryTypes[corpname];
        return this.validateQuery(query, queryType);
    }

}
