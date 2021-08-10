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

import { IFullActionControl, StatefulModel } from 'kombo';
import { Observable, of as rxOf } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import * as Kontext from '../../types/kontext';
import { Dict } from 'cnc-tskit';

import { PageModel } from '../../app/page';
import { MultiDict } from '../../multidict';
import { SwitchMainCorpServerArgs } from './common';
import { Actions as MainMenuActions } from '../../models/mainMenu/actions';
import { Actions } from './actions';
import { ConcFormArgs, SwitchMainCorpArgs } from './formArgs';



export interface SwitchMainCorpFormProperties {
    maincorp:Array<[string, string]>;
}


export function fetchSwitchMainCorpFormArgs<T>(args:{[ident:string]:ConcFormArgs},
        key:(item:SwitchMainCorpArgs)=>T):Array<[string, T]> {
    const ans = [];
    for (let formId in args) {
        if (args.hasOwnProperty(formId) && args[formId].form_type === 'sample') {
            ans.push([formId, key(args[formId] as SwitchMainCorpArgs)]);
        }
    }
    return ans;
}


export interface SwitchMainCorpModelState {
    maincorpValues:{[key:string]:string};
}


export class SwitchMainCorpModel extends StatefulModel<SwitchMainCorpModelState> {

    private readonly layoutModel:PageModel;

    private readonly syncInitialArgs:SwitchMainCorpArgs;

    constructor(
        dispatcher:IFullActionControl,
        layoutModel:PageModel,
        data:SwitchMainCorpFormProperties,
        syncInitialArgs:SwitchMainCorpArgs
    ) {
        super(
            dispatcher,
            {
                maincorpValues: Dict.fromEntries(data.maincorp)
            }
        );
        this.layoutModel = layoutModel;
        this.syncInitialArgs = syncInitialArgs;

        this.addActionHandler<typeof MainMenuActions.ShowSwitchMc>(
            MainMenuActions.ShowSwitchMc.name,
            action => {
                this.syncFrom(rxOf({...this.syncInitialArgs, ...action.payload})).subscribe({
                    error: err => {
                        this.layoutModel.showMessage('error',
                                `Failed to synchronize SwitchMainCorpModel: ${err}`);
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.SwitchMcFormSubmit>(
            Actions.SwitchMcFormSubmit.name,
            action => {
                window.location.href = this.getSubmitUrl(
                    action.payload.operationId,
                    action.payload.operationId
                );
            }
        );
    }

    getSubmitUrl(opId:string, concId:string):string {
        const args = this.layoutModel.exportConcArgs() as MultiDict<SwitchMainCorpServerArgs>;
        args.set('q', '~' + concId);
        args.set('maincorp', this.state.maincorpValues[opId]);
        return this.layoutModel.createActionUrl('switch_main_corp', args);
    }

    syncFrom(
        src:Observable<SwitchMainCorpArgs>
    ):Observable<SwitchMainCorpArgs> {

        return src.pipe(
            tap(
                (data) => {
                    if (data.form_type === Kontext.ConcFormTypes.SWITCHMC) {
                        this.changeState(state => {
                            state.maincorpValues[data.op_key] = data.maincorp;
                        });
                    }
                }
            ),
            map(
                (data) => {
                    if (data.form_type === Kontext.ConcFormTypes.SWITCHMC) {
                        return data;

                    } else if (data.form_type === 'locked') {
                        return null;

                    } else {
                        throw new Error(
                            'Cannot sync switchmc model - invalid form data type: ' +
                            data.form_type
                        );
                    }
                }
            )
        );
    }

}