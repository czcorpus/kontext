/*
 * Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IFullActionControl, StatelessModel } from 'kombo';
import { PageModel } from '../../../app/page';
import { Actions } from './actions';
import { BaseFreqModelState, FreqDataLoader, ResultBlock, validateNumber } from './common';
import { FreqFormInputs } from './freqForms';

export type FreqChartsAvailableUnits = 'ipm'|'abs';
export type FreqChartsAvailableTypes = 'bar'|'line';

export interface FreqChartsModelArgs {
    dispatcher:IFullActionControl;
    pageModel:PageModel;
    freqCrit:Array<string>;
    formProps:FreqFormInputs;
    initialData:Array<ResultBlock>;
    currentPage:number;
    pageSize:number;
    freqLoader:FreqDataLoader;
}

export interface FreqChartsModelState extends BaseFreqModelState {
    type:FreqChartsAvailableTypes;
    units:FreqChartsAvailableUnits;
    pageSize:number;
}

export class FreqChartsModel extends StatelessModel<FreqChartsModelState> {

    private pageModel:PageModel;

    private freqLoader:FreqDataLoader;

    constructor({dispatcher, pageModel, freqCrit, formProps, initialData,
        currentPage, pageSize, freqLoader}:FreqChartsModelArgs) {

        super(
            dispatcher,
            {
                data: initialData,
                freqCrit,
                currentPage: initialData.length > 1 ? null : `${currentPage}`,
                sortColumn: formProps.freq_sort,
                ftt_include_empty: formProps.ftt_include_empty,
                flimit: formProps.flimit || '0',
                type: 'bar',
                units: 'abs',
                pageSize,
            }
        );

        this.pageModel = pageModel;

        this.freqLoader = freqLoader;

        this.addActionHandler<typeof Actions.FreqChartsChangeUnits>(
            Actions.FreqChartsChangeUnits.name,
            (state, action) => {
                state.units = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsChangeType>(
            Actions.FreqChartsChangeType.name,
            (state, action) => {
                state.type = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.FreqChartsChangePageSize>(
            Actions.FreqChartsChangePageSize.name,
            (state, action) => {
                state.pageSize = action.payload.value;
            }
        );

        this.addActionHandler<typeof Actions.ResultSetMinFreqVal>(
            Actions.ResultSetMinFreqVal.name,
            (state, action) => {
                if (validateNumber(action.payload.value, 0)) {
                    state.flimit = action.payload.value;
                }
            }
        );
    }
}
