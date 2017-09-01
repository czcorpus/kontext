/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';


export function init(dispatcher, he, tagHelperStore) {

    // ------------------------------ <TagDisplay /> ----------------------------

    class TagDisplay extends React.Component {

        constructor(props) {
            super(props);
            this._changeListener = this._changeListener.bind(this);
            this._keyEventHandler = this._keyEventHandler.bind(this);
            this.state = {pattern: this.props.tagValue};
        }

        _changeListener() {
            this.setState({pattern: tagHelperStore.exportCurrentPattern()});
        }

        _keyEventHandler(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            if (typeof this.props.onEscKey === 'function' && evt.keyCode === 27) {
                this.props.onEscKey();
            }
        }

        componentDidMount() {
            tagHelperStore.addChangeListener(this._changeListener);
        }

        componentWillUnmount() {
            tagHelperStore.removeChangeListener(this._changeListener);
        }


        render() {
            return <input type="text" className="tag-display-box" value={this.state.pattern}
                        onKeyDown={this._keyEventHandler} readOnly
                        ref={item => item ? item.focus() : null} />;
        }
    }

    // ------------------------------ <InsertButton /> ----------------------------

    const InsertButton = (props) => {
        return (
            <button className="util-button" type="button"
                    value="insert" onClick={props.onClick}>
                {he.translate('taghelper__insert_btn')}
            </button>
        );
    }

    // ------------------------------ <UndoButton /> ----------------------------

    const UndoButton = (props) => {
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

    const ResetButton = (props) => {
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

    const TagButtons = (props) => {

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
                dispatcher.dispatch({
                    actionType: props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                    props: {
                        query: `[tag="${tagHelperStore.exportCurrentPattern()}"]`,
                        sourceId: props.sourceId,
                        prependSpace: true,
                        closeWhenDone: true
                    }
                });
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

    class ValueLine extends React.Component {

        constructor(props) {
            super(props);
            this._checkboxHandler = this._checkboxHandler.bind(this);
            this.state = {isChecked: this.props.data['selected']};
        }

        _checkboxHandler(evt) {
            this.setState({isChecked: !this.state.isChecked});
            dispatcher.dispatch({
                actionType: 'TAGHELPER_CHECKBOX_CHANGED',
                props: {
                    position: this.props.lineIdx,
                    value: this.props.data['id'],
                    checked: evt.target.checked
                }
            });
        }

        componentWillUnmount() {
            tagHelperStore.removeChangeListener(this._changeListener);
        }

        render() {
            const inputId = 'c_position_' + this.props.lineIdx + '_' + this.props.sublineIdx;
            const label = this.props.data['title'] ?
                        this.props.data['title'] : he.translate('taghelper__unfulfilled');
            return (
            <tr>
                <td className="checkbox-cell">
                    <input type="checkbox"
                            id={inputId}
                            checked={this.state.isChecked}
                            onChange={this._checkboxHandler}
                            disabled={this.props.isLocked ? true : false } />
                </td>
                <td>
                    <label htmlFor={inputId}>{label}</label>
                </td>
            </tr>
            );
        }
    };

    // ------------------------------ <ValueList /> ----------------------------

    const ValueList = (props) => {

        const renderChildren = () => {
            return props.positionValues.map((item, i) => item.available
                ? <ValueLine key={i} data={item} lineIdx={props.lineIdx} sublineIdx={i}
                                isLocked={props.isLocked} />
                : null);
        };

        const hasOnlyUnfulfilledChild = () => {
            return props.positionValues.size === 1 && props.positionValues.get(0).id === '-';
        };

        const renderUnfulfilledCheckbox = () => {
            return (
                <tr>
                    <td className="checkbox-cell"><input type="checkbox" checked="checked" disabled={true} /></td>
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

    const PositionLine = (props) => {

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
            <li style={{margin: '0px', overflow: 'hidden', clear: 'both'}}>
                <a className={linkClass} onClick={clickHandler}>
                    <span className="pos-num">{props.lineIdx + 1})</span> {props.position['label']}
                    <span className="status-text">[ {getAvailableChildren().size} ]</span>
                </a>
                {props.isActive ?
                <ValueList positionValues={getAvailableChildren()}
                            isLocked={props.position['locked']}
                            lineIdx={props.lineIdx} /> : null }
            </li>
        );
    };

    // ------------------------------ <PositionList /> ----------------------------

    class PositionList extends React.Component {

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
                <ul className="multiselect">
                    {this.props.positions.map(
                        (item, i) => <PositionLine key={this._mkid(i)} position={item}
                                                    lineIdx={i} clickHandler={this._lineClickHandler}
                                                    isActive={i === this.state.activeRow} />)}
                </ul>
            );
        }
    }

    // ------------------------------ <TagBuilder /> ----------------------------

    class TagBuilder extends React.Component {

        constructor(props) {
            super(props);
            this._changeListener = this._changeListener.bind(this);
            this.state = this._fetchStoreState();
        }

        _fetchStoreState() {
            return {
                isWaiting: tagHelperStore.isBusy(),
                positions: tagHelperStore.getPositions(),
                stateId: tagHelperStore.getStateId(),
                newState: tagHelperStore.exportCurrentPattern(),
                tagValue: tagHelperStore.exportCurrentPattern(),
                canUndo: tagHelperStore.canUndo()
            };
        }

        _changeListener() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            tagHelperStore.addChangeListener(this._changeListener);
            dispatcher.dispatch({
                actionType: 'TAGHELPER_GET_INITIAL_DATA',
                props: {}
            });
        }

        componentWillUnmount() {
            tagHelperStore.removeChangeListener(this._changeListener);
        }

        render() {
            return <div>
                <h3>{he.translate('taghelper__create_tag_heading')}</h3>
                {
                    this.state.isWaiting ?
                    <img className="loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            title={he.translate('global__loading')}
                            alt={he.translate('global__loading')} /> :
                    null
                }
                <div className="tag-header">
                    <TagDisplay tagValue={this.state.tagValue} onEscKey={this.props.onEscKey} />
                    <TagButtons sourceId={this.props.sourceId}
                                onInsert={this.props.onInsert}
                                actionPrefix={this.props.actionPrefix}
                                canUndo={this.state.canUndo} />
                </div>
                <PositionList positions={this.state.positions}
                                stateId={this.state.stateId} />
            </div>;
        }
    }

    return {
        TagBuilder: TagBuilder
    };
}
