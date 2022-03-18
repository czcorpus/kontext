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
import * as ReactDOM from 'react-dom';
import * as Kontext from '../../../types/kontext';
import { Bound, IActionDispatcher } from "kombo";
import { FreqChartsModel, FreqChartsModelState } from '../../../models/freqs/regular/freqCharts';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, ScatterChart, Scatter,
    Label, ErrorBar, Line, Area, ComposedChart
} from 'recharts';
import { Dict, List, pipe, Strings, tuple } from 'cnc-tskit';
import { Actions } from '../../../models/freqs/regular/actions';
import { Actions as GlobalActions } from '../../../models/common/actions';
import * as theme from '../../theme/default';
import { init as initSaveViews } from './save';
import { init as initWordCloud } from './wordCloud/index';
import * as S from './style';
import {
    isEmptyResultBlock, ResultBlock, ResultItem
} from '../../../models/freqs/regular/common';
import { WordCloudItemCalc } from './wordCloud/calc';
import { FreqChartsAvailableData, FreqChartsAvailableOrder, FreqChartsAvailableTypes
} from '../../../models/freqs/common';
import { FreqChartsSaveFormModel } from '../../../models/freqs/regular/saveChart';



function transformDataForErrorBars(block:ResultBlock):Array<ResultItem & {z:number}> {
    return List.map(
        item => {
            return {
                ...item,
                relConfidence: tuple(
                    item.rel - item.relConfidence[0],
                    item.relConfidence[1] - item.rel
                ),
                freqConfidence: tuple(
                    item.freq - item.freqConfidence[0],
                    item.freqConfidence[1] - item.freq
                ),
                z: 10
            }
        },
        block.Items
    );
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    freqChartsModel:FreqChartsModel,
    chartSaveFormModel:FreqChartsSaveFormModel
) {

    // max chart label lengths
    const BAR_CHART_MAX_LABEL_LENGTH = 50;
    const WORD_CLOUD_MAX_LABEL_LENGTH = 30;

    const globalComponents = he.getLayoutViews();
    const SaveForm = initSaveViews(dispatcher, he, chartSaveFormModel);
    const WordCloud = initWordCloud<ResultItem>(he);

    const dataTransform = (unit:FreqChartsAvailableData) => (item:ResultItem):WordCloudItemCalc => {
        return {
            fulltext: item.Word.join(' '),
            text: Strings.shortenText(item.Word.join(' '), WORD_CLOUD_MAX_LABEL_LENGTH),
            value: unit === 'freq' ? item.freq : item.rel,
            tooltip: [
                {
                    label: unit === 'freq' ? he.translate('freq__unit_abs') : he.translate('freq__unit_rel'),
                    value: unit === 'freq' ?
                        `${item.freq} [${item.freqConfidence[0]}, ${item.freqConfidence[1]}]` :
                        `${item.rel} [${item.relConfidence[0]}, ${item.relConfidence[1]}]`
                }
            ],
            payload: {
                pfilter: item.pfilter
            }
        }
    };

    // ----------------------- <ChartTypeSelector /> ----------------------

    const ChartTypeSelector:React.FC<{
        dtFormat:string;
        sourceId:string;
        type:FreqChartsAvailableTypes;

    }> = ({dtFormat, sourceId, type}) => {

        const handleTypeChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeType>({
                name: Actions.FreqChartsChangeType.name,
                payload: {
                    value: e.target.value,
                    sourceId
                }
            });
        }

        return (
            <>
                <label htmlFor="sel-type">{he.translate('freq__visualisation_type')}:</label>
                <select id="sel-type" value={type} onChange={handleTypeChange}>
                    <option value="bar">{he.translate('freq__visualisation_type_bar')}</option>
                    <option value="cloud">{he.translate('freq__visualisation_type_cloud')}</option>
                    {dtFormat ?
                        <>
                            <option value="timeline">{he.translate('freq__visualisation_type_line')}</option>
                            <option value="timescatter">{he.translate('freq__visualisation_type_scatter')}</option>
                        </> :
                        null
                    }
                </select>
            </>
        )
    };

    // ----------------------- <FreqUnitsSelector /> ---------------------------

    const FreqUnitsSelector:React.FC<{
        sourceId:string;
        dataKey:FreqChartsAvailableData;
        data:ResultBlock;

    }> = ({sourceId, data, dataKey}) => {

        const handleUnitsChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeUnits>({
                name: Actions.FreqChartsChangeUnits.name,
                payload: {
                    value: e.target.value,
                    sourceId
                }
            });
        }

        return (
            <>
                <label htmlFor="sel-units">{he.translate('freq__visualization_units')}:</label>
                <select id="sel-units" value={dataKey} onChange={handleUnitsChange}>
                    <option value="freq">{he.translate('freq__unit_abs')}</option>
                    {List.some(v => !!v.rel, data.Items) ?
                        <option value="rel">{he.translate('freq__unit_rel')}</option> :
                        null}
                </select>
            </>
        );
    }

    // ----------------------- <FreqSortBySelector /> ----------------------------

    const FreqSortBySelector:React.FC<{
        sourceId:string;
        sortColumn:FreqChartsAvailableOrder;
        data:ResultBlock;

    }> = ({sourceId, sortColumn, data}) => {

        const handleOrderChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeOrder>({
                name: Actions.FreqChartsChangeOrder.name,
                payload: {
                    value: e.target.value,
                    sourceId
                }
            });
        }
        return (
            <>
                <label htmlFor="sel-order">{he.translate('freq__visualization_sort_by')}:</label>
                <select id="sel-order" value={sortColumn} onChange={handleOrderChange}>
                    <option value="0">{he.translate('freq__unit_value')}</option>
                    <option value="freq">{he.translate('freq__unit_abs')}</option>
                    {data.NoRelSorting ?
                        null :
                        <option value="rel">{he.translate('freq__unit_rel')}</option>
                    }
                </select>
            </>
        )
    }

    // ---------------------- <PageSizeInput /> ----------------------

    const PageSizeInput:React.FC<{
        sourceId:string;
        fmaxitems:Kontext.FormValue<string>;
        type:FreqChartsAvailableTypes;
        data:ResultBlock;

    }> = ({sourceId, fmaxitems, type, data}) => {

        const handlePageSizeChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangePageSize>({
                name: Actions.FreqChartsChangePageSize.name,
                payload: {
                    value: e.target.value,
                    sourceId
                }
            });
        }

        return (
            <>
                <label htmlFor="input-max">
                    {he.translate('freq__visualization_display_top_prefix_{n}', {n: parseInt(fmaxitems.value) || 100})}
                </label>
                <globalComponents.ValidatedItem invalid={fmaxitems.isInvalid}>
                    <input type="text" id="input-max" style={{width: '2em'}} value={fmaxitems.value} onChange={handlePageSizeChange} />
                </globalComponents.ValidatedItem>
                {'\u00a0'}<span>{he.translate('freq__visualization_display_top_suffix_{n}', {n: parseInt(fmaxitems.value) || 100})}
                </span>
            </>
        );
    }

    // ---------------------- <DownloadFormatSelector /> --------------

    const DownloadFormatSelector:React.FC<{
        sourceId:string;
        format:Kontext.ChartExportFormat;

    }> = ({ sourceId, format }) => {

        const onChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch<typeof Actions.FreqChartsSetDownloadFormat>({
                name: Actions.FreqChartsSetDownloadFormat.name,
                payload: {
                    sourceId,
                    format: evt.target.value as Kontext.ChartExportFormat
                }
            });
        };

        return <select value={format} onChange={onChange}>
            <option value="png">PNG</option>
            <option value="png-print">PNG ({he.translate('freq__print_quality')})</option>
            {/*<option value="svg">SVG</option>*/}
            <option value="pdf">PDF</option>
        </select>;
    }

    // ----------------------- <FreqChartsParams /> -------------------

    const FreqChartsParams:React.FC<{
        sourceId:string;
        type:FreqChartsAvailableTypes;
        dataKey:FreqChartsAvailableData;
        data:ResultBlock;
        fmaxitems:Kontext.FormValue<string>;
        sortColumn:FreqChartsAvailableOrder;
        isBusy:boolean;
        dtFormat:string;
        downloadFormat:Kontext.ChartExportFormat;
        handleDownload:()=>void;

    }> = (props) => (
        <S.FreqChartsParamsFieldset>
            <globalComponents.ExpandableArea initialExpanded={false} label={he.translate('freq__chart_options')}>
                <div className="opts-line">
                    <ChartTypeSelector sourceId={props.sourceId} type={props.type} dtFormat={props.dtFormat} />
                    <FreqUnitsSelector sourceId={props.sourceId} dataKey={props.dataKey} data={props.data} />
                    <PageSizeInput sourceId={props.sourceId} data={props.data} fmaxitems={props.fmaxitems} type={props.type} />
                    {props.type === 'bar' || props.type === 'cloud' ?
                        <FreqSortBySelector sourceId={props.sourceId} sortColumn={props.sortColumn} data={props.data} /> :
                        null
                    }
                </div>
                <div className="opts-line">
                    <label>{he.translate('freq__download_chart')}:</label>
                    <DownloadFormatSelector sourceId={props.sourceId} format={props.downloadFormat} />
                    <S.DownloadButton src={he.createStaticUrl('img/download-button.svg')} alt={he.translate('freq__download_chart')} onClick={props.handleDownload} />
                    {props.isBusy ?
                        <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} /> :
                        null}
                </div>
            </globalComponents.ExpandableArea>
        </S.FreqChartsParamsFieldset>
    );


    // ----------------------- <FreqChart /> -------------------------

    const FreqChart:React.FC<{
        sourceId:string;
        data:ResultBlock;
        type:FreqChartsAvailableTypes;
        dataKey:FreqChartsAvailableData;
        isBusy:boolean;
        dtFormat:string;
        fmaxitems:Kontext.FormValue<string>;
        sortColumn:FreqChartsAvailableOrder;
        downloadFormat:Kontext.ChartExportFormat;
    }> = (props) => {

        const ref = React.useRef(null);

        const maxLabelLength = pipe(
            List.map(v => v.Word.join(' | '), props.data.Items),
            List.maxItem(v => v.length),
            x => x ? x.length : 0
        );

        React.useEffect(
            () => {
                const container = ReactDOM.findDOMNode(ref.current);
                if (container instanceof Text || !container) {
                    return;
                }
                const svg = container.querySelector('svg');
                const svgURL = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgURL], {type: "image/svg+xml;charset=utf-8"});
                svgBlob.text().then(
                    value => {
                        dispatcher.dispatch<typeof GlobalActions.SetChartDownloadSVG>({
                            name: GlobalActions.SetChartDownloadSVG.name,
                            payload: {
                                sourceId: `${FreqChartsSaveFormModel.SVG_SAVE_ID_PREFIX}${props.sourceId}`,
                                value,
                                type: props.type,
                                // the maxLabelLength is for server to correct issues with text overlapping the view
                                args: {maxLabelLength}
                            }
                        })
                    },
                    error => {
                        dispatcher.dispatch(
                            GlobalActions.SetChartDownloadSVG,
                            error
                        )
                    }
                );
            }
        )

        const handleDownload = () => {
            dispatcher.dispatch<typeof GlobalActions.ConvertChartSVG>({
                name: GlobalActions.ConvertChartSVG.name,
                payload: {
                    sourceId: `${FreqChartsSaveFormModel.SVG_SAVE_ID_PREFIX}${props.sourceId}`,
                    format: props.downloadFormat,
                    chartType: props.type
                }
            });
        }

        const _dispatchFilter = (url) => {
            dispatcher.dispatch<typeof Actions.ResultApplyQuickFilter>({
                name: Actions.ResultApplyQuickFilter.name,
                payload: {
                    url: url,
                    blankWindow: false,
                }
            });
        }
        const handleBarChartFilter = (data) => _dispatchFilter(data['activePayload'][0]['payload']['pfilter']);
        const handleTimelineChartFilter = handleBarChartFilter;
        const handleScatterChartFilter = (data) => _dispatchFilter(data['pfilter']);
        const handleWordCloudChartFilter = (data) => _dispatchFilter(data['payload']['pfilter']);

        const xUnits = props.dataKey === 'freq' ?
            he.translate('freq__unit_abs') : he.translate('freq__unit_rel');

        const renderChart = () => {
            const confidenceKey = props.dataKey === 'rel' ? 'relConfidence' : 'freqConfidence';
            const tooltipFormatter = (value, name, props) => {
                if (props.payload[props.dataKey] === undefined) {  // scatter chart heading
                    return value
                }
                return [`${props.payload[props.dataKey]} [${(props.payload[props.dataKey]-props.payload[confidenceKey][0]).toFixed(2)}, ${(props.payload[props.dataKey]+props.payload[confidenceKey][1]).toFixed(2)}]`, null];
            }

            switch (props.type)  {
                case 'bar':
                    return <ResponsiveContainer width="95%" height={List.size(props.data.Items)*17+60}>
                        <BarChart data={transformDataForErrorBars(props.data)} layout='vertical' ref={ref} barGap="7" onClick={handleBarChartFilter}>
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50}>
                                <Label value={xUnits} position="insideBottom" />
                            </XAxis>
                            <YAxis type="category" interval={0} dataKey={v => v.Word[0]}
                                width={Math.max(60, Math.min(BAR_CHART_MAX_LABEL_LENGTH, maxLabelLength) * 7)}
                                tickFormatter={value => Strings.shortenText(value, BAR_CHART_MAX_LABEL_LENGTH)} />
                            <Tooltip formatter={tooltipFormatter}/>
                            <Bar dataKey={props.dataKey} fill={theme.colorLogoBlue} isAnimationActive={false} barSize={14}>
                                <ErrorBar dataKey={confidenceKey} width={0} strokeWidth={3} stroke={theme.colorLogoPink} opacity={0.8} direction="x" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>;
                case 'cloud':
                    return (
                        <div className="cloud-wrapper">
                            <globalComponents.ResponsiveWrapper render={(width, height) =>
                                <WordCloud width={width} height={height} data={props.data.Items} onClick={handleWordCloudChartFilter}
                                        dataTransform={dataTransform(props.dataKey)} font={theme.monospaceFontFamily} ref={ref} />}
                                />
                        </div>
                    );
                case 'timeline': {
                    return <ResponsiveContainer width="95%" height={300}>
                        <ComposedChart data={props.data.Items} ref={ref} onClick={handleTimelineChartFilter}>
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50} dataKey={v => v.Word.join(' | ')} allowDecimals={false} domain={['dataMin', 'dataMax']}>
                                <Label value={he.translate(`freq__chart_date_${props.dtFormat}`)} position="insideBottom" />
                            </XAxis>
                            <YAxis type="number">
                                <Label value={xUnits} angle={-90} position="insideLeft" style={{textAnchor: 'middle'}} />
                            </YAxis>
                            <Tooltip />
                            <Line dataKey={props.dataKey} strokeWidth={3} stroke={theme.colorLogoBlue}/>
                            <Area dataKey={confidenceKey} strokeWidth={3} stroke={theme.colorLightPink} fill={theme.colorLightPink}/>
                        </ComposedChart>
                    </ResponsiveContainer>;
                }
                case 'timescatter':
                    return <ResponsiveContainer width="95%" height={300}>
                        <ScatterChart ref={ref}>
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50} dataKey={v => v.Word.join(' | ')} allowDecimals={false} domain={['dataMin', 'dataMax']}>
                                <Label value={he.translate(`freq__chart_date_${props.dtFormat}`)} position="insideBottom" />
                            </XAxis>
                            <YAxis type="number">
                                <Label value={xUnits} angle={-90} position="insideLeft" style={{textAnchor: 'middle'}}  />
                            </YAxis>
                            <Tooltip formatter={tooltipFormatter}/>
                            <Scatter dataKey={props.dataKey} data={transformDataForErrorBars(props.data)} onClick={handleScatterChartFilter}
                                    fill={theme.colorLogoBlue} isAnimationActive={false} legendType="wye">
                                <ErrorBar dataKey={confidenceKey} width={0} strokeWidth={2} stroke={theme.colorLogoPink} opacity={0.8} direction="y" />
                            </Scatter>
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
                        downloadFormat={props.downloadFormat} />
                <div className="chart-wrapper">
                    {renderChart()}
                </div>
            </S.FreqChartSection>
        );
    };

    // ----------------------- <FreqChartsLoaderView /> --------------------

    const reloadData = (sourceId:string) => {
        dispatcher.dispatch<typeof Actions.FreqChartsReloadData>({
            name: Actions.FreqChartsReloadData.name,
            payload: {
                sourceId
            }
        })
    };

    const FreqChartsLoaderView:React.FC<{
        sourceId:string;
        dtFormat:string;
        heading:string;
        error?:Error;
    }> = ({sourceId, dtFormat, heading, error}) => {

        React.useEffect(
            () => {
                if (dtFormat) { // if timedata => switch to timeline chart automatically
                    dispatcher.dispatch<typeof Actions.FreqChartsSetParameters>({
                        name: Actions.FreqChartsSetParameters.name,
                        payload: {
                            sourceId,
                            type: 'timescatter',
                            dataKey: 'rel',
                            sortColumn: '0'
                        }
                    })
                } else {
                    reloadData(sourceId);
                }
            },
            []
        );

        return (
            <S.FreqResultLoaderView>
                <h3>{heading}</h3>
                {error ? [
                        <div className='error'>
                            <globalComponents.StatusIcon status='error' />
                            {error.message}
                        </div>,
                        <a className='util-button' onClick={() => reloadData(sourceId)}>&#x21bb; {he.translate('global__try_again')}</a>,
                    ] :
                    <globalComponents.AjaxLoaderImage />
                }
            </S.FreqResultLoaderView>
        );
    }

    // --------------------- <FreqChartsView /> -----------------------------------------


    const FreqChartsView:React.FC<FreqChartsModelState> = (props) => {

        const handleSaveFormClose = () => {
            dispatcher.dispatch(
                Actions.ResultCloseSaveForm,
            );
        }

        return (
            <S.FreqChartsView>
                {pipe(
                    props.data,
                    Dict.toEntries(),
                    List.map(
                        ([sourceId, block]) => (
                            isEmptyResultBlock(block) ?
                                <FreqChartsLoaderView key={sourceId} sourceId={sourceId} dtFormat={props.dtFormat[sourceId]}
                                        heading={block.heading} error={props.isError[sourceId]} /> :
                                <FreqChart key={sourceId} sourceId={sourceId} data={block}
                                        dataKey={props.dataKey[sourceId]}
                                        type={props.type[sourceId]}
                                        isBusy={props.isBusy[sourceId]}
                                        dtFormat={props.dtFormat[sourceId]} fmaxitems={props.fmaxitems[sourceId]}
                                        sortColumn={props.sortColumn[sourceId]}
                                        downloadFormat={props.downloadFormat[sourceId]} />
                        )
                    )
                )}
                {props.saveFormActive ?
                    <SaveForm onClose={handleSaveFormClose} /> :
                    null
                }
            </S.FreqChartsView>
        );
    };

    return {
        FreqChartsView: Bound(FreqChartsView, freqChartsModel)
    };
}