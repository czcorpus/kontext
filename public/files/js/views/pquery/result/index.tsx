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
                                        <td className="num">{i+1}</td>
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
