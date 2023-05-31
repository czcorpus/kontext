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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map, concatMap } from 'rxjs/operators';

import { PageModel } from '../../app/page';
import { Actions as MainMenuActions } from '../mainMenu/actions';
import { Actions } from './actions';
import { Actions as ConcActions } from '../../models/concordance/actions';
import { AjaxConcResponse } from '../concordance/common';
import { HTTP, List } from 'cnc-tskit';
import { ShuffleFormArgs } from './formArgs';
import { ConcFormTypes } from '../../types/kontext';


interface ShuffleModelState {
}


export class ShuffleModel extends StatefulModel<ShuffleModelState> {

    private readonly layoutModel:PageModel;

    private readonly syncInitialArgs:ShuffleFormArgs;


    constructor(
        dispatcher:IFullActionControl,
        layoutModel:PageModel,
        syncInitialArgs:ShuffleFormArgs
    ) {
        super(
            dispatcher,
            {
                docStructValues: {}
            }
        );
        this.layoutModel = layoutModel;
        this.syncInitialArgs = syncInitialArgs;

        this.addActionHandler(
            MainMenuActions.ApplyShuffle,
            action => {
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload})).subscribe({
                    error: err => {
                        this.layoutModel.showMessage('error',
                            `Failed to synchronize ShuffleModel: ${err}`);
                    }
                })
                this.emitChange();
            }
        );

        this.addActionHandler(
            Actions.ShuffleFormSubmit,
            action => {
                this.waitForActionWithTimeout(
                    5000,
                    {},
                    (action, syncData) => {
                        if (ConcActions.isReadyToAddNewOperation(action)) {
                            return null;
                        }
                        return syncData;
                    }
                ).pipe(
                    concatMap(
                        wAction => {
                            if (ConcActions.isReadyToAddNewOperation(wAction)) {
                                return this.submitForm(
                                    action.payload.opKey, wAction.payload.lastConcId
                                );

                            } else {
                                throw new Error('failed to handle shuffle submit - unexpected action ' + wAction.name);
                            }
                        }
                    )

                ).subscribe({
                    next: data => {
                        dispatcher.dispatch<typeof ConcActions.AddedNewOperation>({
                            name: ConcActions.AddedNewOperation.name,
                            payload: {
                                concId: data.conc_persistence_op_id,
                                data
                            }
                        });
                    },
                    error: error => {
                        dispatcher.dispatch<typeof ConcActions.AddedNewOperation>({
                            name: ConcActions.AddedNewOperation.name,
                            error
                        });
                    }
                });
            }
        );
    }

    getSubmitUrl(opKey:string, concId:string):string {
        return this.layoutModel.createActionUrl(
            'shuffle',
            {
                ...this.layoutModel.getConcArgs(),
                q: ['~' + concId],
                format: 'json'
            }
        );
    }

    submitForm(opKey:string, concId:string):Observable<AjaxConcResponse> {
        return this.layoutModel.ajax$<AjaxConcResponse>(
            HTTP.Method.GET,
            this.getSubmitUrl(opKey, concId),
            {}
        );
    }

    syncFrom(fn:Observable<ShuffleFormArgs>):Observable<ShuffleFormArgs> {
        return fn.pipe(
            tap(
                (data) => {
                    if (data.form_type === ConcFormTypes.SHUFFLE) {
                        this.emitChange();  // no real change needed here
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === ConcFormTypes.SHUFFLE) {
                        return data;

                    } else if (data.form_type === ConcFormTypes.LOCKED) {
                        return null;

                    } else {
                        throw new Error('Cannot sync ShuffleModel - invalid form data type: ' + data.form_type);
                    }
                }
            )
        );
    }
}
