/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { List } from 'cnc-tskit';
import { IFullActionControl } from 'kombo';

import { PageModel } from '../../app/page';
import { PluginInterfaces } from '../../types/plugins';
import { HtmlHelpModel } from './help';
import { Actions as QueryActions } from '../query/actions';



export interface QueryHelpModelState {
    isBusy:boolean;
    rawHtml:string;
    tagsets:{[corpname:string]:Array<PluginInterfaces.TagHelper.TagsetInfo>};
    activeCorpora:Array<string>;
}

/**
 * This is an extension of HtmlHelpModel with support for displaying
 * tagset info based on active corpora.
 */
export class QueryHelpModel extends HtmlHelpModel<QueryHelpModelState> {


    constructor(layoutModel:PageModel, dispatcher:IFullActionControl, initialState:QueryHelpModelState) {
        super(layoutModel, dispatcher, initialState);

        this.addActionHandler<typeof QueryActions.QueryInputAddAlignedCorpus>(
            QueryActions.QueryInputAddAlignedCorpus.name,
            action => {
                this.changeState(state => {
                    List.addUnique(action.payload.corpname, state.activeCorpora);
                });
            }
        );

        this.addActionHandler<typeof QueryActions.QueryInputRemoveAlignedCorpus>(
            QueryActions.QueryInputRemoveAlignedCorpus.name,
            action => {
                this.changeState(state => {
                    List.removeValue(
                        action.payload.corpname,
                        state.activeCorpora
                    );
                });
            }
        );
    }


}
