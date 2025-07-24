/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, IModel } from 'kombo';
import { ComponentHelpers } from '../../types/kontext.js';
import { SyntaxTreeViewerState } from './common.js';

export function init(
    dispatcher:IActionDispatcher,
    he:ComponentHelpers,
    model:IModel<SyntaxTreeViewerState>
):React.FC {

    const wrapper:React.FC = (props) => (
        <div>

        </div>
    );

    return wrapper;

}