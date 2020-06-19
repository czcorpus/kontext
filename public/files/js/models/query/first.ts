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

import * as Immutable from 'immutable';
import { IFullActionControl } from 'kombo';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Dict, tuple } from 'cnc-tskit';

import { Kontext, ViewOptions } from '../../types/common';
import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { TextTypesModel } from '../textTypes/main';
import { QueryContextModel } from './context';
import { GeneralQueryFormProperties, QueryFormModel, WidgetsMap, appendQuery, QueryFormModelState, shouldDownArrowTriggerHistory } from './common';
import { QueryContextArgs } from './context';
import { ActionName } from './actions';
import { GeneralViewOptionsModel } from '../options/general';


type ExportedQueryContextArgs = {[p in keyof QueryContextArgs]?:QueryContextArgs[p]};


export interface QueryFormUserEntries {
    currQueryTypes:{[corpname:string]:string};
    currQueries:{[corpname:string]:string};  // current queries values (e.g. when restoring a form state)
    currPcqPosNegValues:{[corpname:string]:string};
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
    tagsetDocs:{[corpname:string]:boolean};
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
export const fetchQueryFormArgs = (data:{[ident:string]:AjaxResponse.ConcFormArgs}):AjaxResponse.QueryFormArgsResponse => {
    const k = (() => {
        for (let p in data) {
            if (data.hasOwnProperty(p) && data[p].form_type === 'query') {
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
            form_type: 'query',
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


function determineSupportedWidgets(corpora:Immutable.List<string>, queryTypes:Immutable.Map<string, string>, tagBuilderSupport:Immutable.Map<string, boolean>, isAnonymousUser:boolean):WidgetsMap {
    const getCorpWidgets = (corpname:string, queryType:string):Array<string> => {
        const ans = ['keyboard'];
        if (!isAnonymousUser) {
            ans.push('history');
        }
        if (queryType === 'cql') {
            ans.push('within');
            if (tagBuilderSupport.get(corpname)) {
                ans.push('tag');
            }
        }
        return ans;
    }
    return new WidgetsMap(
            corpora.map<[string, Immutable.List<string>]>(corpname =>
                tuple(
                    corpname,
                    Immutable.List<string>(getCorpWidgets(corpname, queryTypes.get(corpname)))
                )
            )
            .toList());
}


export interface FirstQueryFormModelState extends QueryFormModelState {

    corpora:Immutable.List<string>;

    availableAlignedCorpora:Immutable.List<Kontext.AttrItem>;

    subcorpList:Immutable.List<Kontext.SubcorpListItem>;

    currentSubcorp:string;

    origSubcorpName:string;

    isForeignSubcorpus:boolean;

    shuffleConcByDefault:boolean;

    lposValues:Immutable.Map<string, string>; // corpname -> lpos

    matchCaseValues:Immutable.Map<string, boolean>; // corpname -> qmcase

    defaultAttrValues:Immutable.Map<string, string>;

    pcqPosNegValues:Immutable.Map<string, string>;

    queryTypes:Immutable.Map<string, string>;

    tagBuilderSupport:Immutable.Map<string, boolean>;

    inputLanguages:Immutable.Map<string, string>;

    hasLemma:Immutable.Map<string, boolean>;

    tagsetDocs:Immutable.Map<string, string>;

    includeEmptyValues:Immutable.Map<string, boolean>; // applies only for aligned languages

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

    queryContextArgs:ExportedQueryContextArgs;
}


/**
 *
 */
export class FirstQueryFormModel extends QueryFormModel<FirstQueryFormModelState> {

    constructor(
            dispatcher:IFullActionControl,
            pageModel:PageModel,
            textTypesModel:TextTypesModel,
            queryContextModel:QueryContextModel,
            props:QueryFormProperties) {
        const corpora = Immutable.List<string>(props.corpora);
        const queryTypes = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currQueryTypes[item] || 'iquery'])).toMap();
        const tagBuilderSupport = Immutable.Map<string, boolean>(props.tagBuilderSupport);
        super(dispatcher, pageModel, textTypesModel, queryContextModel, 'first-query-model', {
            forcedAttr: props.forcedAttr,
            attrList: Immutable.List<Kontext.AttrItem>(props.attrList),
            structAttrList: Immutable.List<Kontext.AttrItem>(props.structAttrList),
            lemmaWindowSizes: Immutable.List<number>(props.lemmaWindowSizes),
            posWindowSizes: Immutable.List<number>(props.posWindowSizes),
            wPoSList: Immutable.List<{v:string; n:string}>(props.wPoSList),
            tagAttr: props.tagAttr,
            useCQLEditor: props.useCQLEditor,
            currentAction: 'first_form',
            widgetArgs: {},
            corpora: corpora,
            availableAlignedCorpora: Immutable.List<Kontext.AttrItem>(props.availableAlignedCorpora),
            subcorpList: Immutable.List<Kontext.SubcorpListItem>(props.subcorpList),
            currentSubcorp: props.currentSubcorp || '',
            origSubcorpName: props.origSubcorpName || '',
            isForeignSubcorpus: !!props.isForeignSubcorpus,
            shuffleForbidden: false,
            shuffleConcByDefault: props.shuffleConcByDefault,
            queries: Immutable.Map<string, string>(props.corpora.map(item => [item, props.currQueries[item] || ''])),
            downArrowTriggersHistory: Immutable.Map<string, boolean>(props.corpora.map(item => [item, shouldDownArrowTriggerHistory(props.currQueries[item], 0, 0)])),
            lposValues: Immutable.Map<string, string>(props.corpora.map(item => [item, props.currLposValues[item] || ''])),
            matchCaseValues: Immutable.Map<string, boolean>(props.corpora.map(item => [item, props.currQmcaseValues[item] || false])),
            defaultAttrValues: Immutable.Map<string, string>(props.corpora.map(item => [item, props.currDefaultAttrValues[item] || 'word'])),
            queryTypes: queryTypes,
            pcqPosNegValues: Immutable.Map<string, string>(props.corpora.map(item => [item, props.currPcqPosNegValues[item] || 'pos'])),
            includeEmptyValues: Immutable.Map<string, boolean>(props.corpora.map(item => [item, props.currIncludeEmptyValues[item] || false])),
            tagBuilderSupport: tagBuilderSupport,
            inputLanguages: Immutable.Map<string, string>(props.inputLanguages),
            hasLemma: Immutable.Map<string, boolean>(props.hasLemma),
            tagsetDocs: Immutable.Map<string, string>(props.tagsetDocs),
            textTypesNotes: props.textTypesNotes,
            activeWidgets: Immutable.Map<string, string>(props.corpora.map(item => null)),
            queryContextArgs: {},
            isAnonymousUser: props.isAnonymousUser,
            supportedWidgets: determineSupportedWidgets(corpora, queryTypes, tagBuilderSupport, props.isAnonymousUser),
            contextFormVisible: false,
            textTypesFormVisible: false
        });
        this.setUserValues(props);

        this.queryContextModel.addListener((state) => {
            this.state.queryContextArgs = {};
            if (state.formData.fc_lemword) {
                this.state.queryContextArgs.fc_lemword = state.formData.fc_lemword;
                this.state.queryContextArgs.fc_lemword_type = state.formData.fc_lemword_type;
                this.state.queryContextArgs.fc_lemword_window_type = state.formData.fc_lemword_window_type;
                this.state.queryContextArgs.fc_lemword_wsize = state.formData.fc_lemword_wsize;
            }
            if (state.formData.fc_pos.length > 0) {
                this.state.queryContextArgs.fc_pos = state.formData.fc_pos;
                this.state.queryContextArgs.fc_pos_type = state.formData.fc_pos_type;
                this.state.queryContextArgs.fc_pos_window_type = state.formData.fc_pos_window_type;
                this.state.queryContextArgs.fc_pos_wsize = state.formData.fc_pos_wsize;
            }
            this.emitChange();
        });
    }

    onAction(action) {
        switch (action.name) {
            case 'QUERY_INPUT_SET_ACTIVE_WIDGET':
                this.setActiveWidget(action.payload['sourceId'], action.payload['value']);
                this.state.widgetArgs = action.payload['widgetArgs'] || {};
                this.emitChange();
            break;
            case 'CQL_EDITOR_DISABLE':
                this.emitChange();
            break;
            case 'QUERY_INPUT_SELECT_TYPE':
                let qType = action.payload['queryType'];
                if (!this.state.hasLemma.get(action.payload['sourceId']) &&  qType === 'lemma') {
                    qType = 'phrase';
                    this.pageModel.showMessage('warning', 'Lemma attribute not available, using "phrase"');
                }
                this.state.queryTypes = this.state.queryTypes.set(action.payload['sourceId'], qType);
                this.state.supportedWidgets = determineSupportedWidgets(this.state.corpora, this.state.queryTypes,
                    this.state.tagBuilderSupport, this.state.isAnonymousUser);
                this.emitChange();
            break;
            case 'CORPARCH_FAV_ITEM_CLICK':

            break;
            case 'QUERY_INPUT_SELECT_SUBCORP':
                if (action.payload['pubName']) {
                    this.state.currentSubcorp = action.payload['pubName'];
                    this.state.origSubcorpName = action.payload['subcorp'];
                    this.state.isForeignSubcorpus = !!action.payload['foreign'];

                } else {
                    this.state.currentSubcorp = action.payload['subcorp'];
                    this.state.origSubcorpName = action.payload['subcorp'];
                    this.state.isForeignSubcorpus = false;
                }
                const corpIdent = this.pageModel.getCorpusIdent();
                this.pageModel.setConf<Kontext.FullCorpusIdent>(
                    'corpusIdent',
                    {
                        id: corpIdent.id,
                        name: corpIdent.name,
                        variant: corpIdent.variant,
                        usesubcorp: this.state.currentSubcorp,
                        origSubcorpName: this.state.origSubcorpName,
                        foreignSubcorp: this.state.isForeignSubcorpus
                    }
                );
                this.emitChange();
            break;
            case 'QUERY_INPUT_MOVE_CURSOR':
                this.state.downArrowTriggersHistory = this.state.downArrowTriggersHistory.set(
                    action.payload['sourceId'],
                    shouldDownArrowTriggerHistory(
                        this.state.queries.get(action.payload['sourceId']),
                        action.payload['rawAnchorIdx'],
                        action.payload['rawFocusIdx']
                    )
                );
                this.emitChange();
            break;
            case 'QUERY_INPUT_SET_QUERY':
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
            case 'QUERY_INPUT_APPEND_QUERY':
                this.state.queries = this.state.queries.set(
                    action.payload['sourceId'],
                    appendQuery(
                        this.state.queries.get(action.payload['sourceId']),
                        action.payload['query'],
                        !!action.payload['prependSpace']
                    )
                );
                if (action.payload['closeWhenDone']) {
                    this.state.activeWidgets = this.state.activeWidgets.set(action.payload['sourceId'], null);
                }
                this.emitChange();
            break;
            case 'QUERY_INPUT_REMOVE_LAST_CHAR':
                const currQuery2 = this.state.queries.get(action.payload['sourceId']);
                if (currQuery2.length > 0) {
                    this.state.queries = this.state.queries.set(action.payload['sourceId'], currQuery2.substr(0, currQuery2.length - 1));
                }
                this.emitChange();
            break;
            case 'QUERY_INPUT_SET_LPOS':
                this.state.lposValues = this.state.lposValues.set(action.payload['sourceId'], action.payload['lpos']);
                this.emitChange();
            break;
            case 'QUERY_INPUT_SET_MATCH_CASE':
                this.state.matchCaseValues = this.state.matchCaseValues.set(action.payload['sourceId'], action.payload['value']);
                this.emitChange();
            break;
            case 'QUERY_INPUT_SET_DEFAULT_ATTR':
                this.state.defaultAttrValues = this.state.defaultAttrValues.set(action.payload['sourceId'], action.payload['value']);
                this.emitChange();
            break;
            case 'QUERY_INPUT_ADD_ALIGNED_CORPUS':
                this.addAlignedCorpus(action.payload['corpname']);
                this.emitChange();
            break;
            case 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS':
                this.removeAlignedCorpus(action.payload['corpname']);
                this.emitChange();
            break;
            case 'QUERY_INPUT_SET_PCQ_POS_NEG':
                this.state.pcqPosNegValues = this.state.pcqPosNegValues.set(action.payload['corpname'], action.payload['value']);
                this.emitChange();
            break;
            case 'QUERY_INPUT_SET_INCLUDE_EMPTY':
                this.state.includeEmptyValues = this.state.includeEmptyValues.set(action.payload['corpname'], action.payload['value']);
                this.emitChange();
            break;
            case 'QUERY_MAKE_CORPUS_PRIMARY':
                this.makeCorpusPrimary(action.payload['corpname']);
                break;
            case 'QUERY_INPUT_SUBMIT':
                if (this.testPrimaryQueryNonEmpty() && this.testQueryTypeMismatch()) {
                    this.submitQuery();
                }
            break;
            case 'CORPUS_SWITCH_MODEL_RESTORE':
                this.restoreFromCorpSwitch(action.payload);
            break;
            case ActionName.QueryContextToggleForm:
                this.state.contextFormVisible = !this.state.contextFormVisible;
                this.emitChange();
            break;
            case ActionName.QueryTextTypesToggleForm:
                this.state.textTypesFormVisible = !this.state.textTypesFormVisible;
                this.emitChange();
            break;
            case 'GENERAL_VIEW_OPTIONS_SET_SHUFFLE':
                this.state.shuffleConcByDefault = action.payload['value'];
                this.emitChange();
            break;
        }
    }

    unregister():void {
    }

    disableDefaultShuffling():void {
        this.state.shuffleForbidden = true;
        this.emitChange();
    }

    private restoreFromCorpSwitch(payload:any):void { // TODO TYPE !!!!
        if (payload.key === this.csGetStateKey()) {
            this.state = {...payload.data};
            this.state.supportedWidgets = determineSupportedWidgets(this.state.corpora, this.state.queryTypes,
                    this.state.tagBuilderSupport, this.state.isAnonymousUser);
            this.emitChange();
        }
    }

    private testPrimaryQueryNonEmpty():boolean {
        if (this.state.queries.get(this.state.corpora.get(0)).length > 0) {
            return true;

        } else {
            this.pageModel.showMessage('error', this.pageModel.translate('query__query_must_be_entered'));
            return false;
        }
    }

    private testQueryTypeMismatch():boolean {
        const errors = this.state.corpora.map(corpname => this.isPossibleQueryTypeMismatch(corpname)).filter(err => !!err);
        return errors.size === 0 || window.confirm(this.pageModel.translate('global__query_type_mismatch'));
    }

    csGetStateKey():string {
        return 'query-storage';
    }

    getActiveWidget(sourceId:string):string {
        return this.state.activeWidgets.get(sourceId);
    }

    setActiveWidget(sourceId:string, ident:string):void {
        this.state.activeWidgets = this.state.activeWidgets.set(sourceId, ident);
    }

    private setUserValues(data:QueryFormUserEntries):void {
        this.state.queries = Immutable.Map<string, string>(this.state.corpora.map(item => [item, data.currQueries[item] || '']));
        this.state.lposValues = Immutable.Map<string, string>(this.state.corpora.map(item => [item, data.currLposValues[item] || '']));
        this.state.matchCaseValues = Immutable.Map<string, boolean>(this.state.corpora.map(item => [item, data.currQmcaseValues[item] || false]));
        this.state.defaultAttrValues = Immutable.Map<string, string>(this.state.corpora.map(item => [item, data.currDefaultAttrValues[item] || 'word']));
        this.state.queryTypes = Immutable.Map<string, string>(this.state.corpora.map(item => [item, data.currQueryTypes[item] || 'iquery'])).toMap();
        this.state.pcqPosNegValues = Immutable.Map<string, string>(this.state.corpora.map(item => [item, data.currPcqPosNegValues[item] || 'pos']));
    }

    syncFrom(src:Observable<AjaxResponse.QueryFormArgs>):Observable<AjaxResponse.QueryFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'query') {
                        this.setUserValues({
                            currQueries: data.curr_queries,
                            currQueryTypes: data.curr_query_types,
                            currLposValues: data.curr_lpos_values,
                            currDefaultAttrValues: data.curr_default_attr_values,
                            currQmcaseValues: data.curr_qmcase_values,
                            currPcqPosNegValues: data.curr_pcq_pos_neg_values,
                            currIncludeEmptyValues: data.curr_include_empty_values
                        });
                        this.state.tagBuilderSupport = Immutable.Map<string, boolean>(data.tag_builder_support);
                        this.state.hasLemma = Immutable.Map<string, boolean>(data.has_lemma);
                        this.state.tagsetDocs = Immutable.Map<string, string>(data.tagset_docs);
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === 'query') {
                        return data;

                    } else if (data.form_type === 'locked') {
                        return null;

                    } else {
                        throw new Error('Cannot sync query store - invalid form data type: ' + data.form_type);
                    }
                }
            )
        )
    }

    private makeCorpusPrimary(corpname:string):void {
        const idx = this.state.corpora.indexOf(corpname);
        if (idx > -1) {
            this.state.corpora = this.state.corpora.remove(idx).insert(0, corpname);
            this.state.currentSubcorp = '';
            window.location.href = this.pageModel.createActionUrl(this.state.currentAction, this.createSubmitArgs().items());
        }
    }

    private addAlignedCorpus(corpname:string):void {
        if (!this.state.corpora.contains(corpname) && this.state.availableAlignedCorpora.find(x => x.n === corpname)) {
            this.state.corpora = this.state.corpora.push(corpname);
            if (!this.state.queries.has(corpname)) {
                this.state.queries = this.state.queries.set(corpname, '');
            }
            if (!this.state.lposValues.has(corpname)) {
                this.state.lposValues = this.state.lposValues.set(corpname, '');
            }
            if (!this.state.matchCaseValues.has(corpname)) {
                this.state.matchCaseValues = this.state.matchCaseValues.set(corpname, false);
            }
            if (!this.state.queryTypes.has(corpname)) {
                this.state.queryTypes = this.state.queryTypes.set(corpname, 'iquery'); // TODO what about some session-stored stuff?
            }
            if (!this.state.pcqPosNegValues.has(corpname)) {
                this.state.pcqPosNegValues = this.state.pcqPosNegValues.set(corpname, 'pos');
            }
            if (!this.state.includeEmptyValues.has(corpname)) {
                this.state.includeEmptyValues = this.state.includeEmptyValues.set(corpname, false);
            }
            if (!this.state.defaultAttrValues.has(corpname)) {
                this.state.defaultAttrValues = this.state.defaultAttrValues.set(corpname, 'word');
            }
            this.state.supportedWidgets = determineSupportedWidgets(this.state.corpora, this.state.queryTypes,
                this.state.tagBuilderSupport, this.state.isAnonymousUser);

        } else {
            // TODO error
        }
    }

    private removeAlignedCorpus(corpname:string):void {
        const idx = this.state.corpora.indexOf(corpname);
        if (idx > -1) {
            this.state.corpora = this.state.corpora.remove(idx);

        } else {
            console.error('Cannot remove corpus ', corpname);
        }
    }

    private createSubmitArgs():MultiDict {
        const primaryCorpus = this.state.corpora.get(0);
        const args = this.pageModel.getConcArgs();
        args.set('corpname', primaryCorpus);
        args.set('usesubcorp', this.state.currentSubcorp);

        if (this.state.corpora.size > 1) {
            args.set('maincorp', primaryCorpus);
            args.replace('align', this.state.corpora.rest().toArray());
            args.set('viewmode', 'align');

        } else {
            args.remove('maincorp');
            args.remove('align');
            args.set('viewmode', 'kwic');
        }

        function createArgname(name, corpname) {
            return corpname !== primaryCorpus ? name + '_' + corpname : name;
        }

        this.state.corpora.forEach(corpname => {
            args.add(createArgname('queryselector', corpname), `${this.state.queryTypes.get(corpname)}row`);
            // now we set the query; we have to remove possible new-line
            // characters as while the client's cql parser and CQL widget are ok with that
            // server is unable to parse this
            args.add(createArgname(this.state.queryTypes.get(corpname), corpname),
                     this.getQueryUnicodeNFC(corpname));

            if (this.state.lposValues.get(corpname)) {
                switch (this.state.queryTypes.get(corpname)) {
                    case 'lemma':
                        args.add(createArgname('lpos', corpname), this.state.lposValues.get(corpname));
                    break;
                    case 'word':
                        args.add(createArgname('wpos', corpname), this.state.lposValues.get(corpname));
                    break;
                }
            }
            if (this.state.matchCaseValues.get(corpname)) {
                args.add(createArgname('qmcase', corpname), this.state.matchCaseValues.get(corpname) ? '1' : '0');
            }
            args.set(createArgname('pcq_pos_neg', corpname), this.state.pcqPosNegValues.get(corpname));
            args.set(createArgname('include_empty', corpname), this.state.includeEmptyValues.get(corpname) ? '1' : '0');
            args.set(createArgname('default_attr', corpname), this.state.defaultAttrValues.get(corpname));
        });


        // query context
        Dict.forEach(
            (value, key) => args.replace(key, [value]),
            this.state.queryContextArgs as {}
        );

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

    submitQuery():void {
        const args = this.createSubmitArgs().items();
        const url = this.pageModel.createActionUrl('first', args);
        if (url.length < 2048) {
            window.location.href = url;

        } else {
            this.pageModel.setLocationPost(this.pageModel.createActionUrl('first'), args);
        }
    }

    getSubmitUrl():string {
        const args = this.createSubmitArgs().items();
        return this.pageModel.createActionUrl('first', args);
    }

    isPossibleQueryTypeMismatch(corpname:string):boolean {
        const query = this.state.queries.get(corpname);
        const queryType = this.state.queryTypes.get(corpname);
        return this.validateQuery(query, queryType);
    }

    /* TODO
    supportsParallelCorpora():boolean {
        return this.corpora.size > 1 || this.availableAlignedCorpora.size > 0;
    }
    */

}
