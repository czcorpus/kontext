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
import { IActionDispatcher } from 'kombo';
import { List } from 'cnc-tskit';

import {PositionValue, PositionOptions, TagHelperModelState} from './models';
import { Kontext } from '../../../types/common';
import { Actions, ActionName } from '../actions';


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
                positionValues:Array<PositionValue>,
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
            return props.positionValues.length === 1 && List.head(props.positionValues).id === '-';
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
            List.filter(item => item.available, props.positionValues).length > 0 ?
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
                position:PositionOptions;
                checkboxHandler:CheckboxHandler;
            }> = (props) => {

        const clickHandler = () => {
            props.clickHandler(props.lineIdx, props.position.isActive);
        };

        const getAvailableChildren = () => {
            return props.position['values'].filter(x=>x.available);
        };

        let linkClass = 'switch-link';
        if (props.position.isActive) {
            linkClass += ' active';

        } else if (props.position['locked']) {
            linkClass += ' used';
        }

        return (
            <li className="defaultTaghelper_PositionLine">
                <a className={linkClass} onClick={clickHandler}>
                    <span className="pos-num">{props.lineIdx + 1})</span> {props.position['label']}
                    <span className="status-text">[ {getAvailableChildren().length} ]</span>
                </a>
                {props.position.isActive ?
                <ValueList positionValues={getAvailableChildren()}
                            isLocked={props.position.isLocked}
                            lineIdx={props.lineIdx}
                            checkboxHandler={props.checkboxHandler} /> : null }
            </li>
        );
    };

    // ------------------------------ <PositionList /> ----------------------------

    const PositionList:React.SFC<{
        sourceId:string;
        positions:Array<PositionOptions>;
        checkboxHandler:CheckboxHandler;
    }> = (props) => {

        const lineClickHandler = () => {
            dispatcher.dispatch<Actions.ToggleActivePosition>({
                name: ActionName.ToggleActivePosition,
                payload: {
                    sourceId: props.sourceId
                }
            });
        };

        return (
            <ul className="defaultTaghelper_PositionList">
                {props.positions.map(
                    (item, i) => <PositionLine key={`${i}:${item.label}`} position={item}
                                                lineIdx={i} clickHandler={lineClickHandler}
                                                checkboxHandler={props.checkboxHandler} />)}
            </ul>
        );
    }

    // ------------------------------ <TagBuilder /> ----------------------------

    const TagBuilder:React.SFC<TagHelperModelState> = (props) => {

        const checkboxHandler = (lineIdx:number, value:string, checked:boolean) => {
            dispatcher.dispatch<Actions.CheckboxChanged>({
                name: ActionName.CheckboxChanged,
                payload: {
                    sourceId: props.corpname,
                    position: lineIdx,
                    value: value,
                    checked: checked
                }
            });
        };

        return (
            <div>
                <input type="text" className="postag-display-box" value={props.generatedQuery} readOnly />
                <PositionList
                    positions={props.positions}
                    sourceId={props.corpname}
                    checkboxHandler={checkboxHandler} />
            </div>
        );
    }

    return TagBuilder;
}
