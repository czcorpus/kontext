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

import * as Immutable from 'immutable';
import { QueryInfoModel } from './info';
import { IQueryReplayModel, ExtendedQueryOperation, importEncodedOperations } from './common';
import { Kontext } from '../../../types/common';
import { IFullActionControl, Action } from 'kombo';
import { PageModel } from '../../../app/page';

/**
 * IndirectQueryReplayModel is a replacement for QueryReplayModel
 * on pages where query editation forms (and most of related data)
 * are not available but we still want to display operations
 * description (aka breadcrumb navigation) and redirect to the
 * 'view' page and open a respective operation form in case
 * user clicks a item.
 */
export class IndirectQueryReplayModel extends QueryInfoModel implements IQueryReplayModel {

    private currEncodedOperations:Immutable.List<ExtendedQueryOperation>;

    private currQueryOverivew:Immutable.List<Kontext.QueryOperation>;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel,
            currentOperations:Array<Kontext.QueryOperation>) {
        super(dispatcher, pageModel);
        this.pageModel = pageModel;
        this.currEncodedOperations = importEncodedOperations(currentOperations);
        this.currQueryOverivew = Immutable.List<Kontext.QueryOperation>(currentOperations);

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'REDIRECT_TO_EDIT_QUERY_OPERATION':
                    window.location.replace(
                        this.pageModel.createActionUrl(
                            'view',
                            this.pageModel.getConcArgs().items()
                        ) + '#edit_op/operationIdx=' + action.payload['operationIdx']
                    );
                break;
            }
        });
    }

    getCurrEncodedOperations():Immutable.List<ExtendedQueryOperation> {
        return this.currEncodedOperations;
    }

    getCurrentQueryOverview():Immutable.List<Kontext.QueryOperation> {
        return null;
    }

}