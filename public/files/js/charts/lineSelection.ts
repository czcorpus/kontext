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


import { HTTP, Dict, List, pipe } from 'cnc-tskit';

import { DownloadType, PageModel } from '../app/page';
import * as Kontext from '../types/kontext';
import { attachColorsToIds } from '../models/concordance/common';
import { init as initView } from './lineSelectionView'
import { Action, IFullActionControl, StatelessModel } from 'kombo';

export interface LineGroupChartItem {
    groupId:number;
    group:string;
    count:number;
    fgColor:string;
    bgColor:string;
}

export type LineGroupChartData = Array<LineGroupChartItem>;

export class Actions {

    static DownloadSelectionOverview:Action<{
        data:LineGroupChartData;
        corpname:string;
        cformat:string;
    }> = {
        name: 'LINE_SELECTION_MENU_DOWNLOAD_SELECTION_OVERVIEW'
    };
}


export interface LineGroupStats extends Kontext.AjaxResponse {
    groups:{[groupId:string]:number};
}

/**
 *
 */
export class LineSelGroupsRatiosChartModel extends StatelessModel<{}> {

    private readonly layoutModel:PageModel;

    private readonly exportFormats:Array<string>;

    private currWidth:number;

    private currHeight:number;


    constructor(dispatcher:IFullActionControl, pageModel:PageModel, exportFormats:Array<string>) {
        super(
            dispatcher,
            {}
        );
    
        this.layoutModel = pageModel;
        this.exportFormats = exportFormats;
        this.currWidth = 200;
        this.currHeight = 200;

        this.addActionHandler<typeof Actions.DownloadSelectionOverview>(
            Actions.DownloadSelectionOverview.name,
            (state, action) => {
                this.layoutModel.bgDownload({
                    filename: 'line-selection-overview.xlsx',
                    type: DownloadType.LINE_SELECTION,
                    url: this.layoutModel.createActionUrl('export_line_groups_chart'),
                    contentType: 'application/json',
                    args: {
                        title: this.layoutModel.translate('linesel__saved_line_groups_heading'),
                        ...action.payload
                    }
                })
            }
        );
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
                const chartData:LineGroupChartData = attachColorsToIds(
                    pipe(
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
                    ),
                    item => item.groupId,
                    (item, fgColor, bgColor) => ({
                        ...item,
                        fgColor,
                        bgColor
                    })
                );
                const GroupsStatsView = initView(this.layoutModel.getComponentHelpers(), this.layoutModel.dispatcher);
                this.layoutModel.renderReactComponent(
                    GroupsStatsView,
                    rootElm,
                    {
                        data: chartData,
                        chartWidth: this.currWidth,
                        chartHeight: this.currHeight,
                        corpusId: corpusId,
                        exportFormats: this.exportFormats,
                    }
                );
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}