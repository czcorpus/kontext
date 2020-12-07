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



export function init(he:Kontext.ComponentHelpers):React.ComponentClass<CoreViews.ToggleSwitch.Props, CoreViews.ToggleSwitch.State> {

    class ToggleSwitch extends React.Component<CoreViews.ToggleSwitch.Props, CoreViews.ToggleSwitch.State> {

        constructor(props) {
            super(props)
            this.state = {
                checked: this.props.checked === undefined ? false : this.props.checked,
                imgClass: this.props.checked === undefined ? 'off' : this.props.checked ? 'on' : 'off'
            }
            this.clickHandler = this.clickHandler.bind(this);
        }

        componentDidUpdate(prevProps) {
            if (this.props.checked !== prevProps.checked) {
                this.setState({
                    checked: this.props.checked,
                    imgClass: this.props.checked ? 'on switch-on' : 'off switch-off'
                });
            }
          }

        clickHandler() {
            this.setState({
                checked: !this.state.checked,
                imgClass: !this.state.checked ? 'on switch-on' : 'off switch-off'
            });
            if (this.props.onChange !== undefined) {
                this.props.onChange(this.state.checked);
            }
        }

        render() {
            return (
                <span className={"ToggleSwitch" + (this.props.disabled ? " disabled" : "")}
                    onClick={this.props.disabled ? null : this.clickHandler}>
                    
                    <span className="toggle-img">
                        <input id={this.props.id} type="checkbox" onClick={this.clickHandler} disabled={this.props.disabled}/>
                        <a role="checkbox" aria-checked={this.state.checked} className={this.state.imgClass}/>
                    </span>
                </span>
            );
        }
    }

    return ToggleSwitch;

}