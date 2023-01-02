/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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


import * as React from 'react';
import { Bound, IActionDispatcher } from 'kombo';

import * as Kontext from '../../../types/kontext';
import * as PluginInterfaces from '../../../types/plugins';
import { KeywordsFormModel, KeywordsFormState } from '../../../models/keywords/form';


export interface KeywordsFormViewArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorparchWidget:PluginInterfaces.Corparch.WidgetView;
    keywordsFormModel:KeywordsFormModel;
}


export function init({
    dispatcher,
    he,
    CorparchWidget,
    keywordsFormModel
}:KeywordsFormViewArgs):React.ComponentClass<{}> {

    const layoutViews = he.getLayoutViews();


    const KeywordsForm:React.FC<KeywordsFormState> = (props) => {

        return (
            <div>
                keywords form (TODO)
            </div>
        );
    }


    return Bound(KeywordsForm, keywordsFormModel);

}