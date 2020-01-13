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
import * as d3Color from 'vendor/d3-color';
import { MultiDict } from '../util';
import { PageModel, DownloadType } from '../app/page';
import RSVP from 'rsvp';


export type LineGroupChartData = Array<{groupId:number; group:string; count:number}>;

export type LineGroupStats = {[groupId:number]:number};

/**
 *
 */
export class LineSelGroupsRatiosChart {

    /**
     * Color scheme derived from d3.schemeCategory20
     * by changing the order.
     */
    private static BASE_COLOR_SCHEME = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
    ];

    private layoutModel:PageModel;

    private lastGroupStats:LineGroupStats; // group stats cache

    private currWidth:number;

    private currHeight:number;

    private exportFormats:Array<string>;


    constructor(layoutModel:PageModel, exportFormats:Array<string>, data?:LineGroupStats) {
        this.layoutModel = layoutModel;
        this.exportFormats = exportFormats;
        if (data) {
            this.lastGroupStats = data;
        }
        this.currWidth = 200;
        this.currHeight = 200;
    }

    /**
     * @todo this must be tuned quite a bit to make
     * categories and chart elements distinguishable
     */
    extendBaseColorPalette(offset:number=0):Array<string> {
        const ans:Array<string> = ['RGB(0, 0, 0)']; // we don't use the first color
        const coeff = [0, 0.7, 1.2, 1.8, 2.1, 2.2, 2.3, 2.3, 2.3, 2.3];
        for (let i = 0; i < 10; i += 1) {
            LineSelGroupsRatiosChart.BASE_COLOR_SCHEME.forEach((color, j) => {
                const c = d3Color.color(color);
                ans.push(c.brighter(coeff[i]).toString());
            });
        }
        return ans.slice(offset);
    }

    private renderChart(rootElm:d3.Selection<any>, data:LineGroupChartData):Array<string> {
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

        const pieData = pie(data);
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

        const color = this.extendBaseColorPalette();

        g.append('path')
            .attr('d', arc)
            .style('fill', (d:any) => color[d.data['groupId']]);

        if (pieData.length <= 5) { // direct labels only for small num of portions
            g.append('text')
                .attr('transform', (d:any) => ('translate(' + labelArc.centroid(d) + ')'))
                .text((d:any) => d.data['group']);
        }
        return color;
    }

    private renderLabels(data:LineGroupChartData, colors:Array<string>, rootElm:d3.Selection<any>):void {
        const labelWrapper:HTMLElement = window.document.createElement('table');
        const tbody:HTMLElement = window.document.createElement('tbody');
        const total = data.reduce((prev, curr)=>(prev + curr['count']), 0);
        const percentage = (item) => {
            return (item['count'] / total * 100).toFixed(1) + '%';
        };

        const trSel = d3.select(labelWrapper)
            .attr('class', 'chart-label')
            .append(() => tbody)
            .selectAll('tr')
            .data(data.sort((x1, x2) => x1.groupId > x2.groupId ? 1 : -1))
            .enter()
            .append('tr');
        trSel
            .append('td')
                .attr('class', 'label-text color-code')
                .append('svg')
                .attr('width', '1.5em')
                .attr('height', '1.5em')
                .append('rect')
                .attr('width', '100%')
                .attr('height', '100%')
                .style('fill', (d:any) => colors[d['groupId']]);
        trSel.append('th')
            .attr('class', 'num')
            .text((d) => d['group']);
        trSel.append('td')
            .attr('class', 'num')
            .text(d => percentage(d));
        trSel.append('td')
            .attr('class', 'num')
            .text(d => '(' + d['count'] + 'x)');
        rootElm.append(() => labelWrapper);
    }

    private renderExportLinks(rootElm:d3.Selection<any>, corpusId:string) {
        if (this.exportFormats.length > 0) {
            const div = rootElm.append('div');
            div.attr('class', 'footer');
            const sElm = div.append('span');
            sElm.text('export: '); // TODO

            this.exportFormats.forEach((ef, i) => {
                if (i > 0) {
                    const sep = div.append('span');
                    sep.text(', ');
                }
                const aElm = div.append('a')
                aElm.attr('class', 'export');
                aElm.text(ef);
                aElm.on('click', () => {
                    const args = new MultiDict();
                    args.set('corpname', corpusId);
                    args.set('data', JSON.stringify(this.lastGroupStats));
                    args.set('cformat', ef);
                    args.set('title', this.layoutModel.translate('linesel__saved_line_groups_heading'));
                    this.layoutModel.bgDownload(
                        'line-selection-overview.xlsx',
                        DownloadType.LINE_SELECTION,
                        this.layoutModel.createActionUrl('export_line_groups_chart', args)
                    );
                });
            });
        }
    }

    showGroupsStats(rootElm:HTMLElement, usePrevData:boolean, corpusId:string, size:[number, number]):void {
        [this.currWidth, this.currHeight] = size;
        (() => {
            if (this.lastGroupStats && usePrevData) {
                return new RSVP.Promise<LineGroupStats>((resolve:(v:any)=>void, reject:(e:any)=>void) => {
                    resolve(this.lastGroupStats);
                });

            } else {
                return this.layoutModel.ajax<LineGroupStats>(
                    'GET',
                    this.layoutModel.createActionUrl(
                        'ajax_get_line_groups_stats',
                        this.layoutModel.getConcArgs().items()
                    ),
                    {}

                ).then(
                    (data) => {
                        this.lastGroupStats = data;
                        return data;
                    }
                );
            }
        })().then(
            (data) => {
                const chartData:LineGroupChartData = [];
                for (let p in data) {
                    chartData.push({
                        groupId: parseInt(p, 10),
                        group: `#${p}`,
                        count: data[p]
                    });
                }
                const d3Root = d3.select(rootElm);
                d3Root.selectAll('*').remove(); // remove loader
                d3Root
                    .append('legend')
                    .text(this.layoutModel.translate('linesel__groups_stats_heading'));
                const colors = this.renderChart(d3Root, chartData);
                this.renderLabels(chartData, colors, d3Root);
                this.renderExportLinks(d3Root, corpusId);
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}