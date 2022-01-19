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
import { ResultItem, ResultBlock } from 'public/files/js/models/freqs/regular/common';
import * as S from './style';


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

    // ----------------------- <FreqCharts /> -------------------------

    interface FreqChartsProps {
        sourceId:string;
        data:ResultBlock;
        type:FreqChartsAvailableTypes;
        dataKey:FreqChartsAvailableData;
        fmaxitems:number;
        sortColumn:string;
        isBusy:boolean;
        dtFormat:string;
    }

    const FreqChart:React.FC<FreqChartsProps> = (props) => {

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

        const maxLabelLength = (List.maxItem(
            v => v.length,
            props.data.Items.map(v => v.Word[0])
        ) as string).length

        return <div>
            <label>{props.data.Head[0].n}</label>
            <fieldset>
                <label htmlFor='sel-type'>type:</label>
                <select id='sel-type' value={props.type} onChange={handleTypeChange}>
                    <option value='bar'>bar</option>
                    <option value='cloud'>cloud</option>
                    {props.dtFormat ? <option value='timeline'>timeline</option> : null}
                </select>
                {props.type !== 'cloud' ?
                    <>
                        <label htmlFor='sel-units'>units:</label>
                        <select id='sel-units' value={props.dataKey} onChange={handleUnitsChange}>
                            <option value='freq'>abs</option>
                            {List.some(v => !!v.rel, props.data.Items) ?
                                <option value='rel'>ipm</option> :
                                null}
                        </select>
                    </> :
                    null}
                <label htmlFor='input-max'>display max:</label>
                <input type='number' min={1} id='input-max' value={props.fmaxitems} onChange={handlePageSizeChange} />
                {props.type === 'bar' ?
                    <>
                        <label htmlFor='sel-order'>order:</label>
                        <select id='sel-order' value={props.sortColumn} onChange={handleOrderChange}>
                            <option value='0'>name</option>
                            <option value='freq'>freq</option>
                            {List.some(v => !!v.rel, props.data.Items) ?
                                <option value='rel'>rel</option> :
                                null
                            }
                        </select>
                    </> :
                    null}
                {props.isBusy ?
                    <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}alt={he.translate('global__loading')} /> :
                    null}
            </fieldset>
            {props.type === 'bar' ?
                <ResponsiveContainer width="95%" height={List.size(props.data.Items)*17+60}>
                    <BarChart data={props.data.Items} layout='vertical'>
                        <CartesianGrid strokeDasharray='3 3'/>
                        <XAxis type='number' height={50} label={props.dataKey} />
                        <YAxis type="category" interval={0} dataKey={v => v.Word[0]} width={Math.max(60, maxLabelLength * 7)}/>
                        <Tooltip />
                        <Bar dataKey={props.dataKey} barSize={15} fill={theme.colorLogoBlue} />
                    </BarChart>
                </ResponsiveContainer> :

            props.type === 'cloud' ?
                <ResponsiveContainer width={500} height={300}>
                    <WordCloud width={500} height={300} data={props.data.Items} dataTransform={dataTransform} font={theme.monospaceFontFamily} />
                </ResponsiveContainer> :

            props.type === 'timeline' ?
                <ResponsiveContainer width="95%" height={300}>
                    <LineChart data={props.data.Items} >
                        <CartesianGrid strokeDasharray='3 3'/>
                        <XAxis type='number' height={50} dataKey={v => v.Word[0]} allowDecimals={false} domain={['dataMin', 'dataMax']}/>
                        <YAxis type='number' />
                        <Tooltip />
                        <Line dataKey={props.dataKey} />
                    </LineChart>
                </ResponsiveContainer> : null
            }
        </div>;
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
                                    fmaxitems={props.fmaxitems[sourceId]}
                                    sortColumn={props.sortColumn[sourceId]}
                                    type={props.type[sourceId]}
                                    isBusy={props.isBusy[sourceId]}
                                    dtFormat={props.dtFormat[sourceId]} /> :
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