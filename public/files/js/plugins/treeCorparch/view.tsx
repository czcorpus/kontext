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
import {TreeWidgetModel, Node, TreeWidgetModelState} from './init';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { ActionName, Actions } from './actions';
import { List } from 'cnc-tskit';

import * as S from './style';

export interface CorptreeWidgetProps {

}


export interface CorptreePageComponentProps {

}


export interface Views {
    CorptreeWidget:React.ComponentClass<CorptreeWidgetProps, TreeWidgetModelState>;
    CorptreePageComponent:React.ComponentClass<CorptreePageComponentProps, TreeWidgetModelState>;
    FilterPageComponent:React.SFC<{}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        treeModel:TreeWidgetModel):Views {

    // --------------------------------- <TreeNode /> --------------------------

    const TreeNode:React.SFC<{
        name:string;
        ident:string;
        nodeActive:{[key:string]:boolean};
        corplist:Array<Node>;

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
            return he.createStaticUrl(props.nodeActive[props.ident] ? 'img/collapse.svg' : 'img/expand.svg');
        };

        return (
            <li className="node">
                <a onClick={clickHandler}>
                    <img className="state-flag" src={getStateImagePath()} />
                    {props.name}
                </a>
                {props.nodeActive[props.ident] ?
                    <ItemList name={props.name} corplist={props.corplist} nodeActive={props.nodeActive}/>
                    : null }
            </li>
        );
    };

    // -------------------------------- <TreeLeaf /> -------------------------------

    const TreeLeaf:React.SFC<{
        ident:string;
        name:string;

    }> = (props) => {

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

    const ItemList:React.SFC<{
        htmlClass?:string;
        name?:string;
        corplist:Array<Node>;
        nodeActive:{[key:string]:boolean};

    }> = (props) => {

        const renderChildren = () => {
            return List.map((item, i) => {
                if (item.corplist.length > 0) {
                    return <TreeNode key={i} name={item.name} ident={item.ident}
                                        corplist={item.corplist} nodeActive={props.nodeActive}
                            />;

                } else {
                    return <TreeLeaf key={i} name={item.name} ident={item.ident} />;
                }
            }, props.corplist);
        };

        return (
            <ul className={props.htmlClass}>
                {renderChildren()}
            </ul>
        );
    };

    // -------------------------------- <CorptreeWidget /> -------------------------------

    class CorptreeWidget extends React.PureComponent<CorptreeWidgetProps & TreeWidgetModelState> {

        constructor(props) {
            super(props);
            this._buttonClickHandler = this._buttonClickHandler.bind(this);
        }

        _buttonClickHandler() {
            if (!this.props.active) {
                dispatcher.dispatch<Actions.GetData>({name: ActionName.GetData});

            } else {
                dispatcher.dispatch<Actions.Deactivate>({name: ActionName.Deactivate});
            }
        }

        render() {
            return (
                <S.CorpTreeWidget>
                    <button className="switch util-button" type="button" onClick={this._buttonClickHandler}
                            title={this.props.corpusIdent.name}>
                        {this.props.corpusIdent.id}
                    </button>
                    {this.props.active ? <ItemList htmlClass="corp-tree"
                        corplist={this.props.data.corplist} nodeActive={this.props.nodeActive} /> : null}
                </S.CorpTreeWidget>
            );
        }
    }

    // ----------------------- <CorptreePageComponent /> -----------------

    class CorptreePageComponent extends React.Component<CorptreePageComponentProps & TreeWidgetModelState> {

        componentDidMount() {
            dispatcher.dispatch<Actions.GetData>({name: ActionName.GetData});
        }

        render() {
            return (
                <S.CorpTreeComponent>
                    <ItemList htmlClass="corp-tree"
                            corplist={this.props.data ? this.props.data.corplist : []}
                            nodeActive={this.props.nodeActive}
                    />
                </S.CorpTreeComponent>
            );
        }
    }

    const FilterPageComponent:React.SFC<{}> = (props) => {
        return <span />;
    }

    return {
        CorptreeWidget: BoundWithProps<CorptreeWidgetProps, TreeWidgetModelState>(CorptreeWidget, treeModel),
        CorptreePageComponent: BoundWithProps<CorptreeWidgetProps, TreeWidgetModelState>(CorptreePageComponent, treeModel),
        FilterPageComponent: FilterPageComponent
    };
}
