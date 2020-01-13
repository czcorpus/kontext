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
import {PageModel} from '../app/page';


export type NumTriplet = [number, number, number];

export interface DataPoint {
    data:NumTriplet;
    label:string;
}


export class ConfIntervals {

    private pageModel:PageModel;

    private width:number;

    private height:number;

    private target:HTMLElement;

    private paddingTop:number;

    private paddingBottom:number;

    private tooltipElm:d3.Selection<any>;

    private tooltipOpacity:number;

    private dataPointOpactity:number;

    private dataPointTextSize:number;

    constructor(pageModel:PageModel, width:number, height:number, target:HTMLElement) {
        this.pageModel = pageModel;
        this.width = width;
        this.height = height;
        this.target = target;
        this.paddingTop = 35;
        this.paddingBottom = 30;
        this.tooltipElm = d3.select('div.tooltip');
        this.tooltipOpacity = 0.9;
        this.dataPointOpactity = 0.6;
        this.dataPointTextSize = 11;
    }

    private renderLines(root:d3.Selection<any>, data:Array<DataPoint>, xScale:any, yScale:any):void {


    }

    private getRealHeight():number {
        return this.height - this.paddingBottom - this.paddingTop;
    }

    private createTooltip(d:DataPoint, i:number, parent:d3.Selection<any>, xScale:any, yScale:any):void {
        const p = this.tooltipElm.append('p');
        this.tooltipElm.style('top', `${yScale(i)}px`);
        this.tooltipElm.style('left', `${xScale(d.data[1]) - 20}px`);
        if (d.data[1] !== 0) {
            p.text(`${d.data[1]} (${d.data[0]}\u2013${d.data[2]})`);

        } else {
            p.text(this.pageModel.translate('freq__ct_no_observed_data'));
        }
    }

    private renderCircles(root:d3.Selection<any>, data:Array<DataPoint>, xScale:any, yScale:any):void {
        const dataPoints = root
            .selectAll('.data-point')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'data-point');

        dataPoints
            .append('line')
            .attr('x1', (d, _) => xScale(d.data[0]))
            .attr('y1', (_, i) => yScale(i))
            .attr('x2', (d, _) => xScale(d.data[2]))
            .attr('y2', (_, i) => yScale(i))
            .attr('stroke', '#009EE0')
            .attr('stroke-width', 2);

        dataPoints
            .append('line')
            .attr('x1', (d, _) => xScale(d.data[0]))
            .attr('y1', (_, i) => yScale(i))
            .attr('x2', (d, _) => xScale(d.data[0]))
            .attr('y2', (_, i) => yScale(i) - 10)
            .attr('transform', `translate(0, 5)`)
            .attr('stroke', '#009EE0')
            .attr('stroke-width', 2);

        dataPoints
            .append('line')
            .attr('x1', (d, _) => xScale(d.data[2]))
            .attr('y1', (_, i) => yScale(i))
            .attr('x2', (d, _) => xScale(d.data[2]))
            .attr('y2', (_, i) => yScale(i) - 10)
            .attr('transform', `translate(0, 5)`)
            .attr('stroke', '#009EE0')
            .attr('stroke-width', 2);

        dataPoints
            .append('circle')
            .attr('cx', d => xScale(d.data[1]))
            .attr('cy', (_, i) => yScale(i))
            .attr('r', 5)
            .style('fill', d => d.data[1] !== 0 ? '#E2007A' : '#575154')
            .style('opacity', this.dataPointOpactity);

        dataPoints
            .append('text')
            .attr('x', d => xScale(d.data[1]) - 15)
            .attr('y', (_, i) => yScale(i) - 15)
            .attr('font-size', this.dataPointTextSize)
            .text(d => d.label);

        dataPoints
            .on('mouseover', (d, i, nodes) => {
                d3.select(nodes[i]).select('circle').transition().duration(100).attr('r', 7);
                this.createTooltip(d, i, d3.select(nodes[i]), xScale, yScale);
                this.tooltipElm
                    .style('display', 'block')
                    .style('opacity', 0)
                    .transition()
                    .duration(200)
                    .style('opacity', this.tooltipOpacity);
            })
            .on('mouseout', (d, i, nodes) => {
                d3.select(nodes[i]).select('circle').transition().duration(100).attr('r', 5);
                this.tooltipElm.select('p').remove();
                this.tooltipElm.style('display', 'none');
            });
    }

    private getValuesRange(data:Array<DataPoint>):[number, number] {
        let max = data[0].data[2];
        let min = data[0].data[0];
        data.forEach(item => {
            if (item.data[0] < min) {
                min = item.data[0];
            }
            if (item.data[2] > max) {
                max = item.data[2];
            }
        });
        const padding = (max - min) / 10;
        return [min - padding, max + padding];
    }

    private makeAxes(root:d3.Selection<any>, xScale:any):void {
        const xAxis = d3.axisBottom(xScale);
        const formatNumber = d3.format('.1f');
        root.append('g')
            .attr('transform', `translate(0, ${this.getRealHeight()})`)
            .call(xAxis.tickFormat(d => d >= 0 ? formatNumber(d) : '-'));

        root.append('g')
            .call(xAxis.tickFormat(''));


        const makeXGridlines = () => d3.axisBottom(xScale).tickFormat(d3.format('d'));

        root.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0, ${this.getRealHeight()})`)
            .call(makeXGridlines()
                    .tickSize(-this.getRealHeight())
                    .tickFormat(''));

        root
            .append('text')
            .text(this.pageModel.translate('freq__ct_ipm_x_axis_label'))
            .attr('x', 0)
            .attr('y', this.getRealHeight() + 40)
            .attr("text-anchor", "middle")
            .attr('transform', `translate(${this.width / 2}, 0)`);
    }

    renderChart(data:Array<DataPoint>, heading:string):void {
        const [minVal, maxVal] = this.getValuesRange(data);
        const frame = d3.select(this.target);
        frame.select('h2.top').text(heading);

        const svg = frame.select('svg');
        this.height = Math.max(70 * data.length, 70 * 2);
        svg.attr('height', this.height);

        const xScale = d3.scaleLinear()
                .domain([minVal, maxVal])
                .range([0, this.width]);

        const yScale = d3.scaleLinear()
                .domain([0, data.length])
                .range([this.paddingTop, this.getRealHeight()]);

        this.makeAxes(svg, xScale);
        this.renderLines(svg, data, xScale, yScale);
        this.renderCircles(svg, data, xScale, yScale);

    }
}