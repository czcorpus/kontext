/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { List, pipe, URL } from 'cnc-tskit';
import { Action } from 'kombo';
import { Actions as MainMenuActions } from '../../models/mainMenu/actions.js';
import { Actions as QueryActions } from '../../models/query/actions.js';
import { PageModel } from '../page.js';


export type ActionUrlCodes =
    'filter' |
    'sort' |
    'sample' |
    'shuffle' |
    'edit_op' |
    'show_permalink';


function createViewUrl(layoutModel:PageModel, actionCode:ActionUrlCodes, payload?:{}):string {
    return layoutModel.createActionUrl(
        'view',
        layoutModel.getConcArgs()
    ) +
    `#${actionCode}/`
    + pipe(
        payload || {},
        URL.valueToPairs(),
        List.map(([k, v]) => `${k}=${v}`),
        items => items.join('#')
    );
}

/**
 * transferActionToViewPage is used on non-view (!= concordance view) pages like
 * 'freqs', 'colls' where different models of the "view" page are not available
 * but we still want the page to react to actions available in "view". In such
 * case we have to add some information to URL using '#' and redirect to the
 * "view" page which is able to decode the information after '#' and 'revive'
 * the action.
 */
export const transferActionToViewPage = (layoutModel:PageModel) => (action:Action) => {
    const actionMap:{[k:string]:ActionUrlCodes} = {
        [MainMenuActions.ShowFilter.name]: 'filter',
        [MainMenuActions.ShowSort.name]: 'sort',
        [MainMenuActions.ShowSample.name]: 'sample',
        [MainMenuActions.ApplyShuffle.name]: 'shuffle',
        [QueryActions.EditQueryOperation.name]: 'edit_op',
        [MainMenuActions.MakeConcLinkPersistent.name]: 'show_permalink'
    };
    const actionKey = actionMap[action.name];
    if (actionKey) {
        window.location.replace(
            createViewUrl(layoutModel, actionKey, action.payload)
        );
    }
};
