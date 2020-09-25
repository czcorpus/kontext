/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher } from 'kombo';

import { Kontext } from '../../types/common';
import { Actions, ActionName } from '../../models/textTypes/actions';

export interface ExtendedInfoButtonProps {
    attrName:string;
    ident:string;
    containsExtendedInfo:boolean;
    numGrouped:number;
    isBusy:boolean;
};

export interface CheckBoxItemProps {
    itemName:string;
    itemValue:string;
    itemIdx:number;
    itemIsSelected:boolean;
    itemIsLocked:boolean;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):{
    ExtendedInfoButton:React.ComponentClass<ExtendedInfoButtonProps>;
    CheckBoxItem:React.FC<CheckBoxItemProps>;
} {


    class ExtendedInfoButton extends React.PureComponent<ExtendedInfoButtonProps> {


        constructor(props) {
            super(props);
            this._handleClick = this._handleClick.bind(this);
        }

        _handleClick(evt) {
            dispatcher.dispatch<Actions.ExtendedInformationRequest>({
                name: ActionName.ExtendedInformationRequest,
                payload: {
                    attrName: this.props.attrName,
                    ident: this.props.ident
                }
            });
        }

        render() {
            if (this.props.isBusy) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={he.translate('global__loading')} />;

            } else if (this.props.numGrouped < 2) {
                return <a onClick={this._handleClick} className="bib-info">i</a>;

            } else {
                return <a onClick={this._handleClick} className="bib-warn">!</a>
            }

        }
    }


        // ----------------------------- <CheckboxItem /> --------------------------

        const CheckBoxItem:React.FC<CheckBoxItemProps> = (props) => {


            const clickHandler = () => {
                dispatcher.dispatch<Actions.ValueCheckboxClicked>({
                    name: ActionName.ValueCheckboxClicked,
                    payload: {
                        attrName: props.itemName,
                        itemIdx: props.itemIdx
                    }
                });
            }

            return (
                <label className={props.itemIsLocked ? 'locked' : null}>
                    <input
                        type="checkbox"
                        value={props.itemValue}
                        className="attr-selector user-selected"
                        checked={props.itemIsSelected}
                        onChange={clickHandler}
                        disabled={props.itemIsLocked}
                    />
                    {props.itemIsLocked ?
                        <input type="hidden" value={props.itemValue} /> : null }
                    {props.itemValue}
                </label>
            );
        }

    return {
        ExtendedInfoButton,
        CheckBoxItem
    };
}