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
import * as Rx from '@reactivex/rxjs';

import {Kontext} from '../../types/common';
import {ActionDispatcher, Action, SEDispatcher} from '../../app/dispatcher';
import {validateGzNumber, StatelessModel} from '../base';
import {PageModel} from '../../app/main';
import {MultiDict, puid} from '../../util';


export enum FileTarget {
    WHITELIST = "wlwords",
    BLACKLIST = "blacklist",
    EMPTY = "empty'"
}

/**
 *
 */
export interface WLFilterEditorData {
    target: FileTarget.WHITELIST;
    fileName:string;
    data:string;
}

export interface BLFilterEditorData {
    target: FileTarget.BLACKLIST;
    fileName:string;
    data:string;
}

export interface EmptyFilterEditorData {
    target: FileTarget.EMPTY;
}

export type FilterEditorData = WLFilterEditorData|BLFilterEditorData|EmptyFilterEditorData;

export enum WlnumsTypes {
    FRQ = 'frq',
    DOCF = 'docf',
    ARF = 'arf'
}

export enum WlTypes {
    SIMPLE = 'simple',
    MULTILEVEL = 'multilevel'
}

export interface WordlistFormState {
    corpusId:string;
    corpusName:string;
    corpusVariant:string;
    subcorpList:Immutable.List<Kontext.SubcorpListItem>;
    attrList:Immutable.List<Kontext.AttrItem>;
    structAttrList:Immutable.List<Kontext.AttrItem>;
    wlattr:string;
    wlpat:string;
    wlsort:string;
    subcnorm:string;
    wlnums:WlnumsTypes;
    wlposattrs:[string, string, string];
    numWlPosattrLevels:number;
    wltype:WlTypes;
    wlminfreq:Kontext.FormValue<string>;
    wlwords:string;
    blacklist:string;
    filterEditorData:FilterEditorData;
    wlFileName:string;
    blFileName:string;
    includeNonwords:boolean;
    isForeignSubcorp:boolean;
    currentSubcorpus:string;
    origSubcorpName:string;
}

export interface WordlistModelInitialArgs {
    includeNonwords:number; // boolean like
    wlminfreq:number;
    subcnorm:string;
    wlnums:WlnumsTypes;
    blacklist:string;
    wlpat:string;
    wlwords:string;
    wlsort:string;
    wlattr:string;
    wltype:WlTypes;
}


/**
 *
 */
export class WordlistFormModel extends StatelessModel<WordlistFormState> implements Kontext.ICorpusSwitchAware<WordlistFormState> {

    private layoutModel:PageModel;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, corpusIdent:Kontext.FullCorpusIdent,
            subcorpList:Array<string>, attrList:Array<Kontext.AttrItem>, structAttrList:Array<Kontext.AttrItem>,
            initialArgs:WordlistModelInitialArgs) {
        super(
            dispatcher,
            {
                corpusId: corpusIdent.id,
                corpusName: corpusIdent.name,
                corpusVariant: corpusIdent.variant,
                subcorpList: Immutable.List<Kontext.SubcorpListItem>(subcorpList),
                attrList: Immutable.List<Kontext.AttrItem>(attrList),
                structAttrList: Immutable.List<Kontext.AttrItem>(structAttrList),
                wlpat: initialArgs.wlpat,
                wlattr: initialArgs.wlattr,
                wlnums: initialArgs.wlnums,
                wltype: initialArgs.wltype,
                wlminfreq: {value: initialArgs.wlminfreq.toFixed(), isInvalid: false, isRequired: true},
                wlsort: initialArgs.wlsort,
                wlposattrs: ['', '', ''],
                numWlPosattrLevels: 1,
                wlwords: initialArgs.wlwords,
                blacklist: initialArgs.blacklist,
                wlFileName: '',
                blFileName: '',
                subcnorm: initialArgs.subcnorm,
                includeNonwords: !!initialArgs.includeNonwords,
                filterEditorData: {
                    target: FileTarget.EMPTY
                },
                isForeignSubcorp: corpusIdent.foreignSubcorp,
                currentSubcorpus: corpusIdent.usesubcorp,
                origSubcorpName: ''
            }
        );
        this.layoutModel = layoutModel;
    }


    reduce(state:WordlistFormState, action:Action):WordlistFormState {
        let newState:WordlistFormState;
        switch (action.actionType) {
            case 'QUERY_INPUT_SELECT_SUBCORP':
                newState = this.copyState(state);
                if (action.props['pubName']) {
                    newState.currentSubcorpus = action.props['pubName'];
                    newState.origSubcorpName = action.props['subcorp'];
                    newState.isForeignSubcorp = action.props['foreign'];

                } else {
                    newState.currentSubcorpus = action.props['subcorp'];
                    newState.origSubcorpName = action.props['subcorp'];
                    newState.isForeignSubcorp = false;
                }
            break;
            case 'WORDLIST_FORM_SELECT_ATTR':
                newState = this.copyState(state);
                newState.wlattr = action.props['value'];
            break;
            case 'WORDLIST_FORM_SET_WLPAT':
                newState = this.copyState(state);
                newState.wlpat = action.props['value'];
            break;
            case 'WORDLIST_FORM_SET_WLNUMS':
                newState = this.copyState(state);
                newState.wlnums = action.props['value'];
            break;
            case 'WORDLIST_FORM_SELECT_WLPOSATTR':
                newState = this.copyState(state);
                newState.wlposattrs[action.props['position'] - 1] = action.props['value'];
            break;
            case 'WORDLIST_FORM_SET_WLTYPE':
                newState = this.copyState(state);
                newState.wltype = action.props['value'];
            break;
            case 'WORDLIST_FORM_SET_WLMINFREQ':
                newState = this.copyState(state);
                newState.wlminfreq.value = action.props['value'];
            break;
            case 'WORDLIST_FORM_SET_INCLUDE_NONWORDS':
                newState = this.copyState(state);
                newState.includeNonwords = action.props['value'];
            break;
            case 'WORDLIST_FORM_ADD_POSATTR_LEVEL':
                newState = this.copyState(state);
                newState.numWlPosattrLevels += 1;
            break;
            case 'WORDLIST_FORM_CREATE_WHITELIST':
                newState = this.copyState(state);
                newState.filterEditorData = {
                    target: FileTarget.WHITELIST,
                    fileName: `unsaved-file-${puid().substr(0, 5)}`,
                    data: ''
                };
            break;
            case 'WORDLIST_FORM_CREATE_BLACKLIST':
                newState = this.copyState(state);
                newState.filterEditorData = {
                    target: FileTarget.BLACKLIST,
                    fileName: `unsaved-file-${puid().substr(0, 5)}`,
                    data: ''
                };
            break;
            case 'WORDLIST_FORM_SET_FILTER_FILE_DONE': {
                newState = this.copyState(state);
                const props = action.props['data'] as FilterEditorData;
                if (props.target === FileTarget.BLACKLIST) {
                    newState.filterEditorData = {
                        target: FileTarget.BLACKLIST,
                        fileName: props.fileName,
                        data: props.data
                    };

                } else if (props.target === FileTarget.WHITELIST) {
                    newState.filterEditorData = {
                        target: FileTarget.WHITELIST,
                        fileName: props.fileName,
                        data: props.data
                    };
                }
            }
            break;
            case 'WORDLIST_FORM_UPDATE_EDITOR':
                newState = this.copyState(state);
                if (newState.filterEditorData.target !== FileTarget.EMPTY) {
                    if (newState.filterEditorData.target === FileTarget.BLACKLIST) {
                        newState.filterEditorData = {
                            target: FileTarget.BLACKLIST,
                            data: action.props['value'] as string,
                            fileName: newState.filterEditorData.fileName
                        };

                    } else {
                        newState.filterEditorData = {
                            target: FileTarget.WHITELIST,
                            data: action.props['value'] as string,
                            fileName: newState.filterEditorData.fileName
                        };
                    }
                }
            break;
            case 'WORDLIST_FORM_REOPEN_EDITOR':
                newState = this.copyState(state);
                if (action.props['target'] === FileTarget.WHITELIST) {
                    newState.filterEditorData = {
                        target: FileTarget.WHITELIST,
                        data: state.wlwords,
                        fileName: state.wlFileName
                    };

                } else if (action.props['target'] === FileTarget.BLACKLIST) {
                    newState.filterEditorData = {
                        target: FileTarget.BLACKLIST,
                        data: state.blacklist,
                        fileName: state.blFileName
                    };
                }
            break;
            case 'WORDLIST_FORM_CLEAR_FILTER_FILE':
                newState = this.copyState(state);
                if (window.confirm(this.layoutModel.translate('wordlist__confirm_file_remove'))) {
                    if (action.props['target'] === FileTarget.WHITELIST) {
                        newState.wlwords = '';
                        newState.wlFileName = ''

                    } else if (action.props['target'] === FileTarget.BLACKLIST) {
                        newState.blacklist = '';
                        newState.blFileName = ''
                    }
                }
            break;
            case 'WORDLIST_FORM_CLOSE_EDITOR':
                newState = this.copyState(state);
                if (newState.filterEditorData.target === FileTarget.WHITELIST) {
                    newState.wlwords = newState.filterEditorData.data;
                    newState.wlFileName = newState.filterEditorData.fileName;
                    newState.filterEditorData = {target: FileTarget.EMPTY};

                } else if (newState.filterEditorData.target === FileTarget.BLACKLIST) {
                    newState.blacklist = newState.filterEditorData.data;
                    newState.blFileName = newState.filterEditorData.fileName;
                    newState.filterEditorData = {target: FileTarget.EMPTY};
                }
            break;
            case 'WORDLIST_RESULT_SET_SORT_COLUMN':
                newState = this.copyState(state);
                newState.wlsort = action.props['sortKey'];
            break;
            case 'CORPUS_SWITCH_MODEL_RESTORE':
                if (action.props['key'] === this.csGetStateKey()) {
                    const props = action.props as Kontext.CorpusSwitchActionProps<WordlistFormState>;
                    newState = props.data;

                } else {
                    newState = state;
                }
            break;
            default:
                newState = state;
            break;
        }
        return newState;
    }

    sideEffects(state:WordlistFormState, action:Action, dispatch:SEDispatcher):void {
        switch (action.actionType) {
            case 'QUERY_INPUT_SELECT_SUBCORP':
                const corpIdent = this.layoutModel.getCorpusIdent();
                this.layoutModel.setConf<Kontext.FullCorpusIdent>(
                    'corpusIdent',
                    {
                        id: corpIdent.id,
                        name: corpIdent.name,
                        variant: corpIdent.variant,
                        usesubcorp: state.currentSubcorpus,
                        origSubcorpName: state.origSubcorpName,
                        foreignSubcorp: state.isForeignSubcorp
                    }
                );
            break;
            case 'WORDLIST_FORM_SET_FILTER_FILE': {
                const file:File = action.props['value'];
                if (file) {
                    this.handleFilterFileSelection(state, file, action.props['target']).subscribe(
                        (data) => {
                            dispatch({
                                actionType: 'WORDLIST_FORM_SET_FILTER_FILE_DONE',
                                props: {
                                    data: data
                                }
                            });
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            }
            break;
            case 'WORDLIST_FORM_SUBMIT':
                const err = this.validateForm(state);
                if (!err) {
                    this.submit(state);

                } else {
                    this.layoutModel.showMessage('error', err);
                }
            break;
        }
    }

    private validateForm(state:WordlistFormState):Error|null {
        if (validateGzNumber(state.wlminfreq.value)) {
            state.wlminfreq.isInvalid = false;
            return null;

        } else {
            state.wlminfreq.isInvalid = true;
            return new Error(this.layoutModel.translate('wordlist__minfreq_err'));
        }
    }

    private handleFilterFileSelection(state:WordlistFormState, file:File, target:string):Rx.Observable<FilterEditorData> {
        return Rx.Observable.create((observer:Rx.Observer<any>) => {
            const fr = new FileReader();
            fr.onload = (evt:any) => { // TODO TypeScript seems to have no type for this
                observer.next(evt.target.result);
                observer.complete();
            };
            fr.readAsText(file);

        }).concatMap(
            (data) => {
                return Rx.Observable.of({
                    target: target,
                    data: data,
                    fileName: file.name
                });
            }
        );
    }

    createSubmitArgs(state:WordlistFormState):MultiDict {
        const ans = new MultiDict();
        ans.set('corpname', state.corpusId);
        if (state.currentSubcorpus) {
            ans.set('usesubcorp', state.currentSubcorpus);
        }
        ans.set('wlattr', state.wlattr);
        ans.set('wlpat', state.wlpat.normalize());
        ans.set('wlminfreq', state.wlminfreq.value);
        ans.set('wlnums', state.wlnums);
        ans.set('wltype', state.wltype);
        ans.set('wlsort', state.wlsort);
        if (state.wlwords.trim()) {
            ans.set('wlwords', state.wlwords.trim());
        }
        if (state.blacklist.trim()) {
            ans.set('blacklist', state.blacklist.trim());
        }
        ans.set('include_nonwords', state.includeNonwords ? '1' : '0');
        if (state.wltype === WlTypes.MULTILEVEL) {
            ans.set('wlposattr1', state.wlposattrs[0]);
            ans.set('wlposattr2', state.wlposattrs[1]);
            ans.set('wlposattr3', state.wlposattrs[2]);
        }
        return ans;
    }

    private submit(state:WordlistFormState):void {
        const args = this.createSubmitArgs(state);
        const action = state.wltype === WlTypes.MULTILEVEL ? 'wordlist/struct_result' : 'wordlist/result';
        this.layoutModel.setLocationPost(
            this.layoutModel.createActionUrl(action),
            args.items()
        );
    }

    csExportState():WordlistFormState {
        return this.getState();
    }

    csGetStateKey():string {
        return 'wordlist-form';
    }

    getAllowsMultilevelWltype(state:WordlistFormState):boolean {
        return state.wlnums === WlnumsTypes.FRQ;
    }
}