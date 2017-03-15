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


import React from 'vendor/react';


export function init(dispatcher, mixins) {

    // ------------------- <TRCorpusField /> -----------------------------

    /**
     * Properties:
     * - currentSubcorp
     * - subcorpList
     */
    const TRCorpusField = React.createClass({

        mixins : mixins,

        _handleSubcorpChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'QUERY_INPUT_SELECT_SUBCORP',
                props: {
                    subcorp: evt.target.value
                }
            });
        },

        render : function () {
            return (
                <tr>
                    <th>{this.translate('global__corpus')}:</th>
                    <td>
                        <div id="corparch-mount" />
                        {this.props.subcorpList.size > 0 ?
                            (<span id="subcorp-selector-wrapper">
                                <strong>{'\u00a0'}:{'\u00a0'}</strong>
                                <select id="subcorp-selector" name="usesubcorp" value={this.props.currentSubcorp}
                                        onChange={this._handleSubcorpChange}>
                                    {this.props.subcorpList.map(item => {
                                        return <option key={item.v} value={item.v}>{item.n}</option>;
                                    })}
                                </select>
                            </span>)
                            : null}
                        <div className="starred" />
                    </td>
                </tr>
            );
        }
    });

    return {
        TRCorpusField: TRCorpusField
    };

}