/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Kontext from '../../../types/kontext.js';
import * as React from 'react';
import { ResultHeader, ResultItem } from '../../../models/freqs/regular/common.js';
import { IActionDispatcher } from 'kombo';
import { Actions } from '../../../models/freqs/regular/actions.js';
import { List, Maths } from 'cnc-tskit';
import * as S from './style.js';
import { alphaToCoeffFormatter } from '../../../models/freqs/common.js';


interface DataTableProps {
    head:Array<ResultHeader>;
    rows:Array<ResultItem>;
    alphaLevel:Maths.AlphaLevel;
    sortColumn:string;
    hasSkippedEmpty:boolean;
    sourceId:string;
    displayConfidence:boolean;
}


interface ExportedComponents {
    DataTable:React.FC<DataTableProps>;
}


export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers
):ExportedComponents {

    const alphaToCoeff = alphaToCoeffFormatter(he);

    const SAMPLE_FLOATING_NUM = he.formatNumber(3.1, 1);


    // ----------------------- <DataRowPNFilter /> --------------------------------

    const layoutViews = he.getLayoutViews();

    const DataRowPNFilter:React.FC<{
        pfilter:string;
        nfilter:string;
    }> = (props) => {

        const handlePFilter = (e) => {
            dispatcher.dispatch<typeof Actions.ResultApplyQuickFilter>({
                name: Actions.ResultApplyQuickFilter.name,
                payload: {
                    url: props.pfilter,
                    blankWindow: e.ctrlKey
                }
            });
        };

        const handleNFilter = (e) => {
            dispatcher.dispatch<typeof Actions.ResultApplyQuickFilter>({
                name: Actions.ResultApplyQuickFilter.name,
                payload: {
                    url: props.nfilter,
                    blankWindow: e.ctrlKey
                }
            });
        };

        if (props.pfilter || props.nfilter) {
            return (
                <td>
                    {props.pfilter ? <a onClick={handlePFilter}
                                title={he.translate('global__pnfilter_label_p')}>p</a> :
                            <span title={he.translate('freq__neg_filter_disabled')}>p</span>}
                    {'\u00a0/\u00a0'}
                    {props.nfilter ? <a onClick={handleNFilter}
                                title={he.translate('global__pnfilter_label_n')}>n</a> :
                            <span title={he.translate('freq__neg_filter_disabled')}>n</span>}
                </td>
            );

        } else {
            return <td />;
        }
    };

    // ----------------------- <DataRow /> --------------------------------

    const DataRow:React.FC<{
        data: ResultItem;
        monospaceCols: Array<boolean>;
        displayConfidence: boolean;
    }> = (props) => (
        <S.DataRowTR>
            <td className="num">{props.data.idx + 1}</td>
            <DataRowPNFilter pfilter={props.data.pfilter} nfilter={props.data.nfilter} />
            {List.map((w, i) => <S.ValueTD key={i} monospace={props.monospaceCols[i]}>{w}</S.ValueTD>, props.data.Word)}
            <td className="num">
                {he.formatNumber(props.data.freq)}
            </td>
            {props.displayConfidence ?
                <td className="bci">
                    <span className="bracket">[</span>
                    {he.formatNumber(props.data.freqConfidence[0])}
                    <span className="separ">,{'\u00a0'}</span>
                    {he.formatNumber(props.data.freqConfidence[1])}
                    <span className="bracket">]</span>
                </td> :
                null }
            <td className="num">
                {he.formatNumber(props.data.rel)}
            </td>
            {props.displayConfidence ?
                <td className="bci">
                    <span className="bracket">[</span>
                    <span className="val">
                        {he.formatNumber(props.data.relConfidence[0])}
                        <span className="separ">,{'\u00a0'}</span>
                        {he.formatNumber(props.data.relConfidence[1])}
                    </span>
                    <span className="bracket">]</span>
                </td> :
                null }
        </S.DataRowTR>
    );

    /**
     *  ----------------------- <TableColHead /> --------------------------------
     */

    interface TableColHeadProps {
        data:ResultHeader;
        sortColumn:string;
        alphaLevel:Maths.AlphaLevel;
        sourceId:string;
        displayConfidence:boolean;
    }

    const TableColHead:React.FC<TableColHeadProps> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.ResultSortByColumn>({
                name: Actions.ResultSortByColumn.name,
                payload: {
                    value: props.data.s,
                    sourceId: props.sourceId
                }
            });
        };

        const renderSortingIcon = () => {
            if (props.data.s === 'rel' && !props.data.allowSorting) {
                return <span>{props.data.n}</span>;

            } else if (props.sortColumn === props.data.s) {
                return (
                    <span title={he.translate('global__sorted')}>
                         {props.data.n}
                        <img className="sort-flag" src={
                            props.sortColumn === 'rel' || props.sortColumn === 'freq' ?
                            he.createStaticUrl('img/sort_desc.svg') :
                            he.createStaticUrl('img/sort_asc.svg')
                        } />
                    </span>
                );

            } else {
                return (
                    <a onClick={handleClick} title={he.translate('global__click_to_sort')}>
                         {props.data.n}
                    </a>
                );
            }
        };

        if (props.data.s === 'rel' || props.data.s === 'freq') {
            return <>
                <th key={props.data.n} title={props.data.s || ''}>
                    {renderSortingIcon()}
                </th>
                {props.displayConfidence ?
                    <th>
                        {props.data.n}{'\u00a0'}
                        ({he.translate('freq__binom_conf_interval_hd')}, {alphaToCoeff(props.alphaLevel)}% Cl)
                    </th> :
                    null }
            </>;
        }
        return (
            <th key={props.data.n}
                    title={props.data.s || ''}>
                {renderSortingIcon()}
            </th>
        );
    };

    /**
     * ----------------------- <DataTable /> --------------------------------
     */
    const DataTable:React.FC<DataTableProps> = (props) => {

        const renderRows = () => {
            const monospaceCols = List.map(v => v.isPosTag, props.head)
            return List.map(
                item => <DataRow key={`${item.Word}:${item.idx}`} data={item} monospaceCols={monospaceCols} displayConfidence={props.displayConfidence} />,
                props.rows
            );
        };

        return (
            <S.DataTable>
                <table className="data">
                    <thead>
                        <tr>
                            <th />
                            <th>{he.translate('freq__ct_filter_th')}</th>
                            {List.map(
                                (item, i) => (
                                    <TableColHead key={`${item.n}:${i}`}
                                            sortColumn={props.sortColumn}
                                            data={item}
                                            sourceId={props.sourceId}
                                            alphaLevel={props.alphaLevel}
                                            displayConfidence={props.displayConfidence} />
                                ),
                                props.head
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {List.empty(props.rows) ?
                            <tr><td colSpan={3 + List.size(props.head)}>{'\u00a0'}</td></tr> :
                            renderRows()
                        }
                    </tbody>
                </table>
                {props.hasSkippedEmpty ?
                    <div className="skipped-info">
                        <layoutViews.StatusIcon status="info" />
                        <p className="note">
                            {he.translate('freq__contains_skipped_empty_note_{attr}', {attr: props.head[0].n})}.
                        </p>
                    </div> :
                    null
                }
            </S.DataTable>
        );
    }


    return {
        DataTable
    };
}