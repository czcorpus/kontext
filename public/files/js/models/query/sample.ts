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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Dict, HTTP, List } from 'cnc-tskit';

import { PageModel } from '../../app/page';
import { SampleServerArgs } from './common';
import { Actions as MainMenuActions } from '../../models/mainMenu/actions';
import { Actions } from './actions';
import { Actions as ConcActions } from '../../models/concordance/actions';
import { AjaxConcResponse } from '../concordance/common';
import { ConcFormArgs, SampleFormArgs } from './formArgs';


export interface SampleFormProperties {
    rlines:Array<[string, string]>;
}


export function fetchSampleFormArgs<T>(args:{[ident:string]:ConcFormArgs},
        key:(item:SampleFormArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'sample') {
            ans.push([formId, key(args[formId] as SampleFormArgs)]);
        }
    }
    return ans;
}

export interface ConcSampleModelState {
    rlinesValues:{[key:string]:string};
}


export class ConcSampleModel extends StatefulModel<ConcSampleModelState> {

    private readonly pageModel:PageModel;

    private readonly syncInitialArgs:SampleFormArgs;

    constructor(
        dispatcher:IFullActionControl,
        pageModel:PageModel,
        props:SampleFormProperties,
        syncInitialArgs:SampleFormArgs
    ) {
        super(
            dispatcher,
            {
                rlinesValues: Dict.fromEntries(props.rlines)
            }
        );
        this.pageModel = pageModel;
        this.syncInitialArgs = syncInitialArgs;

        this.addActionHandler<typeof MainMenuActions.ShowSample>(
            MainMenuActions.ShowSample.name,
            action => {
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload})).subscribe({
                    error: err => {
                        this.pageModel.showMessage('error',
                                `Failed to synchronize ConcSampleModel: ${err}`);
                    }
                })
            }
        );

        this.addActionHandler<typeof Actions.SampleFormSetRlines>(
            Actions.SampleFormSetRlines.name,
            action => {
                const v = action.payload.value;
                if (/^([1-9]\d*)?$/.exec(v)) {
                    this.changeState(state => {
                        state.rlinesValues[action.payload.sampleId] = v;
                    });

                } else {
                    this.pageModel.showMessage('error', this.pageModel.translate('query__sample_value_must_be_gt_zero'));
                }
            }
        );

        this.addActionHandler<typeof Actions.SampleFormSubmit>(
            Actions.SampleFormSubmit.name,
            action => {
                this.submitQuery(
                    action.payload.sampleId,
                    List.head(this.pageModel.getConcArgs().q).substr(1)

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

    syncFrom(src:Observable<SampleFormArgs>):Observable<SampleFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'sample') {
                        this.changeState(state => {
                            state.rlinesValues[data.op_key] = data.rlines;
                        });
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === 'sample') {
                        return data;

                    } else if (data.form_type === 'locked') {
                        return null;

                    } else {
                        throw new Error('Cannot sync sample model - invalid form data type: ' + data.form_type);
                    }
                }
            )
        );
    }

    createSubmitArgs(sortId:string, concId:string):SampleServerArgs {
        return {
            ...this.pageModel.getConcArgs(),
            q: ['~' + concId],
            rlines: parseInt(this.state.rlinesValues[sortId])
        };
    }

    submitQuery(sortId:string, concId:string):Observable<AjaxConcResponse> {
        const args = this.createSubmitArgs(sortId, concId);
        return this.pageModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.pageModel.createActionUrl(
                'reduce',
                {format: 'json'}
            ),
            args
        );
    }

}