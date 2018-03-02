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

import * as React from 'react';


export function init(dispatcher, he, treeModel) {

    // --------------------------------- <TreeNode /> --------------------------

    const TreeNode = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_SET_NODE_STATUS',
                props: {
                    nodeId: props.ident
                }
            });
        };

        const getStateImagePath = () => {
            return he.createStaticUrl(props.active ? 'img/collapse.svg' : 'img/expand.svg');
        };

        return (
            <li className="node">
                <a onClick={clickHandler}>
                    <img className="state-flag" src={getStateImagePath()} />
                    {props.name}
                </a>
                {props.active ?
                    <ItemList name={props.name} corplist={props.corplist} />
                    : null }
            </li>
        );
    };

    // -------------------------------- <TreeLeaf /> -------------------------------

    const TreeLeaf = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_LEAF_NODE_CLICKED',
                props: {
                    ident: props.ident
                }
            });
        };

        return (
            <li className="leaf">
                <a onClick={clickHandler}>
                    {props.name}
                </a>
            </li>
        );
    };

    // -------------------------------- <ItemList /> -------------------------------

    const ItemList = (props) => {

        const renderChildren = () => {
            return props.corplist.map((item, i) => {
                if (item['corplist'].size > 0) {
                    return <TreeNode key={i} name={item['name']} ident={item['ident']}
                                        corplist={item['corplist']} active={item['active']} />;

                } else {
                    return <TreeLeaf key={i} name={item['name']} ident={item['ident']} />;
                }
            });
        };

        return (
            <ul className={props.htmlClass}>
                {renderChildren()}
            </ul>
        );
    };

    // -------------------------------- <CorptreeWidget /> -------------------------------

    class CorptreeWidget extends React.Component {

        constructor(props) {
            super(props);
            this._buttonClickHandler = this._buttonClickHandler.bind(this);
            this._changeListener = this._changeListener.bind(this);
            this.state = {
                active: false,
                data: treeModel.getData(),
                currentCorpusIdent: treeModel.getCurrentCorpusIdent()
            };
        }

        _buttonClickHandler() {
            if (!this.state.active) {
                dispatcher.dispatch({
                    actionType: 'TREE_CORPARCH_GET_DATA',
                    props: {}
                });

            } else {
                this.setState({
                    active: !this.state.active,
                    data: this.state.data,
                    currentCorpusIdent: treeModel.getCurrentCorpusIdent()
                });
            }
        }

        _changeListener(model, action) {
            this.setState({
                active: true,
                data: model.getData(),
                currentCorpusIdent: treeModel.getCurrentCorpusIdent()
            });
        }

        componentDidMount() {
            treeModel.addChangeListener(this._changeListener);
        }

        componentWillUnmount() {
            treeModel.removeChangeListener(this._changeListener);
        }

        render() {
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
    }

    // ----------------------- <CorptreePageComponent /> -----------------

    class CorptreePageComponent extends React.Component {

        constructor(props) {
            super(props);
            this._changeListener = this._changeListener.bind(this);
            this.state = {
                data: null,
                currentCorpusIdent: treeModel.getCurrentCorpusIdent()
            };
        }

        _changeListener(model, action) {
            this.setState({
                data: model.getData(),
                currentCorpusIdent: treeModel.getCurrentCorpusIdent()
            });
        }

        componentDidMount() {
            treeModel.addChangeListener(this._changeListener);
            dispatcher.dispatch({
                actionType: 'TREE_CORPARCH_GET_DATA',
                props: {}
            });
        }

        componentWillUnmount() {
            treeModel.removeChangeListener(this._changeListener);
        }

        render() {
            return (
                <div className="corp-tree-component">
                    <ItemList htmlClass="corp-tree"
                            corplist={this.state.data ? this.state.data['corplist'] : []} />
                </div>
            );
        }
    }

    const FilterPageComponent = (props) => {
        return <span />;
    }

    return {
        CorptreeWidget: CorptreeWidget,
        CorptreePageComponent: CorptreePageComponent,
        FilterPageComponent: FilterPageComponent
    };
}
