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
import { UNSAFE_SynchronizedModel } from '../../base';
import { Kontext } from '../../../types/common';
import { PageModel } from '../../../app/page';
import { IFullActionControl, Action } from 'kombo';
import { Observable } from 'rxjs';


interface QueryOverviewResponse extends Kontext.AjaxConcResponse {
    Desc:Array<QueryOverviewResponseRow>;
}


interface QueryOverviewResponseRow {
    op:string;
    opid:string;
    churl:string;
    tourl:string;
    nicearg:string;
    size:number;
}

/**
 * This is a basic variant of query info/replay store which
 * can only fetch query overview info without any edit
 * functions. It is typically used on pages where an active
 * concordance exists but it is not visible at the moment
 * (e.g. freq. & coll. pages). In such case it is typically
 * extended further (see IndirectQueryReplayModel) to allow
 * returning to the 'view' page in case user wants to use
 * some of its functions.
 */
export class QueryInfoModel extends UNSAFE_SynchronizedModel {

    /**
     * This is a little bit independent from the rest. It just
     * contains data required to render tabular query overview.
     */
    private currentQueryOverview:Immutable.List<Kontext.QueryOperation>;

    protected pageModel:PageModel;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel) {
        super(dispatcher);
        this.pageModel = pageModel;

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'CLEAR_QUERY_OVERVIEW_DATA':
                    this.currentQueryOverview = null;
                    this.emitChange();
                break;
                case 'MAIN_MENU_OVERVIEW_SHOW_QUERY_INFO':
                    this.loadQueryOverview().subscribe(
                        (data) => {
                            this.currentQueryOverview = Immutable.List<Kontext.QueryOperation>(data.Desc);
                            this.emitChange();
                        },
                        (err) => {
                            this.pageModel.showMessage('error', err);
                        }
                    );
            break;
            }
        });
    }

    private loadQueryOverview():Observable<QueryOverviewResponse> {
        return this.pageModel.ajax$<QueryOverviewResponse>(
            'GET',
            this.pageModel.createActionUrl('concdesc_json'),
            this.pageModel.getConcArgs(),
            {}
        );
    }

    getCurrentQueryOverview():Immutable.List<Kontext.QueryOperation> {
        return this.currentQueryOverview;
    }
}


