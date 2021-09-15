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

/// <reference path="../vendor.d.ts/d3.d.ts" />
/// <reference path="../vendor.d.ts/d3-color.d.ts" />

import * as d3 from 'vendor/d3';
import { HTTP, Dict, List, pipe, tuple } from 'cnc-tskit';

import { PageModel, DownloadType } from '../app/page';
import * as Kontext from '../types/kontext';
import { attachColorsToIds } from '../models/concordance/common';

export interface LineGroupChartItem {
    groupId:number;
    group:string;
    count:number;
    fgColor:string;
    bgColor:string;
}

export type LineGroupChartData = Array<LineGroupChartItem>;


export interface LineGroupStats extends Kontext.AjaxResponse {
    groups:{[groupId:string]:number};
}

/**
 *
 */
export class LineSelGroupsRatiosChart {

    private readonly layoutModel:PageModel;

    private readonly exportFormats:Array<string>;

    private currWidth:number;

    private currHeight:number;


    constructor(layoutModel:PageModel, exportFormats:Array<string>) {
        this.layoutModel = layoutModel;
        this.exportFormats = exportFormats;
        this.currWidth = 200;
        this.currHeight = 200;
    }

    private renderChart(rootElm:d3.Selection<any>, data:LineGroupChartData):Array<string> {
        const coloredData = attachColorsToIds(
            data,
            item => item.groupId,
            (item, fgColor, bgColor) => ({
                ...item,
                fgColor,
                bgColor
            })
        );
        const radius = Math.min(this.currWidth, this.currHeight) / 2;
        const arc = d3.arc()
            .outerRadius(radius - 10)
            .innerRadius(0);
        const labelArc = d3.arc()
            .outerRadius(radius - 40)
            .innerRadius(radius - 40);
        const pie = d3.pie()
            .value((d) => d['count'])
            .sort(null);

        const pieData = pie(coloredData);
        const wrapper = rootElm.append('svg')
            .attr('width', this.currWidth)
            .attr('height', this.currHeight)
            .attr('class', 'chart')
            .append('g')
                .attr('transform', 'translate(' + this.currWidth / 2 + ',' + this.currHeight / 2 + ')')
                .attr('class', 'chart-wrapper');

        const g = wrapper.selectAll('.arc')
            .data(pieData).enter()
                .append('g')
                .attr('class', 'arc');

        g.append('path')
            .attr('d', arc)
            .style('fill', (d:any) => d.data['bgColor']);

        if (pieData.length <= 5) { // direct labels only for small num of portions
            g.append('text')
                .attr('transform', (d:any) => ('translate(' + labelArc.centroid(d) + ')'))
                .text((d:any) => d.data['group']);
        }
        const ans = List.repeat(() => '#000000', List.maxItem(v => v.groupId, coloredData).groupId);
        List.forEach(
            v => {
                ans[v.groupId] = v.bgColor;
            },
            coloredData
        );
        return ans;
    }

    private renderLabels(data:LineGroupChartData, colors:Array<string>, rootElm:d3.Selection<any>):void {
        const labelWrapper:HTMLElement = window.document.createElement('table');
        const tbody:HTMLElement = window.document.createElement('tbody');
        const total = data.reduce((prev, curr)=>(prev + curr['count']), 0);

        const percentage = (item) => {
            return (item / total * 100).toFixed(1) + '%';
        };

        const sortedData = List.sorted(
            (x1, x2) => x1.groupId > x2.groupId ? 1 : -1,
            data
        );

        const dataPairs = pipe(
            sortedData,
            List.filter((_, i) => i < List.size(sortedData) / 2),
            List.zipAll(List.filter((_, i) => i >= List.size(sortedData) / 2, sortedData)),
        );

        const trSel = d3.select(labelWrapper)
            .attr('class', 'chart-label')
            .append(() => tbody)
            .selectAll('tr')
            .data(dataPairs)
            .enter()
            .append('tr');

        const addRowData = (colNum:number, dataSel:(d:any, key:string)=>any) => {
            trSel
                .append('td')
                    .attr('class', 'label-text color-code')
                    .style('padding-left', colNum === 1 ? '1em' : '0')
                    .append('svg')
                    .attr('width', '1.5em')
                    .attr('height', '1.5em')
                    .append('rect')
                    .attr('width', '100%')
                    .attr('height', '100%')
                    .style('fill', d => colors[dataSel(d, 'groupId')])
                    .style('display', d => dataSel(d, 'groupId') ? undefined : 'none');
            trSel.append('th')
                .attr('class', 'num')
                .text(d => dataSel(d, 'group'))
                .style('display', d => dataSel(d, 'groupId') ? undefined : 'none');
            trSel.append('td')
                .attr('class', 'num')
                .text(d => percentage(dataSel(d, 'count')))
                .style('display', d => dataSel(d, 'groupId') ? undefined : 'none');
            trSel.append('td')
                .attr('class', 'num')
                .text(d => '(' + dataSel(d, 'count') + 'x)')
                .style('display', d => dataSel(d, 'groupId') ? undefined : 'none');
        };

        addRowData(0, (item, key) => {
            const tmp = item[0];
            return tmp ? tmp[key] : undefined;
        });
        addRowData(1, (item, key) => {
            const tmp = item[1];
            return tmp ? tmp[key] : undefined;
        });
        rootElm.append(() => labelWrapper);
    }

    private renderExportLinks(data:LineGroupChartData, rootElm:d3.Selection<any>, corpusId:string) {
        if (this.exportFormats.length > 0) {
            const fieldset = rootElm.append('fieldset');
            fieldset.attr('class', 'footer');
            const sElm = fieldset.append('legend');
            sElm.text(this.layoutModel.translate('linesel__export_btn'));
            const ul = fieldset.append('ul');
            ul.attr('class', 'export');

            List.forEach(
                ef => {
                    const li = ul.append('li');
                    const aElm = li.append('a');
                    aElm.text(ef);
                    aElm.on('click', () => {
                        this.layoutModel.bgDownload({
                            filename: 'line-selection-overview.xlsx',
                            type: DownloadType.LINE_SELECTION,
                            url: this.layoutModel.createActionUrl(
                                'export_line_groups_chart',
                                Dict.toEntries({
                                    corpname: corpusId,
                                    cformat: ef
                                })
                            ),
                            contentType: 'multipart/form-data',
                            args: {
                                data: pipe(
                                    data,
                                    List.map(({groupId, count}) => tuple(
                                        groupId, count
                                    )),
                                    (data) => JSON.stringify(data)
                                ),
                                title: this.layoutModel.translate('linesel__saved_line_groups_heading')
                            }
                        });
                    });
                },
                this.exportFormats
            );
        }
    }

    showGroupsStats(rootElm:HTMLElement, corpusId:string, size:[number, number]):void {
        [this.currWidth, this.currHeight] = size;
        this.layoutModel.ajax$<LineGroupStats>(
            HTTP.Method.GET,
            this.layoutModel.createActionUrl(
                'ajax_get_line_groups_stats',
                this.layoutModel.getConcArgs()
            ),
            {}

        ).subscribe(
            (resp) => {
                const chartData:LineGroupChartData = pipe(
                    resp.groups,
                    Dict.toEntries(),
                    List.map(([ident, num]) => ({
                        groupId: parseInt(ident, 10),
                        group: `#${ident}`,
                        count: num,
                        fgColor: '#abcdef',
                        bgColor: '#111111'
                    })),
                    List.sortBy(v => v.groupId)
                );
                const d3Root = d3.select(rootElm);
                d3Root.selectAll('*').remove(); // remove loader
                d3Root
                    .append('legend')
                    .text(this.layoutModel.translate('linesel__groups_stats_heading'));
                const colors = this.renderChart(d3Root, chartData);
                this.renderLabels(chartData, colors, d3Root);
                this.renderExportLinks(chartData, d3Root, corpusId);
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}