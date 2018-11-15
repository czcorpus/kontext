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

import * as Immutable from 'immutable';
import RSVP from 'rsvp';

import {Kontext} from '../../types/common';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {StatefulModel, validateGzNumber} from '../base';
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
    wlposattrs:[string, string, string];
    wlwords:string;
    blacklist:string;
    wlFileName:string;
    blFileName:string;
    includeNonwords:boolean;
}

/**
 *
 */
export class WordlistFormModel extends StatefulModel implements Kontext.ICorpusSwitchAware<WordlistFormProps> {

    private layoutModel:PageModel;

    private corpusId:string;

    private corpusName:string;

    private corpusVariant:string;

    private currentSubcorpus:string;

    private origSubcorpName:string;

    private isForeignSubcorp:boolean;

    private subcorpList:Immutable.List<Kontext.SubcorpListItem>;

    private attrList:Immutable.List<Kontext.AttrItem>;

    private structAttrList:Immutable.List<Kontext.AttrItem>;

    private wlattr:string;

    private wlpat:string;

    private wlsort:string;

    private subcnorm:string;

    private wlnums:string; // frq/docf/arf

    private wlposattrs:[string, string, string];

    private numWlPosattrLevels:number;

    private wltype:string; // simple/multilevel

    private wlminfreq:Kontext.FormValue<string>;

    private wlwords:string;

    private blacklist:string;

    private filterEditorData:WLFilterEditorData;

    private wlFileName:string;

    private blFileName:string;

    private includeNonwords:boolean;


    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, corpusIdent:Kontext.FullCorpusIdent,
            subcorpList:Array<string>, attrList:Array<Kontext.AttrItem>, structAttrList:Array<Kontext.AttrItem>) {
        super(dispatcher);
        this.corpusId = corpusIdent.id;
        this.corpusName = corpusIdent.name;
        this.corpusVariant = this.corpusVariant;
        this.currentSubcorpus = corpusIdent.usesubcorp;
        this.origSubcorpName = '';
        this.isForeignSubcorp = corpusIdent.foreignSubcorp;
        this.layoutModel = layoutModel;
        this.subcorpList = Immutable.List<Kontext.SubcorpListItem>(subcorpList);
        this.attrList = Immutable.List<Kontext.AttrItem>(attrList);
        this.structAttrList = Immutable.List<Kontext.AttrItem>(structAttrList);
        this.wlpat = '';
        this.wlattr = this.attrList.get(0).n;
        this.wlnums = 'frq';
        this.wltype = 'simple';
        this.wlminfreq = {value: '5', isInvalid: false, isRequired: true};
        this.wlsort = 'f';
        this.wlposattrs = ['', '', ''];
        this.numWlPosattrLevels = 1;
        this.wlwords = '';
        this.blacklist = '';
        this.wlFileName = '';
        this.blFileName = '';
        this.subcnorm = '';
        this.includeNonwords = false;


        this.dispatcherRegister((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SELECT_SUBCORP':
                    if (payload.props['pubName']) {
                        this.currentSubcorpus = payload.props['pubName'];
                        this.origSubcorpName = payload.props['subcorp'];
                        this.isForeignSubcorp = payload.props['foreign'];

                    } else {
                        this.currentSubcorpus = payload.props['subcorp'];
                        this.origSubcorpName = payload.props['subcorp'];
                        this.isForeignSubcorp = false;
                    }
                    const corpIdent = this.layoutModel.getCorpusIdent();
                    this.layoutModel.setConf<Kontext.FullCorpusIdent>(
                        'corpusIdent',
                        {
                            id: corpIdent.id,
                            name: corpIdent.name,
                            variant: corpIdent.variant,
                            usesubcorp: this.currentSubcorpus,
                            origSubcorpName: this.origSubcorpName,
                            foreignSubcorp: this.isForeignSubcorp
                        }
                    );
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
                    this.wlposattrs[payload.props['position'] - 1] = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'WORDLIST_FORM_SET_WLTYPE':
                    this.wltype = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'WORDLIST_FORM_SET_WLMINFREQ':
                    this.wlminfreq.value = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'WORDLIST_FORM_SET_INCLUDE_NONWORDS':
                    this.includeNonwords = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'WORDLIST_FORM_ADD_POSATTR_LEVEL':
                    this.numWlPosattrLevels += 1;
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
                    const err = this.validateForm();
                    if (!err) {
                        this.submit();

                    } else {
                        this.layoutModel.showMessage('error', err);
                    }
                    this.notifyChangeListeners();
                break;
                case 'CORPUS_SWITCH_MODEL_RESTORE':
                if (payload.props['key'] === this.csGetStateKey()) {
                    this.csSetState(payload.props['data']);
                    this.notifyChangeListeners();
                }
                break;
            }
        });
    }

    private validateForm():Error|null {
        if (validateGzNumber(this.wlminfreq.value)) {
            this.wlminfreq.isInvalid = false;
            return null;

        } else {
            this.wlminfreq.isInvalid = true;
            return new Error(this.layoutModel.translate('wordlist__minfreq_err'));
        }
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
        ans.set('corpname', this.corpusId);
        if (this.currentSubcorpus) {
            ans.set('usesubcorp', this.currentSubcorpus);
        }
        ans.set('wlattr', this.wlattr);
        ans.set('wlpat', this.wlpat);
        ans.set('wlminfreq', this.wlminfreq.value);
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
            ans.set('wlposattr1', this.wlposattrs[0]);
            ans.set('wlposattr2', this.wlposattrs[1]);
            ans.set('wlposattr3', this.wlposattrs[2]);
        }
        return ans;
    }

    private submit():void {
        const args = this.createSubmitArgs();
        const action = this.wltype === 'multilevel' ? 'wordlist/struct_result' : 'wordlist/result';
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
            wlminfreq: this.wlminfreq.value,
            wlposattrs: ['', '', ''], // this is likely different between corpora
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
        this.wlminfreq = {value: state.wlminfreq, isInvalid: false, isRequired: true};
        this.wlposattrs = state.wlposattrs;
        this.wlwords = state.wlwords;
        this.blacklist = state.blacklist;
        this.wlFileName = state.wlFileName;
        this.blFileName = state.blFileName;
        this.includeNonwords = state.includeNonwords;
    }

    csGetStateKey():string {
        return 'wordlist-form';
    }

    getAvailableSubcorpora():Immutable.List<{n:string; v:string}> {
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

    getWposattrs():[string, string, string] {
        return this.wlposattrs;
    }

    getNumWlPosattrLevels():number {
        return this.numWlPosattrLevels;
    }

    getWltype():string {
        return this.wltype;
    }

    getWlsort():string {
        return this.wlsort;
    }

    getWlminfreq():Kontext.FormValue<string> {
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
        return {
            id: this.corpusId,
            name: this.corpusName,
            variant: this.corpusVariant,
            origSubcorpName: this.origSubcorpName,
            usesubcorp: this.currentSubcorpus,
            foreignSubcorp: this.isForeignSubcorp
        };
    }

    getAllowsMultilevelWltype():boolean {
        return this.wlnums === 'frq';
    }
}