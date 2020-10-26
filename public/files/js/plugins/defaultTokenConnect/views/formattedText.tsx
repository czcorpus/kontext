/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
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

import { List } from 'cnc-tskit';
import * as React from 'react';
import { AjaxResponse } from '../../../types/ajaxResponses';
import { Kontext } from '../../../types/common';


export interface FormattedTextRendererProps {
    data:AjaxResponse.WideCtx;
}


export function init(he:Kontext.ComponentHelpers):React.FC<FormattedTextRendererProps> {

    const FormattedTextRenderer:React.FC<FormattedTextRendererProps> = (props) => {

        return (
            <div>FORMATTED TEXT ---
                {List.map(
                    v => v.str,
                    // also 'class' attr is avail.; if v.class === 'strc' then there is
                    // a structure inside v.str
                    props.data.content
                )}
            </div>
        );
    };


    return FormattedTextRenderer;

}