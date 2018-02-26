/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />
/// <reference path="../../types/common.d.ts" />

import * as Immutable from 'vendor/immutable';
import * as RSVP from 'vendor/rsvp';
import {SimplePageStore} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher} from '../../app/dispatcher';
import {MultiDict} from '../../util';


export interface SwitchMainCorpFormProperties {
    maincorp:Array<[string, string]>;
}


export function fetchSwitchMainCorpFormArgs<T>(args:{[ident:string]:AjaxResponse.ConcFormArgs},
        key:(item:AjaxResponse.SwitchMainCorpArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'sample') {
            ans.push([formId, key(<AjaxResponse.SwitchMainCorpArgs>args[formId])]);
        }
    }
    return ans;
}


export class SwitchMainCorpStore extends SimplePageStore {

    private layoutModel:PageModel;

    private maincorpValues:Immutable.Map<string, string>;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel, data:SwitchMainCorpFormProperties) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.maincorpValues = Immutable.Map<string, string>(data);

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'SWITCH_MC_FORM_SUBMIT':
                    window.location.href = this.getSubmitUrl(payload.props['operationId']);
                break;
            }
        });
    }

    getSubmitUrl(opId:string):string {
        const args = this.layoutModel.getConcArgs();
        args.set('maincorp', this.maincorpValues.get(opId));
        return this.layoutModel.createActionUrl('switch_main_corp', args);
    }

    syncFrom(fn:()=>RSVP.Promise<AjaxResponse.SwitchMainCorpArgs>):RSVP.Promise<AjaxResponse.SwitchMainCorpArgs> {
        return fn().then(
            (data) => {
                if (data.form_type === 'switchmc') {
                    this.maincorpValues = this.maincorpValues.set(data.op_key, data.maincorp);
                    return data;

                } else if (data.form_type === 'locked') {
                    return null;

                } else {
                    throw new Error('Cannot sync switchmc store - invalid form data type: ' + data.form_type);
                }
            }
        );
    }


    getMainCorpValues():Immutable.Map<string, string> {
        return this.maincorpValues;
    }

}