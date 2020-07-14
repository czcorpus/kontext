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

import { IStaticallyIdentifiable } from './common';
import { List, pipe, Dict } from 'cnc-tskit';

export interface IPageLeaveVoter<T> extends IModel<T>, IStaticallyIdentifiable {
    reasonNotLeave():string|null;
}


export class PageLeaveVoting extends StatefulModel<{}> {

    votingModels:{[key:string]:IPageLeaveVoter<{}>};

    constructor(dispatcher:IFullActionControl) {
        super(
            dispatcher,
            {}
        );
        this.votingModels = {};
        window.addEventListener('beforeunload', (event) => {
            const reasons = pipe(
                this.votingModels,
                Dict.values(),
                List.map(model => model.reasonNotLeave()),
                List.filter(r => r !== null)
            );
            if (!List.empty(reasons)) {
                event.preventDefault();
                event.returnValue = '';
            }
        });

    }

    unregister() {}

    registerVotingModel<T>(model:IPageLeaveVoter<T>):void {
        this.votingModels[model.getRegistrationId()] = model;
    };

}