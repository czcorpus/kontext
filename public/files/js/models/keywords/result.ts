/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import { IActionDispatcher, StatelessModel } from 'kombo';
import { PageModel } from '../../app/page';
import { Keyword } from './common';
import { Actions } from './actions';
import { validateGzNumber } from '../base';



export interface KeywordsResultState {
    data:Array<Keyword>;
    isBusy:boolean;
    refCorpname:string;
    refSubcorpname:string|undefined;
    focusCorpname:string;
    focusSubcorpname:string|undefined;
    total:number;
    kwpage:number;
    kwpagesize:number;
    reverse:boolean;
    totalPages:number;
}


export interface KeywordsResultModelArgs {
    dispatcher:IActionDispatcher;
    layoutModel:PageModel;
    refCorpname:string;
    refSubcorpname:string|undefined;
    focusCorpname:string;
    focusSubcorpname:string|undefined;
}

/**
 *
 */
export class KeywordsResultModel extends StatelessModel<KeywordsResultState> {

    private readonly layoutModel:PageModel;

    constructor({
        dispatcher,
        layoutModel,
        refCorpname,
        refSubcorpname,
        focusCorpname,
        focusSubcorpname
    }:KeywordsResultModelArgs) {
        super(
            dispatcher,
            {
                data: layoutModel.getConf<Array<Keyword>>('Keywords'),
                isBusy: false,
                refCorpname,
                refSubcorpname,
                focusCorpname,
                focusSubcorpname,
                kwpage: layoutModel.getConf<number>('Page'),
                kwpagesize: layoutModel.getConf<number>('PageSize'),
                reverse: layoutModel.getConf<boolean>('Reverse'),
                total: layoutModel.getConf<number>('Total'),
                totalPages: Math.ceil(layoutModel.getConf<number>('Total')/layoutModel.getConf<number>('PageSize')),
            }
        );
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.ResultSetPage,
            (state, action) => {
                if (validateGzNumber(action.payload.page)) {
                    if (parseInt(action.payload.page) > state.totalPages) {
                        state.kwpage = state.totalPages;
                        this.layoutModel.showMessage('info', this.layoutModel.translate('global__no_more_pages'));
                    } else {
                        state.kwpage = parseInt(action.payload.page);
                    }
                } else {
                    this.layoutModel.showMessage('error', this.layoutModel.translate('freq__page_invalid_val'));
                }
            }
        );

    }

}