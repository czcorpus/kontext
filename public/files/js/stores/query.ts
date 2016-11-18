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

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/ajaxResponses.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/cqlParser.d.ts" />


import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../util';
import {PageModel} from '../tpl/document';
import {MultiDict} from '../util';
import {parse as parseQuery} from 'cqlParser/parser';
import {TextTypesStore} from './textTypes/attrValues';


export interface QueryFormProperties {
    currentArgs:Kontext.MultiDictSrc;
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
    lposlist:Array<{v:string; n:string}>;
    currLposValues:{[corpname:string]:string};
    currQmcaseValues:{[corpname:string]:boolean};
    forcedAttr:string;
    attrList:Array<{n:string; label:string}>;
    tagsetDocUrl:string;
    // context form props
    lemmaWindowSizes:Array<number>;
    posWindowSizes:Array<number>;
    hasLemmaAttr:boolean;
    wPoSList:Array<{v:string; n:string}>;
    inputLanguages:{[corpname:string]:string};
}

export type WidgetsMap = Immutable.Map<string, Immutable.List<string>>;


export class QueryStore extends SimplePageStore implements Kontext.QuerySetupHandler {

    pageModel:PageModel;

    private queryTypes:Immutable.Map<string, string>;

    private corpora:Immutable.List<string>;

    private availableAlignedCorpora:Immutable.List<{n:string; label:string}>;

    private subcorpList:Immutable.List<string>;

    private currentSubcorp:string;

    private tagBuilderSupport:Immutable.Map<string, boolean>;

    private shuffleConcByDefault:boolean;

    private queries:Immutable.Map<string, string>; // corpname -> query

    private currentArgs:Immutable.List<[string, any]>;

    private lposlist:Immutable.List<{v:string; n:string}>;

    private lposValues:Immutable.Map<string, string>; // corpname -> lpos

    private matchCaseValues:Immutable.Map<string, boolean>; // corpname -> qmcase

    private forcedAttr:string;

    private defaultAttrValues:Immutable.Map<string, string>;

    private attrList:Immutable.List<{n:string; label:string}>;

    private tagsetDocUrl:string;

    private pcqPosNegValues:Immutable.Map<string, string>;

    private lemmaWindowSizes:Immutable.List<number>;

    private posWindowSizes:Immutable.List<number>;

    private hasLemmaAttr:boolean;

    private wPoSList:Immutable.List<{v:string; n:string}>;

    private inputLanguages:Immutable.Map<string, string>;

    // ----- non flux world handlers

    private onSubcorpChangeActions:Immutable.List<(subcname:string)=>void>;

    private onAddParallelCorpActions:Immutable.List<(corpname:string)=>void>;

    private onBeforeRemoveParallelCorpActions:Immutable.List<(corpname:string)=>void>;

    private onRemoveParallelCorpAction:Immutable.List<(corpname:string)=>void>;

    // ----------------------

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, props:QueryFormProperties) {
        super(dispatcher);
        const self = this;
        this.pageModel = pageModel;
        this.corpora = Immutable.List<string>(props.corpora);
        this.availableAlignedCorpora = Immutable.List<{n:string; label:string}>(props.availableAlignedCorpora);
        this.queryTypes = Immutable.Map<string, string>(props.currQueryTypes).map((v, k) => v ? v : 'iquery').toMap();
        this.subcorpList = Immutable.List<string>(props.subcorpList);
        this.currentSubcorp = props.currentSubcorp;
        this.tagBuilderSupport = Immutable.Map<string, boolean>(props.tagBuilderSupport);
        this.shuffleConcByDefault = props.shuffleConcByDefault;
        this.queries = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currQueries[item] || '']));
        this.currentArgs = Immutable.List<[string, any]>(props.currentArgs);
        this.lposlist = Immutable.List<{v:string; n:string}>(props.lposlist);
        this.lposValues = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currLposValues[item] || '']));
        this.matchCaseValues = Immutable.Map<string, boolean>(props.corpora.map(item => [item, props.currQmcaseValues[item] || false]));
        this.forcedAttr = props.forcedAttr;
        this.defaultAttrValues = Immutable.Map<string, string>(props.corpora.map(item => [item, props.currDefaultAttrValues[item] || 'word']));
        this.attrList = Immutable.List<{n:string; label:string}>(props.attrList);
        this.tagsetDocUrl = props.tagsetDocUrl;
        this.pcqPosNegValues = Immutable.Map<string, string>(this.corpora.map(item => [item, props.currPcqPosNegValues[item] || 'pos']));
        this.lemmaWindowSizes = Immutable.List<number>(props.lemmaWindowSizes);
        this.posWindowSizes = Immutable.List<number>(props.posWindowSizes);
        this.hasLemmaAttr = props.hasLemmaAttr;
        this.wPoSList = Immutable.List<{v:string; n:string}>(props.wPoSList);
        this.inputLanguages = Immutable.Map<string, string>(props.inputLanguages);

        this.onSubcorpChangeActions = Immutable.List<(subcname:string)=>void>();
        this.onAddParallelCorpActions = Immutable.List<(corpname:string)=>void>();
        this.onBeforeRemoveParallelCorpActions = Immutable.List<(corpname:string)=>void>();
        this.onRemoveParallelCorpAction = Immutable.List<(corpname:string)=>void>();

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {

            switch (payload.actionType) {
                case 'QUERY_INPUT_SELECT_TYPE':
                    self.queryTypes = self.queryTypes.set(payload.props['corpname'], payload.props['queryType']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SELECT_SUBCORP':
                    self.currentSubcorp = payload.props['subcorp'];
                    self.notifyChangeListeners();
                    self.onSubcorpChangeActions.forEach(fn => fn(self.currentSubcorp));
                break;
                case 'QUERY_INPUT_SET_QUERY':
                    self.queries = self.queries.set(payload.props['corpname'], payload.props['query']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_APPEND_QUERY':
                    const currQuery = self.queries.get(payload.props['corpname'])
                    const newQuery =  currQuery + (currQuery && payload.props['prependSpace'] ? ' ' : '') + payload.props['query'];
                    self.queries = self.queries.set(payload.props['corpname'], newQuery);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_LPOS':
                    self.lposValues = self.lposValues.set(payload.props['corpname'], payload.props['lpos']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_MATCH_CASE':
                    self.matchCaseValues = self.matchCaseValues.set(payload.props['corpname'], payload.props['value']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_DEFAULT_ATTR':
                    self.defaultAttrValues = self.defaultAttrValues.set(payload.props['corpname'], payload.props['value']);
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_ADD_ALIGNED_CORPUS':
                    self.addAlignedCorpus(payload.props['corpname']);
                    self.notifyChangeListeners();
                    self.onAddParallelCorpActions.forEach(fn => fn(payload.props['corpname']));
                break;
                case 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS':
                    self.onBeforeRemoveParallelCorpActions.forEach(fn => fn(payload.props['corpname']));
                    self.removeAlignedCorpus(payload.props['corpname']);
                    self.notifyChangeListeners();
                    self.onRemoveParallelCorpAction.forEach(fn => fn(payload.props['corpname']));
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

    private makeCorpusPrimary(corpname:string):void {
        const idx = this.corpora.indexOf(corpname);
        if (idx > -1) {
            this.corpora = this.corpora.remove(idx).insert(0, corpname);
            window.location.href = this.pageModel.createActionUrl('first_form', this.createSubmitArgs().items());
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

        return args;
    }

    private submitQuery():void {
        // TODO - allow POST in case of a large query
        window.location.href = this.pageModel.createActionUrl('first', this.createSubmitArgs().items());
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

    getCorpora():Immutable.List<string> {
        return this.corpora;
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return this.availableAlignedCorpora;
    }

    getQueryTypes():Immutable.Map<string, string> {
        return this.queryTypes;
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

    getQuery(corpname:string):string {
        return this.queries.get(corpname);
    }

    getLposlist():Immutable.List<{v:string; n:string}> {
        return this.lposlist;
    }

    getLposValues():Immutable.Map<string, string> {
        return this.lposValues;
    }

    getMatchCaseValues():Immutable.Map<string, boolean> {
        return this.matchCaseValues;
    }

    getForcedAttr():string {
        return this.forcedAttr;
    }

    getDefaultAttrValues():Immutable.Map<string, string> {
        return this.defaultAttrValues;
    }

    getAttrList():Immutable.List<{n:string; label:string}> {
        return this.attrList;
    }

    getTagsetDocUrl():string {
        return this.tagsetDocUrl;
    }

    supportsParallelCorpora():boolean {
        return this.corpora.size > 1 || this.availableAlignedCorpora.size > 0;
    }

    getPcqPosNegValues():Immutable.Map<string, string> {
        return this.pcqPosNegValues;
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

    getInputLanguages():Immutable.Map<string, string> {
        return this.inputLanguages;
    }

    isPossibleQueryTypeMismatch(corpname:string):boolean {
        const query = this.queries.get(corpname);
        const queryType = this.queryTypes.get(corpname);
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


/**
 *
 */
export class WithinBuilderStore extends SimplePageStore {

    private pageModel:PageModel;

    private data:Immutable.List<[string, string]>;

    private query:string;

    private currAttrIdx:number;

    constructor(dispatcher:Dispatcher.Dispatcher<Kontext.DispatcherPayload>, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.data = Immutable.List<[string, string]>();
        this.query = '';
        this.currAttrIdx = 0;
        const self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'QUERY_INPUT_LOAD_WITHIN_BUILDER_DATA':
                    self.loadAttrs().then(
                        () => {
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            console.error(err);
                            self.pageModel.showMessage('error', err);
                        }
                    );
                break;
                case 'QUERY_INPUT_SET_WITHIN_VALUE':
                    self.query = payload.props['value'];
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_SET_WITHIN_ATTR':
                    self.currAttrIdx = payload.props['idx'];
                    self.notifyChangeListeners();
                break;
            }
        });
    }

    private loadAttrs():RSVP.Promise<any> {
        return this.pageModel.ajax<AjaxResponse.WithinBuilderData>(
            'GET',
            this.pageModel.createActionUrl('corpora/ajax_get_structattrs_details'),
            {
                corpname: this.pageModel.getConf<string>('corpname')
            },
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            (data) => {
                this.data = this.data.clear();
                if (data.contains_errors) {
                    throw new Error(data.messages[0]);

                } else {
                    for (let attr in data.structattrs) {
                        if (data.structattrs.hasOwnProperty(attr)) {
                            data.structattrs[attr].forEach(item => {
                                this.data = this.data.push([attr, item]);
                            });
                        }
                    }
                    this.currAttrIdx = 0;
                }
            }
        );
    }

    getData():Immutable.List<[string, string]> {
        return this.data;
    }

    getQuery():string {
        return this.query;
    }

    getCurrAttrIdx():number {
        return this.currAttrIdx;
    }

    exportQuery():string {
        return this.data.size > 0 ?
            `within <${this.data.get(this.currAttrIdx).join(' ')}="${this.query}" />`
            : '';
    }
}


export type VirtualKeys = Array<Array<[string, string]>>;

export interface VirtualKeyboardLayout {
    codes:Array<string>;
    label:string;
    name:string;
    keys:VirtualKeys;
}

export type VirtualKeyboardLayouts = Array<VirtualKeyboardLayout>;


export class VirtualKeyboardStore extends SimplePageStore {

    private pageModel:PageModel;

    private layouts:VirtualKeyboardLayouts;

    private currLayout:number;

    constructor(dispatcher:Dispatcher.Dispatcher<Kontext.DispatcherPayload>, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.currLayout = 0;
        const self = this;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {

            switch (payload.actionType) {
                case 'QUERY_INPUT_SET_VIRTUAL_KEYBOARD_LAYOUT':
                    self.currLayout = payload.props['idx'];
                    self.notifyChangeListeners();
                break;
                case 'QUERY_INPUT_LOAD_VIRTUAL_KEYBOARD_LAYOUTS':
                    self.pageModel.ajax<VirtualKeyboardLayouts>(
                        'GET',
                        self.pageModel.createStaticUrl('misc/kb-layouts.json'),
                        {}
                    ).then(
                        (data) => {
                            self.layouts = data;
                            self.currLayout = self.findMatchingKeyboard(payload.props['inputLanguage']);
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.pageModel.showMessage('error', err);
                        }
                    );
                break;
            }
        });
    }

    private findMatchingKeyboard(lang:string):number {
        const ans = [];
        const walkThru = (fn:(item:string)=>boolean) => {
            for (let i = 0; i < this.layouts.length; i += 1) {
                for (let code of this.layouts[i].codes || ['en_US']) {
                    if (fn((code || '').replace('-', '_').toLowerCase())) {
                        ans.push(i);
                    }
                }
            }
        };
        const normLang = lang.toLowerCase();
        walkThru(item => item === normLang);
        walkThru(item => item.substr(0, 2) === normLang.substr(0, 2));
        if (ans.length > 0) {
            return ans[0];

        } else {
            throw new Error('Unable to find matching keyboard layout');
        }
    }

    getLayoutNames():Array<[string, string]> {
        return this.layouts.map<[string, string]>(item => [item.name, item.label]);
    }

    getCurrentLayout():VirtualKeyboardLayout {
        return this.layouts[this.currLayout];
    }

    getCurrentLayoutIdx():number {
        return this.currLayout;
    }
}
