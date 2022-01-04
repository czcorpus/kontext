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


import * as d3 from 'd3';
import { HTTP, Dict, List, pipe } from 'cnc-tskit';

import { PageModel, DownloadType } from '../app/page';
import * as Kontext from '../types/kontext';
import { attachColorsToIds } from '../models/concordance/common';
import { init as initViews } from './lineSelectionView'

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

    // TODO rewrite for Recharts
    private renderChart(rootElm:HTMLElement, data:LineGroupChartData) {
        const lineSelectionViews = initViews(this.layoutModel.getComponentHelpers());
        const coloredData = attachColorsToIds(
            data,
            item => item.groupId,
            (item, fgColor, bgColor) => ({
                ...item,
                fgColor,
                bgColor
            })
        );
        const title = document.createElement('legend');
        title.append();
        this.layoutModel.renderReactComponent(
            lineSelectionViews.LineGroupChart,
            rootElm,
            {data: coloredData, width: this.currWidth, height: this.currHeight}
        )
    }

    private renderExportLinks(
        data:LineGroupChartData,
        rootElm:d3.Selection<any, any, any, any>,
        corpusId:string
    ) {
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
                            url: this.layoutModel.createActionUrl('export_line_groups_chart'),
                            contentType: 'application/json',
                            args: {
                                data,
                                corpname: corpusId,
                                cformat: ef,
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
                d3Root.append('legend')
                    .text(this.layoutModel.translate('linesel__groups_stats_heading'));
                d3Root.append('div').attr('class', 'chart')
                this.renderChart(rootElm.querySelector('.chart'), chartData);
                this.renderExportLinks(chartData, d3Root, corpusId);
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}