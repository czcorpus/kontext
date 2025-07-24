/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import * as Kontext from '../../../types/kontext.js';
import * as S from './style.js';


export function init(utils:Kontext.ComponentHelpers):React.FC<{}> {

    const layoutViews = utils.getLayoutViews();

    const Page:React.FC<{}> = (props) => (
        <S.Restore>
            <p>{utils.translate('kwords__please_wait_while_restore_msg')}</p>
            <p className="loader">
                <layoutViews.AjaxLoaderImage />
            </p>
        </S.Restore>
    );

    return Page;
}


