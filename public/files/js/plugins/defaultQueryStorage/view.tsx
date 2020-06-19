/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as Immutable from 'immutable';
import { Keyboard } from 'cnc-tskit';
import {Kontext } from '../../types/common';
import { QueryStorageModel, InputBoxHistoryItem } from './models';
import { SetQueryInputAction } from '../../models/query/common';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';


export interface QueryStorageProps {
    sourceId:string;
    actionPrefix:string;
    onCloseTrigger:()=>void;
}


interface QueryStorageState {
    data:Immutable.List<InputBoxHistoryItem>;
    isBusy:boolean;
    currentItem:number;
}


export interface Views {
    QueryStorage:React.ComponentClass<QueryStorageProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, queryStorageModel:QueryStorageModel) {

    const layoutViews = he.getLayoutViews();

    class QueryStorage extends React.Component<QueryStorageProps, QueryStorageState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = {
                data: queryStorageModel.getFlatData(),
                isBusy: queryStorageModel.getIsBusy(),
                currentItem: 0
            };
            this._keyPressHandler = this._keyPressHandler.bind(this);
            this._handleClickSelection = this._handleClickSelection.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleBlurEvent = this._handleBlurEvent.bind(this);
            this._handleFocusEvent = this._handleFocusEvent.bind(this);
        }

        _keyPressHandler(evt) {
            const inc = Number({
                [Keyboard.Code.UP_ARROW]: this.state.data.size - 1,
                [Keyboard.Code.DOWN_ARROW]: 1
            }[evt.keyCode]);
            const modulo = this.state.data.size > 0 ? this.state.data.size : 1;
            if (!isNaN(inc)) {
                this.setState({
                    data: queryStorageModel.getFlatData(),
                    isBusy: queryStorageModel.getIsBusy(),
                    currentItem: (this.state.currentItem + inc) % modulo
                });

            } else if (evt.keyCode === Keyboard.Code.ENTER) {
                const historyItem = this.state.data.get(this.state.currentItem);
                dispatcher.dispatch({
                    name: 'QUERY_INPUT_SELECT_TYPE',
                    payload: {
                        sourceId: this.props.sourceId, // either corpname or filterId
                        queryType: historyItem.query_type
                    }
                });
                dispatcher.dispatch<SetQueryInputAction>({
                    name: 'QUERY_INPUT_SET_QUERY',
                    payload: {
                        sourceId: this.props.sourceId,
                        query: historyItem.query,
                        rawAnchorIdx: null,
                        rawFocusIdx: null,
                        insertRange: null
                    }
                });
                this.props.onCloseTrigger();

            } else {
                this.props.onCloseTrigger();
            }
            evt.preventDefault();
            evt.stopPropagation();
        }

        _handleClickSelection(itemNum) {
            const historyItem = this.state.data.get(itemNum);
            dispatcher.dispatch({
                name: this.props.actionPrefix + 'QUERY_INPUT_SELECT_TYPE',
                payload: {
                    sourceId: this.props.sourceId,
                    queryType: historyItem.query_type
                }
            });
            dispatcher.dispatch<SetQueryInputAction>({
                name: this.props.actionPrefix + 'QUERY_INPUT_SET_QUERY',
                payload: {
                    sourceId: this.props.sourceId,
                    query: historyItem.query,
                    rawAnchorIdx: null,
                    rawFocusIdx: null,
                    insertRange: null
                }
            });
            this.props.onCloseTrigger();
        }

        componentDidMount() {
            this.modelSubscription = queryStorageModel.addListener(this._handleModelChange);
            dispatcher.dispatch({
                name: 'QUERY_STORAGE_LOAD_HISTORY',
                payload: {}
            });
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _handleModelChange() {
            this.setState({
                data: queryStorageModel.getFlatData(),
                isBusy: queryStorageModel.getIsBusy(),
                currentItem: this.state.currentItem
            });
        }

        _handleBlurEvent(evt) {
            this.props.onCloseTrigger();
        }

        _handleFocusEvent(evt) {
        }

        _renderContents() {
            if (this.state.isBusy) {
                return <div style={{padding: '0.4em'}}><layoutViews.AjaxLoaderBarImage /></div>;

            } else {
                return this.state.data.map((item, i) => {
                    return (
                        <li key={i} title={he.formatDate(new Date(item.created * 1000), 1)}
                                className={i === this.state.currentItem ? 'selected' : null}
                                onClick={this._handleClickSelection.bind(this, i)}>
                            <span className="wrapper">
                                <em>
                                    {item.query}
                                </em>
                                {'\u00a0'}
                                <span className="corpname">
                                    ({item.query_type})
                                </span>
                            </span>
                        </li>
                    );
                });
            }
        }

        render() {
            return (
                <ol className="rows"
                        onKeyDown={this._keyPressHandler}
                        tabIndex={0}
                        ref={item => item ? item.focus() : null}
                        onBlur={this._handleBlurEvent}
                        onFocus={this._handleFocusEvent}>
                    {this._renderContents()}
                </ol>
            );
        }
    }

    return {
        QueryStorage: QueryStorage
    };

}