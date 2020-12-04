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

        const [state, changeState] = React.useState({
            checked: props.checked === undefined ? false : props.checked,
            imgClass: props.checked === undefined ? 'off' : props.checked ? 'on' : 'off'
        });

        const clickHandler = () => {
            changeState({
                checked: !state.checked,
                imgClass: !state.checked ? 'on switch-on' : 'off switch-off'
            });
            if (props.onChange !== undefined) {
                props.onChange(state.checked);
            }
        }

        return (
            <span className={"ToggleSwitch" + (props.disabled ? " disabled" : "")}
                  onClick={props.disabled ? null : clickHandler}>
                
                <span className="toggle-img">
                    <input id={props.id} type="checkbox" onClick={clickHandler} disabled={props.disabled}/>
                    <a role="checkbox" aria-checked={state.checked} className={state.imgClass}/>
                </span>
            </span>
        );
    }

    return ToggleSwitch;

}