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

import { Action, IFullActionControl } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import * as Immutable from 'immutable';

import { AjaxResponse } from '../../types/ajaxResponses';
import { StatefulModel } from '../base';
import { PageModel } from '../../app/page';
import { FirstHitsServerArgs } from './common';
import { MultiDict } from '../../multidict';



export class FirstHitsModel extends StatefulModel {

    private readonly layoutModel:PageModel;

    private readonly syncInitialArgs:AjaxResponse.FirstHitsFormArgs;

    private docStructValues:Immutable.Map<string, string>;


    constructor(dispatcher:IFullActionControl, layoutModel:PageModel, syncInitialArgs:AjaxResponse.FirstHitsFormArgs) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.syncInitialArgs = syncInitialArgs;
        this.docStructValues = Immutable.Map<string, string>();
        this.dispatcherRegister((action:Action) => {
            switch (action.name) {
                case 'MAIN_MENU_FILTER_APPLY_FIRST_OCCURRENCES':
                    this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload}));
                    this.emitChange();
                break;
                case 'FILTER_FIRST_HITS_SUBMIT':
                    this.submitForm(action.payload['opKey']);
                    // app leaves here
                break;
            }
        });
    }

    getSubmitUrl(opKey:string):string {
        const args = this.layoutModel.getConcArgs() as MultiDict<FirstHitsServerArgs>;
        args.set('fh_struct', this.docStructValues.get(opKey));
        return this.layoutModel.createActionUrl('filter_firsthits', args);
    }

    submitForm(opKey:string):void {
        window.location.href = this.getSubmitUrl(opKey);
    }

    syncFrom(fn:Observable<AjaxResponse.FirstHitsFormArgs>):Observable<AjaxResponse.FirstHitsFormArgs> {
        return fn.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'firsthits') {
                        this.docStructValues = this.docStructValues.set(data.op_key, data.doc_struct);
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === 'firsthits') {
                        return data;

                    } else if (data.form_type === 'locked') {
                        return null;

                    } else {
                        throw new Error('Cannot sync FirstHitsModel - invalid form data type: ' + data.form_type);
                    }
                }
            )
        );
    }

    getDocStructValues():Immutable.Map<string, string> {
        return this.docStructValues;
    }

}