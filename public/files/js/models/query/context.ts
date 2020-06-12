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

import { IFullActionControl, StatelessModel } from 'kombo';
import { Actions, ActionName } from './actions';


export interface QueryContextModelState {
    formData:QueryContextArgs;
}

export interface QueryContextArgs {
    fc_lemword_window_type:string;
    fc_lemword_wsize:string;
    fc_lemword:string;
    fc_lemword_type:string;
    fc_pos_window_type:string;
    fc_pos_wsize:string;
    fc_pos:string[];
    fc_pos_type:string;
}


export class QueryContextModel extends StatelessModel<QueryContextModelState> {

    constructor(dispatcher:IFullActionControl) {
        super(dispatcher, {
            formData: {
                fc_lemword_window_type: 'both',
                fc_lemword_wsize: '1',
                fc_lemword: '',
                fc_lemword_type: 'all',
                fc_pos_window_type: 'left',
                fc_pos_wsize: '1',
                fc_pos: [],
                fc_pos_type: 'all'
            }
        });
        this.addActionHandler<Actions.QueryInputSelectContextFormItem>(
            ActionName.QueryInputSelectContextFormItem,
            (state, action) => {
                state.formData[action.payload.name] = action.payload.value;
            }
        );
    }
}