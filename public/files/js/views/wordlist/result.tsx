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


import * as React from 'react';
import { Kontext, KeyCodes } from '../../types/common';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { WordlistSaveModel } from '../../models/wordlist/save';
import { WordlistResultModel, WordlistResultModelState } from '../../models/wordlist/main';
import { WordlistSaveViews } from './save';
import { ActionName, Actions } from '../../models/wordlist/actions';
import { List } from 'cnc-tskit';

export interface WordlistResultViewsArgs {
    dispatcher:IActionDispatcher;
    utils:Kontext.ComponentHelpers;
    wordlistSaveViews:WordlistSaveViews;
    wordlistResultModel:WordlistResultModel;
    wordlistSaveModel:WordlistSaveModel;
}


export interface WordlistResultViews {
    WordlistResult:React.SFC<{}>
}


/**
 */
export function init({dispatcher, utils, wordlistSaveViews,
                      wordlistResultModel, wordlistSaveModel}:WordlistResultViewsArgs):WordlistResultViews {

    const layoutViews = utils.getLayoutViews();

    // ---------------------- <THSortableColumn /> -------------------

    const THSortableColumn:React.SFC<{
        sortKey:string;
        isActive:boolean;
        str:string;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<Actions.WordlistResultSetSortColumn>({
                name: ActionName.WordlistResultSetSortColumn,
                payload: {
                    sortKey: props.sortKey
                }
            });
            dispatcher.dispatch<Actions.WordlistResultReload>({
                name: ActionName.WordlistResultReload
            });
        };

        const renderSortingIcon = () => {
            if (props.isActive) {
                return (
                    <span title={utils.translate('global__sorted')}>
                         {props.str}
                        <img className="sort-flag" src={utils.createStaticUrl('img/sort_desc.svg')} />
                    </span>
                );

            } else {
                return (
                    <a onClick={handleClick} title={utils.translate('global__click_to_sort')}>
                         {props.str}
                    </a>
                );
            }
        };

        return <th>{renderSortingIcon()}</th>;
    };

    /**
     *
     */
    const ResultRowPosFilter:React.SFC<{
        word:string;
        usesStructAttr:boolean;

    }> = (props) => {

        const handleViewConcClick = () => {
            dispatcher.dispatch<Actions.WordlistResultViewConc>({
                name: ActionName.WordlistResultViewConc,
                payload: {
                    word: props.word
                }
            });
        };

        if (props.usesStructAttr) {
            return <span className="hint" title={utils.translate('wordlist__filter_not_avail')}>p</span>;

        } else {
            return <a title={utils.translate('global__pnfilter_label_p')}
                        onClick={handleViewConcClick}>p</a>;
        }
    };

    // ---------------------- <TRResultRow /> -------------------

    const TRResultRow:React.SFC<{
        idx:number;
        str:string;
        usesStructAttr:boolean;
        freq:number;

    }> = (props) => {
        return (
            <tr>
                <td className="num">
                    {props.idx + 1}.
                </td>
                <td className="center">
                    <ResultRowPosFilter usesStructAttr={props.usesStructAttr}
                            word={props.str} />
                    {'\u00a0/\u00a0'}
                    <span className="hint" title={utils.translate('wordlist__filter_not_avail')}>n</span>
                </td>
                <td>
                    {props.str}
                </td>
                <td className="num">
                    {props.freq}
                </td>
            </tr>
        );
    };

    // ---------------------- <PaginatorTextInput /> -------------------

    const PaginatorTextInput:React.SFC<{
        modelIsBusy:boolean;
        value:string;
        hint:string;

     }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.WordlistResultSetPage>({
                name: ActionName.WordlistResultSetPage,
                payload: {
                    page: evt.target.value
                }
            });
        };

        return (
            <span className="curr-page" title={props.hint}>
                {props.modelIsBusy ?
                    <img className="ajax-loader-bar" src={utils.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={utils.translate('global__loading')} /> :
                    <input type="text" value={props.value}
                        onChange={handleInputChange} style={{width: '3em'}} />
                }
            </span>
        );
    };

    // ---------------------- <PaginatorLeftArrows /> -------------------

    const PaginatorLeftArrows:React.SFC<{}> = (props) => {

        const handlePrevPageClick = () => {
            dispatcher.dispatch<Actions.WordlistResultPrevPage>({
                name: ActionName.WordlistResultPrevPage
            });
        };

        const handleFirstPageClick = () => {
            dispatcher.dispatch<Actions.WordlistGoToFirstPage>({
                name: ActionName.WordlistGoToFirstPage,
                payload: {}
            });
        };

        return (
            <div className="ktx-pagination-left">
                <a onClick={handleFirstPageClick}>
                    <img src={utils.createStaticUrl('img/first-page.svg')} />
                </a>
                <a onClick={handlePrevPageClick}>
                    <img src={utils.createStaticUrl('img/prev-page.svg')} />
                </a>
            </div>
        );
    };

    // ---------------------- <PaginatorRightArrows /> -------------------

    const PaginatorRightArrows:React.SFC<{}> = (props) => {

        const handleNextPageClick = () => {
            dispatcher.dispatch<Actions.WordlistResultNextPage>({
                name: ActionName.WordlistResultNextPage
            });
        };

        const handleLastPageClick = () => {
            dispatcher.dispatch<Actions.WordlistGoToLastPage>({
                name: ActionName.WordlistGoToLastPage,
                payload: {}
            });
        };

        return (
            <div className="ktx-pagination-right">
                <a onClick={handleNextPageClick}>
                    <img src={utils.createStaticUrl('img/next-page.svg')} />
                </a>
                <a onClick={handleLastPageClick}>
                    <img src={utils.createStaticUrl('img/last-page.svg')} />
                </a>
            </div>
        );
    };


    // ---------------------- <Paginator /> -------------------

    const Paginator:React.SFC<{
        currPage:number;
        currPageInput:string;
        modelIsBusy:boolean;
        isLastPage:boolean;

     }> = (props) => {

        const handleKeyPress = (evt) => {
            if (evt.keyCode === KeyCodes.ENTER) {
                evt.preventDefault();
                evt.stopPropagation();
                dispatcher.dispatch<Actions.WordlistResultConfirmPage>({
                    name: ActionName.WordlistResultConfirmPage,
                    payload: {
                        page: props.currPageInput
                    }
                });
            }
        };

        return (
            <div className="ktx-pagination">
                <form onKeyDown={handleKeyPress}>
                    {props.currPage > 1 ? <PaginatorLeftArrows /> : null}
                    <div className="ktx-pagination-core">
                        <PaginatorTextInput value={props.currPageInput} modelIsBusy={props.modelIsBusy}
                                hint={props.currPage !== parseInt(props.currPageInput) ? utils.translate('global__hit_enter_to_confirm') : null} />
                    </div>
                    {!props.isLastPage ? <PaginatorRightArrows /> : null}
                </form>
            </div>
        );
    }

    // ---------------------- <CalculationStatus /> -------------------

    const CalculationStatus:React.SFC<{
        progressPercent:number;
        isError:boolean;

    }> = (props) => {
        if (props.isError) {
            return (
                <div className="WordlistResult_progress-message">
                    <img src={utils.createStaticUrl('img/crisis.svg')} style={{width: '1.5em'}}
                            alt={utils.translate('global__error_icon')} />
                    <p>{utils.translate('global__bg_calculation_failed')}</p>
                </div>
            );

        } else {
            return (
                <div className="WordlistResult_progress-message">
                    <div className="progress-info">
                        <p className="calc-info">
                            <layoutViews.ImgWithMouseover src={utils.createStaticUrl('img/info-icon.svg')}
                                alt={utils.translate('global__info_icon')}
                                htmlClass="icon" />
                            {utils.translate('global__wl_calc_info')}
                        </p>
                        <h3>{utils.translate('global__calculating_imtermediate_data')}{'\u2026'}</h3>
                        <div className="processbar-wrapper">
                            <div className="processbar" style={{width: `${(props.progressPercent / 100 * 5).toFixed()}em`}}
                                    title={`${props.progressPercent.toFixed()}%`} />
                        </div>
                    </div>
                </div>
            );
        }
    };

    const DataTable:React.SFC<WordlistResultModelState & {wlsort:string; usesStructAttr:boolean, wlpat:string}> = (props) => {
        if (props.data.length === 0) {
            return (
                <p className="no-result">
                    {utils.translate('wordlist__no_result_for_{wlpat}', {wlpat: props.wlpat})}
                </p>
            );

        } else if (props.isUnfinished) {
            return (
                <div className="WordlistResult">
                    <CalculationStatus progressPercent={props.bgCalcStatus}
                            isError={props.isError} />
                </div>
            );

        } else {
            return <>
                <Paginator currPageInput={props.currPageInput} modelIsBusy={props.isBusy}
                                currPage={props.currPage} isLastPage={props.isLastPage} />
                <table className="data">
                    <thead>
                        <tr>
                            <th />
                            <th>
                                {utils.translate('wordlist__filter_th')}
                            </th>
                            {List.map(
                                item => <THSortableColumn key={item.sortKey} str={item.str} sortKey={item.sortKey}
                                    isActive={props.wlsort === item.sortKey} />,
                                props.headings
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {List.map(
                            (item, i) => <TRResultRow key={item.idx} idx={item.idx} str={item.str} freq={item.freq}
                                usesStructAttr={props.usesStructAttr} />,
                            props.data
                        )}
                    </tbody>
                </table>
            </>;
        }
    };

    const BoundDataTable = BoundWithProps(DataTable, wordlistResultModel);

    // ---------------------- <WordlistResult /> -------------------

    const WordlistResult:React.SFC<{}> = (props) => (
        <div className="WordlistResult">
            <BoundDataTable />
            <wordlistSaveViews.WordlistSaveForm />
        </div>
    );

    return {
        WordlistResult: WordlistResult
    };

}