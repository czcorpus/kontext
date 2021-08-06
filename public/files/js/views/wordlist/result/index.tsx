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
import { Kontext } from '../../../types/common';
import { Keyboard } from 'cnc-tskit';
import { IActionDispatcher, BoundWithProps, IModel, Bound } from 'kombo';
import { WordlistResultModel, WordlistResultModelState } from '../../../models/wordlist/main';
import { WordlistSaveViews } from '../save';
import { Actions } from '../../../models/wordlist/actions';
import { List } from 'cnc-tskit';
import { WordlistFormState } from '../../../models/wordlist/form';
import * as S from './style';


export interface WordlistResultViewsArgs {
    dispatcher:IActionDispatcher;
    utils:Kontext.ComponentHelpers;
    wordlistSaveViews:WordlistSaveViews;
    wordlistResultModel:WordlistResultModel;
    wordlistFormModel:IModel<WordlistFormState>;
}


export interface WordlistResultViews {
    WordlistResult:React.ComponentClass<{}>;
}


/**
 */
export function init({dispatcher, utils, wordlistSaveViews,
                      wordlistResultModel, wordlistFormModel}:WordlistResultViewsArgs):WordlistResultViews {

    const layoutViews = utils.getLayoutViews();

    // ---------------------- <THSortableColumn /> -------------------

    const THSortableColumn:React.FC<{
        sortKey:string;
        isActive:boolean;
        str:string;
        reversed:boolean;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistResultSetSortColumn>({
                name: Actions.WordlistResultSetSortColumn.name,
                payload: {
                    sortKey: props.sortKey,
                    reverse: props.isActive ? !props.reversed : false
                }
            });
        };

        const renderSortingIcon = () => {
            return (
                <span title={utils.translate('global__sorted')}>
                    <a onClick={handleClick} title={props.isActive ?
                        utils.translate('global__sorted_click_change') :
                        utils.translate('global__click_to_sort')}>
                            {props.str}
                    </a>
                    {props.isActive ? (props.reversed ?
                        <img className="sort-flag" src={utils.createStaticUrl('img/sort_desc.svg')} /> :
                        <img className="sort-flag" src={utils.createStaticUrl('img/sort_asc.svg')} /> ) :
                        null
                    }
                </span>
            );
        }

        return <th>{renderSortingIcon()}</th>;
    };

    /**
     *
     */
    const ResultRowPosFilter:React.FC<{
        word:string;
        usesStructAttr:boolean;

    }> = (props) => {

        const handleViewConcClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistResultViewConc>({
                name: Actions.WordlistResultViewConc.name,
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

    const TRResultRow:React.FC<{
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

    const PaginatorTextInput:React.FC<{
        modelIsBusy:boolean;
        value:string;
        hint:string;

     }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.WordlistResultSetPage>({
                name: Actions.WordlistResultSetPage.name,
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

    const PaginatorLeftArrows:React.FC<{}> = (props) => {

        const handlePrevPageClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistResultPrevPage>({
                name: Actions.WordlistResultPrevPage.name
            });
        };

        const handleFirstPageClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistGoToFirstPage>({
                name: Actions.WordlistGoToFirstPage.name,
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

    const PaginatorRightArrows:React.FC<{}> = (props) => {

        const handleNextPageClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistResultNextPage>({
                name: Actions.WordlistResultNextPage.name
            });
        };

        const handleLastPageClick = () => {
            dispatcher.dispatch<typeof Actions.WordlistGoToLastPage>({
                name: Actions.WordlistGoToLastPage.name,
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

    const Paginator:React.FC<{
        currPage:number;
        currPageInput:string;
        maxPage:number;
        modelIsBusy:boolean;

     }> = (props) => {

        const handleKeyPress = (evt) => {
            if (evt.key === Keyboard.Value.ENTER) {
                evt.preventDefault();
                evt.stopPropagation();
                dispatcher.dispatch<typeof Actions.WordlistResultConfirmPage>({
                    name: Actions.WordlistResultConfirmPage.name,
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
                        {'\u00a0'}/{'\u00a0'}<span>{props.maxPage}</span>
                    </div>
                    {props.currPage < props.maxPage ? <PaginatorRightArrows /> : null}
                </form>
            </div>
        );
    }

    // ---------------------- <CalculationStatus /> -------------------

    const CalculationStatus:React.FC<{
        progressPercent:number;
        isError:boolean;

    }> = (props) => {
        if (props.isError) {
            return (
                <S.CalculationStatus>
                    <img src={utils.createStaticUrl('img/crisis.svg')} style={{width: '1.5em'}}
                            alt={utils.translate('global__error_icon')} />
                    <p>{utils.translate('global__bg_calculation_failed')}</p>
                </S.CalculationStatus>
            );

        } else {
            return (
                <S.CalculationStatus>
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
                </S.CalculationStatus>
            );
        }
    };

    // -------------------------- <DataTable /> -------------------------------------

    interface DataTableProps {
        usesStructAttr:boolean;
        wlpat:string;
    }

    const DataTable:React.FC<WordlistResultModelState & DataTableProps> = (props) => {
        if (props.isUnfinished) {
            return (
                <div className="WordlistResult">
                    <CalculationStatus progressPercent={props.bgCalcStatus}
                            isError={props.isError} />
                </div>
            );

        } else if (props.data.length === 0) {
            return (
                <p className="no-result">
                    {utils.translate('wordlist__no_result_for_{wlpat}', {wlpat: props.wlpat})}
                </p>
            );

        } else {
            return <>
                <Paginator currPageInput={props.currPageInput} modelIsBusy={props.isBusy}
                                currPage={props.currPage} maxPage={props.numPages} />
                <table className="data">
                    <thead>
                        <tr>
                            <th />
                            <th>
                                {utils.translate('wordlist__filter_th')}
                            </th>
                            {List.map(
                                item => <THSortableColumn key={item.sortKey} str={item.str} sortKey={item.sortKey}
                                    isActive={props.wlsort === item.sortKey} reversed={props.reversed} />,
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

    const BoundDataTable = BoundWithProps<DataTableProps, WordlistResultModelState>(DataTable, wordlistResultModel);

    // ---------------------- <WordlistResult /> -------------------

    const WordlistResult:React.FC<WordlistFormState> = (props) => (
        <S.WordlistResult>
            <BoundDataTable wlpat={props.wlpat} usesStructAttr={props.usesStructAttr} />
            <wordlistSaveViews.WordlistSaveForm />
        </S.WordlistResult>
    );

    return {
        WordlistResult: Bound(WordlistResult, wordlistFormModel)
    };

}