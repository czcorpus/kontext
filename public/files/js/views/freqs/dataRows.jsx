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

export function init(dispatcher, mixins, freqDataRowsStore) {

    // ----------------------- <DataRowPNFilter /> --------------------------------
    class DataRowPNFilter extends React.Component {

        constructor(props) {
            super(props);
            this._handlePosClick = this._handlePosClick.bind(this);
            this._handleNegClick = this._handleNegClick.bind(this);
        }

        _handlePosClick(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_RESULT_APPLY_QUICK_FILTER',
                props: {
                    args: this.props.pfilter
                }
            });
        }

        _handleNegClick(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_RESULT_APPLY_QUICK_FILTER',
                props: {
                    args: this.props.nfilter
                }
            });
        }

        _hasSomeFilter() {
            return this.props.pfilter.size + this.props.nfilter.size > 0;
        }

        render() {
            if (this._hasSomeFilter()) {
                return (
                    <td>
                        {this.props.pfilter.size > 0 ? <a onClick={this._handlePosClick}>p</a> :
                                <span title={mixins.translate('freq__neg_filter_disabled')}>p</span>}
                        {'\u00a0/\u00a0'}
                        {this.props.nfilter.size > 0 ? <a onClick={this._handleNegClick}>n</a> :
                                <span title={mixins.translate('freq__neg_filter_disabled')}>n</span>}
                    </td>
                );

            } else {
                return <td />;
            }
        }
    }

    // ----------------------- <DataRow /> --------------------------------
    class DataRow extends React.Component {

        constructor(props) {
            super(props);
        }

        render() {
            return (
                <tr>
                    <td className="num">{this.props.data.idx + 1}</td>
                    <DataRowPNFilter pfilter={this.props.data.pfilter} nfilter={this.props.data.nfilter} />
                    {this.props.data.Word.map((w, i) => <td key={i}>{w}</td>)}
                    <td className="num">{this.props.data.freq}</td>
                    <td className="num">{this.props.data.rel}</td>
                    <td>
                        <div className="bar" style={{height: '10px', width: `${this.props.data.relbar}px`}} />
                    </td>
                </tr>
            );
        }
    }

    // ----------------------- <DataRowNoRel /> --------------------------------
    class DataRowNoRel extends React.Component {

        constructor(props) {
            super(props);
        }

        render() {
            return (
                <tr>
                    <td className="num">{this.props.data.idx + 1}</td>
                    <DataRowPNFilter pfilter={this.props.data.pfilter} nfilter={this.props.data.nfilter} />
                    {this.props.data.Word.map((w, i) => <td key={i}>{w}</td>)}
                    <td className="num">{this.props.data.freq}</td>
                    <td>
                        <div className="bar" style={{height: '10px', width: `${this.props.data.fbar}px`}} />
                    </td>
                </tr>
            );
        }
    }

    /**
     *  ----------------------- <TableColHead /> --------------------------------
     */
    class TableColHead extends React.Component {

        constructor(props) {
            super(props);
            this._handleClick = this._handleClick.bind(this);
        }

        _handleClick() {
            this.props.setLoadingFlag();
            dispatcher.dispatch({
                actionType: 'FREQ_RESULT_SORT_BY_COLUMN',
                props: {
                    value: this.props.data.s
                }
            });
        }

        _renderSortingIcon() {
            if (this.props.sortColumn === this.props.data.s) {
                return (
                    <span title={mixins.translate('global__sorted')}>
                         {this.props.data.n}
                        <img className="sort-flag" src={mixins.createStaticUrl('img/sort_desc.svg')} />
                    </span>
                )

            } else {
                return (
                    <a onClick={this._handleClick} title={mixins.translate('global__click_to_sort')}>
                         {this.props.data.n}
                    </a>
                );
            }
        }

        render() {
            return (
                <th key={this.props.data.n}
                        title={this.props.data.title || ''}>
                    {this._renderSortingIcon()}
                </th>
            );

        }
    }

    /**
     * ----------------------- <DataTable /> --------------------------------
     */
    class DataTable extends React.Component {

        constructor(props) {
            super(props);
        }

        _getBarChartTitle() {
            if (this.props.head.size > 0) {
                return this.props.head.get(-1).title || '';
            }
            return '';
        }

        _renderRows() {
            if (this.props.rows.size === 0 || this.props.rows.get(0).relbar) {
                return this.props.rows.map(item => {
                    return <DataRow key={item.idx} data={item} />;
                });

            } else {
                return this.props.rows.map(item => {
                    return <DataRowNoRel key={item.idx} data={item} />;
                });
            }
        }

        render() {
            return (
                <table className="data">
                    <tbody>
                        <tr>
                            <th />
                            <th>Filter</th>
                            {this.props.head.map(item => <TableColHead key={item.n} sortColumn={this.props.sortColumn}
                                        data={item} setLoadingFlag={this.props.setLoadingFlag} />)}
                            <th title={this._getBarChartTitle()} />
                        </tr>
                        {this._renderRows()}
                    </tbody>
                </table>
            );
        }
    }


    return {
        DataTable: DataTable
    };
}