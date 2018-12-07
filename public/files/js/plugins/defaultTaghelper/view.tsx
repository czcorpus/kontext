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
import {Action, ActionDispatcher} from '../../app/dispatcher';
import {TagHelperModel, PositionValue, PositionOptions, TagHelperModelState} from './models';
import * as Rx from '@reactivex/rxjs';
import {Kontext, KeyCodes} from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { SetQueryInputAction, AppendQueryInputAction } from '../../models/query/common';


type CheckboxHandler = (lineIdx:number, value:string, checked:boolean)=>void;


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers, tagHelperModel:TagHelperModel) {

    // ------------------------------ <TagDisplay /> ----------------------------

    const TagDisplay:React.SFC<{
                onEscKey:()=>void;
                displayPattern:string;
            }> = (props) => {


        const keyEventHandler = (evt:React.KeyboardEvent<{}>) => {
            evt.preventDefault();
            evt.stopPropagation();
            if (typeof props.onEscKey === 'function' && evt.keyCode === KeyCodes.ESC) {
                props.onEscKey();
            }
        };

        return <input type="text" className="tag-display-box" value={props.displayPattern}
                    onKeyDown={keyEventHandler} readOnly
                    ref={item => item ? item.focus() : null} />;
    }

    // ------------------------------ <InsertButton /> ----------------------------

    const InsertButton:React.SFC<{onClick:(evt:React.MouseEvent<{}>)=>void}> = (props) => {
        return (
            <button className="util-button" type="button"
                    value="insert" onClick={props.onClick}>
                {he.translate('taghelper__insert_btn')}
            </button>
        );
    }

    // ------------------------------ <UndoButton /> ----------------------------

    const UndoButton:React.SFC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> = (props) => {
        if (props.enabled) {
            return (
                <button type="button" className="util-button" value="undo"
                        onClick={props.onClick}>
                    {he.translate('taghelper__undo')}
                </button>
            );

        } else {
            return (
                <span className="util-button disabled">
                    {he.translate('taghelper__undo')}
                </span>
            );
        }
    };

    // ------------------------------ <ResetButton /> ----------------------------

    const ResetButton:React.SFC<{onClick:(evt:React.MouseEvent<{}>)=>void; enabled:boolean}> = (props) => {
        if (props.enabled) {
            return (
                <button type="button" className="util-button cancel"
                        value="reset" onClick={props.onClick}>
                    {he.translate('taghelper__reset')}
                </button>
            );

        } else {
            return (
                <span className="util-button disabled">
                    {he.translate('taghelper__reset')}
                </span>
            );
        }
    };


    // ------------------------------ <TagButtons /> ----------------------------

    const TagButtons:React.SFC<{
                range:[number, number];
                sourceId:string;
                onInsert?:()=>void;
                canUndo:boolean;
                displayPattern:string;
                actionPrefix:string;
            }> = (props) => {

        const buttonClick = (evt) => {
            if (evt.target.value === 'reset') {
                dispatcher.dispatch({
                    actionType: 'TAGHELPER_RESET',
                    props: {}
                });

            } else if (evt.target.value === 'undo') {
                dispatcher.dispatch({
                    actionType: 'TAGHELPER_UNDO',
                    props: {}
                });

            } else if (evt.target.value === 'insert') {
                if (Array.isArray(props.range) && props.range[0] && props.range[1]) {
                    const query = `"${props.displayPattern}"`;
                    dispatcher.dispatch<SetQueryInputAction>({
                        actionType: `${props.actionPrefix}QUERY_INPUT_SET_QUERY`,
                        props: {
                            sourceId: props.sourceId,
                            query: query,
                            insertRange: [props.range[0], props.range[1]],
                            rawAnchorIdx: null,
                            rawFocusIdx: null
                        }
                    });

                } else {
                    dispatcher.dispatch<AppendQueryInputAction>({
                        actionType: props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                        props: {
                            sourceId: props.sourceId,
                            query: `[tag="${props.displayPattern}"]`
                        }
                    });
                }
                dispatcher.dispatch({
                    actionType: 'TAGHELPER_RESET',
                    props: {}
                });
                if (typeof props.onInsert === 'function') {
                    props.onInsert();
                }
            }
        };

        return (
            <div className="buttons">
                <InsertButton onClick={buttonClick} />
                <UndoButton onClick={buttonClick} enabled={props.canUndo} />
                <ResetButton onClick={buttonClick} enabled={props.canUndo} />
            </div>
        );
    };

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

    class TagBuilder extends React.Component<PluginInterfaces.TagHelper.ViewProps, TagHelperModelState> {

        constructor(props) {
            super(props);
            this.state = tagHelperModel.getState();
            this._changeListener = this._changeListener.bind(this);
            this.checkboxHandler = this.checkboxHandler.bind(this);
        }

        _changeListener(state:TagHelperModelState) {
            this.setState(state);
        }

        componentDidMount() {
            tagHelperModel.addChangeListener(this._changeListener);
            dispatcher.dispatch({
                actionType: 'TAGHELPER_GET_INITIAL_DATA',
                props: {}
            });
        }

        componentWillUnmount() {
            tagHelperModel.removeChangeListener(this._changeListener);
        }

        private checkboxHandler(lineIdx:number, value:string, checked:boolean) {
            dispatcher.dispatch({
                actionType: 'TAGHELPER_CHECKBOX_CHANGED',
                props: {
                    position: lineIdx,
                    value: value,
                    checked: checked
                }
            });
        }

        render() {
            return <div>
                <h3>{he.translate('taghelper__create_tag_heading')}</h3>
                {
                    this.state.isBusy ?
                    <img className="loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            title={he.translate('global__loading')}
                            alt={he.translate('global__loading')} /> :
                    null
                }
                <div className="tag-header">
                    <TagDisplay displayPattern={this.state.displayPattern} onEscKey={this.props.onEscKey} />
                    <TagButtons sourceId={this.props.sourceId}
                                onInsert={this.props.onInsert}
                                canUndo={this.state.canUndo}
                                range={this.props.range}
                                actionPrefix={this.props.actionPrefix}
                                displayPattern={this.state.displayPattern} />
                </div>
                <PositionList positions={this.state.positions}
                                stateId={this.state.stateId}
                                checkboxHandler={this.checkboxHandler} />
            </div>;
        }
    }

    return {
        TagBuilder: TagBuilder
    };
}
