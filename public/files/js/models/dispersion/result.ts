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
import { FormValue } from '../../types/kontext';
import { PageModel } from '../../app/page';
import { ChartExportFormat } from '../../types/kontext';
import { Actions } from './actions';
import { validateGzNumber } from '../base';
import { stackOffsetExpand } from 'd3';


export interface DispersionDataRow {
    start: number;
    position: number;
    end: number;
    freq: number;
}

export interface DispersionResultModelState {
    isBusy:boolean;
    concordanceId:string;
    resolution:FormValue<string>;
    maxResolution:number;
    data:Array<DispersionDataRow>;
    downloadFormat:ChartExportFormat;
}

function validateResolution(state:DispersionResultModelState):boolean {
    if (!validateGzNumber(state.resolution.value)) {
        return false;
    }
    const intval = parseInt(state.resolution.value);
    if (intval < 1 || intval > state.maxResolution) {
        return false;
    }
    return true;
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
                state.resolution.value = action.payload.value;
                if (state.resolution.value !== '' && !validateResolution(state)) {
                    state.resolution.isInvalid = true;
                    state.resolution.errorDesc = this.layoutModel.translate(
                        'dispersion__max_resolution_is_{value}', {value: state.maxResolution});

                } else {
                    state.resolution.isInvalid = false;
                    state.resolution.errorDesc = undefined;
                }
            }
        );

        this.addActionHandler(
            Actions.ChangeResolutionAndReload,
            (state, action) => {
                state.resolution.value = action.payload.value;
                if (state.resolution.value !== '' && !validateResolution(state)) {
                    state.resolution.isInvalid = true;
                    state.resolution.errorDesc = this.layoutModel.translate(
                        'dispersion__max_resolution_is_{value}', {value: state.maxResolution});

                } else {
                    state.resolution.isInvalid = false;
                    state.resolution.errorDesc = undefined;
                }
            },
            (state, action, dispatch) => {
                if (state.resolution.value !== '' && validateResolution(state)) {
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
                    });
                }
            }
        );

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
                            resolution: state.resolution.value,
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
                    });
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
                resolution: state.resolution.value,
            }
        )
    }
}