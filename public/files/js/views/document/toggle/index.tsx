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

import * as Kontext from '../../../types/kontext.js';
import * as CoreViews from '../../../types/coreViews/index.js';
import * as S from './style.js';
import { Keyboard } from 'cnc-tskit';


type ToggleMotionTypes = 'switch-on'|'switch-off'|undefined;


export function init(he:Kontext.ComponentHelpers):React.FC<CoreViews.ToggleSwitch.Props> {

    const ToggleSwitch:React.FC<CoreViews.ToggleSwitch.Props> = (props) => {

        const [inMotionTo, setMotionTo] = React.useState<ToggleMotionTypes>(undefined);

        React.useEffect(
            () => {
                if (props.onChange !== undefined && inMotionTo) {
                    props.onChange(inMotionTo === 'switch-on');
                }
            },
            [inMotionTo]
        )

        const clickHandler = () => {
            setMotionTo(props.checked ? 'switch-off' : 'switch-on');
        };

        const keyHandler = (evt:React.KeyboardEvent) => {
            if (
                (evt.key === Keyboard.Value.ENTER) ||
                 evt.key === Keyboard.Value.SPACE ||
                (!props.checked && evt.key === Keyboard.Value.RIGHT_ARROW) ||
                (props.checked && evt.key === Keyboard.Value.LEFT_ARROW)
            ) {
                clickHandler();
                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        const imgClass = !!props.checked ? `on ${inMotionTo || ''}`: `off ${inMotionTo || ''}`;
        const htmlClasses = ['ToggleSwitch'];
        if (props.disabled) {
            htmlClasses.push('disabled');
        }
        if (props.htmlClass) {
            htmlClasses.push(props.htmlClass);
        }
        return (
            <S.ToggleSwitch className={htmlClasses.join(' ')} onKeyDown={keyHandler} tabIndex={props.disabled ? -1 : 0}>
                <span className="toggle-img" onClick={props.disabled ? null : clickHandler}>
                    <a role="checkbox" aria-checked={!!props.checked} className={imgClass}/>
                </span>
            </S.ToggleSwitch>
        );
    }

    return ToggleSwitch;

}