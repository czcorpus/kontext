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

import { Kontext, TextTypes } from '../../types/common';
import { MultiDict } from '../../multidict';
import { PageModel } from '../../app/page';
import { TextTypesModel } from '../../models/textTypes/main';
import { InputMode, BaseSubcorFormState } from './common';
import { ITranslator, IFullActionControl, StatefulModel } from 'kombo';
import { Observable, throwError } from 'rxjs';
import { List, HTTP } from 'cnc-tskit';
import { Actions, ActionName } from './actions';

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
):void {

    if (state.subcname.value === '') {
        state.subcname.isInvalid = true;
        state.subcname.errorDesc = translator.translate('subcform__missing_subcname');

    } else {
        state.subcname.isInvalid = false;
    }

    if (state.description.isRequired && state.description.value === '') {
        state.description.isInvalid = true;
        state.description.errorDesc = translator.translate('subcform__missing_description');

    } else {
        state.subcname.isInvalid = false;
    }

    if (mustHaveTTSelection && !hasSelectedTTItems) {
        state.otherValidationError = new Error(
            translator.translate('subcform__at_least_one_type_must_be_selected'));
    }
    return null;
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


export class SubcorpFormModel extends StatefulModel<SubcorpFormModelState> {

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

        this.addActionHandler<Actions.FormSetInputMode>(
            ActionName.FormSetInputMode,
            action => this.changeState(state => {state.inputMode = action.payload.value})
        );

        this.addActionHandler<Actions.FormSetSubcAsPublic>(
            ActionName.FormSetSubcAsPublic,
            action => this.changeState(state => {state.isPublic = action.payload.value})
        );

        this.addActionHandler<Actions.FormSetDescription>(
            ActionName.FormSetDescription,
            action => this.changeState(state => {
                state.description = Kontext.updateFormValue(
                    this.state.description, {value: action.payload.value})
            })
        );

        this.addActionHandler<Actions.FormSubmit>(
            ActionName.FormSubmit,
            action => {
                if (this.state.inputMode === InputMode.GUI) {
                    this.changeState(state => {state.isBusy = true});
                    this.submit().subscribe(
                        () => {
                            this.changeState(state => {
                                state.isBusy = false
                            });
                            window.location.href = this.pageModel.createActionUrl(
                                'subcorpus/subcorp_list');
                        },
                        (err) => {
                            this.changeState(state => {state.isBusy = false});
                            this.pageModel.showMessage('error', err);
                        }
                    );

                } else if (this.state.inputMode === InputMode.RAW) {
                    this.validateForm(false);
                    if (this.state.otherValidationError) {
                        this.pageModel.showMessage('error', this.state.otherValidationError);
                    }
                }
            }
        );

        this.addActionHandler<Actions.FormSetSubcName>(
            ActionName.FormSetSubcName,
            (action) => {
                this.changeState(state => {state.subcname.value = action.payload.value});
            }
        );

        this.addActionHandler<Actions.FormSetAlignedCorpora>(
            ActionName.FormSetAlignedCorpora,
            action => this.changeState(state => {
                state.alignedCorpora = action.payload.alignedCorpora
            })
        );
    }

    private getSubmitArgs():MultiDict<{
        corpname:string;
        subcname:string;
        publish:boolean;
        description:string;
        method:string;
        aligned_corpora:string;
        attrs:string;
    } & {[scaKey:string]:string}> {

        const args = new MultiDict();
        args.set('corpname', this.state.corpname);
        args.set('subcname', this.state.subcname.value);
        args.set('publish', this.state.isPublic ? '1' : '0');
        args.set('description', this.state.description.value);
        args.set('method', this.state.inputMode);
        const alignedCorpora = List.map(v => v.value, this.state.alignedCorpora);
        if (alignedCorpora.length > 0) {
            args.replace('aligned_corpora', List.map(v => v.value, this.state.alignedCorpora));
            args.set('attrs', JSON.stringify(this.textTypesModel.exportSelections(false)));
        }
        const selections = this.textTypesModel.exportSelections(false);
        for (let p in selections) {
            args.replace(`sca_${p}`, selections[p]);
        }
        return args;
    }

    validateForm(mustHaveTTSelection:boolean):void {
        this.changeState(state => {
            state.otherValidationError = null;
            validateSubcProps(
                state,
                mustHaveTTSelection,
                this.textTypesModel.hasSelectedItems(),
                this.pageModel
            );
        });
    }

    submit():Observable<any> {
        const args = this.getSubmitArgs();
        const err = this.validateForm(true);
        if (err === null) {
            return this.pageModel.ajax$<any>(
                HTTP.Method.POST,
                this.pageModel.createActionUrl(
                    '/subcorpus/subcorp',
                    MultiDict.fromDict({format: 'json'})
                ),
                args
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

    getTTSelections():{[attr:string]:Array<string>} {
        return this.textTypesModel.exportSelections(false);
    }
}
