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
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Keyboard, List, pipe } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext.js';
import { SearchHistoryModel, InputBoxHistoryItem } from '../../../models/searchHistory/index.js';
import { Actions } from '../../../models/searchHistory/actions.js';
import { Actions as QueryActions } from '../../../models/query/actions.js';

import * as S from './style.js';
import { QueryFormType } from '../../../models/query/actions.js';
import { isConcQueryHistoryItem, SearchHistoryModelState } from '../../../models/searchHistory/common.js';


export interface QueryHistoryProps {
    formType:QueryFormType;
    sourceId:string;
    onCloseTrigger:()=>void;
}


export interface Views {
    QueryHistory:React.ComponentClass<QueryHistoryProps>;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    queryHistoryModel:SearchHistoryModel
):React.ComponentClass<QueryHistoryProps> {

    const layoutViews = he.getLayoutViews();

    class QueryHistory extends React.Component<QueryHistoryProps & SearchHistoryModelState> {

        constructor(props) {
            super(props);
            this._keyPressHandler = this._keyPressHandler.bind(this);
            this._handleClickSelection = this._handleClickSelection.bind(this);
            this._handleBlurEvent = this._handleBlurEvent.bind(this);
            this._handleFocusEvent = this._handleFocusEvent.bind(this);
        }

        getFlatData():Array<InputBoxHistoryItem> {
            return pipe(
                this.props.data,
                List.flatMap(v =>
                    [{query: v.query, query_type: v.query_type, created: v.created}]
                    .concat(
                        isConcQueryHistoryItem(v) ?
                        pipe(
                            v.aligned,
                            List.filter(v2 => !!v2.query),
                            List.map(v2 => ({query: v2.query, query_type: v2.query_type, created: v.created}))
                        ): []
                    )
                )
            );
        }

        _keyPressHandler(data, evt) {
            const inc = Number({
                [Keyboard.Value.UP_ARROW]: data.length - 1,
                [Keyboard.Value.DOWN_ARROW]: 1
            }[evt.key]);
            const modulo = data.length > 0 ? data.length : 1;
            if (!isNaN(inc)) {
                dispatcher.dispatch<typeof Actions.SelectItem>({
                    name: Actions.SelectItem.name,
                    payload: {value: (this.props.currentItem + inc) % modulo}
                });

            } else if (evt.key === Keyboard.Value.ENTER) {
                const historyItem = data[this.props.currentItem];
                dispatcher.dispatch<typeof QueryActions.QueryInputSetQType>({
                    name: QueryActions.QueryInputSetQType.name,
                    payload: {
                        sourceId: this.props.sourceId, // either corpname or filterId
                        queryType: historyItem.query_type,
                        formType: this.props.formType
                    }
                });
                dispatcher.dispatch<typeof QueryActions.QueryInputSetQuery>({
                    name: QueryActions.QueryInputSetQuery.name,
                    payload: {
                        formType: this.props.formType,
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

        _handleClickSelection(itemNum, data) {
            const historyItem = data[itemNum];
            dispatcher.dispatch<typeof QueryActions.QueryInputSetQType>({
                name: QueryActions.QueryInputSetQType.name,
                payload: {
                    sourceId: this.props.sourceId,
                    queryType: historyItem.query_type,
                    formType: this.props.formType
                }
            });
            dispatcher.dispatch<typeof QueryActions.QueryInputSetQuery>({
                name: QueryActions.QueryInputSetQuery.name,
                payload: {
                    formType: this.props.formType,
                    sourceId: this.props.sourceId,
                    query: historyItem.query,
                    rawAnchorIdx: null,
                    rawFocusIdx: null,
                    insertRange: null
                }
            });
            this.props.onCloseTrigger();
        }

        _handleBlurEvent(evt) {
            this.props.onCloseTrigger();
        }

        _handleFocusEvent(evt) {
        }

        _renderContents(data:Array<InputBoxHistoryItem>) {
            if (this.props.isBusy) {
                return <div style={{padding: '0.4em'}}><layoutViews.AjaxLoaderBarImage /></div>;

            } else {
                return List.map((item, i) => {
                    return (
                        <li key={i} title={he.formatDate(new Date(item.created * 1000), 1)}
                                className={i === this.props.currentItem ? 'selected' : null}
                                onClick={this._handleClickSelection.bind(this, i, data)}>
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
                }, data);
            }
        }

        render() {
            const data = this.getFlatData();
            return (
                <S.QueryHistoryRows
                        onKeyDown={evt => this._keyPressHandler(data, evt)}
                        tabIndex={0}
                        ref={item => item ? item.focus() : null}
                        onBlur={this._handleBlurEvent}
                        onFocus={this._handleFocusEvent}>
                    {this._renderContents(data)}
                </S.QueryHistoryRows>
            );
        }
    }

    return BoundWithProps<QueryHistoryProps, SearchHistoryModelState>(QueryHistory, queryHistoryModel);

}