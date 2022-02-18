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
import { DispersionResultModel, DispersionResultModelState } from '../../models/dispersion/result';
import { ChartExportFormat, ComponentHelpers } from '../../types/kontext';
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer } from 'recharts';
import * as theme from '../theme/default';

import { Actions as GlobalActions } from '../../models/common/actions';

import { Actions } from '../../models/dispersion/actions';
import { List } from 'cnc-tskit';

import * as S from './style';
import * as ReactDOM from 'react-dom';



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
            <option value="svg">SVG</option>
        </select>;
    }

    // ---------------------- <DispersionResults /> --------------

    const DispersionResults:React.FC<DispersionResultModelState> = (props) => {

        const ref = React.useRef(null);

        const handleDownload = () => {
            const container = ReactDOM.findDOMNode(ref.current);
            if (container instanceof Text) {
                return;
            }
            const svg = container.querySelector('svg');
            let svgURL = new XMLSerializer().serializeToString(svg);
            let svgBlob = new Blob([svgURL], {type: "image/svg+xml;charset=utf-8"});
            svgBlob.text().then(
                (blob) => {
                    dispatcher.dispatch<typeof GlobalActions.ConvertChartSVG>({
                        name: GlobalActions.ConvertChartSVG.name,
                        payload: {
                            format: props.downloadFormat,
                            filename: 'dispersion-chart',
                            blob,
                            chartType: 'bar',
                        }
                    });
                },
                (error) => {
                    dispatcher.dispatch<typeof GlobalActions.ConvertChartSVG>({
                        name: GlobalActions.ConvertChartSVG.name,
                        error
                    });
                }
            )
        }

        const handleResolutionChange = (evt) => {
            const value = parseInt(evt.target.value);
            if (value) {
                dispatcher.dispatch<typeof Actions.ChangeResolution>({
                    name: Actions.ChangeResolution.name,
                    payload: {value}
                });
                dispatcher.dispatch<typeof Actions.SubmitForm>({
                    name: Actions.SubmitForm.name,
                    payload: {reloadPage: false}
                });
            }
        }

        return (
            <S.FreqDispersionSection>
                <S.FreqDispersionParamFieldset>
                    <label htmlFor='resolution-input'>{he.translate('dispersion__resolution')}:</label>
                    <input id='resolution-input' onChange={handleResolutionChange} value={props.resolution}/>
                    <label>{he.translate('dispersion__download_chart')}:</label>
                    <DownloadFormatSelector format={props.downloadFormat} />
                    <S.DownloadButton src={he.createStaticUrl('img/download-button.svg')} alt={he.translate('dispersion__download_chart')} onClick={handleDownload} />
                </S.FreqDispersionParamFieldset>
                {props.isBusy ?
                    <globalComponents.AjaxLoaderImage /> :
                    <div>
                        <ResponsiveContainer width="95%" height={250}>
                            <BarChart data={props.data} ref={ref}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <Bar dataKey="freq" fill={theme.colorLogoBlue} barSize={List.size(props.data) === 1 ? 100 : null} />
                                <XAxis dataKey="position" type="number" unit="%" domain={[0, 100]} allowDataOverflow={true} />
                                <YAxis />
                                <Tooltip labelFormatter={(label, data) => data[0] ? `${data[0].payload.start} - ${data[0].payload.end} %` : label} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                }
            </S.FreqDispersionSection>
        );
    }


    return BoundWithProps<{}, DispersionResultModelState>(DispersionResults, dispersionModel);
}