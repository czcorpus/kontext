/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
import { ActionName, Actions } from './actions';
import { IFullActionControl, StatelessModel } from 'kombo';
import { IUnregistrable } from '../common/common';
import { SimpleQuery } from './query';


export interface QueryStructureState {
    query:SimpleQuery;
}


export class QueryStructureModel extends StatelessModel<QueryStructureState>
        implements IUnregistrable {

    constructor(dispatcher:IFullActionControl, pageModel:PageModel) {
        super(dispatcher, {
            query: null,
        });

        this.addActionHandler<Actions.ToggleQueryStructureWidget>(
            ActionName.ToggleQueryStructureWidget,
            (state, action) => {
                state.query = action.payload.query;
            }
        );
    }

    getRegistrationId():string {
        return 'query-structure-model';
    }

}