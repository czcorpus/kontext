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
import { Dict, HTTP, tuple } from 'cnc-tskit';

import { PageModel } from '../../app/page';
import { AjaxResponse } from '../../types/ajaxResponses';
import { MultiDict } from '../../multidict';
import { SampleServerArgs } from './common';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../../models/mainMenu/actions';
import { Actions, ActionName } from './actions';
import { Actions as ConcActions, ActionName as ConcActionName } from '../../models/concordance/actions';
import { AjaxConcResponse } from '../concordance/common';


export interface SampleFormProperties {
    rlines:Array<[string, string]>;
}


export function fetchSampleFormArgs<T>(args:{[ident:string]:AjaxResponse.ConcFormArgs},
        key:(item:AjaxResponse.SampleFormArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'sample') {
            ans.push([formId, key(args[formId] as AjaxResponse.SampleFormArgs)]);
        }
    }
    return ans;
}

export interface ConcSampleModelState {
    rlinesValues:{[key:string]:string};
}


export class ConcSampleModel extends StatefulModel<ConcSampleModelState> {

    private readonly pageModel:PageModel;

    private readonly syncInitialArgs:AjaxResponse.SampleFormArgs;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:SampleFormProperties, syncInitialArgs:AjaxResponse.SampleFormArgs) {
        super(
            dispatcher,
            {
                rlinesValues: Dict.fromEntries(props.rlines)
            }
        );
        this.pageModel = pageModel;
        this.syncInitialArgs = syncInitialArgs;

        this.addActionHandler<MainMenuActions.ShowSample>(
            MainMenuActionName.ShowSample,
            action => {
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload})).subscribe({
                    error: err => {
                        this.pageModel.showMessage('error',
                                `Failed to synchronize ConcSampleModel: ${err}`);
                    }
                })
            }
        );

        this.addActionHandler<Actions.SampleFormSetRlines>(
            ActionName.SampleFormSetRlines,
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

        this.addActionHandler<Actions.SampleFormSubmit>(
            ActionName.SampleFormSubmit,
            action => {
                this.submitQuery(
                    action.payload.sampleId,
                    this.pageModel.getConcArgs().q.substr(1)

                ).subscribe(
                    data => {
                        dispatcher.dispatch<ConcActions.AddedNewOperation>({
                            name: ConcActionName.AddedNewOperation,
                            payload: {
                                concId: data.conc_persistence_op_id,
                                data
                            }
                        });
                    },
                    error => {
                        dispatcher.dispatch<ConcActions.AddedNewOperation>({
                            name: ConcActionName.AddedNewOperation,
                            error
                        });
                    }
                )
            }
        );
    }

    syncFrom(src:Observable<AjaxResponse.SampleFormArgs>):Observable<AjaxResponse.SampleFormArgs> {
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

    createSubmitArgs(sortId:string, concId:string):MultiDict<SampleServerArgs> {
        const args = this.pageModel.exportConcArgs() as MultiDict<SampleServerArgs>;
        args.set('q', '~' + concId);
        args.set('rlines', parseInt(this.state.rlinesValues[sortId]));
        return args;
    }

    submitQuery(sortId:string, concId:string):Observable<AjaxConcResponse> {
        const args = this.createSubmitArgs(sortId, concId);
        return this.pageModel.ajax$<AjaxConcResponse>(
            HTTP.Method.POST,
            this.pageModel.createActionUrl(
                'reduce',
                [
                    tuple('format', 'json')
                ]
            ),
            args
        );
    }

}