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

import React from 'vendor/react';


export function init(dispatcher, mixins, queryStorageStore) {

    const QueryStorage = React.createClass({

        mixins : mixins,

        _keyPressHandler : function (evt) {
            const inc = Number({38: this.state.data.size - 1, 40: 1}[evt.keyCode]);
            const modulo = this.state.data.size > 0 ? this.state.data.size : 1;
            if (!isNaN(inc)) {
                this.setState({
                    data: queryStorageStore.getData(),
                    currentItem: (this.state.currentItem + inc) % modulo
                });

            } else if (evt.keyCode === 13) { // ENTER key
                const historyItem = this.state.data.get(this.state.currentItem);
                dispatcher.dispatch({
                    actionType: 'QUERY_INPUT_SELECT_TYPE',
                    props: {
                        corpname: this.props.corpname,
                        queryType: historyItem.query_type
                    }
                });
                dispatcher.dispatch({
                    actionType: 'QUERY_INPUT_SET_QUERY',
                    props: {
                        corpname: this.props.corpname,
                        query: historyItem.query
                    }
                });

            } else if (evt.keyCode === 27) { // ESC key
                this.props.onCloseTrigger();
            }
        },

        _handleClickSelection : function (itemNum) {
            const historyItem = this.state.data.get(itemNum);
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_TYPE',
                props: {
                    corpname: this.props.corpname,
                    queryType: historyItem.query_type
                }
            });
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SET_QUERY',
                props: {
                    corpname: this.props.corpname,
                    query: historyItem.query
                }
            });
        },

        componentDidMount : function () {
            this.addGlobalKeyEventHandler(this._keyPressHandler);
            queryStorageStore.addChangeListener(this._handleStoreChange);
            dispatcher.dispatch({
                actionType: 'QUERY_STORAGE_LOAD_HISTORY',
                props: {}
            });
        },

        componentWillUnmount : function () {
            this.removeGlobalKeyEventHandler(this._keyPressHandler);
            queryStorageStore.removeChangeListener(this._handleStoreChange);
        },

        _handleStoreChange : function () {
            this.setState({
                data: queryStorageStore.getData(),
                currentItem: this.state.currentItem
            });
        },

        getInitialState : function () {
            return {
                data: queryStorageStore.getData(),
                currentItem: 0
            };
        },

        _renderParams : function (qtype, params) {
            const ans = [qtype];
            for (let p in params || {}) {
                if (params.hasOwnProperty(p)) {
                    ans.push(`${p}: ${params[p]}`);
                }
            }
            return ans.join(', ');
        },

        render : function () {
            return (
                <ol className="rows">
                    {this.state.data.map((item, i) => {
                        return (
                            <li key={i} title={item.created} className={i === this.state.currentItem ? 'selected' : null}
                                    onClick={this._handleClickSelection.bind(this, i)}>
                                <span className="wrapper">
                                    <em>
                                        {item.query}
                                    </em>
                                    {'\u00a0'}
                                    <span className="corpname">
                                        ({this._renderParams(item.query_type_translated, item.params)})
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            );
        }
    });


    return {
        QueryStorage: QueryStorage
    };

}