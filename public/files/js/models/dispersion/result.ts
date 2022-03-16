/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import { HTTP } from 'cnc-tskit';
import { IActionQueue, StatelessModel } from 'kombo';
import { Observable } from 'rxjs';
import { PageModel } from '../../app/page';
import { ChartExportFormat } from '../../types/kontext';
import { Actions } from './actions';


export interface DispersionDataRow {
    start: number;
    position: number;
    end: number;
    freq: number;
}

export interface DispersionResultModelState {
    isBusy:boolean;
    concordanceId:string;
    resolution:number;
    data:Array<DispersionDataRow>;
    downloadFormat:ChartExportFormat;
}


export class DispersionResultModel extends StatelessModel<DispersionResultModelState> {

    private readonly layoutModel:PageModel;

    constructor(
        dispatcher:IActionQueue,
        layoutModel:PageModel,
        initialState:DispersionResultModelState
    ) {

        super(dispatcher, initialState);
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.ChangeResolution,
            (state, action) => {
                if (action.payload.value > 1000) {
                    state.resolution = 1000;
                } else if (action.payload.value < 1) {
                    state.resolution = 1;
                } else {
                    state.resolution = action.payload.value;
                }
            }
        )

        this.addActionHandler(
            Actions.ReloadDone,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);
                } else {
                    state.data = action.payload.data;
                }
            }
        )

        this.addActionHandler(
            Actions.SetDownloadFormat,
            (state, action) => {
                state.downloadFormat = action.payload.format;
            }
        );

        this.addActionHandler(
            Actions.SubmitForm,
            (state, action) => {
                if (!action.payload.reloadPage) {
                    state.isBusy = true;
                }
            },
            (state, action, dispatch) => {
                if (action.payload.reloadPage) {
                    window.location.href = this.layoutModel.createActionUrl(
                        'dispersion/index',
                        {
                            q: `~${state.concordanceId}`,
                            resolution: state.resolution,
                        }
                    );

                } else {
                    this.reloadData(state).subscribe({
                        next: data => {
                            dispatch<typeof Actions.ReloadDone>({
                                name: Actions.ReloadDone.name,
                                payload: {data}
                            });
                        },
                        error: error => {
                            dispatch<typeof Actions.ReloadDone>({
                                name: Actions.ReloadDone.name,
                                error
                            });
                        }
                    })
                }
            }
        )
    }

    private reloadData(state):Observable<Array<DispersionDataRow>> {
        return this.layoutModel.ajax$<Array<DispersionDataRow>>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl('dispersion/ajax_get_freq_dispersion'),
            {
                q: `~${state.concordanceId}`,
                resolution: state.resolution,
            }
        )
    }
}