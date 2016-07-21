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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';


export function init(dispatcher, mixins) {

    // --------------------------- <TRHeadingSelector /> -------------------------------

    let TRHeadingSelector = React.createClass({

        mixins : mixins,

        _handleCheckbox : function () {
            this.setState({
                isChecked: !this.state.isChecked
            });
        },

        getInitialState : function () {
            return {
                isChecked: true
            };
        },

        render : function () {
            if (this.props.format === 'csv' || this.props.format === 'xlsx') {
                return (
                    <tr className="separator">
                        <th>{this.translate('wordlist__include_col_headers')}:</th>
                        <td>
                            <input onChange={this._handleCheckbox} type="checkbox" name="colheaders"
                                    value="1" checked={this.state.isChecked} />
                        </td>
                    </tr>
                );

            } else if (this.props.format === 'xml' || this.props.format === 'text') {
                return (
                    <tr className="separator">
                        <th>{this.translate('wordlist__include_heading')}:</th>
                        <td>
                            <input type="checkbox" name="heading" value="1" checked={this.state.isChecked} />
                        </td>
                    </tr>
                );

            } else {
                return null;
            }
        }
    });

    // --------------------------- <SaveWlForm /> -------------------------------

    let SaveWlForm = React.createClass({

        mixins: mixins,

        _handleFormatChange : function (event) {
            this.setState(React.addons.update(this.state,
                {
                    formatType: {$set: event.target.value}
                }
            ));
        },

        _handleMaxLinesChange : function (event) {
            this.setState(React.addons.update(this.state,
                {
                    maxLines: {$set: event.target.value}
                }
            ));
        },

        getInitialState : function () {
            return {
                formatType: 'csv',
                maxLines: '1000'
            };
        },

        _formatIsChecked : function (v) {
            return v === this.state.formatType ? 'checked' : null;
        },

        render : function () {
            return (
                <form action="savewl">
                    {this.props.hiddenInputValues.map(
                        (item, i) => <input key={i} type="hidden" name={item[0]} value={item[1]} />)}

                    <table className="form">
                        <tbody>
                            <tr>
                                <th>
                                {this.translate('wordlist__save_wl_as_header')}
                                </th>
                                <td>
                                <label>
                                    <input onChange={this._handleFormatChange} type="radio" name="saveformat"
                                            value="csv" checked={this._formatIsChecked('csv')} /> CSV
                                </label>
                                <label>
                                    <input onChange={this._handleFormatChange} type="radio" name="saveformat"
                                            value="xlsx" checked={this._formatIsChecked('xlsx')} /> XLSX
                                </label>
                                <label>
                                    <input onChange={this._handleFormatChange} type="radio" name="saveformat"
                                            value="xml" checked={this._formatIsChecked('xml')} /> XML
                                </label>
                                <label>
                                    <input onChange={this._handleFormatChange} type="radio" name="saveformat"
                                            value="text" checked={this._formatIsChecked('text')} /> Text
                                </label>
                                </td>
                            </tr>
                            <TRHeadingSelector format={this.state.formatType} />
                            <tr>
                                <th>{this.translate('wordlist__max_num_lines')}:</th>
                                <td>
                                    <input type="hidden" name="from_line" value="1" size="4" />
                                    <input onChange={this._handleMaxLinesChange} type="text" name="to_line"
                                            value={this.state.maxLines} size="4" />
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="buttons">
                        <input type="submit" id="submit" value={this.translate('wordlist__save_wl_header')} />
                    </div>
                </form>
            );
        }
    });

    return {
        SaveWlForm: SaveWlForm
    };
}