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

import * as React from 'react';
import * as Kontext from '../types/kontext';


export interface CommonViews {
    SaveFormatSelect:React.FC<SaveFormatSelectProps>;
}


export interface SaveFormatSelectProps {
    value:string;
    onChange:(evt:React.ChangeEvent<HTMLSelectElement>)=>void;
}


export function init(he:Kontext.ComponentHelpers):CommonViews {

    /**
     *
     */
    const SaveFormatSelect:React.FC<SaveFormatSelectProps> = (props) => {

        return (
            <select value={props.value} onChange={props.onChange}>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX (Excel)</option>
                <option value="xml">XML</option>
                <option value="text">Text</option>
            </select>
        );
    };

    return {
        SaveFormatSelect: SaveFormatSelect
    };

}