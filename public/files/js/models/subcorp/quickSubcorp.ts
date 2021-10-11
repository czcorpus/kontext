/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { PageModel } from '../../app/page';
import { TextTypesModel } from '../../models/textTypes/main';
import { CreateSubcorpusArgs, BaseSubcorpFormModel } from './common';
import { IFullActionControl } from 'kombo';


export interface QuickSubcorpModelState {
}


export class QuickSubcorpModel extends BaseSubcorpFormModel<QuickSubcorpModelState> {

    constructor(
        dispatcher:IFullActionControl,
        pageModel: PageModel,
        textTypesModel:TextTypesModel,
    ) {
        super(
            dispatcher,
            pageModel,
            textTypesModel,
            {},
        );

    }

    getRegistrationId():string {
        return 'quick-subcorp-model';
    }

    private getSubmitArgs():CreateSubcorpusArgs {
        return {
            corpname: '',
            subcname: '',
            publish: false,
            description: '',
            aligned_corpora: [],
            text_types: this.textTypesModel.UNSAFE_exportSelections(false),
            form_type: 'tt-sel'
        };
    }

    validate():Error|null {
        return null;
    }

}