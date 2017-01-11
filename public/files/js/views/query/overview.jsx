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

export function init(dispatcher, mixins, layoutViews, QueryFormView, FilterFormView, SortFormView, queryReplayStore) {

    // ------------------------ <QueryReplayView /> --------------------------------

    const QueryReplayView = React.createClass({

        mixins : mixins,

        _handleCloseClick : function () {
            // TODO
            console.log('close click ...');
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                    <layoutViews.PopupBox customClass="query-replay-box" onCloseClick={this._handleCloseClick}>
                        <div>
                            <h3>Replaying the query...</h3>
                            <img src={this.createStaticUrl('img/ajax-loader-bar.gif')} alt={this.translate('global__loading')} />
                            <div>...</div>
                        </div>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // ------------------------ <CorpnameInfo /> --------------------------------

    const CorpnameInfo = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <li id="active-corpus">
                    <strong>{this.translate('global__corpus')}:{'\u00a0'}</strong>
                    <a id="corpus-desc-link" className="corpus-desc" title="$_('click for details')">
                        {this.props.humanCorpname}
                    </a>
                    {this.props.usesubcorp ? (
                        <a className="subcorpus" title={this.translate('global__subcorpus')}>
                        {this.props.usesubcorp}
                    </a>) : null}
                </li>
            );
        }
    });

    // ------------------------ <QueryEditor /> --------------------------------

    const QueryEditor = React.createClass({
        /*
            query codes:
            q: Query
            a: Query
            r: Random sample
            s: Sort
            f: Shuffle
            n: Negative filter
            N: Negative filter (excluding KWIC)
            p: Positive filter
            P: Positive filter (excluding KWIC)
            x: Switch KWIC
        */

        mixins : mixins,

        _renderEditorComponent : function () {
            if (this.props.isLoading) {
                return <img src={this.createStaticUrl('img/ajax-loader-bar.gif')} alt={this.translate('global__loading')} />;

            } else if (this.props.operationIdx === 0) {
                return <QueryFormView {...this.props.editorProps} operationIdx={this.props.operationIdx} />;

            } else if (['n', 'N', 'p', 'P'].indexOf(this.props.operationId) > -1) {
                return <FilterFormView {...this.props.editorProps}
                            operationIdx={this.props.operationIdx}
                            filterId={this.props.opKey} />;

            } else {
                return <SortFormView />;
            }
        },

        _getContextTitle : function (opId) {
            const isOperation = (...values) => values.indexOf(opId) > -1;
            if (isOperation('a', 'q')) {
                return this.translate('query__operation_name_query');

            } else if (isOperation('n', 'N', 'p', 'P')) {
                return this.translate('query__operation_name_filter');

            } else if (isOperation('s')) {
                return this.translate('query__operation_name_sort');

            } else if (isOperation('f')) {
                return this.translate('query__operation_name_shuffle');

            } else if (isOperation('r')) {
                return this.translate('query__operation_name_sample');
            }
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.PopupBox customClass="query-form-lite"
                            onCloseClick={this.props.closeClickHandler}>
                        <h3>
                            {this.translate('query__edit_current_hd_{operation}',
                                    {operation: this._getContextTitle(this.props.operationId)})
                            }
                        </h3>
                        {this._renderEditorComponent()}
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });QueryOverview

    // ------------------------ <QueryOpInfo /> --------------------------------

    const QueryOpInfo = React.createClass({

        mixins : mixins,

        _renderLabel : function () {
            if (this.props.idx === 0) {
                return [
                    '\u00a0|\u00a0',
                    <strong key="op">{this.props.item.op}</strong>
                ];

            } else {
                return [
                    <span key="transit" className="transition">{'\u00A0\u25B6\u00A0'}</span>,
                    <strong key="op">{this.props.item.op}</strong>
                ];
            }
        },

        render : function () {
            return (
                <li>
                    {this._renderLabel()}{':\u00a0'}
                    {this.props.item.nicearg ?
                        <a className="args" onClick={this.props.clickHandler}>{this.props.item.nicearg}</a>
                        : <a className="args" onClick={this.props.clickHandler}>{'\u2713'}</a>}
                    {this.props.item.size ?
                         '\u00a0(' + this.translate('query__overview_hits_{num_hits}',
                            {num_hits: this.props.item.size}) + ')'
                        : null}
                    {this.props.hasOpenEditor ?
                        <QueryEditor
                            editorProps={this.props.editorProps}
                            closeClickHandler={this.props.closeEditorHandler}
                            operationIdx={this.props.idx}
                            operationId={this.props.item.opid}
                            opKey={this.props.editOpKey}
                            isLoading={this.props.isLoading} />
                        : null}
                </li>
            );
        }
    });


    // ------------------------ <QueryOverview /> --------------------------------

    const QueryOverview = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                replayIsRunning: queryReplayStore.getBranchReplayIsRunning(),
                ops: queryReplayStore.getCurrEncodedOperations(),
                editOpIdx: null,
                editOpKey: null,
                isLoading: false
            };
        },

        _handleEditClick : function (idx) {
            dispatcher.dispatch({
                actionType: 'EDIT_QUERY_OPERATION',
                props: {operationIdx: idx}
            });
            this.setState({
                replayIsRunning: queryReplayStore.getBranchReplayIsRunning(),
                ops: queryReplayStore.getCurrEncodedOperations(),
                editOpIdx: idx,
                editOpKey: null, // we don't know the key here yet
                isLoading: true
            });
        },

        _handleEditorClose : function () {
            this.setState({
                replayIsRunning: queryReplayStore.getBranchReplayIsRunning(),
                ops: queryReplayStore.getCurrEncodedOperations(),
                editOpIdx: null,
                editOpKey: null,
                isLoading: false
            });
        },

        _storeChangeListener : function (store, action) {
            this.setState({
                replayIsRunning: queryReplayStore.getBranchReplayIsRunning(),
                ops: queryReplayStore.getCurrEncodedOperations(),
                editOpIdx: queryReplayStore.getBranchReplayIsRunning() ? null : this.state.editOpIdx,
                editOpKey: queryReplayStore.opIdxToCachedQueryKey(this.state.editOpIdx),
                isLoading: false
            });
        },

        componentDidMount : function () {
            queryReplayStore.addChangeListener(this._storeChangeListener);
        },

        componentWillUnmount : function () {
            queryReplayStore.removeChangeListener(this._storeChangeListener);
        },

        _getEditorProps : function (opId) {
            if (['a', 'q'].indexOf(opId) > -1) {
                return this.props.queryFormProps;

            } else if (['p', 'P', 'n', 'N'].indexOf(opId) > -1) {
                return this.props.filterFormProps;

            } else { // TODO
                return {}; // TODO
            }
        },

        render : function () {
            return (
                <div>
                    {this.state.replayIsRunning ? <QueryReplayView /> : null}

                    <ul id="query-overview-bar">
                        {this.props.humanCorpname ?
                                <CorpnameInfo humanCorpname={this.props.humanCorpname}
                                        usesubcorp={this.props.usesubcorp} />
                                : null}
                        {this.state.ops.map((item, i) => {
                            return <QueryOpInfo
                                    key={`op_${i}`}
                                    idx={i}
                                    editOpKey={this.state.editOpKey}
                                    item={item}
                                    clickHandler={this._handleEditClick.bind(this, i)}
                                    hasOpenEditor={this.state.editOpIdx === i && !this.state.replayIsRunning}
                                    editorProps={this.state.editOpIdx === i ? this._getEditorProps(item.opid) : null}
                                    closeEditorHandler={this._handleEditorClose}
                                    isLoading={this.state.isLoading} />;
                        })}
                    </ul>
                </div>
            );
        }
    });


    return {
        QueryOverview: QueryOverview
    };
}