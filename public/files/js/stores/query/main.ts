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
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../../vendor.d.ts/cqlParser.d.ts" />


import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../base';
import {PageModel} from '../../app/main';
import {MultiDict} from '../../util';
import {parse as parseQuery} from 'cqlParser/parser';
import {TextTypesStore} from '../textTypes/attrValues';
import {QueryContextStore} from './context';
import * as RSVP from 'vendor/rsvp';


export interface GeneralQueryFormProperties {
    forcedAttr:string;
    attrList:Array<{n:string; label:string}>;
    lemmaWindowSizes:Array<number>;
    posWindowSizes:Array<number>;
    wPoSList:Array<{v:string; n:string}>;
}


export interface QueryFormUserEntries {
    currQueryTypes:{[corpname:string]:string};
    currQueries:{[corpname:string]:string};  // current queries values (e.g. when restoring a form state)
    currPcqPosNegValues:{[corpname:string]:string};
    currDefaultAttrValues:{[corpname:string]:string};
    currLposValues:{[corpname:string]:string};
    currQmcaseValues:{[corpname:string]:boolean};
}


export interface QueryFormProperties extends GeneralQueryFormProperties, QueryFormUserEntries {
    corpora:Array<string>;
    availableAlignedCorpora:Array<{n:string; label:string}>;
    textTypesNotes:string;
    subcorpList:Array<string>;
    currentSubcorp:string;
    tagBuilderSupport:{[corpname:string]:boolean};
    shuffleConcByDefault:boolean;
    inputLanguages:{[corpname:string]:string};
    selectedTextTypes:{[structattr:string]:Array<string>};
    hasLemma:{[corpname:string]:boolean};
    tagsetDocs:{[corpname:string]:boolean};
}

export type WidgetsMap = Immutable.Map<string, Immutable.List<string>>;

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
            contains_errors: false,
            messages: [],
            form_type: 'query',
            op_key: '__new__',
            curr_query_types: {},
            curr_queries: {},
            curr_pcq_pos_neg_values: {},
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



/**
 *
 */
export abstract class GeneralQueryStore extends SimplePageStore {

    protected pageModel:PageModel;

    protected forcedAttr:string;

    protected attrList:Immutable.List<{n:string; label:string}>;

    protected lemmaWindowSizes:Immutable.List<number>;

    protected posWindowSizes:Immutable.List<number>;

    protected wPoSList:Immutable.List<{v:string; n:string}>;

    protected currentAction:string;

    // ----- other stores

    protected textTypesStore:TextTypesStore;

    protected queryContextStore:QueryContextStore;

    // ----- non flux world handlers

    protected onCorpusSelectionChangeActions:Immutable.List<(corpusId:string, aligned:Immutable.List<string>, subcorpusId:string)=>void>;

    // -------

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, textTypesStore:TextTypesStore,
            queryContextStore:QueryContextStore, props:GeneralQueryFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.textTypesStore = textTypesStore;
        this.queryContextStore = queryContextStore;
        this.forcedAttr = props.forcedAttr;
        this.attrList = Immutable.List<{n:string; label:string}>(props.attrList);
        this.lemmaWindowSizes = Immutable.List<number>(props.lemmaWindowSizes);
        this.posWindowSizes = Immutable.List<number>(props.posWindowSizes);
        this.wPoSList = Immutable.List<{v:string; n:string}>(props.wPoSList);

        this.onCorpusSelectionChangeActions = Immutable.List<(subcname:string)=>void>();
        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SET_ACTIVE_WIDGET':
                    this.setActiveWidget(payload.props['sourceId'], payload.props['value']);
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    /**
     * Returns a currently active widget identifier
     * (one of 'tag', 'keyboard', 'within', 'history')
     */
    abstract getActiveWidget(sourceId:string):string;

    /**
     * Sets a currently active widget.
     */
    abstract setActiveWidget(sourceId:string, ident:string):void;

    registerCorpusSelectionListener(fn:(corpusId:string, aligned:Immutable.List<string>, subcorpusId:string)=>void):void {
        this.onCorpusSelectionChangeActions = this.onCorpusSelectionChangeActions.push(fn);
    }

    getForcedAttr():string {
        return this.forcedAttr;
    }

    getAttrList():Immutable.List<{n:string; label:string}> {
        return this.attrList;
    }

    getLemmaWindowSizes():Immutable.List<number> {
        return this.lemmaWindowSizes;
    }

    getPosWindowSizes():Immutable.List<number> {
        return this.posWindowSizes;
    }

    getwPoSList():Immutable.List<{v:string; n:string}> {
        return this.wPoSList;
    }

    protected validateQuery(query:string, queryType:string):boolean {
        const parseFn = ((query:string) => {
            switch (queryType) {
                case 'iquery':
                    return () => {
                        if (!!(/^"[^\"]+"$/.exec(query) || /^(\[(\s*\w+\s*!?=\s*"[^"]*"(\s*[&\|])?)+\]\s*)+$/.exec(query))) {
                            throw new Error();
                        }
                    }
                case 'phrase':
                    return parseQuery.bind(null, query, {startRule: 'PhraseQuery'});
                case 'lemma':
                case 'word':
                    return parseQuery.bind(null, query, {startRule: 'RegExpRaw'});
                case 'cql':
                    return parseQuery.bind(null, query + ';');
                default:
                    return () => {};
            }
        })(query.trim());

        let mismatch;
        try {
            parseFn();
            mismatch = false;

        } catch (e) {
            mismatch = true;
            console.error(e);
        }
        return mismatch;
    }
}

/**
 *
 */
export interface CorpusSwitchPreserved {
    query:string;
    queryType:string;
    matchCase:boolean;
}


/**
 *
 */
export class QueryStore extends GeneralQueryStore implements Kontext.QuerySetupHandler, Kontext.ICorpusSwitchAware<CorpusSwitchPreserved> {

    private corpora:Immutable.List<string>;

    private availableAlignedCorpora:Immutable.List<{n:string; label:string}>;

    private subcorpList:Immutable.List<string>;

    private currentSubcorp:string;

    private shuffleConcByDefault:boolean;

    private queries:Immutable.Map<string, string>; // corpname -> query

    private lposValues:Immutable.Map<string, string>; // corpname -> lpos

    private matchCaseValues:Immutable.Map<string, boolean>; // corpname -> qmcase

    private defaultAttrValues:Immutable.Map<string, string>;

    private pcqPosNegValues:Immutable.Map<string, string>;

    private queryTypes:Immutable.Map<string, string>;

    private tagBuilderSupport:Immutable.Map<string, boolean>;

    private inputLanguages:Immutable.Map<string, string>;

    private activeWidgets:Immutable.Map<string, string>;

    private hasLemma:Immutable.Map<string, boolean>;

    private tagsetDocs:Immutable.Map<string, string>;

    /**
     * Text descriptions of text type structure for end user.
     * (applies for the main corpus)
     */
    private textTypesNotes:string;

    /**
     * This does not equal to URL param shuffle=0/1.
     * If false then the decision is up to server
     * (= user settings). If true then shuffle is
     * set to '0' no matter what value is in user's
     * settings. By default this is set to false.
     */
    private shuffleForbidden:boolean = false;


    // ----------------------

    constructor(dispatcher:Kontext.FluxDispatcher, pageModel:PageModel, textTypesStore:TextTypesStore,
            queryContextStore:QueryContextStore, props:QueryFormProperties) {
        super(dispatcher, pageModel, textTypesStore, queryContextStore, props);
        const self = this;
        this.corpora = Immutable.List<string>(props.corpora);
        this.availableAlignedCorpora = Immutable.List<{n:string; label:string}>(props.availableAlignedCorpora);
        this.subcorpList = Immutable.List<string>(props.subcorpList);
        this.currentSubcorp = props.currentSubcorp;
        this.shuffleConcByDefault = props.shuffleConcByDefault;
        this.queries = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currQueries[item] || '']));
        this.lposValues = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currLposValues[item] || '']));
        this.matchCaseValues = Immutable.Map<string, boolean>(props.corpora.map(item => [item, props.currQmcaseValues[item] || false]));
        this.defaultAttrValues = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currDefaultAttrValues[item] || 'word']));
        this.queryTypes = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currQueryTypes[item] || 'iquery'])).toMap();
        this.pcqPosNegValues = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currPcqPosNegValues[item] || 'pos']));
        this.tagBuilderSupport = Immutable.Map<string, boolean>(props.tagBuilderSupport);
        this.inputLanguages = Immutable.Map<string, string>(props.inputLanguages);
        this.hasLemma = Immutable.Map<string, boolean>(props.hasLemma);
        this.tagsetDocs = Immutable.Map<string, string>(props.tagsetDocs);
        this.textTypesNotes = props.textTypesNotes;
        this.activeWidgets = Immutable.Map<string, string>(props.corpora.map(item => null));
        this.setUserValues(props);
        this.currentAction = 'first_form';

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SELECT_TYPE':
                    let qType = payload.props['queryType'];
                    if (!self.hasLemma.get(payload.props['sourceId']) &&  qType === 'lemma') {
                        qType = 'phrase';
                        self.pageModel.showMessage('warning', 'Lemma attribute not available, using "phrase"');
                    }
                    self.queryTypes = self.queryTypes.set(payload.props['sourceId'], qType);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SELECT_SUBCORP':
                    self.currentSubcorp = payload.props['subcorp'];
                    self.notifyChangeListeners();
                    self.onCorpusSelectionChangeActions.forEach(fn =>
                        fn(self.corpora.first(), self.corpora.rest().toList(), self.currentSubcorp)
                    );
                break;
                case 'QUERY_INPUT_SET_QUERY':
                    self.queries = self.queries.set(payload.props['sourceId'], payload.props['query']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_APPEND_QUERY':
                    const currQuery = self.queries.get(payload.props['sourceId']);
                    const newQuery = currQuery + (currQuery && payload.props['prependSpace'] ? ' ' : '') + payload.props['query'];
                    self.queries = self.queries.set(payload.props['sourceId'], newQuery);
                    if (payload.props['closeWhenDone']) {
                        self.activeWidgets = self.activeWidgets.set(payload.props['sourceId'], null);
                    }
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_REMOVE_LAST_CHAR':
                    const currQuery2 = self.queries.get(payload.props['sourceId']);
                    if (currQuery2.length > 0) {
                        self.queries = self.queries.set(payload.props['sourceId'], currQuery2.substr(0, currQuery2.length - 1));
                    }
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_LPOS':
                    self.lposValues = self.lposValues.set(payload.props['sourceId'], payload.props['lpos']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_MATCH_CASE':
                    self.matchCaseValues = self.matchCaseValues.set(payload.props['sourceId'], payload.props['value']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_DEFAULT_ATTR':
                    self.defaultAttrValues = self.defaultAttrValues.set(payload.props['sourceId'], payload.props['value']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_ADD_ALIGNED_CORPUS':
                    self.addAlignedCorpus(payload.props['corpname']);
                    self.notifyChangeListeners();
                    self.onCorpusSelectionChangeActions.forEach(fn =>
                        fn(self.corpora.first(), self.corpora.rest().toList(), self.currentSubcorp)
                    );
                break;
                case 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS':
                    self.removeAlignedCorpus(payload.props['corpname']);
                    self.notifyChangeListeners();
                    self.onCorpusSelectionChangeActions.forEach(fn =>
                        fn(self.corpora.first(), self.corpora.rest().toList(), self.currentSubcorp)
                    );
                break;
                case 'QUERY_INPUT_SET_PCQ_POS_NEG':
                    self.pcqPosNegValues = self.pcqPosNegValues.set(payload.props['corpname'], payload.props['value']);
                    self.notifyChangeListeners();
                    break;
                case 'QUERY_MAKE_CORPUS_PRIMARY':
                    self.makeCorpusPrimary(payload.props['corpname']);
                    break;
                case 'QUERY_INPUT_SUBMIT':
                    const errors = self.corpora.map(corpname => {
                        return self.isPossibleQueryTypeMismatch(corpname);
                    }).filter(err => !!err);
                    if (errors.size === 0 || window.confirm(self.pageModel.translate('global__query_type_mismatch'))) {
                        self.submitQuery();
                    }
                break;
            }
        });
    }

    csExportState():CorpusSwitchPreserved {
        const corp = this.corpora.get(0);
        return {
            query: this.queries.get(corp),
            queryType: this.queryTypes.get(corp),
            matchCase: this.matchCaseValues.get(corp)
        };
    }

    csSetState(state:CorpusSwitchPreserved):void {
        const corp = this.corpora.get(0);
        this.queries = this.queries.set(corp, state.query);
        this.queryTypes = this.queryTypes.set(corp, state.queryType);
        this.matchCaseValues = this.matchCaseValues.set(corp, state.matchCase);
    }

    csGetStateKey():string {
        return 'query-storage';
    }

    getActiveWidget(sourceId:string):string {
        return this.activeWidgets.get(sourceId);
    }

    setActiveWidget(sourceId:string, ident:string):void {
        this.activeWidgets = this.activeWidgets.set(sourceId, ident);
    }

    private setUserValues(data:QueryFormUserEntries):void {
        this.queries = Immutable.Map<string, string>(this.corpora.map(item => [item, data.currQueries[item] || '']));
        this.lposValues = Immutable.Map<string, string>(this.corpora.map(item => [item, data.currLposValues[item] || '']));
        this.matchCaseValues = Immutable.Map<string, boolean>(this.corpora.map(item => [item, data.currQmcaseValues[item] || false]));
        this.defaultAttrValues = Immutable.Map<string, string>(this.corpora.map(item => [item, data.currDefaultAttrValues[item] || 'word']));
        this.queryTypes = Immutable.Map<string, string>(this.corpora.map(item => [item, data.currQueryTypes[item] || 'iquery'])).toMap();
        this.pcqPosNegValues = Immutable.Map<string, string>(this.corpora.map(item => [item, data.currPcqPosNegValues[item] || 'pos']));
    }

    syncFrom(fn:()=>RSVP.Promise<AjaxResponse.QueryFormArgs>):RSVP.Promise<AjaxResponse.QueryFormArgs> {
        return fn().then(
            (data) => {
                if (data.form_type === 'query') {
                    this.setUserValues({
                        currQueries: data.curr_queries,
                        currQueryTypes: data.curr_query_types,
                        currLposValues: data.curr_lpos_values,
                        currDefaultAttrValues: data.curr_default_attr_values,
                        currQmcaseValues: data.curr_qmcase_values,
                        currPcqPosNegValues: data.curr_pcq_pos_neg_values
                    });
                    this.tagBuilderSupport = Immutable.Map<string, boolean>(data.tag_builder_support);
                    this.hasLemma = Immutable.Map<string, boolean>(data.has_lemma);
                    this.tagsetDocs = Immutable.Map<string, string>(data.tagset_docs);
                    return data;

                } else if (data.form_type === 'locked') {
                    return null;

                } else {
                    throw new Error('Cannot sync query store - invalid form data type: ' + data.form_type);
                }
            }
        );
    }

    private makeCorpusPrimary(corpname:string):void {
        const idx = this.corpora.indexOf(corpname);
        if (idx > -1) {
            this.corpora = this.corpora.remove(idx).insert(0, corpname);
            window.location.href = this.pageModel.createActionUrl(this.currentAction, this.createSubmitArgs().items());
        }
    }

    private addAlignedCorpus(corpname:string):void {
        if (!this.corpora.contains(corpname) && this.availableAlignedCorpora.find(x => x.n === corpname)) {
            this.corpora = this.corpora.push(corpname);
            if (!this.queries.has(corpname)) {
                this.queries = this.queries.set(corpname, '');
            }
            if (!this.lposValues.has(corpname)) {
                this.lposValues = this.lposValues.set(corpname, '');
            }
            if (!this.matchCaseValues.has(corpname)) {
                this.matchCaseValues = this.matchCaseValues.set(corpname, false);
            }
            if (!this.queryTypes.has(corpname)) {
                this.queryTypes = this.queryTypes.set(corpname, 'iquery'); // TODO what about some session-stored stuff?
            }
            if (!this.pcqPosNegValues.has(corpname)) {
                this.pcqPosNegValues = this.pcqPosNegValues.set(corpname, 'pos');
            }
            if (!this.defaultAttrValues.has(corpname)) {
                this.defaultAttrValues = this.defaultAttrValues.set(corpname, 'word');
            }

        } else {
            // TODO error
        }
    }

    private removeAlignedCorpus(corpname:string):void {
        const idx = this.corpora.indexOf(corpname);
        if (idx > -1) {
            this.corpora = this.corpora.remove(idx);

        } else {
            console.error('Cannot remove corpus ', corpname);
        }
    }

    private createSubmitArgs():MultiDict {
        const primaryCorpus = this.corpora.get(0);
        const args = this.pageModel.getConcArgs();
        args.replace('corpname', [primaryCorpus]);
        if (this.currentSubcorp) {
            args.add('usesubcorp', this.currentSubcorp);
        }

        if (this.corpora.size > 1) {
            args.replace('maincorp', [primaryCorpus]);
            args.replace('align', this.corpora.rest().toArray());
            args.replace('viewmode', ['align']);

        } else {
            args.remove('maincorp');
            args.remove('align');
            args.replace('viewmode', ['kwic']);
        }
        function createArgname(name, corpname) {
            return corpname !== primaryCorpus ? name + '_' + corpname : name;
        }

        this.corpora.forEach(corpname => {
            args.add(createArgname('queryselector', corpname), `${this.queryTypes.get(corpname)}row`);
            // now we set the query; we have to remove possible new-line
            // characters as while the client's cql parser and CQL widget are ok with that
            // server is unable to parse this
            args.add(createArgname(this.queryTypes.get(corpname), corpname),
                     this.queries.get(corpname));

            if (this.lposValues.get(corpname)) {
                switch (this.queryTypes.get(corpname)) {
                    case 'lemma':
                        args.add(createArgname('lpos', corpname), this.lposValues.get(corpname));
                    break;
                    case 'word':
                        args.add(createArgname('wpos', corpname), this.lposValues.get(corpname));
                    break;
                }
            }
            if (this.matchCaseValues.get(corpname)) {
                args.add(createArgname('qmcase', corpname), this.matchCaseValues.get(corpname) ? '1' : '0');
            }
            args.replace(createArgname('pcq_pos_neg', corpname), [this.pcqPosNegValues.get(corpname)]);
            args.add(createArgname('default_attr', corpname), this.defaultAttrValues.get(corpname));
        });

        // query context
        const contextArgs = this.queryContextStore.exportForm();
        for (let k in contextArgs) {
            if (Object.prototype.toString.call(contextArgs[k]) === '[object Array]') {
                args.replace(k, contextArgs[k]);

            } else {
                args.replace(k, [contextArgs[k]]);
            }
        }

        // text types
        const ttData = this.textTypesStore.exportSelections(false);
        for (let k in ttData) {
            if (ttData.hasOwnProperty(k)) {
                args.replace('sca_' + k, ttData[k]);
            }
        }

        // default shuffle
        if (this.shuffleConcByDefault) {
            args.set('shuffle', 1);

        } else {
            args.remove('shuffle');
        }

        // default shuffling
        if (this.shuffleForbidden) {
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
        const query = this.queries.get(corpname);
        const queryType = this.queryTypes.get(corpname);
        return this.validateQuery(query, queryType);
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

    getQuery(corpname:string):string {
        return this.queries.get(corpname);
    }

    supportsParallelCorpora():boolean {
        return this.corpora.size > 1 || this.availableAlignedCorpora.size > 0;
    }

    getSupportedWidgets():WidgetsMap {
        const userIsAnonymous = () => this.pageModel.getConf<boolean>('anonymousUser');
        const getCorpWidgets = (corpname:string, queryType:string):Array<string> => {
            const ans = ['keyboard'];
            if (!userIsAnonymous()) {
                ans.push('history');
            }
            if (queryType === 'cql') {
                ans.push('within');
                if (this.tagBuilderSupport.get(corpname)) {
                    ans.push('tag');
                }
            }
            return ans;
        }
        const ans = Immutable.Map<string, Immutable.List<string>>();
        return Immutable.Map<string, Immutable.List<string>>(this.corpora.map(corpname => {
            return [corpname, Immutable.List<string>(getCorpWidgets(corpname, this.queryTypes.get(corpname)))];
        }));
    }

    getPcqPosNegValues():Immutable.Map<string, string> {
        return this.pcqPosNegValues;
    }

    getCorpora():Immutable.List<string> {
        return this.corpora;
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return this.availableAlignedCorpora;
    }


    getAvailableSubcorpora():Immutable.List<string> {
        return this.subcorpList;
    }

    getCurrentSubcorpus():string {
        return this.currentSubcorp;
    }

    getInputLanguages():Immutable.Map<string, string> {
        return this.inputLanguages;
    }

    disableDefaultShuffling():void {
        this.shuffleForbidden = true;
    }

    getTextTypesNotes():string {
        return this.textTypesNotes;
    }

    getHasLemmaAttr():Immutable.Map<string, boolean> {
        return this.hasLemma;
    }

    getTagsetDocUrls():Immutable.Map<string, string> {
        return this.tagsetDocs;
    }
}


/**
 *
 */
export class QueryHintStore extends SimplePageStore {

    private hints:Array<string>;

    private currentHint:number;

    constructor(dispatcher:Kontext.FluxDispatcher, hints:Array<string>) {
        super(dispatcher);
        const self = this;
        this.hints = hints ? hints : [];
        this.currentHint = this.randomIndex();

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'NEXT_QUERY_HINT':
                    self.setNextHint();
                    self.notifyChangeListeners();
                    break;
            }
        });
    }

    randomIndex():number {
        return Math.round((Math.random() * (this.hints.length - 1)))|0;
    }

    setNextHint():void {
        this.currentHint = (this.currentHint + 1) % this.hints.length;
    }

    getHint():string {
        return this.hints[this.currentHint];
    }
}
