/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
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
import * as Immutable from 'immutable';
import {PositionValue, PositionOptions, TagHelperModelState} from './models';
import {Kontext} from '../../../types/common';
import { IActionDispatcher } from 'kombo';


type CheckboxHandler = (lineIdx:number, value:string, checked:boolean)=>void;


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers) {


    // ------------------------------ <ValueLine /> ----------------------------

    const ValueLine:React.SFC<{
                data:{selected:boolean};
                lineIdx:number;
                sublineIdx:number;
                isLocked:boolean;
                isChecked:boolean;
                checkboxHandler:CheckboxHandler;
            }> = (props) => {

        const checkboxHandler = (evt) => {
            props.checkboxHandler(
                props.lineIdx,
                props.data['id'],
                evt.target.checked
            );
        };

        const inputId = 'c_position_' + props.lineIdx + '_' + props.sublineIdx;
        const label = props.data['title'] ?
                    props.data['title'] : he.translate('taghelper__unfulfilled');
        return (
        <tr>
            <td className="checkbox-cell">
                <input type="checkbox"
                        id={inputId}
                        checked={props.isChecked}
                        onChange={checkboxHandler}
                        disabled={props.isLocked ? true : false } />
            </td>
            <td>
                <label htmlFor={inputId}>{label}</label>
            </td>
        </tr>
        );
    };

    // ------------------------------ <ValueList /> ----------------------------

    const ValueList:React.SFC<{
                positionValues:Immutable.Iterable<number, PositionValue>,
                lineIdx:number;
                isLocked:boolean;
                checkboxHandler:CheckboxHandler;
            }> = (props) => {

        const renderChildren = () => {
            return props.positionValues.map((item, i) => item.available
                ? <ValueLine key={i} data={item} lineIdx={props.lineIdx} sublineIdx={i}
                                isLocked={props.isLocked} isChecked={item.selected}
                                checkboxHandler={props.checkboxHandler} />
                : null);
        };

        const hasOnlyUnfulfilledChild = () => {
            return props.positionValues.size === 1 && props.positionValues.get(0).id === '-';
        };

        const renderUnfulfilledCheckbox = () => {
            return (
                <tr>
                    <td className="checkbox-cell"><input type="checkbox" checked={true} disabled={true} /></td>
                    <td>{he.translate('taghelper__unfulfilled')}</td>
                </tr>
            );
        };
        return (
            props.positionValues.filter(item => item.available).size > 0 ?
            (
                <table className="checkbox-list">
                <tbody>
                {
                    hasOnlyUnfulfilledChild() ?
                    renderUnfulfilledCheckbox() : renderChildren()
                }
                </tbody>
                </table>
            )
            : null
        );
    };

    // ------------------------------ <PositionLine /> ----------------------------

    const PositionLine:React.SFC<{
                clickHandler:(lineIdx:number, isActive:boolean)=>void;
                lineIdx:number;
                isActive:boolean;
                position:PositionOptions;
                checkboxHandler:CheckboxHandler;
            }> = (props) => {

        const clickHandler = () => {
            props.clickHandler(props.lineIdx, props.isActive);
        };

        const getAvailableChildren = () => {
            return props.position['values'].filter(x=>x.available);
        };

        let linkClass = 'switch-link';
        if (props.isActive) {
            linkClass += ' active';

        } else if (props.position['locked']) {
            linkClass += ' used';
        }

        return (
            <li className="defaultTaghelper_PositionLine">
                <a className={linkClass} onClick={clickHandler}>
                    <span className="pos-num">{props.lineIdx + 1})</span> {props.position['label']}
                    <span className="status-text">[ {getAvailableChildren().size} ]</span>
                </a>
                {props.isActive ?
                <ValueList positionValues={getAvailableChildren()}
                            isLocked={props.position.locked}
                            lineIdx={props.lineIdx}
                            checkboxHandler={props.checkboxHandler} /> : null }
            </li>
        );
    };

    // ------------------------------ <PositionList /> ----------------------------

    class PositionList extends React.Component<{
                stateId:string;
                positions:Immutable.List<PositionOptions>;
                checkboxHandler:CheckboxHandler;
            },
            {
                activeRow:number;
            }> {

        constructor(props) {
            super(props);
            this._lineClickHandler = this._lineClickHandler.bind(this);
            this.state = {activeRow: null};
        }

        _lineClickHandler(clickedRow, isActive) {
            this.setState({activeRow: isActive ? null : clickedRow});
        }

        _mkid(i) {
            return this.props.stateId + String(i);
        }

        render() {
            return (
                <ul className="defaultTaghelper_PositionList">
                    {this.props.positions.map(
                        (item, i) => <PositionLine key={this._mkid(i)} position={item}
                                                    lineIdx={i} clickHandler={this._lineClickHandler}
                                                    isActive={i === this.state.activeRow}
                                                    checkboxHandler={this.props.checkboxHandler} />)}
                </ul>
            );
        }
    }

    // ------------------------------ <TagBuilder /> ----------------------------

    class TagBuilder extends React.Component<TagHelperModelState> {

        constructor(props) {
            super(props);
            this.checkboxHandler = this.checkboxHandler.bind(this);
        }

        private checkboxHandler(lineIdx:number, value:string, checked:boolean) {
            dispatcher.dispatch({
                name: 'TAGHELPER_CHECKBOX_CHANGED',
                payload: {
                    position: lineIdx,
                    value: value,
                    checked: checked
                }
            });
        }

        render() {
            return <PositionList
                        positions={this.props.positions}
                        stateId={this.props.stateId}
                        checkboxHandler={this.checkboxHandler} />;
        }
    }

    return TagBuilder;
}
