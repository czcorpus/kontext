/*
 * Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as React from 'react';
import * as Kontext from '../../../types/kontext';
import { Bound, IActionDispatcher } from "kombo";
import { FreqChartsAvailableData, FreqChartsAvailableTypes, FreqChartsModel, FreqChartsModelState } from "../../../models/freqs/regular/freqCharts";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, ResponsiveContainer } from 'recharts';
import { Dict, List, pipe } from 'cnc-tskit';
import { Actions } from '../../../models/freqs/regular/actions';
import * as theme from '../../theme/default';
import { init as initWordCloud } from './wordCloud/index';
import * as S from './style';
import { ResultBlock, ResultItem } from '../../../models/freqs/regular/common';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    freqChartsModel:FreqChartsModel,
) {

    const globalComponents = he.getLayoutViews();

    const WordCloud = initWordCloud<ResultItem>(he);
    const dataTransform = (item:ResultItem) => ({
        text: item.Word[0],
        value: item.freq,
        tooltip: [
            {label: 'abs', value: item.freq},
            {label: 'rel', value: item.rel, round: 1},
        ],
    });

    // ----------------------- <FreqChartsParams /> -------------------

    const FreqChartsParams:React.FC<{
        sourceId:string;
        type:FreqChartsAvailableTypes;
        dataKey:FreqChartsAvailableData;
        data:ResultBlock;
        fmaxitems:Kontext.FormValue<string>;
        sortColumn:string;
        isBusy:boolean;
        dtFormat:string;

    }> = (props) => {

        const handleOrderChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeOrder>({
                name: Actions.FreqChartsChangeOrder.name,
                payload: {
                    value: e.target.value,
                    sourceId: props.sourceId
                }
            });
        }

        const handleUnitsChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeUnits>({
                name: Actions.FreqChartsChangeUnits.name,
                payload: {
                    value: e.target.value,
                    sourceId: props.sourceId
                }
            });
        }

        const handleTypeChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeType>({
                name: Actions.FreqChartsChangeType.name,
                payload: {
                    value: e.target.value,
                    sourceId: props.sourceId
                }
            });
        }

        const handlePageSizeChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangePageSize>({
                name: Actions.FreqChartsChangePageSize.name,
                payload: {
                    value: e.target.value,
                    sourceId: props.sourceId
                }
            });
        }

        return (
            <S.FreqChartsParamsFieldset>
                <label htmlFor="sel-type">{he.translate('freq__visualisation_type')}:</label>
                <select id="sel-type" value={props.type} onChange={handleTypeChange}>
                    <option value="bar">{he.translate('freq__visualisation_type_bar')}</option>
                    <option value="cloud">{he.translate('freq__visualisation_type_cloud')}</option>
                    {props.dtFormat ? <option value="timeline">{he.translate('freq__visualisation_type_line')}</option> : null}
                </select>
                {props.type !== 'cloud' ?
                    <>
                        <label htmlFor="sel-units">{he.translate('freq__visualization_units')}:</label>
                        <select id="sel-units" value={props.dataKey} onChange={handleUnitsChange}>
                            <option value="freq">{he.translate('freq__unit_abs')}</option>
                            {List.some(v => !!v.rel, props.data.Items) ?
                                <option value="rel">{he.translate('freq__unit_rel')}</option> :
                                null}
                        </select>
                    </> :
                    null}
                <label htmlFor="input-max">{he.translate('freq__visualization_display_top_prefix_{n}', {n: parseInt(props.fmaxitems.value) || 100})}</label>
                <globalComponents.ValidatedItem invalid={props.fmaxitems.isInvalid}>
                    <input type="text" id="input-max" style={{width: '2em'}} value={props.fmaxitems.value} onChange={handlePageSizeChange} />
                </globalComponents.ValidatedItem>
                {'\u00a0'}<span>{he.translate('freq__visualization_display_top_suffix_{n}', {n: parseInt(props.fmaxitems.value) || 100})}</span>
                {props.type === 'bar' ?
                    <>
                        <label htmlFor="sel-order">{he.translate('freq__visualization_sort_by')}:</label>
                        <select id="sel-order" value={props.sortColumn} onChange={handleOrderChange}>
                            <option value="0">{he.translate('freq__unit_value')}</option>
                            <option value="freq">{he.translate('freq__unit_abs')}</option>
                            {List.some(v => !!v.rel, props.data.Items) ?
                                <option value="rel">{he.translate('freq__unit_rel')}</option> :
                                null
                            }
                        </select>
                    </> :
                    null}
                {props.isBusy ?
                    <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}alt={he.translate('global__loading')} /> :
                    null}
            </S.FreqChartsParamsFieldset>
        );
    }

    // ----------------------- <FreqChart /> -------------------------

    const FreqChart:React.FC<{
        sourceId:string;
        data:ResultBlock;
        type:FreqChartsAvailableTypes;
        dataKey:FreqChartsAvailableData;
        isBusy:boolean;
        dtFormat:string;
        fmaxitems:Kontext.FormValue<string>;
        sortColumn:string;
    }> = (props) => {

        const maxLabelLength = (List.maxItem(
            v => v.length,
            props.data.Items.map(v => v.Word[0])
        ) as string).length;

        const renderChart = () => {
            switch (props.type)  {
                case 'bar':
                    return <ResponsiveContainer width="95%" height={List.size(props.data.Items)*17+60}>
                        <BarChart data={props.data.Items} layout='vertical'>
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50} label={props.dataKey} />
                            <YAxis type="category" interval={0} dataKey={v => v.Word[0]} width={Math.max(60, maxLabelLength * 7)}/>
                            <Tooltip />
                            <Bar dataKey={props.dataKey} barSize={15} fill={theme.colorLogoBlue} />
                        </BarChart>
                    </ResponsiveContainer>
                case 'cloud':
                    return <globalComponents.ResponsiveWrapper render={(width, height) =>
                                <WordCloud width={width} height={height} data={props.data.Items}
                                        dataTransform={dataTransform} font={theme.monospaceFontFamily} />}
                                />;
                case 'timeline':
                    return <ResponsiveContainer width="95%" height={300}>
                        <LineChart data={props.data.Items}>
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50} dataKey={v => v.Word[0]} allowDecimals={false} domain={['dataMin', 'dataMax']}/>
                            <YAxis type='number' />
                            <Tooltip />
                            <Line dataKey={props.dataKey} strokeWidth={3} />
                        </LineChart>
                    </ResponsiveContainer>;
                default:
                    return <div>unknown chart</div>;
            }
        }

        return (
            <S.FreqChartSection>
                <h3>{props.data.Head[0].n}</h3>
                <FreqChartsParams sourceId={props.sourceId} data={props.data} type={props.type}
                        dataKey={props.dataKey} isBusy={props.isBusy} dtFormat={props.dtFormat}
                        fmaxitems={props.fmaxitems} sortColumn={props.sortColumn} />
                <div className="chart-wrapper">
                    {renderChart()}
                </div>
            </S.FreqChartSection>
        );
    };

    // ----------------------- <FreqChartsLoaderView /> --------------------

    const FreqChartsLoaderView:React.FC<{sourceId:string, dtFormat:string}> = ({sourceId, dtFormat}) => {

        React.useEffect(
            () => {
                if (dtFormat) { // if timedata => switch to timeline chart automatically
                    dispatcher.dispatch<typeof Actions.FreqChartsSetParameters>({
                        name: Actions.FreqChartsSetParameters.name,
                        payload: {
                            sourceId,
                            type: 'timeline',
                            dataKey: 'rel',
                            sortColumn: '0'
                        }
                    })
                } else {
                    dispatcher.dispatch<typeof Actions.FreqChartsReloadData>({
                        name: Actions.FreqChartsReloadData.name,
                        payload: {
                            sourceId
                        }
                    })
                }
            },
            []
        );

        return (
            <S.FreqResultLoaderView>
                <globalComponents.AjaxLoaderImage />
            </S.FreqResultLoaderView>
        );
    }

    // --------------------- <FreqChartsView /> -----------------------------------------

    const FreqChartsView:React.FC<FreqChartsModelState> = (props) => (
        <div>
            {pipe(
                props.data,
                Dict.toEntries(),
                List.map(
                    ([sourceId, block]) => (
                        block ?
                            <FreqChart key={sourceId} sourceId={sourceId} data={block}
                                    dataKey={props.dataKey[sourceId]}
                                    type={props.type[sourceId]}
                                    isBusy={props.isBusy[sourceId]}
                                    dtFormat={props.dtFormat[sourceId]} fmaxitems={props.fmaxitems[sourceId]}
                                    sortColumn={props.sortColumn[sourceId]} /> :
                            <FreqChartsLoaderView key={sourceId} sourceId={sourceId} dtFormat={props.dtFormat[sourceId]} />
                    )
                )
            )}
        </div>
    );

    return {
        FreqChartsView: Bound(FreqChartsView, freqChartsModel)
    };
}