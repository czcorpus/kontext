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

/// <reference path="../../types/common.d.ts" />

import * as Immutable from 'vendor/immutable';
import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';
import {MultiDict} from '../../util';


export interface SampleFormProperties {
    rlines:Array<[string, number]>;
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


export class SampleStore extends SimplePageStore {

    private pageModel:PageModel;

    private rlinesValues:Immutable.Map<string, number>;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pageModel:PageModel, props:SampleFormProperties) {
        super(dispatcher);
        this.pageModel = pageModel;
        this.rlinesValues = Immutable.Map<string, number>(props.rlines);

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'SAMPLE_FORM_SET_RLINES':
                    const v = payload.props['value'];
                    if (/^([1-9]\d*)?$/.exec(v)) {
                        this.rlinesValues = this.rlinesValues.set(
                            payload.props['sampleId'],
                            parseInt(v)
                        );

                    } else {
                        this.pageModel.showMessage('error', this.pageModel.translate('query__sample_value_must_be_gt_zero'));
                    }
                    this.notifyChangeListeners();
                break;
                case 'SAMPLE_FORM_SUBMIT':
                    this.submitQuery(payload.props['sampleId']);
                    this.notifyChangeListeners(); // actually - currently there is no need for this (window.location changed here...)
                break;
            }
        });
    }

    syncFrom(fn:()=>RSVP.Promise<AjaxResponse.SampleFormArgs>):RSVP.Promise<SampleStore> {
        return fn().then(
            (data) => {
                const filterId = data.op_key;
                this.rlinesValues = this.rlinesValues.set(data.op_key, data.rlines);
                return this;
            }
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

    getRlinesValues():Immutable.Map<string, number> {
        return this.rlinesValues;
    }
}