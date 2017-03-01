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

import React from 'vendor/react';
import {init as keyboardInit} from './keyboard';


export function init(dispatcher, mixins, queryStore, virtualKeyboardStore) {

    // -------------------- <Key /> ----------------------------

    const Key = React.createClass({

        _handleClick : function () {
            this.props.handleClick(this.props.value);
        },

        componentDidUpdate : function (prevProps, prevState) {
            if (!prevProps.triggered && this.props.triggered) {
                this._handleClick();
            }
        },

        render : function () {
            const htmlClass = this.props.triggered ? 'active' : null;
            return <button type="button" onClick={this._handleClick} className={htmlClass}>{this.props.value}</button>;
        }
    });

    // -------------------- <DummyKey /> ----------------------------

    const DummyKey = React.createClass({

        render : function () {
            return <span className="dummy">{this.props.value}</span>;
        }
    });

    // -------------------- <ShiftKey /> ----------------------------

    const ShiftKey = React.createClass({

        render : function () {
            const classes = ['spec'];
            if (this.props.shiftOn) {
                classes.push('active');
            }
            return <button type="button" className={classes.join(' ')} onClick={this.props.handleShift}>{'\u21E7'}</button>;
        }
    });

    // -------------------- <SpaceKey /> ----------------------------

    const SpaceKey = React.createClass({

        render : function () {
            return <button type="button" className="space" onClick={this.props.handleClick}>Space</button>;
        }
    });

    // -------------------- <KeysRow /> ----------------------------

    const KeysRow = React.createClass({

        _selectValue : function (v) {
            if (this.props.shiftOn) {
                return v[1];

            } else {
                return v[0];
            }
        },

        _selectKeyType : function (item, i) {
            if (item[0].length > 1) {
                if (item[0] === 'Shift') {
                    return <ShiftKey
                                key={`${item[0]}-${i}`}
                                handleShift={this.props.handleShift}
                                shiftOn={this.props.shiftOn} />;

                } else {
                    return <DummyKey
                                key={`${item[0]}-${i}`}
                                value={this._selectValue(item)} />;
                }

            } else if (item[0] === ' ') {
                return <SpaceKey key="space-k" triggered={i === this.props.passTriggerIdx} />;

            } else {
                return <Key
                            key={item[0]}
                            value={this._selectValue(item)}
                            handleClick={this.props.handleClick}
                            triggered={i === this.props.passTriggerIdx} />;
            }
        },

        render : function () {
            return (
                <div className="key-row">
                {this.props.data.map(this._selectKeyType)}
                </div>
            );
        }

    });

    // -------------------- <Keyboard /> ----------------------------

    const Keyboard = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                shiftOn: false,
                layout: null,
                layoutNames: null,
                currentLayoutIdx: null,
                triggeredKey: null
            };
        },

        _handleClick : function (v) {
            dispatcher.dispatch({
                actionType: this.props.actionPrefix + 'QUERY_INPUT_APPEND_QUERY',
                props: {
                    sourceId: this.props.sourceId,
                    query: v,
                    prependSpace: false,
                    closeWhenDone: false,
                    triggeredKey: this.state.triggeredKey
                }
            });
        },

        _handleShift : function () {
            this.setState({
                shiftOn: !this.state.shiftOn,
                layout: this.state.layout,
                layoutNames: this.state.layoutNames,
                currentLayoutIdx: this.state.currentLayoutIdx,
                triggeredKey: this.state.triggeredKey
            });
        },

        _handleLayoutChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_VIRTUAL_KEYBOARD_LAYOUT',
                props: {idx: evt.target.value}
            });
        },

        _storeChangeListener : function () {
            this.setState({
                shiftOn: this.state.shiftOn,
                layout: virtualKeyboardStore.getCurrentLayout(),
                layoutNames: virtualKeyboardStore.getLayoutNames(),
                currentLayoutIdx: virtualKeyboardStore.getCurrentLayoutIdx(),
                triggeredKey: virtualKeyboardStore.getActiveKey()
            });
        },

        componentDidMount : function () {
            virtualKeyboardStore.addChangeListener(this._storeChangeListener);
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_LOAD_VIRTUAL_KEYBOARD_LAYOUTS',
                props: {
                    inputLanguage: this.props.inputLanguage
                }
            });
        },

        componentWillUnmount : function () {
            virtualKeyboardStore.removeChangeListener(this._storeChangeListener);
        },

        _renderContents : function () {
            return (
                <div>
                    <div className="layout-selection">
                        <h3>{this.translate('query__kb_layout')}:</h3>
                        <select onChange={this._handleLayoutChange} value={this.state.currentLayoutIdx}>
                        {this.state.layoutNames.map((item, i) => {
                            return <option key={i} value={i} title={item[1]}>{item[0]}</option>;
                        })}
                        </select>
                    </div>
                    {this.state.layout.keys.map((item, i) => {
                        const passTriggerIdx =  i === this.state.triggeredKey[0] ? this.state.triggeredKey[1] : null;
                        return <KeysRow key={`row${i}`}
                                    data={item}
                                    handleClick={this._handleClick}
                                    shiftOn={this.state.shiftOn}
                                    handleShift={this._handleShift}
                                    passTriggerIdx={passTriggerIdx} />;
                    })}
                </div>
            );
        },

        render : function () {
            return (
                <div className="virtual-keyboard-buttons">
                    {this.state.layout && this.state.layoutNames ?
                        this._renderContents()
                        : <img src={this.createStaticUrl('img/ajax-loader.gif')} alt={this.translate('global__loading')} />
                    }
                </div>
            );
        }
    });

    return {
        Keyboard: Keyboard
    };
}