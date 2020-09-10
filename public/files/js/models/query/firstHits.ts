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

import { Action, IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map } from 'rxjs/operators';

import { AjaxResponse } from '../../types/ajaxResponses';
import { PageModel } from '../../app/page';
import { FirstHitsServerArgs } from './common';
import { MultiDict } from '../../multidict';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../mainMenu/actions';
import { Actions, ActionName } from './actions';


export interface FirstHitsModelState {
    docStructValues:{[key:string]:string};
}


export class FirstHitsModel extends StatefulModel<FirstHitsModelState> {

    private readonly layoutModel:PageModel;

    private readonly syncInitialArgs:AjaxResponse.FirstHitsFormArgs;


    constructor(dispatcher:IFullActionControl, layoutModel:PageModel, syncInitialArgs:AjaxResponse.FirstHitsFormArgs) {
        super(
            dispatcher,
            {
                docStructValues: {}
            }
        );
        this.layoutModel = layoutModel;
        this.syncInitialArgs = syncInitialArgs;

        this.addActionHandler<MainMenuActions.FilterApplyFirstOccurrences>(
            MainMenuActionName.FilterApplyFirstOccurrences,
            action => {
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload}));
                this.emitChange();
            }
        );

        this.addActionHandler<Actions.FilterFirstHitsSubmit>(
            ActionName.FilterFirstHitsSubmit,
            action => {
                this.submitForm(action.payload.opKey, action.payload.opKey);
            }
        );
    }

    getSubmitUrl(opKey:string, concId:string):string {
        const args = this.layoutModel.exportConcArgs() as MultiDict<FirstHitsServerArgs>;
        args.set('q', '~' + concId);
        args.set('fh_struct', this.state.docStructValues[opKey]);
        return this.layoutModel.createActionUrl('filter_firsthits', args);
    }

    submitForm(opKey:string, concId:string):void {
        window.location.href = this.getSubmitUrl(opKey, concId);
    }

    syncFrom(fn:Observable<AjaxResponse.FirstHitsFormArgs>):Observable<AjaxResponse.FirstHitsFormArgs> {
        return fn.pipe(
            tap(
                (data) => {
                    if (data.form_type === 'firsthits') {
                        this.changeState(state => {
                            state.docStructValues[data.op_key] = data.doc_struct;
                        });
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
}
