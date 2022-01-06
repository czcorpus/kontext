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
import { Action, IFullActionControl, SEDispatcher, StatelessModel } from 'kombo';

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
        format:string;
    }> = {
        name: 'LINE_SELECTION_OVERVIEW_DOWNLOAD'
    };

    static RenderLineSelectionOverview:Action<{
        rootElm:HTMLElement;
        corpname:string;
        size:[number, number];
    }> = {
        name: 'LINE_SELECTION_OVERVIEW_RENDER'
    };

    static RenderLineSelectionOverviewDone:Action<{
        data:LineGroupChartData;
    }> = {
        name: 'LINE_SELECTION_OVERVIEW_RENDER_DONE'
    };

}


export interface LineGroupStats extends Kontext.AjaxResponse {
    groups:{[groupId:string]:number};
}

interface LineSelGroupsRatiosChartModelState {
    rootElm:HTMLElement;
    size:[number, number];
    corpname:string;
    data:LineGroupChartData;
    isBusy:boolean;
}

/**
 *
 */
export class LineSelGroupsRatiosChartModel extends StatelessModel<LineSelGroupsRatiosChartModelState> {

    private readonly layoutModel:PageModel;

    private readonly exportFormats:Array<string>;

    private currWidth:number;

    private currHeight:number;


    constructor(dispatcher:IFullActionControl, pageModel:PageModel, exportFormats:Array<string>) {
        super(
            dispatcher,
            {
                rootElm: null,
                size: null,
                corpname: null,
                data: null,
                isBusy: false,
            }
        );
    
        this.layoutModel = pageModel;
        this.exportFormats = exportFormats;
        this.currWidth = 200;
        this.currHeight = 200;

        const lineSelectionOverviewView = initView(this.layoutModel.getComponentHelpers(), dispatcher);

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
                        data: state.data,
                        corpname: state.corpname,
                        cformat: action.payload.format,
                    }
                })
            }
        );

        this.addActionHandler<typeof Actions.RenderLineSelectionOverview>(
            Actions.RenderLineSelectionOverview.name,
            (state, action) => {
                state.rootElm = action.payload.rootElm;
                state.size = action.payload.size;
                state.corpname = action.payload.corpname;
                state.isBusy = true;
            },
            (state, action, dispatch) => {
                this.getGroupsStats(dispatch, state.size)
            }
        );

        this.addActionHandler<typeof Actions.RenderLineSelectionOverviewDone>(
            Actions.RenderLineSelectionOverviewDone.name,
            (state, action) => {
                state.isBusy = false;
                if (action.error) {
                    this.layoutModel.showMessage('error', action.error);

                } else {
                    state.data = action.payload.data;
                    this.layoutModel.renderReactComponent(
                        lineSelectionOverviewView,
                        state.rootElm,
                        {
                            data: state.data,
                            chartWidth: this.currWidth,
                            chartHeight: this.currHeight,
                            corpusId: state.corpname,
                            exportFormats: this.exportFormats,
                        }
                    );
                }
            }
        );
    }

    private getGroupsStats(dispatch: SEDispatcher, size:[number, number]):void {
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
                dispatch<typeof Actions.RenderLineSelectionOverviewDone>({
                    name: Actions.RenderLineSelectionOverviewDone.name,
                    payload: {data: chartData}
                });
            },
            (err) => {
                dispatch<typeof Actions.RenderLineSelectionOverviewDone>({
                    name: Actions.RenderLineSelectionOverviewDone.name,
                    error: err
                });
            }
        );
    }
}