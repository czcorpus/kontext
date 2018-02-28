/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />

import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';

import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {SimplePageStore, validateGzNumber} from '../base';
import {PageModel} from '../../app/main';
import {MultiDict} from '../../util';

/**
 *
 */
export interface WLFilterEditorData {
    fileName:string;
    target: string;
    data: string;
}

export interface WordlistFormProps {
    wlattr:string;
    wlpat:string;
    wlsort:string;
    subcnorm:string;
    wltype:string;
    wlnums:string;
    wlminfreq:string
    wlposattr1:string;
    wlposattr2:string;
    wlposattr3:string;
    wlwords:string;
    blacklist:string;
    wlFileName:string;
    blFileName:string;
    includeNonwords:boolean;
}

/**
 *
 */
export class WordlistFormStore extends SimplePageStore implements Kontext.ICorpusSwitchAware<WordlistFormProps>, PluginInterfaces.ICorparchStore {

    private layoutModel:PageModel;

    private corpusIdent:Kontext.FullCorpusIdent;

    private currentSubcorpus:string;

    private subcorpList:Immutable.List<string>;

    private attrList:Immutable.List<Kontext.AttrItem>;

    private structAttrList:Immutable.List<Kontext.AttrItem>;

    private wlattr:string;

    private wlpat:string;

    private wlsort:string;

    private subcnorm:string;

    private wlnums:string; // frq/docf/arf

    private wlposattr1:string;

    private wlposattr2:string;

    private wlposattr3:string;

    private wltype:string; // simple/multilevel

    private wlminfreq:string;

    private wlwords:string;

    private blacklist:string;

    private filterEditorData:WLFilterEditorData;

    private wlFileName:string;

    private blFileName:string;

    private includeNonwords:boolean;


    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, corpusIdent:Kontext.FullCorpusIdent,
            subcorpList:Array<string>, attrList:Array<Kontext.AttrItem>, structAttrList:Array<Kontext.AttrItem>) {
        super(dispatcher);
        this.corpusIdent = corpusIdent;
        this.currentSubcorpus = '';
        this.layoutModel = layoutModel;
        this.subcorpList = Immutable.List<string>(subcorpList);
        this.attrList = Immutable.List<Kontext.AttrItem>(attrList);
        this.structAttrList = Immutable.List<Kontext.AttrItem>(structAttrList);
        this.wlpat = '';
        this.wlattr = this.attrList.get(0).n;
        this.wlnums = 'frq';
        this.wltype = 'simple';
        this.wlminfreq = '5';
        this.wlsort = 'f';
        this.wlposattr1 = '';
        this.wlposattr2 = '';
        this.wlposattr3 = '';
        this.wlwords = '';
        this.blacklist = '';
        this.wlFileName = '';
        this.blFileName = '';
        this.subcnorm = '';
        this.includeNonwords = false;


        this.dispatcherRegister((payload:ActionPayload) => {
            switch (payload.actionType) {
            case 'QUERY_INPUT_SELECT_SUBCORP':
                this.currentSubcorpus = payload.props['subcorp'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SELECT_ATTR':
                this.wlattr = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SET_WLPAT':
                this.wlpat = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SET_WLNUMS':
                this.wlnums = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SELECT_WLPOSATTR':
                switch (payload.props['position']) {
                case 1:
                    this.wlposattr1 = payload.props['value'];
                break;
                case 2:
                    this.wlposattr2 = payload.props['value'];
                break;
                case 3:
                    this.wlposattr3 = payload.props['value'];
                break;
                }
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SET_WLTYPE':
                this.wltype = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SET_WLMINFREQ':
                if (validateGzNumber(payload.props['value'])) {
                    this.wlminfreq = payload.props['value'];

                } else {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('wordlist__minfreq_err'));
                }
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SET_INCLUDE_NONWORDS':
                this.includeNonwords = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SET_FILTER_FILE':
                const file:File = payload.props['value'];
                if (file) {
                    this.handleFilterFileSelection(file, payload.props['target']).then(
                        () => {
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                }
            break;
            case 'WORDLIST_FORM_UPDATE_EDITOR':
                this.filterEditorData.data = payload.props['value'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_REOPEN_EDITOR':
                this.filterEditorData = {
                    target: payload.props['target'],
                    data: '',
                    fileName: ''
                };
                this.doWhiteOrBlackOp(
                    payload.props['target'],
                    () => {
                        this.filterEditorData.data = this.wlwords;
                        this.filterEditorData.fileName = this.wlFileName;
                    },
                    () => {
                        this.filterEditorData.data = this.blacklist;
                        this.filterEditorData.fileName = this.blFileName;
                    }
                );
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_CLEAR_FILTER_FILE':
                if (window.confirm(this.layoutModel.translate('wordlist__confirm_file_remove'))) {
                    this.doWhiteOrBlackOp(
                        payload.props['target'],
                        () => { this.wlwords = ''; this.wlFileName = '' },
                        () => { this.blacklist = ''; this.blFileName = '' }
                    );
                    this.notifyChangeListeners();
                }
            break;
            case 'WORDLIST_FORM_CLOSE_EDITOR':
                this.doWhiteOrBlackOp(
                    this.filterEditorData.target,
                    () => this.wlwords = this.filterEditorData.data,
                    () => this.blacklist = this.filterEditorData.data
                );
                this.filterEditorData = null;
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_RESULT_SET_SORT_COLUMN':
                this.wlsort = payload.props['sortKey'];
                this.notifyChangeListeners();
            break;
            case 'WORDLIST_FORM_SUBMIT':
                this.submit();
                this.notifyChangeListeners();
            break;
            }
        });
    }

    private doWhiteOrBlackOp(value:string, wlop:()=>void, blop:()=>void):void {
        switch (value) {
            case 'wlwords':
                wlop();
            break;
            case 'blacklist':
                blop();
            break;
        }
    }

    private handleFilterFileSelection(file:File, target:string):RSVP.Promise<any> {
        return new RSVP.Promise<any>((resolve:(v)=>void, reject:(err)=>void) => {
            const fr = new FileReader();
            fr.onload = (evt:any) => { // TODO TypeScript seems to have no type for this
                resolve(evt.target.result);
            };
            fr.readAsText(file);

        }).then(
            (data) => {
                this.doWhiteOrBlackOp(
                    target,
                    () => this.wlFileName = file.name,
                    () => this.blFileName = file.name
                );
                this.filterEditorData = {
                    target: target,
                    data: data,
                    fileName: file.name
                };
            }
        );
    }

    createSubmitArgs():MultiDict {
        const ans = new MultiDict();
        ans.set('corpname', this.corpusIdent.id);
        if (this.currentSubcorpus) {
            ans.set('usesubcorp', this.currentSubcorpus);
        }
        ans.set('wlattr', this.wlattr);
        ans.set('wlpat', this.wlpat);
        ans.set('wlminfreq', this.wlminfreq);
        ans.set('wlnums', this.wlnums);
        ans.set('wltype', this.wltype);
        ans.set('wlsort', this.wlsort);
        if (this.wlwords.trim()) {
            ans.set('wlwords', this.wlwords.trim());
        }
        if (this.blacklist.trim()) {
            ans.set('blacklist', this.blacklist.trim());
        }
        ans.set('include_nonwords', this.includeNonwords ? '1' : '0');
        if (this.wltype === 'multilevel') {
            ans.set('wlposattr1', this.wlposattr1);
            ans.set('wlposattr2', this.wlposattr2);
            ans.set('wlposattr3', this.wlposattr3);
        }
        return ans;
    }

    private submit():void {
        const args = this.createSubmitArgs();
        const action = this.wltype === 'multilevel' ? 'struct_wordlist' : 'wordlist';
        this.layoutModel.setLocationPost(
            this.layoutModel.createActionUrl(action),
            args.items()
        );
    }

    csExportState():WordlistFormProps {
        return {
            wlattr: '', // this is likely different between corpora
            wlpat: this.wlpat,
            wlsort: this.wlsort,
            subcnorm: this.subcnorm,
            wltype: this.wltype,
            wlnums: this.wlnums,
            wlminfreq: this.wlminfreq,
            wlposattr1: '', // this is likely different between corpora
            wlposattr2: '', // - dtto -
            wlposattr3: '', // - dtto -
            wlwords: this.wlwords,
            blacklist: this.blacklist,
            wlFileName: this.wlFileName,
            blFileName: this.blFileName,
            includeNonwords: this.includeNonwords
        };
    }

    csSetState(state:WordlistFormProps):void {
        this.wlattr = state.wlattr ? state.wlattr : 'word';
        this.wlpat = state.wlpat;
        this.wlsort = state.wlsort;
        this.subcnorm = state.subcnorm;
        this.wltype = state.wltype;
        this.wlnums = state.wlnums;
        this.wlminfreq = state.wlminfreq;
        this.wlposattr1 = state.wlposattr1;
        this.wlposattr2 = state.wlposattr2;
        this.wlposattr3 = state.wlposattr3;
        this.wlwords = state.wlwords;
        this.blacklist = state.blacklist;
        this.wlFileName = state.wlFileName;
        this.blFileName = state.blFileName;
        this.includeNonwords = state.includeNonwords;
    }

    csGetStateKey():string {
        return 'wordlist-form';
    }

    getSubcorpList():Immutable.List<string> {
        return this.subcorpList;
    }

    getAvailableSubcorpora():Immutable.List<string> {
        return this.subcorpList;
    }

    getCurrentSubcorpus():string {
        return this.currentSubcorpus;
    }

    getAttrList():Immutable.List<Kontext.AttrItem> {
        return this.attrList;
    }

    getStructAttrList():Immutable.List<Kontext.AttrItem> {
        return this.structAttrList;
    }

    getWlpat():string {
        return this.wlpat;
    }

    getWlattr():string {
        return this.wlattr;
    }

    getWlnums():string {
        return this.wlnums;
    }

    getWposattr1():string {
        return this.wlposattr1;
    }

    getWposattr2():string {
        return this.wlposattr2;
    }

    getWposattr3():string {
        return this.wlposattr3;
    }

    getWltype():string {
        return this.wltype;
    }

    getWlsort():string {
        return this.wlsort;
    }

    getWlminfreq():string {
        return this.wlminfreq;
    }

    getFilterEditorData():WLFilterEditorData {
        return this.filterEditorData;
    }

    hasWlwords():boolean {
        return !!this.wlwords;
    }

    hasBlacklist():boolean {
        return !!this.blacklist;
    }

    getWlFileName():string {
        return this.wlFileName;
    }

    getBlFileName():string {
        return this.blFileName;
    }

    getIncludeNonwords():boolean {
        return this.includeNonwords;
    }

    getCorpusIdent():Kontext.FullCorpusIdent {
        return this.corpusIdent;
    }

    getAllowsMultilevelWltype():boolean {
        return this.wlnums === 'frq';
    }
}