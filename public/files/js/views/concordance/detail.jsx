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

    let RefLine = React.createClass({

        _renderCols : function () {
            let ans = [];
            let item = this.props.colGroups;

            if (item[0]) {
                ans.push(<th key="c1">{item[0].name}</th>);
                ans.push(<td key="c2" className="data">{item[0].val}</td>);

            } else {
                ans.push(<th key="c1" />);
                ans.push(<td key="c2" />);
            }
            if (item[1]) {
                ans.push(<th key="c3">{item[1].name}</th>);
                ans.push(<td key="c4" className="data">{item[1].val}</td>);

            } else {
                ans.push(<th key="c3" />);
                ans.push(<td key="c4" />);
            }
            return ans;
        },

        render : function () {
            return <tr>{this._renderCols()}</tr>;
        }
    });

    let RefDetail = React.createClass({

        componentDidMount : function () {
            if (typeof this.props.onReady === 'function') {
                this.props.onReady();
            }
        },

        render: function () {
            return (
                <table className="full-ref">
                    <tbody>
                        {this.props.data.map(
                            (item, i) => <RefLine key={i} colGroups={item} />)
                        }
                    </tbody>
                </table>
            );
        }
    });

    return {
        RefDetail: RefDetail
    };
}