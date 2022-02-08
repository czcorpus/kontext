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

import * as Kontext from '../../../types/kontext';
import * as CoreViews from '../../../types/coreViews';
import * as S from './style';
import { Keyboard } from 'cnc-tskit';



export function init(he:Kontext.ComponentHelpers):React.ComponentClass<CoreViews.ToggleSwitch.Props, CoreViews.ToggleSwitch.State> {

    class ToggleSwitch extends React.Component<CoreViews.ToggleSwitch.Props, CoreViews.ToggleSwitch.State> {

        constructor(props) {
            super(props)
            this.state = {
                checked: this.props.checked === undefined ? false : this.props.checked,
                imgClass: this.props.checked === undefined ? 'off' : this.props.checked ? 'on' : 'off'
            }
            this.clickHandler = this.clickHandler.bind(this);
            this.keyHandler = this.keyHandler.bind(this);
        }

        componentDidUpdate(prevProps) {
            if (this.props.checked !== prevProps.checked && this.state.checked !== this.props.checked) {
                this.setState({
                    checked: this.props.checked,
                    imgClass: this.props.checked ? 'on switch-on' : 'off switch-off'
                });
            }
          }

        clickHandler() {
            this.setState(
                {
                    checked: !this.state.checked,
                    imgClass: !this.state.checked ? 'on switch-on' : 'off switch-off'
                },
                () => {
                    if (this.props.onChange !== undefined) {
                        this.props.onChange(this.state.checked);
                    }
                }
            );
        }

        keyHandler(evt) {
            if (
                (evt.key === Keyboard.Value.ENTER) ||
                (!this.state.checked && evt.key === Keyboard.Value.RIGHT_ARROW) ||
                (this.state.checked && evt.key === Keyboard.Value.LEFT_ARROW)
            ) {
                this.clickHandler();
                evt.stopPropagation();
                evt.preventDefault();
            }
        }

        render() {
            return (
                <S.ToggleSwitch onKeyDown={this.keyHandler} tabIndex={this.props.disabled ? -1 : 0} className={this.props.disabled ? "ToggleSwitch disabled" : "ToggleSwitch"}>
                    <input id={this.props.id} type="checkbox" checked={this.state.checked}
                            onChange={this.clickHandler} disabled={this.props.disabled}/>
                    <span className="toggle-img" onClick={this.props.disabled ? null : this.clickHandler}>
                        <a role="checkbox" aria-checked={this.state.checked} className={this.state.imgClass}/>
                    </span>
                </S.ToggleSwitch>
            );
        }
    }

    return ToggleSwitch;

}