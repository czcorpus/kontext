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

import * as Kontext from '../../types/kontext';
import * as TextTypes from '../../types/textTypes';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../../models/textTypes/main';
import { InputMode, BaseSubcorpFormState, CreateSubcorpusArgs, BaseTTSubcorpFormModel } from './common';
import { ITranslator, IFullActionControl } from 'kombo';
import { Dict, List } from 'cnc-tskit';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../common/actions';
import { Actions as TTActions } from '../textTypes/actions';
import { IUnregistrable } from '../common/common';
import { concatMap, map } from 'rxjs';

/**
 * Validates form fields and stored possible errors there. In case of errors
 * spreading across multiple fields an error is returned.
 *
 */
export function validateSubcProps(
        state:BaseSubcorpFormState,
        mustHaveTTSelection:boolean,
        hasSelectedTTItems:boolean,
        translator:ITranslator

):Error|null {
    let lastErr:Error|null = null;
    if (state.subcname.value === '') {
        state.subcname.isInvalid = true;
        state.subcname.errorDesc = translator.translate('subcform__missing_subcname');
        lastErr = new Error(state.subcname.errorDesc);

    } else {
        state.subcname.isInvalid = false;
    }

    if (state.description.isRequired && state.description.value === '') {
        state.description.isInvalid = true;
        state.description.errorDesc = translator.translate('subcform__missing_description');
        lastErr = new Error(state.description.errorDesc);

    } else {
        state.subcname.isInvalid = false;
    }

    if (mustHaveTTSelection && !hasSelectedTTItems) {
        state.otherValidationError = new Error(
            translator.translate('subcform__at_least_one_type_must_be_selected'));
        lastErr = state.otherValidationError;
    }
    return lastErr;
}


export interface SubcorpFormModelState {
    inputMode:InputMode;
    corpname:string;
    subcname:Kontext.FormValue<string>;
    isPublic:boolean;
    description:Kontext.FormValue<string>;
    isBusy:boolean;
    otherValidationError:Error|null;
    alignedCorpora:Array<TextTypes.AlignedLanguageItem>;
}


export class SubcorpFormModel extends BaseTTSubcorpFormModel<SubcorpFormModelState> implements IUnregistrable {

    constructor(
        dispatcher:IFullActionControl,
        pageModel:PageModel,
        textTypesModel:TextTypesModel,
        corpname:string,
        inputMode:InputMode
    ) {
        super(
            dispatcher,
            pageModel,
            textTypesModel,
            {
                corpname,
                inputMode,
                subcname: {value: '', isRequired: true, isInvalid: false},
                isPublic: false,
                description: {value: '', isRequired: false, isInvalid: false},
                isBusy: false,
                alignedCorpora: [],
                otherValidationError: null
            }
        );

        this.addActionHandler(
            Actions.FormSetInputMode,
            action => {
                this.changeState(state => {state.inputMode = action.payload.value});
                console.log('this input mode: ', this.state.inputMode)
            }
        );

        this.addActionHandler(
            Actions.FormSetSubcAsPublic,
            action => {
                this.changeState(state => {state.isPublic = action.payload.value});
            }
        );

        this.addActionHandler(
            Actions.FormSetDescription,
            action => this.changeState(state => {
                state.description = Kontext.updateFormValue(
                    this.state.description, {value: action.payload.value})
            })
        );

        this.DEBUG_logActions({});

        this.addActionHandler(
            Actions.FormWithinSubmit,
            action => {
                if (this.state.inputMode === 'gui') {
                    this.pageModel.showMessage('error', 'Invalid input mode');
                    return;
                }
                this.validateForm({}, false);
                if (this.state.otherValidationError) {
                    this.pageModel.showMessage('error', this.state.otherValidationError);

                } else {
                    this.dispatchSideEffect({
                        ...Actions.FormWithinSubmitArgsReady,
                        payload: {
                            corpname: this.state.corpname,
                            subcname: this.state.subcname.value,
                            publish:  this.state.isPublic,
                            description: this.state.description.value,
                        }
                    })
                }
            }
        );

        this.addActionHandler(
            Actions.FormSubmit,
            action => {
                if (this.state.inputMode === 'within') {
                    this.pageModel.showMessage('error', 'Invalid input mode');
                }
                this.changeState(state => { state.isBusy = true });

                this.suspendWithTimeout(
                    5000,
                    {},
                    (action, syncData) => {
                        if (TTActions.isTextTypesQuerySubmitReady(action)) {
                            return null;
                        }
                        return syncData;
                    }
                ).pipe(
                    map(
                        action => {
                            if (TTActions.isTextTypesQuerySubmitReady(action)) {
                                return action.payload.selections;
                            }
                            return undefined;
                        }
                    ),
                    concatMap(
                        (ttData) => this.submit(
                            this.getSubmitArgs(ttData),
                            (args) => this.validateForm(ttData, true))
                    )

                ).subscribe({
                    next: () => {
                        this.changeState(state => {
                            state.isBusy = false
                        });
                        window.location.href = this.pageModel.createActionUrl(
                            'subcorpus/list');
                    },
                    error: (err) => {
                        this.changeState(state => { state.isBusy = false });
                        this.pageModel.showMessage('error', err);
                    }
                });
            }
        );

        this.addActionHandler(
            Actions.FormSetSubcName,
            (action) => {
                this.changeState(state => {state.subcname.value = action.payload.value});
            }
        );

        this.addActionHandler(
            Actions.FormSetAlignedCorpora,
            action => this.changeState(state => {
                state.alignedCorpora = action.payload.alignedCorpora
            })
        );

        this.addActionHandler(
            GlobalActions.SwitchCorpus.name,
            action => {
                this.dispatchSideEffect<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                });
            }
        );
    }

    getRegistrationId():string {
        return 'subcorp-form-model';
    }

    private getSubmitArgs(ttSelection:TextTypes.ExportedSelection):CreateSubcorpusArgs {
        return {
            corpname: this.state.corpname,
            subcname: this.state.subcname.value,
            publish: this.state.isPublic,
            description: this.state.description.value,
            aligned_corpora: List.map(v => v.value, this.state.alignedCorpora),
            text_types: ttSelection,
            form_type: 'tt-sel'
        };
    }

    validateForm(ttData:TextTypes.ExportedSelection, mustHaveTTSelection:boolean):Error|null {
        let err:Error|null;
        this.changeState(state => {
            state.otherValidationError = null;
            err = validateSubcProps(
                state,
                mustHaveTTSelection,
                !Dict.empty(ttData),
                this.pageModel
            );
        });
        return err;
    }

}
