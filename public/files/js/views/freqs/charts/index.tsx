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
import {
    FreqChartsAvailableData, FreqChartsAvailableTypes, FreqChartsModel,
    FreqChartsModelState
} from '../../../models/freqs/regular/freqCharts';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
    ResponsiveContainer, ScatterChart, Scatter, PieChart, Pie, Cell,
    Legend
} from 'recharts';
import { Dict, List, pipe, Strings } from 'cnc-tskit';
import { Actions } from '../../../models/freqs/regular/actions';
import * as theme from '../../theme/default';
import { init as initWordCloud } from './wordCloud/index';
import * as S from './style';
import { isEmptyResultBlock, reduceNumResultItems, ResultBlock, ResultItem } from '../../../models/freqs/regular/common';
import { useCurrentPng } from 'recharts-to-png';
import * as FileSaver from 'file-saver';
import { WordCloudItemCalc } from './wordCloud/calc';

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    freqChartsModel:FreqChartsModel,
) {

    // max chart label lengths
    const BAR_CHART_MAX_LABEL_LENGTH = 50;
    const WORD_CLOUD_MAX_LABEL_LENGTH = 30;
    const PIE_CHART_MAX_LABEL_LENGTH = 30;

    const globalComponents = he.getLayoutViews();

    const WordCloud = initWordCloud<ResultItem>(he);
    const dataTransform = (item:ResultItem):WordCloudItemCalc => {
        const data:WordCloudItemCalc = {
            fulltext: item.Word.join(' '),
            text: Strings.shortenText(item.Word.join(' '), WORD_CLOUD_MAX_LABEL_LENGTH),
            value: item.freq,
            tooltip: [{label: 'abs', value: item.freq}]
        }
        if (item.rel) {
            data.tooltip.push({label: 'rel', value: item.rel, round: 1})
        }
        return data;
    };

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
        pieChartMaxIndividualItems:Kontext.FormValue<string>;
        handleDownload:()=>void;

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
                <div>
                    <label htmlFor="sel-type">{he.translate('freq__visualisation_type')}:</label>
                    <select id="sel-type" value={props.type} onChange={handleTypeChange}>
                        <option value="bar">{he.translate('freq__visualisation_type_bar')}</option>
                        <option value="cloud">{he.translate('freq__visualisation_type_cloud')}</option>
                        <option value="pie">{he.translate('freq__visualisation_type_pie')}</option>
                        {props.dtFormat ?
                            <>
                                <option value="timeline">{he.translate('freq__visualisation_type_line')}</option>
                                <option value="timescatter">{he.translate('freq__visualisation_type_scatter')}</option>
                            </> :
                            null
                        }
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
                        <input type="text" id="input-max" style={{width: '2em'}} value={props.type === 'pie' ? props.data.Total : props.fmaxitems.value} onChange={handlePageSizeChange} disabled={props.type === 'pie'}/>
                    </globalComponents.ValidatedItem>
                    {'\u00a0'}
                    <span>{he.translate('freq__visualization_display_top_suffix_{n}', {n: parseInt(props.fmaxitems.value) || 100})}
                        {props.type === 'pie' ?
                            <globalComponents.InlineHelp noSuperscript={true}>TODO: In order for pie to represent 100% all items needs to be shown</globalComponents.InlineHelp> :
                            null}
                    </span>
                    {props.type === 'bar' || props.type === 'pie' ?
                        <>
                            <label htmlFor="sel-order">{he.translate('freq__visualization_sort_by')}:</label>
                            <select id="sel-order" value={props.type === 'pie' ? props.dataKey : props.sortColumn} onChange={handleOrderChange} disabled={props.type === 'pie'} >
                                <option value="0">{he.translate('freq__unit_value')}</option>
                                <option value="freq">{he.translate('freq__unit_abs')}</option>
                                {List.some(v => !!v.rel, props.data.Items) ?
                                    <option value="rel">{he.translate('freq__unit_rel')}</option> :
                                    null
                                }
                            </select>
                        </> :
                        null}
                    <label>{he.translate('freq__download_chart')}:</label>
                    <S.DownloadButton src={he.createStaticUrl('img/download-button.svg')} alt={he.translate('freq__download_chart')} onClick={props.handleDownload} />
                    {props.isBusy ?
                        <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} /> :
                        null}
                </div>
                {props.type === 'pie' ?
                    <PieChartCustomizer sourceId={props.sourceId} value={props.pieChartMaxIndividualItems} /> :
                    null
                }
            </S.FreqChartsParamsFieldset>
        );
    }

    // ---------------------- <PieChartCustomizer /> ---------------

    const PieChartCustomizer:React.FC<{
        sourceId:string;
        value:Kontext.FormValue<string>;

    }> = ({sourceId, value}) => {

        const handleInput = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<typeof Actions.FreqChartsPieSetMaxIndividualItems>({
                name: Actions.FreqChartsPieSetMaxIndividualItems.name,
                payload: {
                    sourceId,
                    value: evt.target.value
                }
            });
        }

        return (
            <div>
                <label>
                    {he.translate('freq__pie_chart_max_items_input_label')}:{'\u00a0'}
                    <globalComponents.ValidatedItem invalid={value.isInvalid}>
                        <input type="text" style={{width: '2em'}} onChange={handleInput} value={value.value} />
                    </globalComponents.ValidatedItem>
                </label>
            </div>
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
        pieChartMaxIndividualItems:Kontext.FormValue<string>;
    }> = (props) => {

        const maxLabelLength = (List.maxItem(
            v => v.length,
            List.map(v => v.Word.join(' | '), props.data.Items)
        ) as string).length;

        const [getPng, {ref, isLoading}] = useCurrentPng();
        const handleDownload = React.useCallback(async () => {
            const png = await getPng();
            if (png) {
                FileSaver.saveAs(png, 'freq-chart.png')
            }
        }, [getPng])

        const renderChart = () => {
            switch (props.type)  {
                case 'bar':
                    return <ResponsiveContainer width="95%" height={List.size(props.data.Items)*17+60}>
                        <BarChart data={props.data.Items} layout='vertical' ref={ref}>
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50} label={props.dataKey} />
                            <YAxis type="category" interval={0} dataKey={v => v.Word[0]}
                                width={Math.max(60, Math.min(BAR_CHART_MAX_LABEL_LENGTH, maxLabelLength) * 7)}
                                tickFormatter={value => Strings.shortenText(value, BAR_CHART_MAX_LABEL_LENGTH)} />
                            <Tooltip />
                            <Bar dataKey={props.dataKey} barSize={15} fill={theme.colorLogoBlue} />
                        </BarChart>
                    </ResponsiveContainer>
                case 'cloud':
                    return <globalComponents.ResponsiveWrapper render={(width, height) =>
                                <WordCloud width={width} height={height} data={props.data.Items}
                                        dataTransform={dataTransform} font={theme.monospaceFontFamily} ref={ref} />}
                                />;
                case 'pie':
                    const modList = reduceNumResultItems(
                        props.data.Items,
                        parseInt(props.pieChartMaxIndividualItems.value),
                        he.translate('freq__pie_other_group_label')
                    );
                    const legendFormatter = (value, entry) => {
                        return (
                            <span style={{color: '#000'}}>
                                <strong>{entry.payload.Word.join(' | ')}</strong>:{'\u00a0'}
                                {entry.payload[props.dataKey]}{'\u00a0'}
                                ({he.formatNumber(100*entry.payload.percent, 1)}%)
                            </span>
                        );
                    };
                    const RADIAN = Math.PI / 180;
                    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                        const radius = innerRadius + (outerRadius - innerRadius) * 1.25;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                        return (
                          <text x={x} y={y} fill="#111111" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                            {Strings.shortenText(modList[index].Word.join(' '), PIE_CHART_MAX_LABEL_LENGTH)}
                          </text>
                        );
                      };
                    return (
                        <ResponsiveContainer width="95%" height={300}>
                            <PieChart ref={ref}>
                                <Pie
                                    isAnimationActive={false}
                                    data={modList}
                                    dataKey={props.dataKey}
                                    label={renderCustomizedLabel}
                                    cx="40%"
                                    cy="50%"
                                    labelLine={true} >
                                        {List.map(
                                            (entry, i) => <Cell key={`cell-${entry.Word.join(':')}`} fill={theme.colorCategoricalData[i]} />,
                                            modList
                                        )}
                                </Pie>
                                <Legend verticalAlign="middle" align="right" layout="vertical" formatter={legendFormatter} />
                            </PieChart>
                        </ResponsiveContainer>
                    );
                case 'timeline':
                    return <ResponsiveContainer width="95%" height={300}>
                        <LineChart data={props.data.Items} ref={ref}>
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50} dataKey={v => v.Word.join(' | ')} allowDecimals={false} domain={['dataMin', 'dataMax']}/>
                            <YAxis type='number' />
                            <Tooltip />
                            <Line dataKey={props.dataKey} strokeWidth={3} stroke={theme.colorLogoBlue} />
                        </LineChart>
                    </ResponsiveContainer>;
                case 'timescatter':
                        return <ResponsiveContainer width="95%" height={300}>
                            <ScatterChart ref={ref}>
                                <CartesianGrid strokeDasharray='3 3'/>
                                <XAxis type='number' height={50} dataKey={v => v.Word.join(' | ')} allowDecimals={false} domain={['dataMin', 'dataMax']}/>
                                <YAxis type='number' />
                                <Tooltip />
                                <Scatter data={props.data.Items} dataKey={props.dataKey} fill={theme.colorLogoBlue} />
                            </ScatterChart>
                        </ResponsiveContainer>;
                default:
                    return <div>ERROR: unknown chart type <strong>{props.type}</strong></div>;
            }
        }

        return (
            <S.FreqChartSection>
                <h3>{pipe(props.data.Head, List.filter(v => v.s !== 'freq' && v.s !== 'rel'), List.map(v => v.n)).join(' | ')}</h3>
                <FreqChartsParams sourceId={props.sourceId} data={props.data} type={props.type}
                        dataKey={props.dataKey} isBusy={props.isBusy} dtFormat={props.dtFormat}
                        fmaxitems={props.fmaxitems} sortColumn={props.sortColumn} handleDownload={handleDownload}
                        pieChartMaxIndividualItems={props.pieChartMaxIndividualItems} />
                <div className="chart-wrapper">
                    {renderChart()}
                </div>
            </S.FreqChartSection>
        );
    };

    // ----------------------- <FreqChartsLoaderView /> --------------------

    const FreqChartsLoaderView:React.FC<{
        sourceId:string;
        dtFormat:string;
        heading:string;
    }> = ({sourceId, dtFormat, heading}) => {

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
                <h3>{heading}</h3>
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
                        isEmptyResultBlock(block) ?
                            <FreqChartsLoaderView key={sourceId} sourceId={sourceId} dtFormat={props.dtFormat[sourceId]}
                                    heading={block.heading} /> :
                            <FreqChart key={sourceId} sourceId={sourceId} data={block}
                                    dataKey={props.dataKey[sourceId]}
                                    type={props.type[sourceId]}
                                    isBusy={props.isBusy[sourceId]}
                                    dtFormat={props.dtFormat[sourceId]} fmaxitems={props.fmaxitems[sourceId]}
                                    sortColumn={props.sortColumn[sourceId]}
                                    pieChartMaxIndividualItems={props.pieChartMaxIndividualItems[sourceId]} />
                    )
                )
            )}
        </div>
    );

    return {
        FreqChartsView: Bound(FreqChartsView, freqChartsModel)
    };
}