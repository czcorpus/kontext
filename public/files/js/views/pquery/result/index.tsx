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

import * as Kontext from '../../../types/kontext';
import { PqueryResultModel, PqueryResultModelState, SortColumn } from '../../../models/pquery/result';
import { Actions } from '../../../models/pquery/actions';
import * as S from './style';
import { Color, id, List, pipe } from 'cnc-tskit';
import { init as initSaveViews } from './save';
import { PqueryResultsSaveModel } from '../../../models/pquery/save';
import { colorHeatmap } from '../../theme/default';

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
            dispatcher.dispatch<typeof Actions.SetPage>({
                name: Actions.SetPage.name,
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
        actualSortColumn:SortColumn;
        label:string;

    }> = (props) => {

        const isSortedByMe = () => {
            if (!props.actualSortColumn) {
                return false;
            }
            if (props.sortColumn.type === 'partial_freq' &&
                    props.actualSortColumn.type === 'partial_freq') {
                return props.sortColumn.concId === props.actualSortColumn.concId;
            }
            return props.sortColumn.type === props.actualSortColumn.type;
        }

        const renderSortFlag = () => {
            if (isSortedByMe()) {
                return props.actualSortColumn.reverse ?
                    <img className="sort-flag" src={he.createStaticUrl('img/sort_desc.svg')} /> :
                    <img className="sort-flag" src={he.createStaticUrl('img/sort_asc.svg')} />;

            } else {
                return null;
            }
        };

        const handleSortClick = () => {
            dispatcher.dispatch<typeof Actions.SortLines>({
                name: Actions.SortLines.name,
                payload: {
                    ...props.sortColumn,
                    reverse: !(isSortedByMe() && props.actualSortColumn.reverse)
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

        const _handleSaveFormClose = () => {
            dispatcher.dispatch<typeof Actions.ResultCloseSaveForm>({
                name: Actions.ResultCloseSaveForm.name
            })
        };

        const mapColor = (idx:number) => colorHeatmap[~~Math.floor((idx) * (colorHeatmap.length - 1) / props.concIds.length)];

        const _handleFilter = (value:string, concId:string) => (e) => {
            dispatcher.dispatch<typeof Actions.ResultApplyQuickFilter>({
                name: Actions.ResultApplyQuickFilter.name,
                payload: {
                    value,
                    concId,
                    blankWindow: e.ctrlKey
                }
            });
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
                            <thead>
                                <tr>
                                    <th colSpan={2} />
                                    {List.map(
                                        (concId, i) => (
                                            <React.Fragment key={concId}>
                                                <th className="conc-group" colSpan={2}>{`Conc ${i+1}`}</th>
                                            </React.Fragment>
                                        ),
                                        props.concIds
                                    )}
                                    <th />
                                </tr>
                                <tr>
                                    <th />
                                    <ThSortable sortColumn={{type: 'value', reverse: false}}
                                            actualSortColumn={props.sortColumn} label="Value"/>
                                    {List.map(
                                        (concId, i) => (
                                            <React.Fragment key={concId}>
                                                <ThSortable sortColumn={{type: 'partial_freq', concId, reverse: false}}
                                                        actualSortColumn={props.sortColumn} label="Freq" />
                                                <th>Filter</th>
                                            </React.Fragment>
                                        ),
                                        props.concIds
                                    )}
                                    <ThSortable sortColumn={{type: 'freq', reverse: false}} actualSortColumn={props.sortColumn}
                                            label={'Freq \u2211'} />
                                </tr>
                            </thead>
                            <tbody>
                                {List.map(
                                    ([word, ...freqs], i) => (
                                        <tr key={`${i}:${word}`}>
                                            <td className="num">{(props.page-1)*props.pageSize+i+1}</td>
                                            <td>{word}</td>
                                            {List.map(
                                                (f, i) => {
                                                    const idx = pipe(
                                                        freqs,
                                                        List.sortedBy(id),
                                                        List.findIndex(v => v === f)
                                                    );
                                                    const bgCol = mapColor(idx);
                                                    const textCol = pipe(
                                                            bgCol,
                                                            Color.importColor(1),
                                                            Color.textColorFromBg(),
                                                            Color.color2str()
                                                    );
                                                    const style = {
                                                        backgroundColor: bgCol,
                                                        color: textCol
                                                    };

                                                    return (
                                                        <React.Fragment key={props.concIds[i]}>
                                                            <td style={style} className="num">{f}</td>
                                                            <td><a onClick={_handleFilter(word, props.concIds[i])}>p</a></td>
                                                        </React.Fragment>
                                                    );
                                                },
                                                freqs
                                            )}
                                            <td className="num sum">{List.foldl((acc, curr) => acc + curr, 0, freqs)}</td>
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
