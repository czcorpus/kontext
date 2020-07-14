/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { StatefulModel, IFullActionControl, IModel } from 'kombo';

import { Actions, ActionName } from './actions';
import { IStaticallyIdentifiable } from './common';
import { Dict, pipe, List, tuple } from 'cnc-tskit';
import { scan } from 'rxjs/operators';

export interface IPageLeaveVoter<T> extends IModel<T>, IStaticallyIdentifiable {

}


export class PageLeaveVoting extends StatefulModel<{}> {

    votingModels:{[key:string]:IPageLeaveVoter<{}>};

    constructor(dispatcher:IFullActionControl) {
        super(
            dispatcher,
            {}
        );
        this.votingModels = {};
        /* TODO cannot do this with async evaluation !!!!
        window.addEventListener('beforeunload', (event) => {
            dispatcher.dispatch<Actions.AskPageLeave>({
                name: ActionName.AskPageLeave
            });
            event.preventDefault();
            event.returnValue = '';
        });
        */
        this.addActionHandler<Actions.AskPageLeave>(
            ActionName.AskPageLeave,
            action => {
                this.suspend(
                    pipe(
                        this.votingModels,
                        Dict.keys(),
                        List.map(k => tuple(k, false)),
                        Dict.fromEntries()
                    ),
                    (wAction, syncData) => {
                        if (wAction.name === ActionName.VotePageLeave) {
                            const payload = (wAction as Actions.VotePageLeave).payload;
                            const newSync = {...syncData, [payload.modelRegKey]: true};
                            return Dict.hasValue(false, newSync) ? newSync : null;
                        }
                        return syncData;

                    }
                ).pipe(
                    scan(
                        (acc, action:Actions.VotePageLeave) => {
                            acc[action.payload.modelRegKey] = action.payload.reasonNotLeave;
                            return acc;
                        },
                        {} as {[key:string]:string|null}
                    )

                ).subscribe(
                    (status) => {
                        const conditions = pipe(
                            status,
                            Dict.values(),
                            List.filter(v => v !== null)
                        );
                        if (!List.empty(conditions)) {
                            window.confirm(conditions.join(' # '));
                        }
                    }
                )
            }
        );
    }

    unregister() {}

    registerVotingModel<T>(model:IPageLeaveVoter<T>):void {
        this.votingModels[model.getRegistrationId()] = model;
    };

}