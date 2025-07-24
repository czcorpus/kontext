/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Bound, IActionDispatcher } from 'kombo';
import * as React from 'react';
import { DispersionResultModel, DispersionResultModelState } from '../../models/dispersion/result.js';
import { ComponentHelpers } from '../../types/kontext.js';
import { Actions } from '../../models/dispersion/actions.js';

import * as S from './style.js';



export function init(
    dispatcher:IActionDispatcher,
    he:ComponentHelpers,
    dispersionModel:DispersionResultModel
) {

    const layoutViews = he.getLayoutViews();

    const handleResolutionChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
        dispatcher.dispatch<typeof Actions.ChangeResolution>({
            name: Actions.ChangeResolution.name,
            payload: {value: evt.target.value}
        });
    }

    const DispersionForm:React.FC<DispersionResultModelState> = (props) => {

        return (
            <S.FreqDispersionParamFieldset>
                <label htmlFor='resolution-input'>{he.translate('dispersion__resolution')}</label>
                <layoutViews.ValidatedItem invalid={props.resolution.isInvalid} errorDesc={props.resolution.errorDesc}>
                    <input id='resolution-input' onChange={handleResolutionChange} value={props.resolution.value}/>
                </layoutViews.ValidatedItem>

            </S.FreqDispersionParamFieldset>
        )
    }


    return Bound(DispersionForm, dispersionModel);
}