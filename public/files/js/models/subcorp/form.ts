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
import { InputMode, BaseSubcorFormState, CreateSubcorpusArgs } from './common';
import { ITranslator, IFullActionControl, StatefulModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { List, HTTP, tuple } from 'cnc-tskit';
import { Actions } from './actions';
import { Actions as GlobalActions } from '../common/actions';
import { IUnregistrable } from '../common/common';

/**
 * Validates form fields and stored possible errors there. In case of errors
 * spreading across multiple fields an error is returned.
 *
 */
export function validateSubcProps(
        state:BaseSubcorFormState,
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


export class SubcorpFormModel extends StatefulModel<SubcorpFormModelState> implements IUnregistrable {

    private pageModel:PageModel;

    private textTypesModel:TextTypesModel;

    constructor(
        dispatcher:IFullActionControl,
        pageModel:PageModel,
        textTypesModel:TextTypesModel,
        corpname:string,
        inputMode:InputMode
    ) {
        super(
            dispatcher,
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
        this.pageModel = pageModel;
        this.textTypesModel = textTypesModel;

        this.addActionHandler<typeof Actions.FormSetInputMode>(
            Actions.FormSetInputMode.name,
            action => this.changeState(state => {state.inputMode = action.payload.value})
        );

        this.addActionHandler<typeof Actions.FormSetSubcAsPublic>(
            Actions.FormSetSubcAsPublic.name,
            action => this.changeState(state => {state.isPublic = action.payload.value})
        );

        this.addActionHandler<typeof Actions.FormSetDescription>(
            Actions.FormSetDescription.name,
            action => this.changeState(state => {
                state.description = Kontext.updateFormValue(
                    this.state.description, {value: action.payload.value})
            })
        );

        this.addActionHandler<typeof Actions.FormSubmit>(
            Actions.FormSubmit.name,
            action => {
                if (this.state.inputMode === 'gui') {
                    this.changeState(state => {state.isBusy = true});
                    this.submit().subscribe(
                        () => {
                            this.changeState(state => {
                                state.isBusy = false
                            });
                            window.location.href = this.pageModel.createActionUrl(
                                'subcorpus/list');
                        },
                        (err) => {
                            this.changeState(state => {state.isBusy = false});
                            this.pageModel.showMessage('error', err);
                        }
                    );

                } else if (this.state.inputMode === 'within') {
                    this.validateForm(false);
                    if (this.state.otherValidationError) {
                        this.pageModel.showMessage('error', this.state.otherValidationError);
                    }
                }
            }
        );

        this.addActionHandler<typeof Actions.FormSetSubcName>(
            Actions.FormSetSubcName.name,
            (action) => {
                this.changeState(state => {state.subcname.value = action.payload.value});
            }
        );

        this.addActionHandler<typeof Actions.FormSetAlignedCorpora>(
            Actions.FormSetAlignedCorpora.name,
            action => this.changeState(state => {
                state.alignedCorpora = action.payload.alignedCorpora
            })
        );

        this.addActionHandler<typeof GlobalActions.SwitchCorpus>(
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

    private getSubmitArgs():CreateSubcorpusArgs {
        return {
            corpname: this.state.corpname,
            subcname: this.state.subcname.value,
            publish: this.state.isPublic,
            description: this.state.description.value,
            aligned_corpora: List.map(v => v.value, this.state.alignedCorpora),
            text_types: this.textTypesModel.UNSAFE_exportSelections(false),
            form_type: 'tt-sel'
        };
    }

    validateForm(mustHaveTTSelection:boolean):Error|null {
        let err:Error|null;
        this.changeState(state => {
            state.otherValidationError = null;
            err = validateSubcProps(
                state,
                mustHaveTTSelection,
                this.textTypesModel.hasSelectedItems(),
                this.pageModel
            );
        });
        return err;
    }

    submit():Observable<any> {
        const args = this.getSubmitArgs();
        const err = this.validateForm(true);
        if (!err) {
            return this.pageModel.ajax$<any>(
                HTTP.Method.POST,
                this.pageModel.createActionUrl(
                    '/subcorpus/create',
                    {format: 'json'}
                ),
                args,
                {
                    contentType: 'application/json'
                }
            );

        } else {
            return throwError(err);
        }
    }

    getCorpname():string {
        return this.state.corpname;
    }

    getSubcname():Kontext.FormValue<string> {
        return this.state.subcname;
    }

    getInputMode():string {
        return this.state.inputMode;
    }

    getIsPublic():boolean {
        return this.state.isPublic;
    }

    getDescription():Kontext.FormValue<string> {
        return this.state.description;
    }

    getIsBusy():boolean {
        return this.state.isBusy;
    }

    getAlignedCorpora():Array<TextTypes.AlignedLanguageItem> {
        return this.state.alignedCorpora;
    }

    getTTSelections():TextTypes.ExportedSelection {
        return this.textTypesModel.UNSAFE_exportSelections(false);
    }
}
