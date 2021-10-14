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
import { CreateSubcorpusArgs, BaseTTSubcorpFormModel } from './common';
import { IFullActionControl } from 'kombo';
import { Actions } from './actions';
import { Dict } from 'cnc-tskit';


export interface QuickSubcorpModelState {
    subcname: string;
}


export class QuickSubcorpModel extends BaseTTSubcorpFormModel<QuickSubcorpModelState> {

    constructor(
        dispatcher:IFullActionControl,
        pageModel: PageModel,
        textTypesModel:TextTypesModel,
    ) {
        super(
            dispatcher,
            pageModel,
            textTypesModel,
            {
                subcname: '',
            },
        );

        this.addActionHandler<typeof Actions.QuickSubcorpSubmit>(
            Actions.QuickSubcorpSubmit.name,
            action => {
                const args = {
                    corpname: pageModel.getNestedConf('corpusIdent', 'id'),
                    subcname: this.state.subcname,
                    publish: false,
                    description: '',
                    aligned_corpora: pageModel.getConf('alignedCorpora'),
                    text_types: this.textTypesModel.UNSAFE_exportSelections(false),
                    form_type: 'tt-sel'
                } as CreateSubcorpusArgs;

                this.submit(args, this.validate).subscribe({
                    next: data => {
                        this.pageModel.showMessage('info', this.pageModel.translate('subc__quick_subcorpus_created'));
                    },
                    error: error => this.pageModel.showMessage('error', error)
                });
            }
        );

        this.addActionHandler<typeof Actions.QuickSubcorpChangeName>(
            Actions.QuickSubcorpChangeName.name,
            action => {
                this.changeState(state => {
                    state.subcname = action.payload.value;
                });
            }
        );

    }

    validate(args: CreateSubcorpusArgs): Error | null {
        return null;
    }

}