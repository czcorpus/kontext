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


export interface GeneralQueryFormProperties {
    currentArgs:Kontext.MultiDictSrc;
    lposlist:Array<{v:string; n:string}>;
    forcedAttr:string;
    attrList:Array<{n:string; label:string}>;
    tagsetDocUrl:string;
    lemmaWindowSizes:Array<number>;
    posWindowSizes:Array<number>;
    hasLemmaAttr:boolean;
    wPoSList:Array<{v:string; n:string}>;
}


export interface QueryFormProperties extends GeneralQueryFormProperties {
    corpora:Array<string>;
    availableAlignedCorpora:Array<{n:string; label:string}>;
    subcorpList:Array<string>;
    currentSubcorp:string;
    currQueryTypes:{[corpname:string]:string};
    currQueries:{[corpname:string]:string};  // current queries values (e.g. when restoring a form state)
    currPcqPosNegValues:{[corpname:string]:string};
    currDefaultAttrValues:{[corpname:string]:string};
    tagBuilderSupport:{[corpname:string]:boolean};
    shuffleConcByDefault:boolean;
    currLposValues:{[corpname:string]:string};
    currQmcaseValues:{[corpname:string]:boolean};
    inputLanguages:{[corpname:string]:string};
}

export type WidgetsMap = Immutable.Map<string, Immutable.List<string>>;


/**
 *
 */
export class GeneralQueryStore extends SimplePageStore {

    protected pageModel:PageModel;

    protected currentArgs:Immutable.List<[string, any]>;

    protected lposlist:Immutable.List<{v:string; n:string}>;

    protected forcedAttr:string;

    protected attrList:Immutable.List<{n:string; label:string}>;

    protected tagsetDocUrl:string;

    protected lemmaWindowSizes:Immutable.List<number>;

    protected posWindowSizes:Immutable.List<number>;

    protected hasLemmaAttr:boolean;

    protected wPoSList:Immutable.List<{v:string; n:string}>;

    protected currentAction:string;

    protected targetAction:string;

    // ----- other stores

    protected textTypesStore:TextTypesStore;

    protected queryContextStore:QueryContextStore;

    // ----- non flux world handlers

    protected onSubcorpChangeActions:Immutable.List<(subcname:string)=>void>;

    protected onAddParallelCorpActions:Immutable.List<(corpname:string)=>void>;

    protected onBeforeRemoveParallelCorpActions:Immutable.List<(corpname:string)=>void>;

    protected onRemoveParallelCorpAction:Immutable.List<(corpname:string)=>void>;

    // -------

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, textTypesStore:TextTypesStore,
            queryContextStore:QueryContextStore, props:GeneralQueryFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.textTypesStore = textTypesStore;
        this.queryContextStore = queryContextStore;
        this.currentArgs = Immutable.List<[string, any]>(props.currentArgs);
        this.lposlist = Immutable.List<{v:string; n:string}>(props.lposlist);
        this.forcedAttr = props.forcedAttr;
        this.attrList = Immutable.List<{n:string; label:string}>(props.attrList);
        this.tagsetDocUrl = props.tagsetDocUrl;
        this.lemmaWindowSizes = Immutable.List<number>(props.lemmaWindowSizes);
        this.posWindowSizes = Immutable.List<number>(props.posWindowSizes);
        this.hasLemmaAttr = props.hasLemmaAttr;
        this.wPoSList = Immutable.List<{v:string; n:string}>(props.wPoSList);

        this.onSubcorpChangeActions = Immutable.List<(subcname:string)=>void>();
        this.onAddParallelCorpActions = Immutable.List<(corpname:string)=>void>();
        this.onBeforeRemoveParallelCorpActions = Immutable.List<(corpname:string)=>void>();
        this.onRemoveParallelCorpAction = Immutable.List<(corpname:string)=>void>();
    }

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void {
        this.onSubcorpChangeActions = this.onSubcorpChangeActions.push(fn);
    }

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {
        this.onAddParallelCorpActions = this.onAddParallelCorpActions.push(fn);
    }

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {
        this.onBeforeRemoveParallelCorpActions = this.onBeforeRemoveParallelCorpActions.push(fn);
    }

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {
        this.onRemoveParallelCorpAction = this.onRemoveParallelCorpAction.push(fn);
    }

    getLposlist():Immutable.List<{v:string; n:string}> {
        return this.lposlist;
    }

    getForcedAttr():string {
        return this.forcedAttr;
    }

    getAttrList():Immutable.List<{n:string; label:string}> {
        return this.attrList;
    }

    getTagsetDocUrl():string {
        return this.tagsetDocUrl;
    }

    getLemmaWindowSizes():Immutable.List<number> {
        return this.lemmaWindowSizes;
    }

    getPosWindowSizes():Immutable.List<number> {
        return this.posWindowSizes;
    }

    getHasLemmaAttr():boolean {
        return this.hasLemmaAttr;
    }

    getwPoSList():Immutable.List<{v:string; n:string}> {
        return this.wPoSList;
    }

    protected validateQuery(query:string, queryType:string):boolean {
        let parseFn;
        switch (queryType) {
            case 'iquery':
                parseFn = () => {
                    if (!!(/^"[^\"]+"$/.exec(query) || /^(\[(\s*\w+\s*!?=\s*"[^"]*"(\s*[&\|])?)+\]\s*)+$/.exec(query))) {
                        throw new Error();
                    }
                }
            break;
            case 'phrase':
                parseFn = parseQuery.bind(null, query, {startRule: 'PhraseQuery'});
            break;
            case 'lemma':
            case 'word':
                parseFn = parseQuery.bind(null, query, {startRule: 'RegExpRaw'});
            break;
            case 'cql':
                parseFn = parseQuery.bind(null, query + ';');
            break;
            default:
                parseFn = () => {};
        }

        let mismatch;
        try {
            parseFn();
            mismatch = false;

        } catch (e) {
            mismatch = true;
            console.log(e);
        }
        return mismatch;
    }

}


/**
 *
 */
export class QueryStore extends GeneralQueryStore implements Kontext.QuerySetupHandler {

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


    // ----------------------

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, textTypesStore:TextTypesStore,
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
        this.queryTypes = Immutable.Map<string, string>(props.currQueryTypes).map((v, k) => v ? v : 'iquery').toMap();
        this.tagBuilderSupport = Immutable.Map<string, boolean>(props.tagBuilderSupport);
        this.inputLanguages = Immutable.Map<string, string>(props.inputLanguages);
        this.pcqPosNegValues = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currPcqPosNegValues[item] || 'pos']));
        this.currentAction = 'first_form';
        this.targetAction = 'first';

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SELECT_TYPE':
                    self.queryTypes = self.queryTypes.set(payload.props['sourceId'], payload.props['queryType']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SELECT_SUBCORP':
                    self.currentSubcorp = payload.props['subcorp'];
                    self.notifyChangeListeners();
                    self.onSubcorpChangeActions.forEach(fn => fn(self.currentSubcorp));
                break;
                case 'QUERY_INPUT_SET_QUERY':
                    self.queries = self.queries.set(payload.props['sourceId'], payload.props['query']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_APPEND_QUERY':
                    const currQuery = self.queries.get(payload.props['sourceId'])
                    const newQuery =  currQuery + (currQuery && payload.props['prependSpace'] ? ' ' : '') + payload.props['query'];
                    self.queries = self.queries.set(payload.props['sourceId'], newQuery);
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
                    self.addAlignedCorpus(payload.props['sourceId']);
                    self.notifyChangeListeners();
                    self.onAddParallelCorpActions.forEach(fn => fn(payload.props['sourceId']));
                break;
                case 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS':
                    self.onBeforeRemoveParallelCorpActions.forEach(fn => fn(payload.props['sourceId']));
                    self.removeAlignedCorpus(payload.props['sourceId']);
                    self.notifyChangeListeners();
                    self.onRemoveParallelCorpAction.forEach(fn => fn(payload.props['sourceId']));
                break;
                case 'QUERY_INPUT_SET_PCQ_POS_NEG':
                    self.pcqPosNegValues = self.pcqPosNegValues.set(payload.props['corpname'], payload.props['value']);
                    self.notifyChangeListeners();
                    break;
                case 'QUERY_MAKE_CORPUS_PRIMARY':
                    self.makeCorpusPrimary(payload.props['sourceId']);
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
        const args = new MultiDict(this.currentArgs.toArray());
        args.replace('corpname', [primaryCorpus]);
        if (this.currentSubcorp) {
            args.add('usesubcorp', this.currentSubcorp);
        }

        if (this.corpora.size > 1) {
            args.replace('maincorp', [primaryCorpus]);
            args.replace('sel_aligned', this.corpora.rest().toArray());
            args.replace('align', this.corpora.rest().toArray()); // TODO why sel_align AND align???
            args.replace('viewmode', ['align']);
        }

        function createArgname(name, corpname) {
            return corpname !== primaryCorpus ? name + '_' + corpname : name;
        }

        this.corpora.forEach(corpname => {
            args.add(createArgname('queryselector', corpname), `${this.queryTypes.get(corpname)}row`);
            args.add(createArgname(this.queryTypes.get(corpname), corpname), this.queries.get(corpname));

            if (this.lposValues.get(corpname)) {
                args.add(createArgname('lpos', corpname), this.lposValues.get(corpname));
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
        return args;
    }

    private submitQuery():void {
        const args = this.createSubmitArgs().items();
        const url = this.pageModel.createActionUrl(this.targetAction, args);
        if (url.length < 2048) {
            window.location.href = url;

        } else {
            this.pageModel.setLocationPost(this.targetAction, args);
        }
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

        const getWidgets = (corpname:string, queryType:string):Array<string> => {
            switch (queryType) {
                case 'iquery':
                case 'lemma':
                case 'phrase':
                case 'word':
                case 'char':
                    return ['keyboard', 'history'];
                case 'cql':
                    const ans = ['keyboard', 'history', 'within'];
                    if (this.tagBuilderSupport.get(corpname)) {
                        ans.push('tag');
                    }
                    return ans;
            }
        }
        const ans = Immutable.Map<string, Immutable.List<string>>();

        return Immutable.Map<string, Immutable.List<string>>(this.corpora.map(corpname => {
            return [corpname, Immutable.List<string>(getWidgets(corpname, this.queryTypes.get(corpname)))];
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

    getSubcorpList():Immutable.List<string> {
        return this.subcorpList;
    }

    getCurrentSubcorp():string {
        return this.currentSubcorp;
    }

    isShuffleConcByDefault():boolean {
        return this.shuffleConcByDefault;
    }

    getInputLanguages():Immutable.Map<string, string> {
        return this.inputLanguages;
    }
}


/**
 *
 */
export class QueryHintStore extends SimplePageStore {

    private hints:Array<string>;

    private currentHint:number;

    constructor(dispatcher:Dispatcher.Dispatcher<Kontext.DispatcherPayload>, hints:Array<string>) {
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
