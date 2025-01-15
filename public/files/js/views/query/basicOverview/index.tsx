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
import { BoundWithProps, IActionDispatcher, IModel } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { Actions } from '../../../models/query/actions.js';
import * as S from './style.js';
import { MainMenuModelState } from '../../../models/mainMenu/index.js';
import { List } from 'cnc-tskit';
import { PersistentQueryOperation } from '../../../models/query/replay/common.js';


export interface QueryOverviewTableProps {
    data:Array<PersistentQueryOperation>;
}


export interface BasicOverviewViews {
    EmptyQueryOverviewBar:React.ComponentClass<{}, MainMenuModelState>;
    QueryOverviewTable:React.FC<QueryOverviewTableProps>;
}


/**
 * This view lib contains core query overview components used by both
 * full-featured query overview toolbar and redirecting toolbar used
 * on non-"view" pages (freqs, colls).
 */
export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    mainMenuModel:IModel<MainMenuModelState>
):BasicOverviewViews {

    const layoutViews = he.getLayoutViews();

    // ------------------------ <EmptyQueryOverviewBar /> --------------------------------

    const EmptyQueryOverviewBar:React.FC<MainMenuModelState & {children?:React.ReactNode}> = (props) => (
        <div>
            <S.QueryOverviewBarUL>
                <layoutViews.CorpnameInfoTrigger
                        corpname={props.corpname}
                        humanCorpname={props.humanCorpname}
                        usesubcorp={props.usesubcorp}
                        subcName={props.subcName}
                        foreignSubcorp={props.foreignSubcorp} />
                {props.children}
            </S.QueryOverviewBarUL>
        </div>
    );

    // ----------------------------- <QueryOverviewTable /> --------------------------

    const QueryOverviewTable:React.FC<QueryOverviewTableProps> = (props) => {

        const handleCloseClick = () => {
            dispatcher.dispatch<typeof Actions.CloseQueryOverview>({
                name: Actions.CloseQueryOverview.name
            });
        };

        const handleEditClickFn = (idx:number) => () => {
            dispatcher.dispatch(Actions.CloseQueryOverview);
            dispatcher.dispatch(
                Actions.EditQueryOperation,
                {
                    operationIdx: idx
                }
            );
        };

        return (
            <layoutViews.PopupBox customClass="centered" onCloseClick={handleCloseClick} takeFocus={true}
                    customStyle={{left: '10%', right: '10%'}}>
                <S.QueryOverviewDiv>
                    <h3>{he.translate('global__query_overview')}</h3>
                    <table>
                        <tbody>
                            <tr>
                                <th>{he.translate('global__operation')}</th>
                                <th>{he.translate('global__user_entry')}</th>
                                <th>{he.translate('global__search_engine_parameters')}</th>
                                <th>{he.translate('global__num_of_hits')}</th>
                                <th></th>
                                <th></th>
                                <th></th>
                            </tr>
                            {List.map(
                                (item, i) => (
                                    <tr key={i}>
                                        <td>{item.op}</td>
                                        <td>{item.userEntry}</td>
                                        <td>{item.encodedArgs}</td>
                                        <td className="num">{item.size}</td>
                                        <td>
                                            <a href={he.createActionLink(`view?q=~${item.concPersistenceId}`)}>
                                                {he.translate('global__view_result')}
                                            </a>
                                        </td>
                                        <td>
                                            <a onClick={handleEditClickFn(i)}>
                                                {he.translate('query__overview_edit_query')}
                                            </a>
                                        </td>
                                    </tr>
                                ),
                                props.data
                            )}
                        </tbody>
                    </table>
                </S.QueryOverviewDiv>
            </layoutViews.PopupBox>
        );
    };

    return {
        EmptyQueryOverviewBar: BoundWithProps<{}, MainMenuModelState>(EmptyQueryOverviewBar, mainMenuModel),
        QueryOverviewTable: QueryOverviewTable
    };

}