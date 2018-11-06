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

import {Kontext, TextTypes} from '../../types/common';
import {StatefulModel} from '../base';
import * as Immutable from 'immutable';
import {MultiDict} from '../../util';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {TextTypesModel} from '../../models/textTypes/main';
import {InputMode} from './common';
import RSVP from 'rsvp';


export class SubcorpFormModel extends StatefulModel {

    private pageModel:PageModel;

    private inputMode:InputMode;

    private corpname:string;

    private subcname:Kontext.FormValue<string>;

    private isPublic:boolean;

    private description:Kontext.FormValue<string>;

    private textTypesModel:TextTypesModel;

    private isBusy:boolean;

    private alignedCorporaProvider:()=>Immutable.List<TextTypes.AlignedLanguageItem>;

    constructor(dispatcher:ActionDispatcher, pageModel:PageModel, textTypesModel:TextTypesModel, corpname:string,
            inputMode:InputMode, alignedCorporaProvider:()=>Immutable.List<TextTypes.AlignedLanguageItem>) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.textTypesModel = textTypesModel;
        this.corpname = corpname;
        this.alignedCorporaProvider = alignedCorporaProvider;
        this.inputMode = inputMode;
        this.subcname = {value: '', isRequired: true, isInvalid: false};
        this.isPublic = false;
        this.description = {value: '', isRequired: false, isInvalid: false};
        this.isBusy = false;

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'SUBCORP_FORM_SET_INPUT_MODE':
                    this.inputMode = payload.props['value'];
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SET_SUBCNAME':
                    this.subcname = Kontext.updateFormValue(this.subcname, {value: payload.props['value']});
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SET_SUBC_AS_PUBLIC':
                    this.isPublic = payload.props['value'];
                    this.description = Kontext.updateFormValue(this.description, {isRequired: this.isPublic});
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SET_DESCRIPTION':
                    this.description = Kontext.updateFormValue(this.description, {value: payload.props['value']});
                    this.notifyChangeListeners();
                break;
                case 'SUBCORP_FORM_SUBMIT':
                    if (this.inputMode === InputMode.GUI) {
                        this.isBusy = true;
                        this.notifyChangeListeners();
                        this.submit().then(
                            () => {
                                this.isBusy = false;
                                this.notifyChangeListeners();
                                window.location.href = this.pageModel.createActionUrl('subcorpus/subcorp_list');
                            },
                            (err) => {
                                this.isBusy = false;
                                this.notifyChangeListeners();
                                this.pageModel.showMessage('error', err);
                            }
                        );

                    } else if (this.inputMode === InputMode.RAW) {
                        this.validateForm(false);
                        this.notifyChangeListeners();
                    }
                break;
            }
        });
    }

    private getSubmitArgs():MultiDict {
        const args = new MultiDict();
        args.set('corpname', this.corpname);
        args.set('subcname', this.subcname.value);
        args.set('publish', this.isPublic ? '1' : '0');
        args.set('description', this.description.value);
        args.set('method', this.inputMode);
        args.set('format', 'json');
        const alignedCorpora = this.alignedCorporaProvider().map(v => v.value).toArray();
        if (alignedCorpora.length > 0) {
            args.replace('aligned_corpora', this.alignedCorporaProvider().map(v => v.value).toArray());
            args.set('attrs', JSON.stringify(this.textTypesModel.exportSelections(false)));
        }
        const selections = this.textTypesModel.exportSelections(false);
        for (let p in selections) {
            args.replace(`sca_${p}`, selections[p]);
        }
        return args;
    }

    validateForm(mustHaveTTSelection:boolean):Error|null {
        if (this.subcname.value === '') {
            this.subcname.isInvalid = true;
            return new Error(this.pageModel.translate('subcform__missing_subcname'));

        } else {
            this.subcname.isInvalid = false;
        }

        if (this.description.isRequired && this.description.value === '') {
            this.description.isInvalid = true;
            return new Error(this.pageModel.translate('subcform__missing_description'));

        } else {
            this.subcname.isInvalid = false;
        }

        if (mustHaveTTSelection && !this.textTypesModel.hasSelectedItems()) {
            return new Error(this.pageModel.translate('subcform__at_least_one_type_must_be_selected'));
        }
        return null;
    }

    submit():RSVP.Promise<any> {
        const args = this.getSubmitArgs();
        const err = this.validateForm(true);
        if (err === null) {
            return this.pageModel.ajax<any>(
                'POST',
                this.pageModel.createActionUrl('/subcorpus/subcorp'),
                args
            );

        } else {
            return RSVP.Promise.reject(err);
        }
    }

    getCorpname():string {
        return this.corpname;
    }

    getSubcname():Kontext.FormValue<string> {
        return this.subcname;
    }

    getInputMode():string {
        return this.inputMode;
    }

    getIsPublic():boolean {
        return this.isPublic;
    }

    getDescription():Kontext.FormValue<string> {
        return this.description;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getAlignedCorpora():Immutable.List<TextTypes.AlignedLanguageItem> {
        return this.alignedCorporaProvider();
    }

    getTTSelections():{[attr:string]:Array<string>} {
        return this.textTypesModel.exportSelections(false);
    }
}
