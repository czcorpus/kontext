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

        // --------------------------------- <TreeNode /> --------------------------

        let TreeNode = React.createClass({

            mixins : mixins,

            _clickHandler : function () {
                dispatcher.dispatch({
                    actionType: 'TREE_CORPARCH_SET_NODE_STATUS',
                    props: {
                        nodeId: this.props.ident
                    }
                });
            },

            getInitialState : function () {
                return {active: false};
            },

            _getStateImagePath : function () {
                let path = this.props.active ? 'img/collapse.svg' : 'img/expand.svg';
                return this.createStaticUrl(path);
            },

            render : function () {
                return (
                    <li className="node">
                        <img className="state-flag" src={this._getStateImagePath()} />
                        <a onClick={this._clickHandler}>{this.props.name}</a>
                        { this.props.active ?
                            <ItemList name={this.props.name} corplist={this.props.corplist} />
                            : null }
                    </li>
                );
            }
        });

        // -------------------------------- <TreeLeaf /> -------------------------------

        let TreeLeaf = React.createClass({

            _clickHandler : function () {
                dispatcher.dispatch({
                    actionType: 'TREE_CORPARCH_LEAF_NODE_CLICKED',
                    props: {
                        ident: this.props.ident
                    }
                });
            },

            render : function () {
                return <li className="leaf"><a onClick={this._clickHandler}>{this.props.name}</a></li>;
            }
        });

        // -------------------------------- <ItemList /> -------------------------------

        let ItemList = React.createClass({

            _renderChildren : function () {
                return this.props.corplist.map((item, i) => {
                    if (item['corplist'].size > 0) {
                        return <TreeNode key={i} name={item['name']} ident={item['ident']}
                                         corplist={item['corplist']} active={item['active']} />;

                    } else {
                        return <TreeLeaf key={i} name={item['name']} ident={item['ident']} />;
                    }
                });
            },

            render : function () {
                return (
                    <ul className={this.props.htmlClass}>
                        {this._renderChildren()}
                    </ul>
                );
            }
        });

        // -------------------------------- <CorptreeWidget /> -------------------------------

        let CorptreeWidget = React.createClass({

            _buttonClickHandler : function () {
                if (!this.state.active && !this.state.data) {
                    dispatcher.dispatch({
                        actionType: 'TREE_CORPARCH_GET_DATA',
                        props: {}
                    });

                } else {
                    this.setState({active: !this.state.active, data: this.state.data});
                }
            },

            _changeListener : function (store, action) {
                if (action === 'TREE_CORPARCH_DATA_CHANGED') {
                    this.setState({
                        active: true,
                        data: store.getData()
                    });
                }
            },

            getInitialState : function () {
                return {active: false, data: null};
            },

            componentDidMount : function () {
                treeStore.addChangeListener(this._changeListener);
            },

            componentWillUnmount : function () {
                treeStore.removeChangeListener(this._changeListener);
            },

            render : function () {
                return (
                    <div className="corp-tree-widget">
                        <button className="switch" type="button" onClick={this._buttonClickHandler}>{this.props.currentCorpus}</button>
                        {this.state.active ? <ItemList htmlClass="corp-tree"
                            corplist={this.state.data['corplist']} /> : null}
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