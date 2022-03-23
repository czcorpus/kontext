/*
 * Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Dict } from 'cnc-tskit';
import { StatelessModel, IActionQueue } from 'kombo';
import { DownloadType, PageModel, UnsupportedBlob } from '../../app/page';
import { Actions } from '../common/actions';
import { FreqChartsAvailableTypes } from '../freqs/common';


export interface ImageConversionModelState {
    data:{[sourceId:string]:{
        src:string;
        type:FreqChartsAvailableTypes;
        serverArgs:{[k:string]:string|number};
    }};
}


export class ImageConversionModel extends StatelessModel<ImageConversionModelState> {

    private layoutModel:PageModel;

    constructor(dispatcher:IActionQueue, layoutModel:PageModel) {
        super(dispatcher, {
            data: {}
        });
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.SetChartDownloadSVG,
            (state, action) => {
                state.data[action.payload.sourceId] = {
                    src: action.payload.value,
                    type: action.payload.type,
                    serverArgs: action.payload.args ? action.payload.args : {}
                };
            }
        );

        this.addActionHandler(
            Actions.ConvertChartSVG,
            null,
            (state, action, dispatch) => {
                    if (window.Blob === UnsupportedBlob) {
                        this.layoutModel.showMessage('error', 'Function not supported, try to update your browser to latest version.')
                        return;
                    }
                    if (!state.data[action.payload.sourceId]) {
                        this.layoutModel.showMessage('error', `Chart data ${action.payload.sourceId} not available. Known data: ${Dict.keys(state.data).join(', ')}`)
                        return;
                    }
                    const { src, type, serverArgs } = state.data[action.payload.sourceId];
                    this.layoutModel.bgDownload({
                        format: action.payload.format.split('-')[0],
                        datasetType: DownloadType.CHART,
                        url: this.layoutModel.createActionUrl(
                            'tools/convert_chart_svg',
                            {
                                ...serverArgs,
                                chartType: type,
                                outFormat: action.payload.format
                            }
                        ),
                        contentType: action.payload.format.startsWith('png') ? 'image/png' : 'image/svg+xml',
                        args: src // the naming is a bit confusing here
                    });
            }
        );
    }
}
