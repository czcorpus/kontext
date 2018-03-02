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

import * as Immutable from 'immutable';
import * as RSVP from 'vendor/rsvp';
import {AjaxResponse} from '../../types/ajaxResponses';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';


export class FirstHitsStore extends StatefulModel {

    private layoutModel:PageModel;

    private docStructValues:Immutable.Map<string, string>;


    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.docStructValues = Immutable.Map<string, string>();
        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'FILTER_FIRST_HITS_SUBMIT':
                    this.submitForm(payload.props['opKey']);
                    // app leaves here
                break;
            }
        });
    }

    getSubmitUrl(opKey:string):string {
        const args = this.layoutModel.getConcArgs();
        args.set('fh_struct', this.docStructValues.get(opKey));
        return this.layoutModel.createActionUrl('filter_firsthits', args);
    }

    submitForm(opKey:string):void {
        window.location.href = this.getSubmitUrl(opKey);
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