/*
 * Copyright (c) 2016 Charles University, Faculty of Mathematics and Physics,
 *                    Institute of Formal and Applied Linguistics
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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
import {Kontext} from '../../types/common';
import {TreeWidgetModel, Node} from './model';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';


export interface Views {
    CorptreeWidget:React.ComponentClass<{}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        treeModel:TreeWidgetModel):Views {


        // --------------------------------- <WidgetTreeNode /> --------------------------

    class WidgetTreeNode extends React.PureComponent<{
        ident:string;
        active:boolean;
        name:string;
        permitted:boolean;
        corplist:Array<Node>;

    }> {


        constructor(props) {
            super(props);
            this._clickHandler = this._clickHandler.bind(this);
        }

        _clickHandler() {
            dispatcher.dispatch({
                name: 'TREE_CORPARCH_SET_NODE_STATUS',
                payload: {
                    nodeId: this.props.ident
                }
            });
        }

        _getStateImagePath() {
            return he.createStaticUrl(this.props.active ? 'img/collapse.svg' : 'img/expand.svg');
        }

        render() {
            return (
                <li className="node">
                    <a onClick={this._clickHandler}>
                        <img className="state-flag" src={this._getStateImagePath()} />
                        {this.props.name}
                    </a>
                    { this.props.active ?
                        <WidgetItemList name={this.props.name}
                                        corplist={this.props.corplist} />
                        : null }
                </li>
            );
        }
    }

    // -------------------------------- <WidgetTreeLeaf /> -------------------------------

    const WidgetTreeLeaf:React.SFC<{
        ident:string;
        name:string;
        permitted:boolean;

    }> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch({
                name: 'TREE_CORPARCH_LEAF_NODE_CLICKED',
                payload: {
                    ident: props.ident
                }
            });
        };

        const getLock = () => {
            return he.createStaticUrl('img/locked.svg');
        };

        if (!props.permitted) {
            return <li className="leaf"><a onClick={clickHandler} style={{color:"gray"}}>
                    <img className="lock-sign" src={getLock()} />
                    {props.name}</a></li>;
        }
        else {
            return <li className="leaf"><a onClick={clickHandler}>{props.name}</a></li>;
        }
    };

    // -------------------------------- <WidgetItemList /> -------------------------------

    const WidgetItemList:React.SFC<{
        name:string;
        htmlClass?:string;
        corplist:Array<Node>;

    }> = (props) => {

        const renderChildren = () => {
            return props.corplist.map((item, i) => {
                if (item.corplist.length > 0) {
                    return <WidgetTreeNode key={i} name={item.name} ident={item.ident}
                                        corplist={item.corplist} active={item.active}
                                        permitted={item.permitted} />;

                } else {
                    return <WidgetTreeLeaf key={i} name={item.name} ident={item.ident}
                                            permitted={item.permitted} />;
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

    class CorptreeWidget extends React.Component<{
    }, {
        active:boolean,
        data:Node,
        currentCorpus:Kontext.FullCorpusIdent;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = {
                active: false,
                data: treeModel.getData(),
                currentCorpus: treeModel.getCorpusIdent()
            };
            this._buttonClickHandler = this._buttonClickHandler.bind(this);
            this._changeListener = this._changeListener.bind(this);
        }

        _buttonClickHandler() {
            if (!this.state.active && this.state.data.size === 0) {
                dispatcher.dispatch({
                    name: 'TREE_CORPARCH_GET_DATA',
                    payload: {}
                });

            } else {
                this.setState({active: !this.state.active, data: this.state.data});
            }
        }

        _changeListener() {
            this.setState({
                active: true,
                data: treeModel.getData(),
                currentCorpus: treeModel.getCorpusIdent()
            });
        }

        componentDidMount() {
            this.modelSubscription = treeModel.addListener(this._changeListener);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div className="corp-tree-widget">
                    <button className="switch" type="button" onClick={this._buttonClickHandler}>
                        {this.state.currentCorpus.name}
                    </button>
                    <input type="hidden" name="corpname" value={this.state.currentCorpus.id} />
                    {this.state.active ?
                            <WidgetItemList
                                htmlClass="corp-tree"
                                name=""
                                corplist={this.state.data.corplist} /> :
                            null
                    }
                </div>
            );
        }
    }

    return {
        CorptreeWidget: CorptreeWidget
    };

}