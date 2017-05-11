/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';
import {init as dataRowsInit} from './dataRows';

export function init(dispatcher, mixins, freqDataRowsStore) {

    const drViews = dataRowsInit(dispatcher, mixins, freqDataRowsStore);

    // ----------------------- <ResultSizeInfo /> -------------------------

    class ResultSizeInfo extends React.Component {

        constructor(props) {
            super(props)
        }

        render () {
            return (
                <p>
                    <strong>{mixins.translate('freq__avail_label')}:</strong>
                    {'\u00a0'}
                    {mixins.translate('freq__avail_items_{num_items}', {num_items: this.props.totalItems})}
                    {'\u00a0'}
                    {this.props.totalPages ?
                        <span>({mixins.translate('freq__avail_pages_{num_pages}', {num_pages: this.props.totalPages})})</span>
                        : null}
                </p>
            );
        }
    }

    // ----------------------- <Paginator /> -------------------------

    class Paginator extends React.Component {

        constructor(props) {
            super(props);
            this._handlePageChange = this._handlePageChange.bind(this);
        }

        _handlePageChangeByClick(curr, step) {
            this.props.setLoadingFlag();
            dispatcher.dispatch({
                actionType: 'FREQ_RESULT_SET_CURRENT_PAGE',
                props: {value: String(Number(curr) + step)}
            });
        }

        _handlePageChange(evt) {
            this.props.setLoadingFlag();
            dispatcher.dispatch({
                actionType: 'FREQ_RESULT_SET_CURRENT_PAGE',
                props: {value: evt.target.value}
            });
        }

        _renderPageNum() {
            if (this.props.isLoading) {
                return (
                    <span className="input-like" style={{width: '3em'}}>
                        <img src={mixins.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={mixins.translate('global__loading')} />
                    </span>
                );

            } else {
                return <input type="text" value={this.props.currentPage}
                                    title={mixins.translate('global__curr_page_num')}
                                    onChange={this._handlePageChange}
                                    disabled={!this.props.hasPrevPage && !this.props.hasNextPage}
                                    style={{width: '3em'}} />;
            }
        }

        render() {
            return (
                <div className="bonito-pagination">
                    <form>
                        <div className="bonito-pagination-core">
                            <div className="bonito-pagination-left">
                                {this.props.hasPrevPage ?
                                    (<a onClick={(e) => this._handlePageChangeByClick(this.props.currentPage, -1)}>
                                        <img className="over-img" src={mixins.createStaticUrl('img/prev-page.svg')}
                                                alt="další" title="další" />
                                    </a>) : null}
                            </div>
                            {this._renderPageNum()}
                            <div className="bonito-pagination-right">
                                {this.props.current}
                                {this.props.hasNextPage ?
                                    (<a onClick={(e) => this._handlePageChangeByClick(this.props.currentPage, 1)}>
                                        <img className="over-img" src={mixins.createStaticUrl('img/next-page.svg')}
                                                alt="další" title="další" />
                                    </a>) : null}
                            </div>
                        </div>
                    </form>
                </div>
            );
        }
    }

    // ----------------------- <FilterForm /> -------------------------

    class FilterForm extends React.Component {

        constructor(props) {
            super(props);
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleApplyClick = this._handleApplyClick.bind(this);
            this.state = {
                minFreqVal: freqDataRowsStore.getMinFreq(),
                currentPage: freqDataRowsStore.getCurrentPage()
            };
        }

        _handleInputChange(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_RESULT_SET_MIN_FREQ_VAL',
                props: {value: evt.target.value}
            });
        }

        _handleApplyClick(evt) {
            this.props.setLoadingFlag();
            dispatcher.dispatch({
                actionType: 'FREQ_RESULT_APPLY_MIN_FREQ',
                props: {}
            });
        }

        render() {
            return (
                <form action="freqs">
                    <label>
                        {mixins.translate('freq__limit_input_label')}:
                        {'\u00a0'}
                        <input type="text" name="flimit" value={this.props.minFreqVal}
                                style={{width: '3em'}}
                                onChange={this._handleInputChange} />
                    </label>
                    {'\u00a0'}
                    <button type="button" className="util-button" onClick={this._handleApplyClick}>
                        {mixins.translate('global__apply_btn')}
                    </button>
                </form>
            );
        }
    }

    // ----------------------- <FreqResultView /> -------------------------

    class FreqResultView extends React.Component {

        constructor(props) {
            super(props);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._setLoadingFlag = this._setLoadingFlag.bind(this);
            this.state = this._fetchState();
        }

        _fetchState() {
            return {
                blocks: freqDataRowsStore.getBlocks(),
                minFreqVal: freqDataRowsStore.getMinFreq(),
                currentPage: freqDataRowsStore.getCurrentPage(),
                sortColumn: freqDataRowsStore.getSortColumn(),
                hasNextPage: freqDataRowsStore.hasNextPage(),
                hasPrevPage: freqDataRowsStore.hasPrevPage(),
                isLoading: false
            };
        }

        _handleStoreChange(evt) {
            this.setState(this._fetchState());
        }

        componentDidMount() {
            freqDataRowsStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            freqDataRowsStore.removeChangeListener(this._handleStoreChange);
        }

        _setLoadingFlag() {
            const v = this._fetchState();
            v.isLoading = true;
            this.setState(v);
        }

        render() {
            return (
                <div>
                    {this.state.currentPage !== null ?
                        <Paginator currentPage={this.state.currentPage}
                            hasNextPage={this.state.hasNextPage} hasPrevPage={this.state.hasPrevPage}
                            setLoadingFlag={this._setLoadingFlag}
                            isLoading={this.state.isLoading} /> : null}
                    <div className="freq-blocks">
                        <FilterForm minFreqVal={this.state.minFreqVal} setLoadingFlag={this._setLoadingFlag} />
                        {this.state.blocks.map((block, i) => {
                            return (
                                <div key={`block-${i}`}>
                                    <hr />
                                    <ResultSizeInfo totalPages={block.TotalPages} totalItems={block.Total} />
                                    <drViews.DataTable head={block.Head}
                                            sortColumn={this.state.sortColumn}
                                            rows={block.Items}
                                            setLoadingFlag={this._setLoadingFlag} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
    }

    return {
        FreqResultView: FreqResultView
    };
}