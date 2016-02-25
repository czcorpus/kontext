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

 define(['vendor/react'], function (React) {

    let lib = {};

    lib.init = function (dispatcher, mixins, tagHelperStore) {

        // ------------------------------ <TagDisplay /> ----------------------------

        let TagDisplay = React.createClass({

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

            render : function () {
                return <div id="tag-display" className="tag-display-box">{this.state.pattern}</div>;
            }
        });

        // ------------------------------ <TagButtons /> ----------------------------

        let TagButtons = React.createClass({

            mixins: mixins,

            _buttonClick : function (evt) {
                if (evt.target.value === 'reset') {
                    dispatcher.dispatch({
                        actionType: 'TAGHELPER_RESET',
                        props: {widgetId:this.props.widgetId}
                    });

                } else if (evt.target.value === 'insert') {
                    dispatcher.dispatch({
                        actionType: 'TAGHELPER_INSERT_TAG',
                        props: {widgetId:this.props.widgetId}
                    });
                }
            },

            render : function () {
                return (
                    <div className="buttons">
                        <button id="insert-tag-button" type="button"
                                value="insert" onClick={this._buttonClick}>
                        {this.translate('taghelper__insert_btn')}
                        </button>
                        <button id="reset-tag-button" type="button"
                                value="reset"  onClick={this._buttonClick}>Reset</button>
                    </div>
                );
            }
        });

        // ------------------------------ <ValueLine /> ----------------------------

        let ValueLine = React.createClass({

            mixins: mixins,

            _checkboxHandler : function (evt) {
                this.setState({isChecked: !this.state.isChecked});
                dispatcher.dispatch({
                    actionType: 'TAGHELPER_CHECKBOX_CHANGED',
                    props: {
                        widgetId: this.props.widgetId,
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

        let ValueList = React.createClass({

            mixins: mixins,

            _renderChildren : function () {
                return this.props.positionValues.map((item, i) => item.available
                    ? <ValueLine key={i} data={item} lineIdx={this.props.lineIdx} sublineIdx={i}
                                 isLocked={this.props.isLocked} widgetId={this.props.widgetId} />
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

        let PositionLine = React.createClass({

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
                                   lineIdx={this.props.lineIdx}
                                   widgetId={this.props.widgetId} /> : null }
                    </li>
                );
            }
        });

        // ------------------------------ <PositionList /> ----------------------------

        let PositionList = React.createClass({

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
                                                        isActive={i === this.state.activeRow}
                                                        widgetId={this.props.widgetId} />)}
                    </ul>
                );
            }
        });

        // ------------------------------ <TagBuilder /> ----------------------------

        let TagBuilder = React.createClass({

            mixins: mixins,

            _changeListener : function (store, action) {
                this.setState(React.addons.update(this.state, {
                    positions: {$set: store.getPositions()},
                    stateId: {$set: store.getStateId()},
                    tagValue: {$set: store.exportCurrentPattern()}
                }));
                if (action === 'TAGHELPER_INSERT_TAG_ACKOWLEDGED' &&
                        typeof this.props.insertCallback === 'function') {
                    this.props.insertCallback(store.exportCurrentPattern());
                }
            },

            getInitialState: function () {
                return {
                    positions: [],
                    stateId: '',
                    tagValue: this.props.initialTagValue
                }; // state id is used to generate proper React item keys
            },

            componentDidMount : function () {
                tagHelperStore.addChangeListener(this._changeListener);
                // we must inform non-react environment (here popupbox.js) we are ready here
                if (typeof this.props.doneCallback === 'function') {
                    this.props.doneCallback();
                }
                dispatcher.dispatch({
                    actionType: 'TAGHELPER_GET_INITIAL_DATA',
                    props: {widgetId: this.props.widgetId}
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
                    <div className="tag-header">
                        <TagDisplay tagValue={this.state.tagValue} />
                        <TagButtons widgetId={this.props.widgetId} />
                    </div>
                    <PositionList positions={this.state.positions}
                                  stateId={this.state.stateId}
                                  widgetId={this.props.widgetId} />
                </div>;
            }
        });

        return {
            TagBuilder: TagBuilder
        }
    };

    return lib;

 });
