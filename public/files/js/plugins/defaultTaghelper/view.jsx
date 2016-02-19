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

        let TagDisplay = React.createClass({

            mixins: mixins,

            render : function () {
                return <div id="tag-display" className="tag-display-box" />;
            }
        });

        let TagButtons = React.createClass({

            mixins: mixins,

            render : function () {
                return
                    <div>
                        <button id="insert-tag-button" type="button">
                        {this.translate('tagbuilder__insert_btn')}
                        </button>
                        <button id="reset-tag-button" type="button">Reset</button>
                    </div>
            }
        });

        let PositionList = React.createClass({

            mixins: mixins,

            render : function () {
                return
                    <ul>
                        <PositionLine />
                    </ul>;
            }
        });

        let PositionLine = React.createClass({

            mixins: mixins,

            render : function () {
                return
                    <li>
                        <a className="switch-link">1 - Part of speech<span className="status-text">[ 12 ]</span></a>
                    </li>;
            }
        });

        let ValueList = React.createClass({

            mixins: mixins,

            render : function () {
                return
                    <table className="checkbox-list">
                        <tbody>
                            <ValueLine />
                        </tbody>
                    </table>;
            }
        });

        let ValueLine = React.createClass({

            mixins: mixins,

            render : function () {
                return
                <tr>
                    <td className="checkbox-cell">
                        <input type="checkbox" id="c_position_0_0" value="N" />
                    </td>
                    <td>
                        <label for="c_position_0_0">N - noun</label>
                    </td>
                </tr>;
            }
        });


        let TagBuilder = React.createClass({

            mixins: mixins,

            _changeListener : function (store) {
                console.log('change detected in TagBuilder component. Src: ', store);
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
                console.log('render');
                return <div>
                    <h3>{this.translate('taghelper__create_tag_heading')}</h3>
                </div>;
            }
        });

        return {
            TagBuilder: TagBuilder
        }
    };

    return lib;

 });
