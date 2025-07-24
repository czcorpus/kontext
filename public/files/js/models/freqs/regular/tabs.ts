/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { Maths } from 'cnc-tskit';
import { IFullActionControl, StatelessModel } from 'kombo';
import { debounceTime, Subject } from 'rxjs';
import { FormValue, newFormValue, updateFormValue } from '../../../types/kontext.js';
import { FreqResultViews } from '../common.js';
import { Actions } from './actions.js';
import { PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS, validateNumber } from './common.js';
import { FreqFormInputs } from './freqForms.js';


export interface TabWrapperModelState {
    activeTab:FreqResultViews;
    alphaLevel:Maths.AlphaLevel;
    flimit:FormValue<string>;
    isBusy:boolean;
}


export class TabWrapperModel extends StatelessModel<TabWrapperModelState> {

    private readonly debouncedAction$:Subject<typeof Actions.ResultSetMinFreqVal>;

    constructor(
        dispatcher:IFullActionControl,
        formProps:FreqFormInputs,
        alphaLevel:Maths.AlphaLevel,
        activeTab:FreqResultViews
    ) {
        super(
            dispatcher,
            {
                activeTab,
                alphaLevel,
                flimit: newFormValue(formProps.flimit || '0', true),
                isBusy: false
            }
        );

        this.debouncedAction$ = new Subject<typeof Actions.ResultSetMinFreqVal>();
        this.debouncedAction$.pipe(
            debounceTime(PAGE_SIZE_INPUT_WRITE_THROTTLE_INTERVAL_MS)

        ).subscribe({
            next: value => {
                dispatcher.dispatch({
                    ...value,
                    payload: {...value.payload, isDebounced: true}
                });
            }
        });

        this.addActionHandler(
            Actions.ResultSetActiveTab,
            (state, action) => {
                state.activeTab = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.PopHistory,
            (state, action) => {
                state.activeTab = action.payload.activeView;
                state.flimit = updateFormValue(
                    state.flimit,
                    {
                        value: '' + action.payload.state.flimit
                    }
                )
            }
        );

        this.addActionHandler(
            Actions.ResultSetAlphaLevel,
            (state, action) => {
                state.alphaLevel = action.payload.value;
            }
        );

        this.addActionHandler(
            Actions.ResultSetMinFreqVal,
            (state, action) => {
                if (action.payload.isDebounced) {
                    if (validateNumber(action.payload.value, 0)) {
                        state.isBusy = true;
                        state.flimit = updateFormValue(state.flimit, {isInvalid: false});

                    } else {
                        state.flimit = updateFormValue(state.flimit, {isInvalid: true});
                    }

                } else {
                    state.flimit = updateFormValue(state.flimit, {value: action.payload.value});
                    this.debouncedAction$.next(action);
                }
            },
            (state, action, dispatch) => {
                if (action.payload.isDebounced) {
                    if (state.flimit.isInvalid) {
                        dispatch<typeof Actions.ResultSetMinFreqValConfirm>({
                            name: Actions.ResultSetMinFreqValConfirm.name,
                            error: new Error(state.flimit.errorDesc)
                        });

                    } else {
                        dispatch<typeof Actions.ResultSetMinFreqValConfirm>({
                            name: Actions.ResultSetMinFreqValConfirm.name,
                            payload: {
                                value: parseInt(state.flimit.value)
                            }
                        });
                    }
                }
            }
        );
    }
}

