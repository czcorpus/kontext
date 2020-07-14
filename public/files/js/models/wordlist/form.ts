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

import { Observable, Observer, of as rxOf } from 'rxjs';
import { StatelessModel, IActionDispatcher } from 'kombo';
import { concatMap } from 'rxjs/operators';
import { Dict, List, Ident } from 'cnc-tskit';


import { Kontext } from '../../types/common';
import { validateGzNumber } from '../base';
import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { ActionName, Actions } from './actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../query/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { FileTarget, WlnumsTypes, WlTypes } from './common';


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


export interface WordlistFormState {
    corpusId:string;
    corpusName:string;
    corpusVariant:string;
    subcorpList:Array<Kontext.SubcorpListItem>;
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    wlattr:string;
    usesStructAttr:boolean;
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
export class WordlistFormModel extends StatelessModel<WordlistFormState> {

    private layoutModel:PageModel;

    constructor(dispatcher:IActionDispatcher, layoutModel:PageModel, corpusIdent:Kontext.FullCorpusIdent,
            subcorpList:Array<string>, attrList:Array<Kontext.AttrItem>, structAttrList:Array<Kontext.AttrItem>,
            initialArgs:WordlistModelInitialArgs) {
        super(
            dispatcher,
            {
                corpusId: corpusIdent.id,
                corpusName: corpusIdent.name,
                corpusVariant: corpusIdent.variant,
                subcorpList: [...List.map(v => ({v: v, n: v, pub: '', foreign: false}), subcorpList)], // TODO missing information for subc items
                attrList: [...attrList],
                structAttrList: [...structAttrList],
                wlpat: initialArgs.wlpat,
                wlattr: initialArgs.wlattr,
                usesStructAttr: initialArgs.wlattr.indexOf('.') > -1,
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

        this.addActionHandler(
            'QUERY_INPUT_SELECT_SUBCORP',
            (state, action) => {
                if (action.payload['pubName']) {
                    state.currentSubcorpus = action.payload['pubName'];
                    state.origSubcorpName = action.payload['subcorp'];
                    state.isForeignSubcorp = action.payload['foreign'];

                } else {
                    state.currentSubcorpus = action.payload['subcorp'];
                    state.origSubcorpName = action.payload['subcorp'];
                    state.isForeignSubcorp = false;
                }
            },
            (state, action, dispatch) => {
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
            }
        );

        this.addActionHandler<Actions.WordlistResultReload>(
            ActionName.WordlistResultReload,
            null,
            (state, action, dispatch) => {
                dispatch<Actions.WordlistFormSubmitReady>({
                    name: ActionName.WordlistFormSubmitReady,
                    payload: {
                        args: this.createSubmitArgs(state)
                    }
                });
            }
        ).sideEffectAlsoOn(
            ActionName.WordlistSaveFormSubmit,
            MainMenuActionName.DirectSave,
            ActionName.WordlistResultNextPage,
            ActionName.WordlistResultPrevPage,
            ActionName.WordlistGoToLastPage,
            ActionName.WordlistResultConfirmPage,
            ActionName.WordlistResultViewConc
        );

        this.addActionHandler<Actions.WordlistFormSelectAttr>(
            ActionName.WordlistFormSelectAttr,
            (state, action) => {
                state.wlattr = action.payload.value;
                state.usesStructAttr = action.payload.value.indexOf('.' ) > -1;
            }
        );

        this.addActionHandler<Actions.WordlistFormSetWlpat>(
            ActionName.WordlistFormSetWlpat,
            (state, action) => {
                state.wlpat = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistFormSetWlnums>(
            ActionName.WordlistFormSetWlnums,
            (state, action) => {
                state.wlnums = action.payload.value as WlnumsTypes; // TODO
            }
        );

        this.addActionHandler<Actions.WordlistFormSelectWlposattr>(
            ActionName.WordlistFormSelectWlposattr,
            (state, action) => {
                state.wlposattrs[action.payload.position - 1] = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistFormSetWltype>(
            ActionName.WordlistFormSetWltype,
            (state, action) => {
                state.wltype = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistFormSetWlminfreq>(
            ActionName.WordlistFormSetWlminfreq,
            (state, action) => {
                state.wlminfreq.value = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistFormSetIncludeNonwords>(
            ActionName.WordlistFormSetIncludeNonwords,
            (state, action) => {
                state.includeNonwords = action.payload.value;
            }
        );

        this.addActionHandler<Actions.WordlistFormAddPosattrLevel>(
            ActionName.WordlistFormAddPosattrLevel,
            (state, action) => {
                state.numWlPosattrLevels += 1;
            }
        );

        this.addActionHandler<Actions.WordlistFormCreateWhitelist>(
            ActionName.WordlistFormCreateWhitelist,
            (state, action) => {
                state.filterEditorData = {
                    target: FileTarget.WHITELIST,
                    fileName: `unsaved-file-${Ident.puid().substr(0, 5)}`,
                    data: ''
                };
            }
        );

        this.addActionHandler<Actions.WordlistFormCreateBlacklist>(
            ActionName.WordlistFormCreateBlacklist,
            (state, action) => {
                state.filterEditorData = {
                    target: FileTarget.BLACKLIST,
                    fileName: `unsaved-file-${Ident.puid().substr(0, 5)}`,
                    data: ''
                };
            }
        );

        this.addActionHandler<Actions.WordlistFormSetFilter>(
            ActionName.WordlistFormSetFilter,
            null,
            (state, action, dispatch) => {
                const file:File = action.payload.value;
                if (file) {
                    this.handleFilterFileSelection(state, file, action.payload.target).subscribe(
                        (data) => {
                            dispatch<Actions.WordlistFormSetFilterDone>({
                                name: ActionName.WordlistFormSetFilterDone,
                                payload: {
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
        );

        this.addActionHandler<Actions.WordlistFormSetFilterDone>(
            ActionName.WordlistFormSetFilterDone,
            (state, action) => {
                const props = action.payload['data'] as FilterEditorData;
                if (props.target === FileTarget.BLACKLIST) {
                    state.filterEditorData = {
                        target: FileTarget.BLACKLIST,
                        fileName: props.fileName,
                        data: props.data
                    };

                } else if (props.target === FileTarget.WHITELIST) {
                    state.filterEditorData = {
                        target: FileTarget.WHITELIST,
                        fileName: props.fileName,
                        data: props.data
                    };
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormUpdateEditor>(
            ActionName.WordlistFormUpdateEditor,
            (state, action) => {
                if (state.filterEditorData.target !== FileTarget.EMPTY) {
                    if (state.filterEditorData.target === FileTarget.BLACKLIST) {
                        state.filterEditorData = {
                            target: FileTarget.BLACKLIST,
                            data: action.payload['value'] as string,
                            fileName: state.filterEditorData.fileName
                        };

                    } else {
                        state.filterEditorData = {
                            target: FileTarget.WHITELIST,
                            data: action.payload['value'] as string,
                            fileName: state.filterEditorData.fileName
                        };
                    }
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormReopenEditor>(
            ActionName.WordlistFormReopenEditor,
            (state, action) => {
                if (action.payload['target'] === FileTarget.WHITELIST) {
                    state.filterEditorData = {
                        target: FileTarget.WHITELIST,
                        data: state.wlwords,
                        fileName: state.wlFileName
                    };

                } else if (action.payload['target'] === FileTarget.BLACKLIST) {
                    state.filterEditorData = {
                        target: FileTarget.BLACKLIST,
                        data: state.blacklist,
                        fileName: state.blFileName
                    };
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormClearFilterFile>(
            ActionName.WordlistFormClearFilterFile,
            (state, action) => {
                if (window.confirm(this.layoutModel.translate('wordlist__confirm_file_remove'))) {
                    if (action.payload.target === FileTarget.WHITELIST) {
                        state.wlwords = '';
                        state.wlFileName = ''

                    } else if (action.payload['target'] === FileTarget.BLACKLIST) {
                        state.blacklist = '';
                        state.blFileName = ''
                    }
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormCloseEditor>(
            ActionName.WordlistFormCloseEditor,
            (state, action) => {
                if (state.filterEditorData.target === FileTarget.WHITELIST) {
                    state.wlwords = state.filterEditorData.data;
                    state.wlFileName = state.filterEditorData.fileName;
                    state.filterEditorData = {target: FileTarget.EMPTY};

                } else if (state.filterEditorData.target === FileTarget.BLACKLIST) {
                    state.blacklist = state.filterEditorData.data;
                    state.blFileName = state.filterEditorData.fileName;
                    state.filterEditorData = {target: FileTarget.EMPTY};
                }
            }
        );

        this.addActionHandler<Actions.WordlistResultSetSortColumn>(
            ActionName.WordlistResultSetSortColumn,
            (state, action) => {
                state.wlsort = action.payload.sortKey;
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            (state, action) => {
                if (action.payload['key'] === this.getRegistrationId()) {
                    Dict.forEach(
                        (val, key) => {
                            state[key] = val;
                        }
                    )
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormSubmit>(
            ActionName.WordlistFormSubmit,
            (state, action) => {
                this.validateForm(state);
            },
            (state, action, dispatch) => {
                if (!state.wlminfreq.isInvalid) {
                    this.submit(state);

                } else {
                    this.layoutModel.showMessage('error', state.wlminfreq.errorDesc);
                }
            }
        )
    }

    private validateForm(state:WordlistFormState):void {
        if (validateGzNumber(state.wlminfreq.value)) {
            state.wlminfreq.isInvalid = false;
            return null;

        } else {
            state.wlminfreq.isInvalid = true;
            state.wlminfreq.errorDesc = this.layoutModel.translate('wordlist__minfreq_err');
        }
    }

    private handleFilterFileSelection(state:WordlistFormState, file:File, target:FileTarget):Observable<FilterEditorData> {
        return new Observable<string>((observer:Observer<string>) => {
            const fr = new FileReader();
            fr.onload = (evt:any) => { // TODO TypeScript seems to have no type for this
                observer.next(evt.target.result);
                observer.complete();
            };
            fr.readAsText(file);

        }).pipe(
            concatMap(
                (data:string) => {
                    return rxOf<FilterEditorData>({
                        target: target,
                        data: data,
                        fileName: file.name
                    });
                }
            )
        );
    }

    createSubmitArgs(state:WordlistFormState):MultiDict {
        const ans = new MultiDict();
        ans.set('corpname', state.corpusId);
        if (state.currentSubcorpus) {
            ans.set('usesubcorp', state.currentSubcorpus);
        }
        ans.set('wlattr', state.wlattr);
        ans.set('wlpat', state.wlpat['normalize']()); // TODO ES2015 stuff here
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

    getRegistrationId():string {
        return 'wordlist-form';
    }

    getAllowsMultilevelWltype(state:WordlistFormState):boolean {
        return state.wlnums === WlnumsTypes.FRQ;
    }
}