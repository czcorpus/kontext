/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import { BoundWithProps, IActionDispatcher } from 'kombo';
import * as React from 'react';
import { DispersionDataRow, DispersionResultModel, DispersionResultModelState } from '../../models/dispersion/result.js';
import { ChartExportFormat, ComponentHelpers } from '../../types/kontext.js';
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import * as theme from '../theme/default/index.js';

import { Actions as GlobalActions } from '../../models/common/actions.js';

import { Actions } from '../../models/dispersion/actions.js';
import { List } from 'cnc-tskit';

import * as S from './style.js';



export function init(
    dispatcher:IActionDispatcher,
    he:ComponentHelpers,
    dispersionModel:DispersionResultModel
) {

    const globalComponents = he.getLayoutViews();


    // ---------------------- <DownloadFormatSelector /> --------------

    const DownloadFormatSelector:React.FC<{
        format:ChartExportFormat;

    }> = ({ format }) => {

        const onChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch<typeof Actions.SetDownloadFormat>({
                name: Actions.SetDownloadFormat.name,
                payload: {
                    format: evt.target.value as ChartExportFormat
                }
            });
        };

        return <select value={format} onChange={onChange}>
            <option value="png">PNG</option>
            <option value="png-print">PNG ({he.translate('freq__print_quality')})</option>
            <option value="pdf">PDF</option>
        </select>;
    }

    // ---------------------- <DispersionChart /> --------------

    const DispersionChart:React.FC<{
        data:Array<DispersionDataRow>;
        width:number;
        height:number;

    }> = ({ data, width, height }) => {

        return <BarChart data={data} width={width} height={height}>
            <CartesianGrid strokeDasharray="3 3" />
            <Bar dataKey="freq" isAnimationActive={false} fill={theme.colorLogoBlue} barSize={List.size(data) === 1 ? 100 : null} />
            <XAxis dataKey="position" type="number" unit="%" domain={[0, 100]} allowDataOverflow={true} />
            <YAxis />
            <Tooltip labelFormatter={(label, data) => data[0] ? `${data[0].payload.start} - ${data[0].payload.end} %` : label} />
        </BarChart>
    }

    // ---------------------- <DispersionResults /> --------------

    const DispersionResults:React.FC<DispersionResultModelState> = (props) => {

        const ref = React.useRef(null);

        const handleDownload = () => {
            const container = ref.current;
            if (container instanceof Text || !container) {
                return;
            }
            const svg = container.querySelector('svg');
            const svgURL = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgURL], {type: "image/svg+xml;charset=utf-8"});
            svgBlob.text().then(
                value => {
                    dispatcher.dispatch<typeof GlobalActions.ConvertChartSVG>({
                        name: GlobalActions.ConvertChartSVG.name,
                        payload: {
                            sourceId: 'dispersion',
                            format: props.downloadFormat,
                            data: value,
                            chartType: 'bar',
                        }
                    })
                },
                error => {
                    dispatcher.dispatch(
                        GlobalActions.ConvertChartSVG,
                        error
                    )
                }
            );
        }

        const handleResolutionChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<typeof Actions.ChangeResolutionAndReload>({
                name: Actions.ChangeResolutionAndReload.name,
                payload: {value: evt.target.value}
            });
        }

        return (
            <S.FreqDispersionSection ref={ref}>
                <S.FreqDispersionParamFieldset>
                    <label htmlFor='resolution-input'>{he.translate('dispersion__resolution')}:</label>
                    <globalComponents.ValidatedItem invalid={props.resolution.isInvalid} errorDesc={props.resolution.errorDesc}>
                        <input id='resolution-input' onChange={handleResolutionChange} value={props.resolution.value}/>
                    </globalComponents.ValidatedItem>
                    <label>{he.translate('dispersion__download_chart')}:</label>
                    <DownloadFormatSelector format={props.downloadFormat} />
                    <S.DownloadButton src={he.createStaticUrl('img/download-button.svg')} alt={he.translate('dispersion__download_chart')} onClick={handleDownload} />
                </S.FreqDispersionParamFieldset>
                {props.isBusy ?
                    <globalComponents.AjaxLoaderImage /> :
                    <div style={{width: '95%', height: '300px'}}>
                        <globalComponents.ResponsiveWrapper render={(width, height) =>
                            <DispersionChart data={props.data} width={width} height={height} />
                        }/>

                    </div>
                }
            </S.FreqDispersionSection>
        );
    }


    return BoundWithProps<{}, DispersionResultModelState>(DispersionResults, dispersionModel);
}