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

import * as React from 'vendor/react';


export function init(dispatcher, mixins, tagHelperStore) {

    const he = mixins[0];

    // ------------------------------ <TagDisplay /> ----------------------------

    const TagDisplay = React.createClass({

        mixins: mixins,

        _changeListener : function (store, evt) {
            if (evt === 'TAGHELPER_PATTERN_CHANGED') {
                this.setState({pattern: tagHelperStore.exportCurrentPattern()});
            }
        },

        componentDidMount : function () {
            tagHelperStore.addChangeListener(this._changeListener);
        },

        componentWillUnmount : function () {
            tagHelperStore.removeChangeListener(this._changeListener);
        },

        getInitialState : function () {
            return {pattern: this.props.tagValue};
        },

        _keyEventHandler : function (evt) {
            evt.preventDefault();
            evt.stopPropagation();
            if (typeof this.props.onEscKey === 'function' && evt.keyCode === 27) {
                this.props.onEscKey();
            }
        },

        render : function () {
            return <input type="text" className="tag-display-box" value={this.state.pattern}
                        onKeyDown={this._keyEventHandler} readOnly
                        ref={item => item ? item.focus() : null} />;
        }
    });

    // ------------------------------ <TagButtons /> ----------------------------

    const TagButtons = React.createClass({

        mixins: mixins,

        _buttonClick : function (evt) {
            if (evt.target.value === 'reset') {
                dispatcher.dispatch({
                    actionType: 'TAGHELPER_RESET',
                    props: {}
                });

            } else if (evt.target.value === 'insert') {
                dispatcher.dispatch({
                    actionType: this.props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                    props: {
                        query: `[tag="${tagHelperStore.exportCurrentPattern()}"]`,
                        sourceId: this.props.sourceId,
                        prependSpace: true,
                        closeWhenDone: true
                    }
                });
                dispatcher.dispatch({
                    actionType: 'TAGHELPER_RESET',
                    props: {}
                });
                if (typeof this.props.onInsert === 'function') {
                    this.props.onInsert();
                }
            }
        },

        render : function () {
            return (
                <div className="buttons">
                    <button className="util-button" type="button"
                            value="insert" onClick={this._buttonClick}>
                    {this.translate('taghelper__insert_btn')}
                    </button>
                    <button type="button" className="util-button cancel"
                            value="reset" onClick={this._buttonClick}>Reset</button>
                </div>
            );
        }
    });

    // ------------------------------ <ValueLine /> ----------------------------

    const ValueLine = React.createClass({

        mixins: mixins,

        _checkboxHandler : function (evt) {
            this.setState({isChecked: !this.state.isChecked});
            dispatcher.dispatch({
                actionType: 'TAGHELPER_CHECKBOX_CHANGED',
                props: {
                    position: this.props.lineIdx,
                    value: this.props.data['id'],
                    checked: evt.target.checked
                }
            });
        },

        componentWillUnmount : function () {
            tagHelperStore.removeChangeListener(this._changeListener);
        },

        getInitialState : function () {
            return {isChecked: this.props.data['selected']};
        },

        render : function () {
            let inputId = 'c_position_' + this.props.lineIdx + '_' + this.props.sublineIdx;
            let label = this.props.data['title'] ?
                        this.props.data['title'] : this.translate('taghelper__unfulfilled');
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
    });

    // ------------------------------ <ValueList /> ----------------------------

    const ValueList = React.createClass({

        mixins: mixins,

        _renderChildren : function () {
            return this.props.positionValues.map((item, i) => item.available
                ? <ValueLine key={i} data={item} lineIdx={this.props.lineIdx} sublineIdx={i}
                                isLocked={this.props.isLocked} />
                : null);
        },

        _hasOnlyUnfulfilledChild : function () {
            return this.props.positionValues.size === 1 && this.props.positionValues.get(0).id === '-';
        },

        _renderUnfulfilledCheckbox : function () {
            return (
                <tr>
                    <td className="checkbox-cell"><input type="checkbox" checked="checked" disabled={true} /></td>
                    <td>{this.translate('taghelper__unfulfilled')}</td>
                </tr>
            );
        },

        render : function () {
            return (
                this.props.positionValues.filter(item => item.available).size > 0 ?
                (
                    <table className="checkbox-list">
                    <tbody>
                        {
                        this._hasOnlyUnfulfilledChild() ?
                        this._renderUnfulfilledCheckbox() : this._renderChildren()
                        }
                    </tbody>
                    </table>
                )
                : null
            );
        }
    });

    // ------------------------------ <PositionLine /> ----------------------------

    const PositionLine = React.createClass({

        mixins: mixins,

        _clickHandler : function () {
            this.props.clickHandler(this.props.lineIdx, this.props.isActive);
        },

        _getAvailableChildren : function () {
            return this.props.position['values'].filter(x=>x.available);
        },

        render : function () {
            let linkClass = 'switch-link';
            if (this.props.isActive) {
                linkClass += ' active';

            } else if (this.props.position['locked']) {
                linkClass += ' used';
            }
            return (
                <li style={{margin: '0px', overflow: 'hidden', clear: 'both'}}>
                    <a className={linkClass} onClick={this._clickHandler}>
                        <span className="pos-num">{this.props.lineIdx + 1})</span> {this.props.position['label']}
                        <span className="status-text">[ {this._getAvailableChildren().size} ]</span>
                    </a>
                    {this.props.isActive ?
                    <ValueList positionValues={this._getAvailableChildren()}
                                isLocked={this.props.position['locked']}
                                lineIdx={this.props.lineIdx} /> : null }
                </li>
            );
        }
    });

    // ------------------------------ <PositionList /> ----------------------------

    const PositionList = React.createClass({

        mixins: mixins,

        _lineClickHandler : function (clickedRow, isActive) {
            this.setState({activeRow: isActive ? null : clickedRow});
        },

        _mkid : function (i) {
            return this.props.stateId + String(i);
        },

        getInitialState : function () {
            return {activeRow: null};
        },

        render : function () {
            return (
                <ul className="multiselect">
                    {this.props.positions.map(
                        (item, i) => <PositionLine key={this._mkid(i)} position={item}
                                                    lineIdx={i} clickHandler={this._lineClickHandler}
                                                    isActive={i === this.state.activeRow} />)}
                </ul>
            );
        }
    });

    // ------------------------------ <TagBuilder /> ----------------------------

    const TagBuilder = React.createClass({

        mixins: mixins,

        _changeListener : function (store, action) {
            if (action === 'TAGHELPER_WAITING_FOR_SERVER') {
                const newState = he.cloneState(this.state);
                newState.isWaiting = true;
                this.setState(newState);

            } else if (action === 'TAGHELPER_UPDATED_DATA_CHANGED' ||
                    action === 'TAGHELPER_INITIAL_DATA_RECEIVED') {
                const newState = he.cloneState(this.state);
                newState.isWaiting = false;
                newState.positions = store.getPositions();
                newState.stateId = store.getStateId();
                newState.tagValue = store.exportCurrentPattern();
                this.setState(newState);
            }
        },

        getInitialState: function () {
            return {
                isWaiting: true,
                positions: [],
                stateId: '',
                tagValue: tagHelperStore.exportCurrentPattern()
            }; // state id is used to generate proper React item keys
        },

        componentDidMount : function () {
            tagHelperStore.addChangeListener(this._changeListener);
            dispatcher.dispatch({
                actionType: 'TAGHELPER_GET_INITIAL_DATA',
                props: {}
            });
        },

        componentWillUnmount : function () {
            tagHelperStore.removeChangeListener(this._changeListener);
        },

        componentDidUpdate : function () {

        },

        render : function () {
            return <div>
                <h3>{this.translate('taghelper__create_tag_heading')}</h3>
                {
                    this.state.isWaiting ?
                    <img className="loader" src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                            title={this.translate('global__loading')}
                            alt={this.translate('global__loading')} /> :
                    null
                }
                <div className="tag-header">
                    <TagDisplay tagValue={this.state.tagValue} onEscKey={this.props.onEscKey} />
                    <TagButtons sourceId={this.props.sourceId}
                                onInsert={this.props.onInsert}
                                actionPrefix={this.props.actionPrefix} />
                </div>
                <PositionList positions={this.state.positions}
                                stateId={this.state.stateId} />
            </div>;
        }
    });

    return {
        TagBuilder: TagBuilder
    };
}
