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
import { FreqChartsModel, FreqChartsModelState } from "public/files/js/models/freqs/regular/freqCharts";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { ResultBlock } from 'public/files/js/models/freqs/regular/dataRows';
import { List } from 'cnc-tskit';
import { Actions } from '../../../models/freqs/regular/actions';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    freqChartsModel:FreqChartsModel,
) {

    // ----------------------- <FreqCharts /> -------------------------

    interface FreqChartsProps {
        data:Array<ResultBlock>;
    }

    const FreqCharts:React.FC<FreqChartsProps & FreqChartsModelState> = (props) => {

        const handleUnitsChange = (e) => {
            dispatcher.dispatch<typeof Actions.FreqChartsChangeUnits>({
                name: Actions.FreqChartsChangeUnits.name,
                payload: {value: e.target.value}
            });
        }

        return <div>
            <select value={props.units} onChange={handleUnitsChange}>
                <option value='abs'>abs</option>
                <option value='ipm'>ipm</option>
            </select>
            {List.map((d, i) =>
                <BarChart key={i} data={d.Items} width={500} height={300} layout='vertical' barCategoryGap={1} >
                    <CartesianGrid strokeDasharray='3 3'/>
                    <XAxis type='number' height={50} label={props.units} />
                    <YAxis type='category' widths={150} dataKey={v => v.Word[0]} />
                    <Tooltip />
                    <Bar dataKey={props.units === 'abs' ? 'freq' : 'rel'} />
                </BarChart>
            , props.data)}
        </div>;
    };

    return {
        FreqChartsView: BoundWithProps<FreqChartsProps, FreqChartsModelState>(FreqCharts, freqChartsModel)
    };
}