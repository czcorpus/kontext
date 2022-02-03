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

import { StatelessModel, IActionQueue } from 'kombo';
import { DownloadType, PageModel } from '../../app/page';
import { Actions } from '../common/actions';


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
                this.layoutModel.bgDownload({
                    filename: `${action.payload.filename}.${action.payload.format}`,
                    url: this.layoutModel.createActionUrl(
                        'tools/convert_chart_svg',
                        {
                            outFormat: action.payload.format,
                            chartType: action.payload.chartType,
                            vertBarChartMaxLabel: action.payload.vertBarChartMaxLabel
                        }
                    ),
                    contentType: action.payload.format === 'png' ? 'image/png' : 'image/svg+xml',
                    type: DownloadType.CHART,
                    args: action.payload.blob
                });
            }
        );
    }
}
