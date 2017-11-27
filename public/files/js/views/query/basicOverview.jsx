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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';

/**
 * This view lib contains core query overview components used by both
 * full-featured query overview toolbar and redirecting toolbar used
 * on non-"view" pages (freqs, colls).
 *
 * @param {*} dispatcher
 * @param {*} he
 */
export function init(dispatcher, he) {

    const layoutViews = he.getLayoutViews();

    // ------------------------ <EmptyQueryOverviewBar /> --------------------------------

    class EmptyQueryOverviewBar extends React.Component {

        constructor(props) {
            super(props);
            this.state = {overviewVisible: false};
        }

        render() {
            return (
                <div>
                    <ul id="query-overview-bar">
                        <CorpnameInfoTrigger
                                corpname={props.corpname}
                                humanCorpname={props.humanCorpname}
                                usesubcorp={props.usesubcorp} />
                    </ul>
                </div>
            );
        }
    };

    // ----------------------------- <QueryOverivewTable /> --------------------------

    const QueryOverivewTable = (props) => {

        const handleCloseClick = () => {
            dispatcher.dispatch({
                actionType: 'CLEAR_QUERY_OVERVIEW_DATA',
                props: {}
            });
        };

        const handleEditClickFn = (idx) => {
            return () => {
                dispatcher.dispatch({
                    actionType: 'CLEAR_QUERY_OVERVIEW_DATA',
                    props: {}
                }); // this is synchronous
                props.onEditClick(idx);
            };
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
        QueryOverivewTable: QueryOverivewTable
    };

}