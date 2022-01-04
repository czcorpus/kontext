/*
 * Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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
import * as Kontext from '../types/kontext';
import { Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { LineGroupChartItem } from './lineSelection';


export interface Views {
    LineGroupChart:React.FC<LineGroupChart>;
}

interface LineGroupChart {
    width: number;
    height: number;
    data: Array<LineGroupChartItem>;
}

export function init(he:Kontext.ComponentHelpers):Views {

    const LineGroupChart:React.FC<LineGroupChart> = (props) => {

        const legendFormatter = (value, entry) => {
            return <span style={{color: '#000'}}><b>{value}</b> {100*entry.payload.percent}% ({entry.payload.count}x)</span>;
        };

        return (
            <ResponsiveContainer width={props.width} height={props.height}>
                <PieChart>
                    <Pie
                            data={props.data}
                            isAnimationActive={false}
                            dataKey="count"
                            nameKey="group" >
                        {props.data.map(entry => <Cell key={`cell-${entry.groupId}`} fill={entry.bgColor}/>)}
                        <LabelList dataKey="group" position="inside" stroke="#000000" fill="#000000" />
                    </Pie>
                    <Legend verticalAlign="middle" align="right" layout="vertical" formatter={legendFormatter} />
                </PieChart>
            </ResponsiveContainer>
        );
    };

    return {
        LineGroupChart: LineGroupChart
    };

}