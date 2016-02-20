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

            render : function () {
                return <div id="tag-display" className="tag-display-box" />;
            }
        });

        // ------------------------------ <TagButtons /> ----------------------------

        let TagButtons = React.createClass({

            mixins: mixins,

            render : function () {
                return
                    <div>
                        <button id="insert-tag-button" type="button">
                        {this.translate('taghelper__insert_btn')}
                        </button>
                        <button id="reset-tag-button" type="button">Reset</button>
                    </div>
            }
        });

        // ------------------------------ <ValueLine /> ----------------------------

        let ValueLine = React.createClass({

            mixins: mixins,

            _checkboxHandler : function (evt) {
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

            render : function () {
                let inputId = 'c_position_' + this.props.lineIdx + '_' + this.props.sublineIdx;
                return (
                <tr>
                    <td className="checkbox-cell">
                        <input type="checkbox" id={inputId}
                               value={this.props.data['id']} checked={this.props.data['selected']}
                               onChange={this._checkboxHandler} disabled={this.props.isLocked ? true : false } />
                    </td>
                    <td>
                        <label htmlFor={inputId}>{this.props.data['title']}</label>
                    </td>
                </tr>
                );
            }
        });

        // ------------------------------ <ValueList /> ----------------------------

        let ValueList = React.createClass({

            mixins: mixins,

            render : function () {
                return (
                    <table className="checkbox-list">
                        <tbody>
                            {this.props.positionValues.map((item, i) => item.available
                                    ? <ValueLine key={i} data={item} lineIdx={this.props.lineIdx}
                                                 sublineIdx={i} isLocked={this.props.isLocked} /> : null)}
                        </tbody>
                    </table>
                );
            }
        });

        // ------------------------------ <PositionLine /> ----------------------------

        let PositionLine = React.createClass({

            mixins: mixins,

            _clickHandler : function () {
                this.props.clickHandler(this.props.lineIdx, this.props.isActive);
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
                            {this.props.position['label']}
                            <span className="status-text">{this.props.position['values'].filter(x=>x.available).size}</span>
                        </a>
                        {this.props.isActive ?
                        <ValueList positionValues={this.props.position['values']}
                                   isLocked={this.props.position['locked']}
                                   lineIdx={this.props.lineIdx} /> : null }
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

            getInitialState : function () {
                return {activeRow: null};
            },

            render : function () {
                return (
                    <ul className="multiselect">
                        {this.props.positions.map(
                            (item, i) => <PositionLine key={i} position={item}
                                                        lineIdx={i} clickHandler={this._lineClickHandler}
                                                        isActive={i === this.state.activeRow} />)}
                    </ul>
                );
            }
        });

        // ------------------------------ <TagBuilder /> ----------------------------

        let TagBuilder = React.createClass({

            mixins: mixins,

            _changeListener : function (store, foo) {
                this.setState(React.addons.update(this.state, {positions: {$set: store.getPositions()}}));
            },

            getInitialState: function () {
                return {positions: []};
            },

            componentDidMount : function () {
                tagHelperStore.addChangeListener(this._changeListener);
                // we must inform non-react environment (here popupbox.js) we are ready here
                if (typeof this.props.doneCallback === 'function') {
                    this.props.doneCallback();
                }
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
                    <PositionList positions={this.state.positions} />
                </div>;
            }
        });

        return {
            TagBuilder: TagBuilder
        }
    };

    return lib;

 });
