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
import { LineGroupChartData } from './lineSelection';
import { List } from 'cnc-tskit';
import { DownloadType } from '../app/page';


interface LineGroupChart {
    width: number;
    height: number;
    data: LineGroupChartData;
}

export function init(he:Kontext.ComponentHelpers):React.FC<{
    chartWidth: number;
    chartHeight: number;
    data: LineGroupChartData;
    exportFormats:Array<string>;
    corpusId: string;
    bgDownload:({})=>void;
}> {

    const LineGroupChart:React.FC<LineGroupChart> = (props) => {

        const legendFormatter = (value, entry) => {
            return <span style={{color: '#000'}}><b>{value}</b> {he.formatNumber(100*entry.payload.percent, 1)}% ({entry.payload.count}x)</span>;
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

    const ExportLinks:React.FC<{
        data: LineGroupChartData;
        exportFormats:Array<string>;
        corpusId: string;
        bgDownload:({})=>void;
    }> = (props) => {
        return props.exportFormats.length > 0 ?
            <fieldset className="footer">
                <legend>{he.translate('linesel__export_btn')}</legend>
                <ul className="export">{
                    List.map(v =>
                        <li key={v}>
                            <a onClick={e => props.bgDownload({
                                filename: 'line-selection-overview.xlsx',
                                type: DownloadType.LINE_SELECTION,
                                url: he.createActionLink('export_line_groups_chart'),
                                contentType: 'application/json',
                                args: {
                                    data: props.data,
                                    corpname: props.corpusId,
                                    cformat: v,
                                    title: he.translate('linesel__saved_line_groups_heading')
                                }
                            })}>{v}</a>
                        </li>
                    , props.exportFormats)
                }</ul>
            </fieldset>:
            null
    }

    const GroupsStats:React.FC<{
        chartWidth: number;
        chartHeight: number;
        data: LineGroupChartData;
        exportFormats:Array<string>;
        corpusId: string;
        bgDownload:({})=>void;
    }> = (props) => {
        return <div>
            <legend>{he.translate('linesel__groups_stats_heading')}</legend>
            <LineGroupChart width={props.chartWidth} height={props.chartHeight} data={props.data}/>
            <ExportLinks data={props.data} exportFormats={props.exportFormats} corpusId={props.corpusId} bgDownload={props.bgDownload} />
        </div>
    }

    return GroupsStats;

}