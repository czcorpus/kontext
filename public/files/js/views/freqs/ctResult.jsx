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
import {calcTextColorFromBg, importColor, color2str} from '../../util';


export function init(dispatcher, mixins, ctFreqDataRowsStore) {

    /**
     *
     */
    class CTFreqResultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchState();
            this._heatmap = [
                '#fff7f3', '#fde0dd', '#fcc5c0',
                '#fa9fb5', '#f768a1', '#dd3497',
                '#ae017e', '#7a0177', '#49006a'
            ];
        }

        _fetchState() {
            return {
                d1Labels: ctFreqDataRowsStore.getD1Labels(),
                d2Labels: ctFreqDataRowsStore.getD2Labels(),
                data: ctFreqDataRowsStore.getData(),
                colorStepFn: ctFreqDataRowsStore.getColorStepFn(),
                attr1: ctFreqDataRowsStore.getAttr1(),
                attr2: ctFreqDataRowsStore.getAttr2()
            };
        }

        _calcColor(v) {
            return this._heatmap[this.state.colorStepFn(v)];
        }

        render() {
            return (
                <div className="CTFreqResultView">
                    <table>
                        <tbody>
                            <tr>
                                <th className="attr-label">
                                    {this.state.attr1} {'\u005C'} {this.state.attr2}
                                </th>
                                {this.state.d2Labels.map((label2, i) => <th key={`lab-${i}`} >{label2}</th>)}
                            </tr>
                            {this.state.d1Labels.map((label1, i) => {
                                return (
                                    <tr key={`row-${i}`}>
                                        <th className="vert">{label1}</th>
                                        {this.state.d2Labels.map((label2, j) => {
                                            const v = this.state.data[label1][label2];
                                            const bgColor = this._calcColor(v);
                                            const style = {
                                                color: color2str(calcTextColorFromBg(importColor(bgColor, 1))),
                                                backgroundColor: bgColor
                                            };
                                            return <td key={`c-${i}:${j}`} className="data-cell" style={style}>{v}</td>;
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    return {
        CTFreqResultView: CTFreqResultView
    };

}
