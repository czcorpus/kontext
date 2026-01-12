/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { DownloadType, PageModel, UnsupportedBlob } from '../../app/page.js';
import { Actions } from '../common/actions.js';


export interface ImageConversionModelState {
}


export class ImageConversionModel extends StatelessModel<ImageConversionModelState> {

    private layoutModel:PageModel;

    constructor(dispatcher:IActionQueue, layoutModel:PageModel) {
        super(dispatcher, {});
        this.layoutModel = layoutModel;

        this.addActionHandler(
            Actions.ConvertChartSVG,
            null,
            (state, action, dispatch) => {
                    if (window.Blob === UnsupportedBlob) {
                        this.layoutModel.showMessage('error', this.layoutModel.translate('global__func_not_supp_by_the_browser'));
                        return;
                    }
                    if (action.error) {
                        this.layoutModel.showMessage('error', action.error);
                        return;
                    }
                    if (!action.payload.data) {
                        this.layoutModel.showMessage('error', `Chart data ${action.payload.sourceId} not available.`)
                        return;
                    }
                    this.layoutModel.bgDownload({
                        format: action.payload.format.split('-')[0],
                        datasetType: DownloadType.CHART,
                        urlConstructor: (taskId:string) => this.layoutModel.createActionUrl(
                            'tools/convert_chart_svg',
                            {
                                ...action.payload.args,
                                chartType: action.payload.chartType,
                                outFormat: action.payload.format
                            }
                        ),
                        contentType: action.payload.format.startsWith('png') ? 'image/png' : 'image/svg+xml',
                        args: action.payload.data // the naming is a bit confusing here
                    }).subscribe();
            }
        );
    }
}
