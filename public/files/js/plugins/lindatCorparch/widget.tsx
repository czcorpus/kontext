/*
 * Copyright (c) 2016 Charles University, Faculty of Mathematics and Physics,
 *                    Institute of Formal and Applied Linguistics
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { TreeWidgetModel, Node } from './model.js';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';

import * as S from './style.js';


export interface Views {
    CorptreeWidget:React.FC<{widgetId:string}>;
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

    const WidgetTreeLeaf:React.FC<{
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

    const WidgetItemList:React.FC<{
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

    const CorptreeWidget:React.FC<{
        widgetId:string;
    }> = (props) => {

        const [state, setState] = React.useState<
        {
            active:boolean,
            data:Node,
            currentCorpus:Kontext.FullCorpusIdent;
        }>({
            active: false,
            data: treeModel.getData(),
            currentCorpus: treeModel.getCorpusIdent()
        });

        const _changeListener = () => {
            setState({
                active: true,
                data: treeModel.getData(),
                currentCorpus: treeModel.getCorpusIdent()
            });
        }

        React.useEffect(
            () => {
                const subscription = treeModel.addListener(_changeListener);
                return () => {
                    subscription.unsubscribe();
                }
            },
            []
        )

        const _buttonClickHandler = () => {
            if (!state.active && state.data.size === 0) {
                dispatcher.dispatch({
                    name: 'TREE_CORPARCH_GET_DATA',
                    payload: {}
                });

            } else {
                setState({active: !state.active, data: state.data, currentCorpus: state.currentCorpus});
            }
        }

        return (
            <S.CorpTreeWidget>
                <button className="switch" type="button" onClick={_buttonClickHandler}>
                    {state.currentCorpus.name}
                </button>
                <input type="hidden" name="corpname" value={state.currentCorpus.id} />
                {state.active ?
                        <WidgetItemList
                            htmlClass="corp-tree"
                            name=""
                            corplist={state.data.corplist} /> :
                        null
                }
            </S.CorpTreeWidget>
        );
    }

    return {
        CorptreeWidget
    };

}