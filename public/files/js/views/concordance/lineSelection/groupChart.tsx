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
import { Cell, LabelList, Legend, Pie, PieChart } from 'recharts';
import { List } from 'cnc-tskit';
import { IActionDispatcher } from 'kombo';
import { Actions } from '../../../models/concordance/actions';
import * as S from './style';
import { LineSelectionModelState } from '../../../models/concordance/lineSelection';
import { LineGroupChartData } from '../../../models/concordance/common';


export interface LineGroupChartProps {
    data:LineGroupChartData;
    exportFormats:Array<string>;
    corpusId:string;
}

export function init(
    he:Kontext.ComponentHelpers,
    dispatcher:IActionDispatcher

):React.FC<LineSelectionModelState> {


    const globalViews = he.getLayoutViews();


    // -------------------- <LineGroupChart /> --------------------------------

    const LineGroupChart:React.FC<{
        data:LineGroupChartData;
    }> = (props) => {

        const legendFormatter = (value, entry) => {
            return <span style={{color: '#000'}}><b>{value}</b> {he.formatNumber(100*entry.payload.percent, 1)}% ({entry.payload.count}x)</span>;
        };

        return (
            <PieChart width={300} height={300}>
                <Pie
                        data={props.data}
                        isAnimationActive={false}
                        dataKey="count"
                        nameKey="group" >
                    {props.data.map(entry => <Cell key={`cell-${entry.groupId}`} fill={entry.bgColor}/>)}
                    <LabelList dataKey="group" position="inside" fill="#000000" strokeWidth={0} />
                </Pie>
                <Legend verticalAlign="middle" align="right" layout="vertical" formatter={legendFormatter} />
            </PieChart>
        );
    };

    // -------------------- <ExportLinks /> --------------------------------

    const ExportLinks:React.FC<{
        data:LineGroupChartData;
        exportFormats:Array<string>;
        corpusId: string;
    }> = (props) => {
        return props.exportFormats.length > 0 ?
            <fieldset className="footer">
                <legend>{he.translate('linesel__export_btn')}</legend>
                <ul className="export">{
                    List.map(format =>
                        <li key={format}>
                            <a onClick={e => {
                                dispatcher.dispatch<typeof Actions.DownloadSelectionOverview>({
                                    name: Actions.DownloadSelectionOverview.name,
                                    payload: {format}
                                })
                            }}>{format}</a>
                        </li>
                    , props.exportFormats)
                }</ul>
            </fieldset>:
            null
    }

    // -------------------- <GroupsStats /> --------------------------------

    const GroupsStats:React.FC<LineSelectionModelState> = (props) => {

        React.useEffect(
            () => {
                dispatcher.dispatch(Actions.GetGroupStats)
            },
            []
        );

        const handleGoToFirstSelect = () => {
            dispatcher.dispatch(
                Actions.ChangePage,
                {action: 'customPage', pageNum: props.firstPage}
            );
        };

        return (
            <S.LockedLineGroupsChartFieldset>
                <p>
                    {props.firstPage ? <a onClick={handleGoToFirstSelect}>{he.translate('linesel__go_to_first_select')}</a> : null}
                </p>
                <div>
                    <legend>{he.translate('linesel__groups_stats_heading')}</legend>
                    {props.isBusy ?
                        <globalViews.AjaxLoaderImage /> :
                        props.groupsChartData ?
                            <>
                                <LineGroupChart data={props.groupsChartData} />
                                <ExportLinks data={props.groupsChartData} exportFormats={props.exportFormats} corpusId={props.corpusId} />
                            </> :
                            null
                    }
                </div>
            </S.LockedLineGroupsChartFieldset>
        );
    }

    return GroupsStats;

}