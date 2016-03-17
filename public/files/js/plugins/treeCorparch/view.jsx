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
    'use strict';

    let lib = {};

    lib.init = function (dispatcher, mixins, treeStore) {

        let TreeNode = React.createClass({

            _renderChild : function () {
                return <li>item</li>;
            },

            render : function () {
                return (
                    <ul>
                        {this.props.data.map((item) => this._renderChild(item))}
                    </ul>
                )
            }
        });


        let CorpTree = React.createClass({
            render : function () {
                return (
                    <ul className="corp-tree">
                        <li>fake item 1</li>
                        <li>fake item 2
                            <ul>
                                <li>fake item 2.1</li>
                            </ul>
                        </li>
                    </ul>
                )
            }
        });


        let CorptreeWidget = React.createClass({

            _buttonClickHandler : function () {
                this.setState({active: !this.state.active});
            },

            getInitialState : function () {
                return {active: false};
            },

            render : function () {
                return (
                    <div className="corp-tree-widget">
                        <button className="switch" type="button" onClick={this._buttonClickHandler}>Select corp</button>
                        {this.state.active ? <CorpTree /> : null}
                    </div>
                );
            }
        });


        return {
            CorptreeWidget: CorptreeWidget
        };

    };

    return lib;

});