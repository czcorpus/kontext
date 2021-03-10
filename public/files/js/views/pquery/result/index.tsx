/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import { Bound, IActionDispatcher } from 'kombo';

import { Kontext } from '../../../types/common';
import { PqueryResultModel, PqueryResultModelState, SortColumn, SortKey } from '../../../models/pquery/result';
import { ActionName, Actions } from '../../../models/pquery/actions';
import * as S from './style';
import { List } from 'cnc-tskit';

export interface PqueryFormViewsArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    model:PqueryResultModel;
}


export function init({dispatcher, he, model}:PqueryFormViewsArgs):React.ComponentClass<{}> {

    // ------------------------ <PageCounter /> --------------------------

    const PageCounter:React.FC<{
        maxPage:number;
        currPage:number;

    }> = (props) => {

        const setPage = (page) => () => {
            dispatcher.dispatch<Actions.SetPage>({
                name: ActionName.SetPage,
                payload: {
                    value: page
                }
            });
        };

        return <S.PageCounter>
            <a className={props.currPage === 1 ? "inactive" : null} onClick={props.currPage > 1 ? setPage(props.currPage-1) : null}>
                <img src={he.createStaticUrl('img/prev-page.svg')} />
            </a>
            <span className="num-input">
                <input type="text" value={props.currPage} onChange={e => setPage(e.target.value)()} /> / {props.maxPage}
            </span>
            <a className={props.currPage === props.maxPage ? "inactive" : null} onClick={props.currPage < props.maxPage ? setPage(props.currPage+1) : null}>
                <img src={he.createStaticUrl('img/next-page.svg')} />
            </a>
        </S.PageCounter>
    };

    // ------------------------ <ThSortable /> --------------------------

    const ThSortable:React.FC<{
        ident:string;
        sortKey:SortKey;
        label:string;

    }> = (props) => {

        const renderSortFlag = () => {
            if (props.sortKey) {
                if (props.sortKey.reverse) {
                    return <img className="sort-flag" src={he.createStaticUrl('img/sort_desc.svg')} />;

                } else {
                    return <img className="sort-flag" src={he.createStaticUrl('img/sort_asc.svg')} />;
                }

            } else {
                return null;
            }
        };

        const handleSortClick = () => {
            dispatcher.dispatch<Actions.SortLines>({
                name: ActionName.SortLines,
                payload: {
                    column: props.ident as SortColumn,
                    reverse: props.sortKey ? !props.sortKey.reverse : false
                }
            });
        };

        const getTitle = () => {
            if (props.sortKey) {
                return he.translate('global__sorted_click_change');
            }
            return he.translate('global__click_to_sort');
        };

        return (
            <th>
                <a onClick={handleSortClick} title={getTitle()}>
                    {props.label}
                    {renderSortFlag()}
                </a>
            </th>
        );
    };

    // ---------------- <PqueryResultSection /> ----------------------------

    const PqueryResultSection:React.FC<PqueryResultModelState> = (props) => {

        const _exportSortKey = (name) => {
            if (name === props.sortKey.column) {
                return props.sortKey;
            }
            return null;
        }

        return props.isVisible ?
            (
                <S.PqueryResultSection>
                    <h2>{he.translate('pquery__results')}</h2>
                    <p>{he.translate('pquery__avail_label')}: {props.numLines}</p>
                    <PageCounter maxPage={Math.ceil(props.numLines/props.pageSize)} currPage={props.page} />
                    <table className="data">
                        <tbody>
                            <tr>
                                <th />
                                <ThSortable ident="value" sortKey={_exportSortKey("value")} label="Value"/>
                                <ThSortable ident="freq" sortKey={_exportSortKey("freq")} label="Freq"/>
                            </tr>
                            {List.map(
                                ([word, freq], i) => (
                                    <tr key={`${i}:${word}`}>
                                        <td className="num">{(props.page-1)*props.pageSize+i+1}</td>
                                        <td>{word}</td>
                                        <td className="num">{freq}</td>
                                    </tr>
                                ),
                                props.data
                            )}
                        </tbody>
                    </table>
                </S.PqueryResultSection>
            ) :
            null
    };

    return Bound(PqueryResultSection, model);
}
