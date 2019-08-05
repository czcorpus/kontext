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

import {Kontext} from '../../types/common';
import * as React from 'react';
import * as Immutable from 'immutable';
import {FreqDataRowsModel, ResultHeader, ResultItem} from '../../models/freqs/dataRows';
import {IActionDispatcher} from 'kombo';

interface DataTableProps {
    head:Immutable.List<ResultHeader>;
    rows:Immutable.List<ResultItem>;
    sortColumn:string;
    setLoadingFlag:()=>void;
}


interface ExportedComponents {
    DataTable:React.SFC<DataTableProps>;
}

export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers,
        freqDataRowsModel:FreqDataRowsModel):ExportedComponents {

    // ----------------------- <DataRowPNFilter /> --------------------------------

    interface DataRowPNFilterProps {
        pfilter:string;
        nfilter:string;
    }

    const DataRowPNFilter:React.SFC<DataRowPNFilterProps> = (props) => {

        if (props.pfilter || props.nfilter) {
            return (
                <td>
                    {props.pfilter ? <a href={props.pfilter}
                                title={he.translate('global__pnfilter_label_p')}>p</a> :
                            <span title={he.translate('freq__neg_filter_disabled')}>p</span>}
                    {'\u00a0/\u00a0'}
                    {props.nfilter ? <a href={props.nfilter}
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

    const DataRow:React.SFC<DataRowProps> = (props) => {

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

    const DataRowNoRel:React.SFC<DataRowNoRelProps> = (props) => {

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
        setLoadingFlag:()=>void;
    }

    const TableColHead:React.SFC<TableColHeadProps> = (props) => {

        const handleClick = () => {
            props.setLoadingFlag();
            dispatcher.dispatch({
                name: 'FREQ_RESULT_SORT_BY_COLUMN',
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
    const DataTable:React.SFC<DataTableProps> = (props) => {

        const getBarChartTitle = () => {
            if (props.head.size > 0) {
                return props.head.get(-1).s || '';
            }
            return '';
        };

        const renderRows = () => {
            if (props.rows.size === 0 || props.rows.get(0).relbar) {
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
                                    data={item} setLoadingFlag={props.setLoadingFlag} />)}
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