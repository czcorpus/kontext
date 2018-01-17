/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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


export class FirstHitsStore extends SimplePageStore {

    private layoutModel:PageModel;

    private docStructValues:Immutable.Map<string, string>;


    constructor(dispatcher:Kontext.FluxDispatcher, layoutModel:PageModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.docStructValues = Immutable.Map<string, string>();
        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'FILTER_FIRST_HITS_SUBMIT':
                this.submitForm(payload.props['operationId']);
                    // app leaves here
                break;
            }
        });
    }

    getSubmitUrl(opId:string):string {
        const args = this.layoutModel.getConcArgs();
        args.set('fh_struct', this.docStructValues.get(opId));
        return this.layoutModel.createActionUrl('filter_firsthits', args);
    }

    submitForm(opId:string):void {
        window.location.href = this.getSubmitUrl(opId);
    }

    syncFrom(fn:()=>RSVP.Promise<AjaxResponse.FirstHitsFormArgs>):RSVP.Promise<AjaxResponse.FirstHitsFormArgs> {
        return fn().then(
            (data) => {
                if (data.form_type === 'firsthits') {
                    this.docStructValues = this.docStructValues.set(data.op_key, data.doc_struct);
                    return data;

                } else if (data.form_type === 'locked') {
                    return null;

                } else {
                    throw new Error('Cannot sync FirstHitsStore - invalid form data type: ' + data.form_type);
                }
            }
        );
    }

    getDocStructValues():Immutable.Map<string, string> {
        return this.docStructValues;
    }

}