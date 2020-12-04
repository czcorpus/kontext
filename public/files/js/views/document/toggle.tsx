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

import * as React from 'react';

import { Kontext } from '../../types/common';
import { CoreViews } from '../../types/coreViews';



export function init(he:Kontext.ComponentHelpers):React.FC<CoreViews.ToggleSwitch.Props> {

    const ToggleSwitch:React.FC<CoreViews.ToggleSwitch.Props> = (props) => {

        const [checked, changeState] = React.useState(props.checked === undefined ? false : props.checked);
        const clickHandler = () => {
            changeState(!checked);
            if (props.onChange !== undefined) {
                props.onChange(checked);
            }
        }

        return (
            <span className={"ToggleSwitch" + props.disabled ? " disabled" : ""}
                  onClick={props.disabled ? null : clickHandler}>
                
                <a className="label">{props.label}</a>
                <span className="toggle-img">
                    <a role="checkbox" aria-checked={checked} className={checked ? 'on' : 'off'}/>
                </span>
            </span>
        );
    }

    return ToggleSwitch;

}