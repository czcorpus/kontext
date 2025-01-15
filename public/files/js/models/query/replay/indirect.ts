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

import { QueryInfoModel } from './info.js';
import { PersistentQueryOperation, importEncodedOperation } from './common.js';
import * as Kontext from '../../../types/kontext.js';
import { IActionDispatcher } from 'kombo';
import { PageModel } from '../../../app/page.js';
import { Actions } from '../actions.js';
import { Actions as ConcActions } from '../../concordance/actions.js';
import { List } from 'cnc-tskit';


export interface IndirectQueryReplayModelState {
    operations:Array<PersistentQueryOperation>;
    overviewVisible:boolean;
}

/**
 * IndirectQueryReplayModel is a replacement for QueryReplayModel
 * on pages where query editation forms (and most of related data)
 * are not available but we still want to display operations
 * description (aka breadcrumb navigation) and redirect to the
 * 'view' page and open a respective operation form in case
 * user clicks a item.
 */
export class IndirectQueryReplayModel extends QueryInfoModel<IndirectQueryReplayModelState> {

    constructor(dispatcher:IActionDispatcher, pageModel:PageModel,
            currentOperations:Array<Kontext.QueryOperation>) {
        super(dispatcher, pageModel, {
            operations: List.map(importEncodedOperation, currentOperations),
            overviewVisible: false
        });


        this.addActionHandler<typeof Actions.RedirectToEditQueryOperation>(
            Actions.RedirectToEditQueryOperation.name,
            null,
            (state, action, dispatch) => {
                window.location.replace(
                    this.pageModel.createActionUrl(
                        'view',
                        this.pageModel.getConcArgs()
                    ) + '#edit_op/operationIdx=' + action.payload.operationIdx
                );
            }
        );

        this.addActionHandler<typeof ConcActions.AsyncCalculationUpdated>(
            ConcActions.AsyncCalculationUpdated.name,
            (state, action) => {
                List.last(state.operations).size = action.payload.concsize;
            }
        );
    }

}