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
import {Kontext} from '../../types/common';
import {TreeWidgetModel, Node} from './init';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';
import { ActionName, Actions } from './actions';

export interface CorptreeWidgetProps {

}


export interface CorptreePageComponentProps {

}


export interface Views {
    CorptreeWidget:React.ComponentClass<CorptreeWidgetProps>;
    CorptreePageComponent:React.ComponentClass<CorptreePageComponentProps>;
    FilterPageComponent:React.SFC<{}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        treeModel:TreeWidgetModel):Views {

    // --------------------------------- <TreeNode /> --------------------------

    const TreeNode:React.SFC<{
        name:string;
        ident:string;
        active:boolean;
        corplist:Node;

    }> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch<Actions.SetNodeStatus>({
                name: ActionName.SetNodeStatus,
                payload: {
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
            dispatcher.dispatch<Actions.LeafNodeClicked>({
                name: ActionName.LeafNodeClicked,
                payload: {
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

    class CorptreeWidget extends React.Component<CorptreeWidget, {
        active:boolean;
        data:Node;
        currentCorpusIdent:Kontext.FullCorpusIdent;
    }> {

        private modelSubscription:Subscription;

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
                dispatcher.dispatch<Actions.GetData>({name: ActionName.GetData});

            } else {
                this.setState({
                    active: !this.state.active,
                    data: this.state.data,
                    currentCorpusIdent: treeModel.getCurrentCorpusIdent()
                });
            }
        }

        _changeListener() {
            this.setState({
                active: true,
                data: treeModel.getData(),
                currentCorpusIdent: treeModel.getCurrentCorpusIdent()
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

    class CorptreePageComponent extends React.Component<CorptreePageComponentProps, {
        data:Node;
        currentCorpusIdent:Kontext.FullCorpusIdent;

    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._changeListener = this._changeListener.bind(this);
            this.state = {
                data: null,
                currentCorpusIdent: treeModel.getCurrentCorpusIdent()
            };
        }

        _changeListener() {
            this.setState({
                data: treeModel.getData(),
                currentCorpusIdent: treeModel.getCurrentCorpusIdent()
            });
        }

        componentDidMount() {
            this.modelSubscription = treeModel.addListener(this._changeListener);
            dispatcher.dispatch<Actions.GetData>({name: ActionName.GetData});
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
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
