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

import React from 'vendor/react';


export function init(dispatcher, mixins, treeStore) {

    // --------------------------------- <TreeNode /> --------------------------

    const TreeNode = React.createClass({

        mixins : mixins,

        _clickHandler : function () {
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_SET_NODE_STATUS',
                props: {
                    nodeId: this.props.ident
                }
            });
        },

        _getStateImagePath : function () {
            let path = this.props.active ? 'img/collapse.svg' : 'img/expand.svg';
            return this.createStaticUrl(path);
        },

        render : function () {
            return (
                <li className="node">
                    <a onClick={this._clickHandler}>
                        <img className="state-flag" src={this._getStateImagePath()} />
                        {this.props.name}
                    </a>
                    { this.props.active ?
                        <ItemList name={this.props.name} corplist={this.props.corplist} />
                        : null }
                </li>
            );
        }
    });

    // -------------------------------- <TreeLeaf /> -------------------------------

    const TreeLeaf = React.createClass({

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

    const ItemList = React.createClass({

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

    const CorptreeWidget = React.createClass({

        _buttonClickHandler : function () {
            if (!this.state.active) {
                dispatcher.dispatch({
                    actionType: 'TREE_CORPARCH_GET_DATA',
                    props: {}
                });

            } else {
                this.setState({
                    active: !this.state.active,
                    data: this.state.data,
                    currentCorpusIdent: treeStore.getCurrentCorpusIdent()
                });
            }
        },

        _changeListener : function (store, action) {
            this.setState({
                active: true,
                data: store.getData(),
                currentCorpusIdent: treeStore.getCurrentCorpusIdent()
            });
        },

        getInitialState : function () {
            return {
                active: false,
                data: treeStore.getData(),
                currentCorpusIdent: treeStore.getCurrentCorpusIdent()
            };
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
                    <button className="switch util-button" type="button" onClick={this._buttonClickHandler}
                            title={this.state.currentCorpusIdent.name}>
                        {this.state.currentCorpusIdent.id}
                    </button>
                    {this.state.active ? <ItemList htmlClass="corp-tree"
                        corplist={this.state.data['corplist']} /> : null}
                </div>
            );
        }
    });

    // ----------------------- <CorptreePageComponent /> -----------------

    const CorptreePageComponent = React.createClass({

        _changeListener : function (store, action) {
            this.setState({
                data: store.getData(),
                currentCorpusIdent: treeStore.getCurrentCorpusIdent()
            });
        },

        getInitialState : function () {
            return {
                data: null,
                currentCorpusIdent: treeStore.getCurrentCorpusIdent()
            };
        },

        componentDidMount : function () {
            treeStore.addChangeListener(this._changeListener);
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_GET_DATA',
                props: {}
            });
        },

        componentWillUnmount : function () {
            treeStore.removeChangeListener(this._changeListener);
        },

        render : function () {
            return (
                <div className="corp-tree-component">
                    <ItemList htmlClass="corp-tree"
                            corplist={this.state.data ? this.state.data['corplist'] : []} />
                </div>
            );
        }
    });

    return {
        CorptreeWidget: CorptreeWidget,
        CorptreePageComponent: CorptreePageComponent
    };
}
