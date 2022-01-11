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
import { BoundWithProps, IActionDispatcher } from "kombo";
import { FreqChartsModel, FreqChartsModelState } from "../../../models/freqs/regular/freqCharts";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, ResponsiveContainer } from 'recharts';
import { List } from 'cnc-tskit';
import { Actions } from '../../../models/freqs/regular/actions';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    freqChartsModel:FreqChartsModel,
) {

    // ----------------------- <FreqCharts /> -------------------------

    interface FreqChartsProps {
    }

    const FreqCharts:React.FC<FreqChartsProps & FreqChartsModelState> = (props) => {

        const handleUnitsChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeUnits>({
                name: Actions.FreqChartsChangeUnits.name,
                payload: {value: e.target.value}
            });
        }

        const handleTypeChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeType>({
                name: Actions.FreqChartsChangeType.name,
                payload: {value: e.target.value}
            });
        }

        const handlePageSizeChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangePageSize>({
                name: Actions.FreqChartsChangePageSize.name,
                payload: {value: e.target.value}
            });
        }

        return <div>
            <fieldset>
                <label htmlFor='sel-units'>units:</label>
                <select id='sel-units' value={props.units} onChange={handleUnitsChange}>
                    <option value='abs'>abs</option>
                    <option value='ipm'>ipm</option>
                </select>
                <label htmlFor='sel-type'>type:</label>
                <select id='sel-type' value={props.type} onChange={handleTypeChange}>
                    <option value='bar'>bar</option>
                    <option value='line'>line</option>
                </select>
                <label htmlFor='input-max'>display max:</label>
                <input type='number' min={1} id='input-max' value={props.fmaxitems} onChange={handlePageSizeChange} />
                {props.isBusy ?
                    <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}alt={he.translate('global__loading')} /> :
                    null}
            </fieldset>
            {props.type === 'bar' ?
                List.map((d, i) =>
                    <ResponsiveContainer width="95%" height={300}>
                        <BarChart key={i} data={d.Items} layout='vertical' barCategoryGap={1} >
                            <CartesianGrid strokeDasharray='3 3'/>
                            <XAxis type='number' height={50} label={props.units} />
                            <YAxis type='category' widths={150} dataKey={v => v.Word[0]} />
                            <Tooltip />
                            <Bar dataKey={props.units === 'abs' ? 'freq' : 'rel'} barSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                , props.data) :
                List.map((d, i) =>
                    <LineChart key={i} data={d.Items} width={500} height={300} >
                        <CartesianGrid strokeDasharray='3 3'/>
                        <XAxis type='category' height={50} dataKey={v => v.Word[0]} />
                        <YAxis type='number' widths={150} />
                        <Tooltip />
                        <Line dataKey={props.units === 'abs' ? 'freq' : 'rel'} />
                    </LineChart>
                , props.data)
            }
        </div>;
    };

    return {
        FreqChartsView: BoundWithProps<FreqChartsProps, FreqChartsModelState>(FreqCharts, freqChartsModel)
    };
}