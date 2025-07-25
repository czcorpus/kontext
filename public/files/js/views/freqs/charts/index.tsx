/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import * as Kontext from '../../../types/kontext.js';
import { BoundWithProps, IActionDispatcher } from "kombo";
import { FreqChartsModel } from '../../../models/freqs/regular/freqCharts.js';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    ResponsiveContainer, ScatterChart, Scatter,
    Label, ErrorBar, Line, Area, ComposedChart
} from 'recharts';
import { Dict, List, pipe, Strings, tuple } from 'cnc-tskit';
import { Actions } from '../../../models/freqs/regular/actions.js';
import { Actions as GlobalActions } from '../../../models/common/actions.js';
import * as theme from '../../theme/default/index.js';
import { init as initSaveViews } from './save.js';
import { init as initWordCloud } from './wordCloud/index.js';
import { init as initFreqCommonViews } from '../common.js';
import * as S from './style.js';
import {
    FreqChartsModelState,
    FreqViewProps,
    isEmptyResultBlock, ResultBlock, ResultItem
} from '../../../models/freqs/regular/common.js';
import { WordCloudItemCalc } from './wordCloud/calc.js';
import { FreqChartsAvailableData, FreqChartsAvailableOrder, FreqChartsAvailableTypes
} from '../../../models/freqs/common.js';
import { FreqChartsSaveFormModel } from '../../../models/freqs/regular/saveChart.js';
import { CSSProperties } from 'styled-components';



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

/**
 *
 * @param dispatcher
 * @param he
 * @param freqChartsModel
 * @param chartSaveFormModel
 * @returns
 */
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
    const {ShareLinkWidget} = initFreqCommonViews(dispatcher, he);

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
        fpagesize:Kontext.FormValue<string>;
        type:FreqChartsAvailableTypes;
        data:ResultBlock;

    }> = ({sourceId, fpagesize, type, data}) => {

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
                    {he.translate('freq__visualization_display_top_prefix_{n}', {n: parseInt(fpagesize.value) || 100})}
                </label>
                <globalComponents.ValidatedItem invalid={fpagesize.isInvalid}>
                    <input type="text" id="input-max" style={{width: '2em'}} value={fpagesize.value} onChange={handlePageSizeChange} />
                </globalComponents.ValidatedItem>
                {'\u00a0'}<span>{he.translate('freq__visualization_display_top_suffix_{n}', {n: parseInt(fpagesize.value) || 100})}
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
        fpagesize:Kontext.FormValue<string>;
        sortColumn:FreqChartsAvailableOrder;
        isBusy:boolean;
        dtFormat:string;
        downloadFormat:Kontext.ChartExportFormat;
        handleDownload:()=>void;
        onShowShare:(sourceId:string)=>void;

    }> = (props) => (
        <S.FreqChartsParamsFieldset>
            <globalComponents.ExpandableArea initialExpanded={false} label={he.translate('freq__chart_options')}>
                <div className="opts-line">
                    <ChartTypeSelector sourceId={props.sourceId} type={props.type} dtFormat={props.dtFormat} />
                    <FreqUnitsSelector sourceId={props.sourceId} dataKey={props.dataKey} data={props.data} />
                    <PageSizeInput sourceId={props.sourceId} data={props.data} fpagesize={props.fpagesize} type={props.type} />
                    {props.type === 'bar' || props.type === 'cloud' ?
                        <FreqSortBySelector sourceId={props.sourceId} sortColumn={props.sortColumn} data={props.data} /> :
                        null
                    }
                </div>
                <div className="opts-line">
                    <label>{he.translate('freq__download_chart')}:</label>
                    <DownloadFormatSelector sourceId={props.sourceId} format={props.downloadFormat} />
                    <a onClick={props.handleDownload}>
                        <globalComponents.ImgWithMouseover
                                alt={he.translate('freq__download_chart')}
                                src={he.createStaticUrl('img/download-button.svg')}
                                style={{width: '1.1em', marginLeft: '0.2em'}} />
                    </a>
                    {props.isBusy ?
                        <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} /> :
                        null}
                    <div className="share">
                        <label>{he.translate('freq__share_chart')}:</label>
                        <a onClick={()=>props.onShowShare(props.sourceId)}>
                            <globalComponents.ImgWithMouseover
                                    style={{width: '1em', verticalAlign: 'middle'}}
                                    src={he.createStaticUrl('img/share.svg')}
                                    alt={he.translate('freq__share_chart')}
                                    title={he.translate('freq__share_chart')} />
                        </a>
                    </div>
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
        fpagesize:Kontext.FormValue<string>;
        sortColumn:FreqChartsAvailableOrder;
        downloadFormat:Kontext.ChartExportFormat;
        shareWidgetIsBusy:boolean;
        onShowShare:(sourceId:string)=>void;

    }> = (props) => {

        const ref = React.useRef(null);

        const maxLabelLength = pipe(
            List.map(v => v.Word.join(' | '), props.data.Items),
            List.maxItem(v => v.length),
            x => x ? x.length : 0
        );

        const handleDownload = () => {
            const container = ref.current;
            if (!container) {
                return;
            }
            const svg = container.querySelector('svg');
            console.log('container: ', container)
            console.log('svg: ', svg)
            const svgURL = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgURL], {type: "image/svg+xml;charset=utf-8"});
            svgBlob.text().then(
                value => {
                    dispatcher.dispatch<typeof GlobalActions.ConvertChartSVG>({
                        name: GlobalActions.ConvertChartSVG.name,
                        payload: {
                            sourceId: `${FreqChartsSaveFormModel.SVG_SAVE_ID_PREFIX}${props.sourceId}`,
                            format: props.downloadFormat,
                            chartType: props.type,
                            data: value,
                            args: {maxLabelLength}
                        }
                    });
                },
                error => {
                    dispatcher.dispatch<typeof GlobalActions.ConvertChartSVG>({
                        name: GlobalActions.ConvertChartSVG.name,
                        error
                    });
                }
            );



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
                const ttLft = he.formatNumber(props.payload[props.dataKey]-props.payload[confidenceKey][0], 3);
                const ttRgt = he.formatNumber(props.payload[props.dataKey]+props.payload[confidenceKey][1], 3);
                const rel = he.formatNumber(props.payload[props.dataKey]);
                const msg = he.translate('freq__chart_p_filter_tooltip');
                const ttStyle:CSSProperties = {
                    color: theme.colorLightText,
                    fontSize: '0.8em'
                };
                return [<div>{`${rel + '\u00a0'}[${ttLft}, ${ttRgt}]`}<br /><span style={ttStyle}>({msg})</span></div>, null];
            }

            switch (props.type)  {
                case 'bar':
                    return (
                        <div ref={ref}>
                            <ResponsiveContainer width="95%" height={List.size(props.data.Items)*17+60}>
                                <BarChart data={transformDataForErrorBars(props.data)} layout='vertical' barGap="7" onClick={handleBarChartFilter}>
                                    <CartesianGrid strokeDasharray='3 3'/>
                                    <XAxis type='number' height={50}>
                                        <Label value={xUnits} position="insideBottom" />
                                    </XAxis>
                                    <YAxis type="category" interval={0} dataKey={v => v.Word.join(' ')}
                                        width={Math.max(60, (Math.min(BAR_CHART_MAX_LABEL_LENGTH, maxLabelLength) + 2) * 7)}
                                        tickFormatter={value => Strings.shortenText(value, BAR_CHART_MAX_LABEL_LENGTH)} />
                                    <Tooltip formatter={tooltipFormatter}/>
                                    <Bar dataKey={props.dataKey} fill={theme.colorLogoBlue} isAnimationActive={false} barSize={14}>
                                        <ErrorBar dataKey={confidenceKey} width={0} strokeWidth={3} stroke={theme.colorLogoPink} opacity={0.8} direction="x" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    );
                case 'cloud':
                    return (
                        <div className="cloud-wrapper" ref={ref}>
                            <globalComponents.ResponsiveWrapper render={(width, height) =>
                                <WordCloud width={width} height={height} data={props.data.Items} onClick={handleWordCloudChartFilter}
                                        dataTransform={dataTransform(props.dataKey)} font={theme.monospaceFontFamily} />}
                                />
                        </div>
                    );
                case 'timeline': {
                    return (
                        <div ref={ref}>
                            <ResponsiveContainer width="95%" height={300}>
                                <ComposedChart data={props.data.Items} onClick={handleTimelineChartFilter}>
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
                            </ResponsiveContainer>
                        </div>
                    );
                }
                case 'timescatter':
                    return (
                        <div ref={ref}>
                            <ResponsiveContainer width="95%" height={300}>
                                <ScatterChart>
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
                            </ResponsiveContainer>
                        </div>
                    );
                default:
                    return <div>ERROR: unknown chart type <strong>{props.type}</strong></div>;
            }
        }

        return (
            <S.FreqChartSection>
                <h3>
                    {pipe(props.data.Head, List.filter(v => v.s !== 'freq' && v.s !== 'rel'), List.map(v => v.n)).join(' | ')}
                </h3>
                <FreqChartsParams sourceId={props.sourceId} data={props.data} type={props.type}
                        dataKey={props.dataKey} isBusy={props.isBusy} dtFormat={props.dtFormat}
                        fpagesize={props.fpagesize} sortColumn={props.sortColumn} handleDownload={handleDownload}
                        downloadFormat={props.downloadFormat}
                        onShowShare={props.onShowShare} />
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


    const FreqChartsView:React.FC<FreqChartsModelState & FreqViewProps> = (props) => {

        const handleSaveFormClose = () => {
            dispatcher.dispatch(
                Actions.ResultCloseSaveForm,
            );
        }

        const hideShare = () => {
            dispatcher.dispatch(Actions.ResultHideShareLink);
        };

        const showShare = (sourceId:string) => {
            dispatcher.dispatch(
                Actions.ResultShowShareLink,
                {sourceId}
            );
        };

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
                                        dtFormat={props.dtFormat[sourceId]} fpagesize={props.fpagesize[sourceId]}
                                        sortColumn={props.sortColumn[sourceId]}
                                        downloadFormat={props.downloadFormat[sourceId]}
                                        onShowShare={showShare}
                                        shareWidgetIsBusy={props.shareWidgetIsBusy} />
                        )
                    )
                )}
                {props.saveFormActive ?
                    <SaveForm onClose={handleSaveFormClose} /> :
                    null
                }
                {props.shareLink ?
                    <globalComponents.ModalOverlay onCloseKey={hideShare}>
                        <globalComponents.CloseableFrame
                                onCloseClick={hideShare}
                                label={he.translate('freq__share_table')}>
                            <ShareLinkWidget sourceId={props.shareLink.sourceId} url={props.shareLink.url}
                                isBusy={props.shareWidgetIsBusy} email={props.userEmail} />
                        </globalComponents.CloseableFrame>
                    </globalComponents.ModalOverlay> : null
                }
            </S.FreqChartsView>
        );
    };

    return {
        FreqChartsView: BoundWithProps<FreqViewProps, FreqChartsModelState>(FreqChartsView, freqChartsModel)
    };
}