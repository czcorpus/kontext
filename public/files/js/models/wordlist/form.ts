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
import { StatelessModel, IActionDispatcher, SEDispatcher } from 'kombo';
import { concatMap, map } from 'rxjs/operators';
import { Dict, List, Ident, pipe, tuple, HTTP } from 'cnc-tskit';


import { Kontext } from '../../types/common';
import { validateGzNumber } from '../base';
import { PageModel } from '../../app/page';
import { ActionName, Actions } from './actions';
import { ActionName as MainMenuActionName } from '../mainMenu/actions';
import { Actions as QueryActions, ActionName as QueryActionName } from '../query/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../common/actions';
import { Actions as ACActions, ActionName as ACActionName } from '../../models/asyncTask/actions';
import { FileTarget, SubmitResponse, WlnumsTypes, WlTypes, WordlistSubmitArgs } from './common';
import { IUnregistrable } from '../common/common';
import { MultiDict } from '../../multidict';


/**
 *
 */
export interface WLFilterEditorData {
    target: 'pfilter';
    fileName:string;
    data:string;
}

export interface BLFilterEditorData {
    target: 'nfilter';
    fileName:string;
    data:string;
}

export interface EmptyFilterEditorData {
    target: 'empty';
}

export type FilterEditorData = WLFilterEditorData|BLFilterEditorData|EmptyFilterEditorData;

export interface MultiposAttr {
    inputId:string;
    value:string;
}

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
    subcnorm:string;
    wlnums:WlnumsTypes;
    wlposattrs:Array<MultiposAttr>;
    maxNumWlPosattrLevels:number;
    wltype:WlTypes;
    wlminfreq:Kontext.FormValue<string>;
    pfilterWords:string;
    nfilterWords:string;
    filterEditorData:FilterEditorData;
    pfilterFileName:string;
    nfilterFileName:string;
    includeNonwords:boolean;
    isForeignSubcorp:boolean;
    currentSubcorpus:string;
    origSubcorpName:string;
    outputOptionsVisible:boolean;
    filtersVisible:boolean;
    precalcTasks:Array<Kontext.AsyncTaskInfo<{}>>;
    isBusy:boolean;
}

export interface WordlistFormCorpSwitchPreserve {
    wlpat:string;
    nfilterWords:string;
    pfilterWords:string;
    pfilterFileName:string;
    nfilterFileName:string;
    includeNonwords:boolean;
}

export interface WordlistFormModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    corpusIdent:Kontext.FullCorpusIdent;
    subcorpList:Array<string>;
    attrList:Array<Kontext.AttrItem>;
    structAttrList:Array<Kontext.AttrItem>;
    initialArgs:{
        include_nonwords:number; // boolean like
        wlminfreq:number;
        subcnorm:string;
        wlnums:WlnumsTypes;
        wlpat:string;
        pfilter_words:Array<string>;
        nfilter_words:Array<string>;
        wlsort:string;
        wlattr:string;
        wltype:WlTypes;
    };
}

/**
 *
 */
export class WordlistFormModel extends StatelessModel<WordlistFormState> implements IUnregistrable {

    private layoutModel:PageModel;

    constructor({
        dispatcher,
        layoutModel,
        corpusIdent,
        subcorpList,
        attrList,
        structAttrList,
        initialArgs
    }:WordlistFormModelArgs) {
        super(
            dispatcher,
            {
                corpusId: corpusIdent.id,
                corpusName: corpusIdent.name,
                corpusVariant: corpusIdent.variant,
                subcorpList: [...List.map(
                    v => ({v: v, n: v, pub: '', foreign: false}),
                    subcorpList
                )], // TODO missing information for subc items
                attrList: [...attrList],
                structAttrList: [...structAttrList],
                wlpat: initialArgs.wlpat,
                wlattr: initialArgs.wlattr,
                usesStructAttr: initialArgs.wlattr.indexOf('.') > -1,
                wlnums: initialArgs.wlnums,
                wltype: initialArgs.wltype,
                wlminfreq: {value: initialArgs.wlminfreq.toFixed(), isInvalid: false, isRequired: true},
                wlposattrs: [{inputId: Ident.puid(), value: ''}],
                maxNumWlPosattrLevels: 3,
                pfilterWords: initialArgs.pfilter_words.join('\n'),
                nfilterWords: initialArgs.nfilter_words.join('\n'),
                pfilterFileName: '',
                nfilterFileName: '',
                subcnorm: initialArgs.subcnorm,
                includeNonwords: !!initialArgs.include_nonwords,
                filterEditorData: {
                    target: 'empty'
                },
                isForeignSubcorp: corpusIdent.foreignSubcorp,
                currentSubcorpus: corpusIdent.usesubcorp,
                origSubcorpName: '',
                outputOptionsVisible: false,
                filtersVisible: false,
                precalcTasks: [],
                isBusy: false
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler<QueryActions.QueryInputSelectSubcorp>(
            QueryActionName.QueryInputSelectSubcorp,
            (state, action) => {
                if (action.payload.pubName) {
                    state.currentSubcorpus = action.payload.pubName;
                    state.origSubcorpName = action.payload.subcorp;
                    state.isForeignSubcorp = action.payload.foreign;

                } else {
                    state.currentSubcorpus = action.payload.subcorp;
                    state.origSubcorpName = action.payload.subcorp;
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
            ActionName.WordlistResultViewConc,
            MainMenuActionName.DirectSave
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
                const srchIdx = List.findIndex(v => v.inputId === action.payload.ident, state.wlposattrs);
                if (srchIdx > -1) {
                    const oldItem = state.wlposattrs[srchIdx];
                    state.wlposattrs[srchIdx] = {...oldItem, value: action.payload.value};
                }
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
                this.validateForm(state);
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
                state.wlposattrs.push({inputId: Ident.puid(), value: ''});
            }
        );

        this.addActionHandler<Actions.WordlistFormRemovePosattrLevel>(
            ActionName.WordlistFormRemovePosattrLevel,
            (state, action) => {
                const srchIdx = List.findIndex(v => v.inputId === action.payload.ident, state.wlposattrs);
                if (srchIdx > -1) {
                    List.removeAt(srchIdx, state.wlposattrs);
                }
            }
        )

        this.addActionHandler<Actions.WordlistFormCreatePfilter>(
            ActionName.WordlistFormCreatePfilter,
            (state, action) => {
                state.filterEditorData = {
                    target: 'pfilter',
                    fileName: `unsaved-file-${Ident.puid().substr(0, 5)}`,
                    data: ''
                };
            }
        );

        this.addActionHandler<Actions.WordlistFormCreateNfilter>(
            ActionName.WordlistFormCreateNfilter,
            (state, action) => {
                state.filterEditorData = {
                    target: 'nfilter',
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
                const props = action.payload.data;
                if (props.target === 'nfilter') {
                    state.filterEditorData = {
                        target: 'nfilter',
                        fileName: props.fileName,
                        data: props.data
                    };

                } else if (props.target === 'pfilter') {
                    state.filterEditorData = {
                        target: 'pfilter',
                        fileName: props.fileName,
                        data: props.data
                    };
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormUpdateEditor>(
            ActionName.WordlistFormUpdateEditor,
            (state, action) => {
                if (state.filterEditorData.target !== 'empty') {
                    if (state.filterEditorData.target === 'nfilter') {
                        state.filterEditorData = {
                            target: 'nfilter',
                            data: action.payload.value,
                            fileName: state.filterEditorData.fileName
                        };

                    } else {
                        state.filterEditorData = {
                            target: 'pfilter',
                            data: action.payload.value,
                            fileName: state.filterEditorData.fileName
                        };
                    }
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormReopenEditor>(
            ActionName.WordlistFormReopenEditor,
            (state, action) => {
                if (action.payload.target === 'pfilter') {
                    state.filterEditorData = {
                        target: 'pfilter',
                        data: state.pfilterWords,
                        fileName: state.pfilterFileName
                    };

                } else if (action.payload.target === 'nfilter') {
                    state.filterEditorData = {
                        target: 'nfilter',
                        data: state.nfilterWords,
                        fileName: state.nfilterFileName
                    };
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormClearFilterFile>(
            ActionName.WordlistFormClearFilterFile,
            (state, action) => {
                if (window.confirm(this.layoutModel.translate('wordlist__confirm_file_remove'))) {
                    if (action.payload.target === 'pfilter') {
                        state.pfilterWords = '';
                        state.pfilterFileName = ''

                    } else if (action.payload.target === 'nfilter') {
                        state.nfilterWords = '';
                        state.nfilterFileName = ''
                    }
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormCloseEditor>(
            ActionName.WordlistFormCloseEditor,
            (state, action) => {
                if (state.filterEditorData.target === 'pfilter') {
                    state.pfilterWords = state.filterEditorData.data;
                    state.pfilterFileName = state.filterEditorData.fileName;
                    state.filterEditorData = {target: 'empty'};

                } else if (state.filterEditorData.target === 'nfilter') {
                    state.nfilterWords = state.filterEditorData.data;
                    state.nfilterFileName = state.filterEditorData.fileName;
                    state.filterEditorData = {target: 'empty'};
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormSubmit>(
            ActionName.WordlistFormSubmit,
            (state, action) => {
                this.validateForm(state);
                state.isBusy = true; // TODO in side-effect, dispatch some new action setting busy to false
            },
            (state, action, dispatch) => {
                const errs = this.getFormsErrors(state);
                List.forEach(
                    err => {
                        this.layoutModel.showMessage('error', err);
                    },
                    errs
                );
                if (List.empty(errs)) {
                    this.submitAction(state, dispatch);

                } else {
                    dispatch<Actions.WordlistFormSubmitCancelled>({
                        name: ActionName.WordlistFormSubmitCancelled
                    });
                }
            }
        );

        this.addActionHandler<Actions.WordlistFormSubmitCancelled>(
            ActionName.WordlistFormSubmitCancelled,
            (state, action) => {
                state.isBusy = false;
            }
        );

        this.addActionHandler<Actions.ToggleOutputOptions>(
            ActionName.ToggleOutputOptions,
            (state, action) => {
                state.outputOptionsVisible = !state.outputOptionsVisible;
            }
        );

        this.addActionHandler<Actions.ToggleFilterOptions>(
            ActionName.ToggleFilterOptions,
            (state, action) => {
                state.filtersVisible = !state.filtersVisible;
            }
        );

        this.addActionHandler<GlobalActions.CorpusSwitchModelRestore>(
            GlobalActionName.CorpusSwitchModelRestore,
            (state, action)  => {
                if (!action.error) {
                    this.deserialize(
                        state,
                        action.payload.data[this.getRegistrationId()] as
                            WordlistFormCorpSwitchPreserve,
                        action.payload.corpora,
                    );
                }
            }
        );

        this.addActionHandler<GlobalActions.SwitchCorpus>(
            GlobalActionName.SwitchCorpus,
            (state, action) => {
                dispatcher.dispatch<GlobalActions.SwitchCorpusReady<
                    WordlistFormCorpSwitchPreserve>>({
                    name: GlobalActionName.SwitchCorpusReady,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: this.serialize(state)
                    }
                });
            }
        );

        this.addActionHandler<Actions.RegisterPrecalcTasks>(
            ActionName.RegisterPrecalcTasks,
            (state, action) => {
                state.precalcTasks = action.payload.tasks;
            }
        );

        this.addActionHandler<ACActions.AsyncTasksChecked>(
            ACActionName.AsyncTasksChecked,
            (state, action) => {
                if (!List.empty(state.precalcTasks)) {
                    const updated:Array<Kontext.AsyncTaskInfo<{}>> = [];
                    List.forEach(
                        (ourTask, i) => {
                            const srch = List.find(t => t.ident === ourTask.ident, action.payload.tasks);
                            updated.push(srch ? srch : ourTask);
                        },
                        state.precalcTasks
                    );
                    state.precalcTasks = updated;
                    if (!List.some(t => t.status === 'PENDING' || t.status === 'STARTED', state.precalcTasks)) {
                        state.isBusy = false;
                    }
                }
            },
            (state, action, dispatch) => {
                if (List.empty(state.precalcTasks)) {
                    return;

                } else if (List.every(t => t.status === 'SUCCESS' || t.status === 'FAILURE', state.precalcTasks)) {

                    if (List.every(t => t.status === 'SUCCESS', state.precalcTasks)) {
                        this.submitAction(state, dispatch);

                    } else {
                        this.layoutModel.showMessage(
                            'error', this.layoutModel.translate('wordlist__failed_to_precalculate')
                        );
                    }
                }
            }
        );
    }

    private submitAction(state:WordlistFormState, dispatch:SEDispatcher):void {
        this.submit(state).subscribe(
            resp => {
                if (resp.freq_files_avail) {
                    window.location.href = this.layoutModel.createActionUrl(
                        'wordlist/result',
                        MultiDict.fromDict({
                            q: `~${resp.wl_query_id}`
                        })
                    );

                } else {
                    this.layoutModel.showMessage(
                        'info',
                        this.layoutModel.translate('wordlist__aux_data_must_be_precalculated')
                    );
                    if (!List.empty(resp.subtasks)) {
                        List.forEach(
                            payload => {
                                dispatch<ACActions.InboxAddAsyncTask>({
                                    name: ACActionName.InboxAddAsyncTask,
                                    payload
                                })
                            },
                            resp.subtasks
                        );
                        dispatch<Actions.RegisterPrecalcTasks>({
                            name: ActionName.RegisterPrecalcTasks,
                            payload: {
                                tasks: resp.subtasks
                            }
                        });
                    }
                }
            }
        );
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

    private getFormsErrors(state:WordlistFormState):Array<string> {
        const ans:Array<string> = [];
        if (state.wlminfreq.isInvalid) {
            ans.push(state.wlminfreq.errorDesc);
        }
        if (!state.wlpat && !state.pfilterWords && !state.nfilterWords) {
            ans.push(this.layoutModel.translate('wordlist__pattern_empty_err'));
        }
        return ans;
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

    getRegistrationId():string {
        return 'WordlistFormModel';
    }

    private serialize(state:WordlistFormState):WordlistFormCorpSwitchPreserve {
        return {
            wlpat: state.wlpat,
            nfilterWords: state.nfilterWords,
            pfilterWords: state.pfilterWords,
            pfilterFileName: state.pfilterFileName,
            nfilterFileName: state.nfilterFileName,
            includeNonwords: state.includeNonwords
        };
    }

    private deserialize(
        state:WordlistFormState,
        data:WordlistFormCorpSwitchPreserve,
        corpora:Array<[string, string]>
    ):void {
        if (data) {
            state.wlpat = data.wlpat;
            state.nfilterWords = data.nfilterWords,
            state.pfilterWords = data.pfilterWords,
            state.pfilterFileName = data.pfilterFileName,
            state.nfilterFileName = data.nfilterFileName,
            state.includeNonwords = data.includeNonwords
        }
    }

    private splitWords(s:string):Array<string> {
        return pipe(
            s.split(/\s+/),
            List.filter(v => v !== '')
        );
    }

    createSubmitArgs(state:WordlistFormState):WordlistSubmitArgs {
        return {
            corpname: state.corpusId,
            usesubcorp: state.currentSubcorpus,
            wlattr: state.wlattr,
            wlpat: state.wlpat['normalize'](),
            wlminfreq: parseInt(state.wlminfreq.value),
            wlnums: state.wlnums,
            wltype: state.wltype,
            pfilter_words: this.splitWords(state.pfilterWords),
            nfilter_words: this.splitWords(state.nfilterWords),
            include_nonwords: state.includeNonwords,
            wlposattrs: List.map(v => v.value, state.wlposattrs)
        };
    }

    private submit(state:WordlistFormState):Observable<SubmitResponse> {
        const args = this.createSubmitArgs(state);
        const action = state.wltype === 'multilevel' ? 'wordlist/struct_result' : 'wordlist/submit';
        return this.layoutModel.ajax$<SubmitResponse>(
            HTTP.Method.POST,
            this.layoutModel.createActionUrl(action),
            args,
            {
                contentType: 'application/json'
            }
        );
    }

    getAllowsMultilevelWltype(state:WordlistFormState):boolean {
        return state.wlnums === WlnumsTypes.FRQ;
    }
}