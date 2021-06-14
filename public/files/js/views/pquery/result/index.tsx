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
import { init as initSaveViews } from './save';
import { PqueryResultsSaveModel } from '../../../models/pquery/save';

export interface PqueryFormViewsArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    resultModel:PqueryResultModel;
    saveModel:PqueryResultsSaveModel;
}


export function init({dispatcher, he, resultModel, saveModel}:PqueryFormViewsArgs):React.ComponentClass<{}> {

    const layoutViews = he.getLayoutViews();

    // ------------------------ <PageCounter /> --------------------------

    const saveViews = initSaveViews(dispatcher, he, saveModel);

    const PageCounter:React.FC<{
        maxPage:number;
        currPage:number;

    }> = (props) => {

        const setPage = (page) => () => {
            dispatcher.dispatch<Actions.SetPage>({
                name: ActionName.SetPage,
                payload: {
                    value: page > props.maxPage ? props.maxPage : page < 1 ? 1 : page
                }
            });
        };

        return <S.PageCounter>
            <a className={props.currPage === 1 ? "inactive" : null} onClick={props.currPage > 1 ? setPage(props.currPage-1) : null}>
                <img src={he.createStaticUrl('img/prev-page.svg')} />
            </a>
            <span className="num-input">
                <input type="text" value={props.currPage} onChange={e => setPage(parseInt(e.target.value))()} /> / {props.maxPage}
            </span>
            <a className={props.currPage === props.maxPage ? "inactive" : null} onClick={props.currPage < props.maxPage ? setPage(props.currPage+1) : null}>
                <img src={he.createStaticUrl('img/next-page.svg')} />
            </a>
        </S.PageCounter>
    };

    // ------------------------ <ThSortable /> --------------------------

    const ThSortable:React.FC<{
        sortColumn:SortColumn;
        actualSortKey:SortKey;
        label:string;

    }> = (props) => {

        const isSortedByMe = () => {
            if (!props.actualSortKey) {
                return false;
            }
            if (props.sortColumn.type === 'partial_freq' && props.actualSortKey.column.type === 'partial_freq') {
                return props.sortColumn.concId === props.actualSortKey.column.concId;
            }
            return props.sortColumn.type === props.actualSortKey.column.type;
        }

        const renderSortFlag = () => {
            if (isSortedByMe()) {
                if (props.actualSortKey.reverse) {
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
                    column: {...props.sortColumn},
                    reverse: !(isSortedByMe() && props.actualSortKey.reverse)
                }
            });
        };

        const getTitle = () => {
            if (isSortedByMe()) {
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
        };

        const _handleSaveFormClose = () => {
            dispatcher.dispatch<Actions.ResultCloseSaveForm>({
                name: ActionName.ResultCloseSaveForm
            })
        };

        const renderContent = () => {
            if (props.isBusy) {
                return <layoutViews.AjaxLoaderImage />;

            } else if (props.numLines === 0) {
                return <S.NoResultPar>{he.translate('pquery__no_result')}</S.NoResultPar>;

            } else {
                return (
                    <>
                        <p>{he.translate('pquery__avail_label')}: {props.numLines}</p>
                        <PageCounter maxPage={Math.ceil(props.numLines/props.pageSize)} currPage={props.page} />
                        <table className="data">
                            <tbody>
                                <tr>
                                    <th />
                                    <ThSortable sortColumn={{type: 'value'}} actualSortKey={props.sortKey} label="Value"/>
                                    {List.map(
                                    (concId, i) => <ThSortable key={concId} sortColumn={{type: 'partial_freq', concId}}  actualSortKey={props.sortKey} label={`Freq ${i+1}`}/>,
                                        props.concIds
                                    )}
                                    <ThSortable sortColumn={{type: 'freq'}} actualSortKey={props.sortKey} label={'Freq \u2211'} />
                                </tr>
                                {List.map(
                                    ([word, ...freqs], i) => (
                                        <tr key={`${i}:${word}`}>
                                            <td className="num">{(props.page-1)*props.pageSize+i+1}</td>
                                            <td>{word}</td>
                                            {List.map((f, i) => <td key={props.concIds[i]} className="num">{f}</td>, freqs)}
                                            <td className="num">{List.foldl((acc, curr) => acc + curr, 0, freqs)}</td>
                                        </tr>
                                    ),
                                    props.data
                                )}
                            </tbody>
                        </table>
                        {props.saveFormActive ?
                        <saveViews.SavePqueryForm onClose={_handleSaveFormClose} /> :
                        null
                    }
                    </>
                );
            }
        };
        return <S.PqueryResultSection>{renderContent()}</S.PqueryResultSection>;
    };

    return Bound(PqueryResultSection, resultModel);
}
