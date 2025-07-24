/*
 * Copyright (c) 2016 Department of Linguistics
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
import * as Kontext from '../../types/kontext.js';
import { TreeWidgetModel, TreeWidgetModelState } from './init.js';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Actions, Corplist, itemIsCorplist } from './common.js';
import { List } from 'cnc-tskit';

import * as S from './style.js';

export interface CorptreeWidgetProps {
    widgetId:string;
}


export interface CorptreePageComponentProps {

}


export interface Views {
    CorptreeWidget:React.ComponentClass<CorptreeWidgetProps, TreeWidgetModelState>;
    CorptreePageComponent:React.ComponentClass<CorptreePageComponentProps, TreeWidgetModelState>;
    FilterPageComponent:React.FC<{}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        treeModel:TreeWidgetModel):Views {

    // --------------------------------- <TreeNode /> --------------------------

    const TreeNode:React.FC<{
        name:string;
        ident:string;
        nodeActive:{[key:string]:boolean};
        corplist:Corplist;

    }> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch<typeof Actions.SetNodeStatus>({
                name: Actions.SetNodeStatus.name,
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

    const TreeLeaf:React.FC<{
        ident:string;
        name:string;

    }> = (props) => {

        const clickHandler = () => {
            dispatcher.dispatch<typeof Actions.LeafNodeClicked>({
                name: Actions.LeafNodeClicked.name,
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

    const ItemList:React.FC<{
        htmlClass?:string;
        name?:string;
        corplist:Corplist;
        nodeActive:{[key:string]:boolean};

    }> = (props) => {

        const renderChildren = () => {
            return List.map((item, i) => {
                if (itemIsCorplist(item)) {
                    return <TreeNode key={i} name={item.name} ident={item.ident}
                                        corplist={item} nodeActive={props.nodeActive}
                            />;

                } else {
                    return <TreeLeaf key={i} name={item.name} ident={item.id} />;
                }
            }, props.corplist.corplist);
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
                dispatcher.dispatch<typeof Actions.GetData>({name: Actions.GetData.name});

            } else {
                dispatcher.dispatch<typeof Actions.Deactivate>({name: Actions.Deactivate.name});
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
                        corplist={this.props.data} nodeActive={this.props.nodeActive} /> : null}
                </S.CorpTreeWidget>
            );
        }
    }

    // ----------------------- <CorptreePageComponent /> -----------------

    class CorptreePageComponent extends React.Component<CorptreePageComponentProps & TreeWidgetModelState> {

        componentDidMount() {
            dispatcher.dispatch<typeof Actions.GetData>({name: Actions.GetData.name});
        }

        render() {
            return (
                <S.CorpTreeComponent>
                    <ItemList htmlClass="corp-tree"
                            corplist={this.props.data}
                            nodeActive={this.props.nodeActive}
                    />
                </S.CorpTreeComponent>
            );
        }
    }

    const FilterPageComponent:React.FC<{}> = (props) => {
        return <span />;
    }

    return {
        CorptreeWidget: BoundWithProps<CorptreeWidgetProps, TreeWidgetModelState>(CorptreeWidget, treeModel),
        CorptreePageComponent: BoundWithProps<CorptreePageComponentProps, TreeWidgetModelState>(CorptreePageComponent, treeModel),
        FilterPageComponent: FilterPageComponent
    };
}
