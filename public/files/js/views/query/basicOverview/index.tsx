/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher } from 'kombo';

import { Kontext } from '../../../types/common';
import { ActionName, Actions } from '../../../models/query/actions';


export interface EmptyQueryOverviewBarProps {
    corpname:string;
    humanCorpname:string;
    usesubcorp:string;
    origSubcorpName:string;
    foreignSubcorp:boolean;
}


export interface QueryOverviewTableProps {
    data:Array<Kontext.QueryOperation>
    onEditClick:(idx:number)=>void;
}


export interface BasicOverviewViews {
    EmptyQueryOverviewBar:React.FC<EmptyQueryOverviewBarProps>;
    QueryOverviewTable:React.FC<QueryOverviewTableProps>;
}


/**
 * This view lib contains core query overview components used by both
 * full-featured query overview toolbar and redirecting toolbar used
 * on non-"view" pages (freqs, colls).
 *
 * @param {*} dispatcher
 * @param {*} he
 */
export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):BasicOverviewViews {

    const layoutViews = he.getLayoutViews();

    // ------------------------ <EmptyQueryOverviewBar /> --------------------------------

    const EmptyQueryOverviewBar:React.FC<EmptyQueryOverviewBarProps> = (props) => (
        <div>
            <ul id="query-overview-bar">
                <layoutViews.CorpnameInfoTrigger
                        corpname={props.corpname}
                        humanCorpname={props.humanCorpname}
                        usesubcorp={props.usesubcorp}
                        origSubcorpName={props.origSubcorpName}
                        foreignSubcorp={props.foreignSubcorp} />
                {props.children}
            </ul>
        </div>
    );

    // ----------------------------- <QueryOverviewTable /> --------------------------

    const QueryOverviewTable:React.FC<QueryOverviewTableProps> = (props) => {

        const handleCloseClick = () => {
            dispatcher.dispatch<Actions.ClearQueryOverviewData>({
                name: ActionName.ClearQueryOverviewData
            });
        };

        const handleEditClickFn = (idx:number) => () => {
            dispatcher.dispatch<Actions.ClearQueryOverviewData>({
                name: ActionName.ClearQueryOverviewData
            });
            props.onEditClick(idx);
        };

        return (
            <layoutViews.PopupBox customClass="query-overview centered" onCloseClick={handleCloseClick} takeFocus={true}>
                <div>
                    <h3>{he.translate('global__query_overview')}</h3>
                    <table>
                        <tbody>
                            <tr>
                                <th>{he.translate('global__operation')}</th>
                                <th>{he.translate('global__parameters')}</th>
                                <th>{he.translate('global__num_of_hits')}</th>
                                <th></th>
                                <th></th>
                            </tr>
                            {props.data.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.op}</td>
                                    <td>{item.arg}</td>
                                    <td>{item.size}</td>
                                    <td>
                                        <a href={he.createActionLink('view?' + item.tourl)}>
                                            {he.translate('global__view_result')}
                                        </a>
                                    </td>
                                    <td>
                                        <a onClick={handleEditClickFn(i)}>
                                            {he.translate('query__overview_edit_query')}
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </layoutViews.PopupBox>
        );
    };

    return {
        EmptyQueryOverviewBar: EmptyQueryOverviewBar,
        QueryOverviewTable: QueryOverviewTable
    };

}