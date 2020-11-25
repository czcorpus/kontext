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

import { Kontext } from '../../types/common';
import * as React from 'react';
import { FreqDataRowsModel, ResultHeader, ResultItem } from '../../models/freqs/dataRows';
import { IActionDispatcher } from 'kombo';
import { Actions, ActionName } from '../../models/freqs/actions';
import { List } from 'cnc-tskit';

interface DataTableProps {
    head:Array<ResultHeader>;
    rows:Array<ResultItem>;
    sortColumn:string;
}


interface ExportedComponents {
    DataTable:React.FC<DataTableProps>;
}

export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers
):ExportedComponents {

    // ----------------------- <DataRowPNFilter /> --------------------------------

    interface DataRowPNFilterProps {
        pfilter:string;
        nfilter:string;
    }

    const DataRowPNFilter:React.FC<DataRowPNFilterProps> = (props) => {

        const handlePFilter = () => {
            dispatcher.dispatch<Actions.ResultApplyQuickFilter>({
                name: ActionName.ResultApplyQuickFilter,
                payload: {
                    url: props.pfilter
                }
            });
        };

        const handleNFilter = () => {
            dispatcher.dispatch<Actions.ResultApplyQuickFilter>({
                name: ActionName.ResultApplyQuickFilter,
                payload: {
                    url: props.nfilter
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

    interface DataRowProps {
        data:ResultItem;
    }

    const DataRow:React.FC<DataRowProps> = (props) => {

        return (
            <tr>
                <td className="num">{props.data.idx + 1}</td>
                <DataRowPNFilter pfilter={props.data.pfilter} nfilter={props.data.nfilter} />
                {props.data.Word.map((w, i) => <td key={i}>{w}</td>)}
                <td className="num">{props.data.freq}</td>
                <td className="num">{props.data.rel}</td>
                <td>
                    <div className="bar" style={{height: '10px', width: `${props.data.relbar}px`}} />
                </td>
            </tr>
        );
    };

    // ----------------------- <DataRowNoRel /> --------------------------------

    interface DataRowNoRelProps {
        data:ResultItem;
    }

    const DataRowNoRel:React.FC<DataRowNoRelProps> = (props) => {

        return (
            <tr>
                <td className="num">{props.data.idx + 1}</td>
                <DataRowPNFilter pfilter={props.data.pfilter} nfilter={props.data.nfilter} />
                {props.data.Word.map((w, i) => <td key={i}>{w}</td>)}
                <td className="num">{props.data.freq}</td>
                <td>
                    <div className="bar" style={{height: '10px', width: `${props.data.fbar}px`}} />
                </td>
            </tr>
        );
    };

    /**
     *  ----------------------- <TableColHead /> --------------------------------
     */

    interface TableColHeadProps {
        data:ResultHeader;
        sortColumn:string;
    }

    const TableColHead:React.FC<TableColHeadProps> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<Actions.ResultSortByColumn>({
                name: ActionName.ResultSortByColumn,
                payload: {
                    value: props.data.s
                }
            });
        };

        const renderSortingIcon = () => {
            if (props.sortColumn === props.data.s) {
                return (
                    <span title={he.translate('global__sorted')}>
                         {props.data.n}
                        <img className="sort-flag" src={he.createStaticUrl('img/sort_desc.svg')} />
                    </span>
                )

            } else {
                return (
                    <a onClick={handleClick} title={he.translate('global__click_to_sort')}>
                         {props.data.n}
                    </a>
                );
            }
        };

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

        const getBarChartTitle = () => {
            if (props.head.length > 0) {
                return List.last(props.head).s || '';
            }
            return '';
        };

        const renderRows = () => {
            if (props.rows.length === 0 || props.rows[0].relbar) {
                return props.rows.map(item => {
                    return <DataRow key={item.idx} data={item} />;
                });

            } else {
                return props.rows.map(item => {
                    return <DataRowNoRel key={item.idx} data={item} />;
                });
            }
        };

        return (
            <table className="data">
                <tbody>
                    <tr>
                        <th />
                        <th>Filter</th>
                        {props.head.map(item => <TableColHead key={item.n} sortColumn={props.sortColumn}
                                    data={item} />)}
                        <th title={getBarChartTitle()} />
                    </tr>
                    {renderRows()}
                </tbody>
            </table>
        );
    }


    return {
        DataTable: DataTable
    };
}