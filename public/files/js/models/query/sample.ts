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

import * as Immutable from 'immutable';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/page';
import {AjaxResponse} from '../../types/ajaxResponses';
import {MultiDict} from '../../multidict';
import { Action, IFullActionControl } from 'kombo';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';


export interface SampleFormProperties {
    rlines:Array<[string, string]>;
}


export function fetchSampleFormArgs<T>(args:{[ident:string]:AjaxResponse.ConcFormArgs},
        key:(item:AjaxResponse.SampleFormArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'sample') {
            ans.push([formId, key(<AjaxResponse.SampleFormArgs>args[formId])]);
        }
    }
    return ans;
}


export class ConcSampleModel extends StatefulModel {

    private pageModel:PageModel;

    private rlinesValues:Immutable.Map<string, string>;

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:SampleFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.rlinesValues = Immutable.Map<string, string>(props.rlines);

        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'SAMPLE_FORM_SET_RLINES':
                    const v = action.payload['value'];
                    if (/^([1-9]\d*)?$/.exec(v)) {
                        this.rlinesValues = this.rlinesValues.set(action.payload['sampleId'], v);

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('query__sample_value_must_be_gt_zero'));
                    }
                    this.emitChange();
                break;
                case 'SAMPLE_FORM_SUBMIT':
                    this.submitQuery(action.payload['sampleId']);
                    this.emitChange(); // actually - currently there is no need for this (window.location changed here...)
                break;
            }
        });
    }

    syncFrom(src:Observable<AjaxResponse.SampleFormArgs>):Observable<AjaxResponse.SampleFormArgs> {
        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'sample') {
                        this.rlinesValues = this.rlinesValues.set(data.op_key, data.rlines);
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

    private createSubmitArgs(sortId:string):MultiDict {
        const args = this.pageModel.getConcArgs();
        args.replace('rlines', [String(this.rlinesValues.get(sortId))]);
        return args;
    }

    submitQuery(sortId:string):void {
        const args = this.createSubmitArgs(sortId);
        window.location.href = this.pageModel.createActionUrl('reduce', args.items());
    }

    getSubmitUrl(sortId:string):string {
        return this.pageModel.createActionUrl('reduce', this.createSubmitArgs(sortId).items());
    }

    getRlinesValues():Immutable.Map<string, string> {
        return this.rlinesValues;
    }
}