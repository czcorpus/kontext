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

import { IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { PageModel } from '../../../app/page';
import { FreqResultResponse } from '../common';
import { Actions } from './actions';
import { BaseFreqModelState, FreqDataLoader, FreqServerArgs, ResultBlock, validateNumber } from './common';
import { importData } from './dataRows';
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
    fmaxitems:number;
    freqLoader:FreqDataLoader;
}

export interface FreqChartsModelState extends BaseFreqModelState {
    type:FreqChartsAvailableTypes;
    units:FreqChartsAvailableUnits;
    fmaxitems:number;
    isBusy:boolean;
}

export class FreqChartsModel extends StatelessModel<FreqChartsModelState> {

    private pageModel:PageModel;

    private freqLoader:FreqDataLoader;

    constructor({dispatcher, pageModel, freqCrit, formProps, initialData,
        currentPage, fmaxitems, freqLoader}:FreqChartsModelArgs) {

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
                fmaxitems,
                isBusy: false,
            }
        );

        this.pageModel = pageModel;

        this.freqLoader = freqLoader;

        this.addActionHandler<typeof Actions.FreqChartsDataLoaded>(
            Actions.FreqChartsDataLoaded.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.pageModel.showMessage('error', action.error);

                } else {
                    state.data = action.payload.data;
                }
            }
        );

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
                state.fmaxitems = action.payload.value;
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.dispatchLoad(
                    this.freqLoader.loadPage(this.getSubmitArgs(state)),
                    state,
                    dispatch,
                );
            }
        );

        this.addActionHandler<typeof Actions.ResultSetMinFreqVal>(
            Actions.ResultSetMinFreqVal.name,
            (state, action) => {
                if (validateNumber(action.payload.value, 0)) {
                    state.flimit = action.payload.value;
                    state.isBusy = true;
                }
            },
            (state, action, dispatch) => {
                if (validateNumber(action.payload.value, 0)) {
                    this.dispatchLoad(
                        this.freqLoader.loadPage(this.getSubmitArgs(state)),
                        state,
                        dispatch,
                    );
                }
            }
        );
    }

    private dispatchLoad(
        load:Observable<FreqResultResponse>,
        state:FreqChartsModelState,
        dispatch:SEDispatcher
    ):void {

        load.subscribe(
            (data) => {
                dispatch<typeof Actions.FreqChartsDataLoaded>({
                    name: Actions.FreqChartsDataLoaded.name,
                    payload: {
                        data: importData(
                            this.pageModel,
                            data.Blocks,
                            data.fmaxitems,
                            parseInt(state.currentPage)
                        )
                    },
                });
            },
            (err) => {
                dispatch<typeof Actions.FreqChartsDataLoaded>({
                    name: Actions.FreqChartsDataLoaded.name,
                    payload: {data: null},
                    error: err
                });
            }
        );
    }

    getSubmitArgs(state:FreqChartsModelState):FreqServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            fcrit: state.freqCrit,
            flimit: parseInt(state.flimit),
            freq_sort: state.sortColumn,
            // fpage: for client, null means 'multi-block' output, for server '1' must be filled in
            fpage: state.currentPage !== null ? state.currentPage : '1',
            ftt_include_empty: state.ftt_include_empty,
            freqlevel: 1,
            fmaxitems: state.fmaxitems,
            format: 'json'
        };
    }
}
