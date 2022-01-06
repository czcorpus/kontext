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
import * as Kontext from '../../../types/kontext';
import { Keyboard, List } from 'cnc-tskit';
import { init as dataRowsInit } from '../dataRows';
import { init as initSaveViews } from '../save';
import { FreqDataRowsModel, FreqDataRowsModelState } from '../../../models/freqs/dataRows';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Actions } from '../../../models/freqs/actions';
import * as S from './style';
import { FreqChartsModel } from '../../../models/freqs/regular/freqCharts';

// --------------------------- exported types --------------------------------------


// ------------------------ factory --------------------------------

export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers,
        freqChartsModel:FreqChartsModel,
        freqDataRowsModel:FreqDataRowsModel
) {
    const globalComponents = he.getLayoutViews();
    const drViews = dataRowsInit(dispatcher, he);
    const saveViews = initSaveViews(dispatcher, he, freqDataRowsModel.getSaveModel());

    // ----------------------- <ResultSizeInfo /> -------------------------

    interface ResultSizeInfoProps {
        totalPages:number;
        totalItems:number;
    }

    const ResultSizeInfo:React.FC<ResultSizeInfoProps> = (props) => {

        return (
            <p>
                <strong>{he.translate('freq__avail_label')}:</strong>
                {'\u00a0'}
                {he.translate('freq__avail_items_{num_items}', {num_items: props.totalItems})}
                {'\u00a0'}
                {props.totalPages ?
                    <span>({he.translate('freq__avail_pages_{num_pages}', {num_pages: props.totalPages})})</span>
                    : null}
            </p>
        );
    };

    // ----------------------- <Paginator /> -------------------------

    interface PaginatorProps {
        isLoading:boolean;
        currentPage:string;
        hasNextPage:boolean;
        hasPrevPage:boolean;
        totalPages:number;
    }

    const Paginator:React.FC<PaginatorProps> = (props) => {

        const handlePageChangeByClick = (curr, step) => {
            dispatcher.dispatch<typeof Actions.ResultSetCurrentPage>({
                name: Actions.ResultSetCurrentPage.name,
                payload: {value: String(Number(curr) + step)}
            });
        };

        const handlePageChange = (evt) => {
            dispatcher.dispatch<typeof Actions.ResultSetCurrentPage>({
                name: Actions.ResultSetCurrentPage.name,
                payload: {value: evt.target.value}
            });
        };

        const renderPageNum = () => {
            if (props.isLoading) {
                return <>
                        <span className="overlay">
                            <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={he.translate('global__loading')} />
                        </span>
                        <input type="text" />
                </>;

            } else {
                return <input type="text" value={props.currentPage}
                                    title={he.translate('global__curr_page_num')}
                                    onChange={handlePageChange}
                                    disabled={!props.hasPrevPage && !props.hasNextPage}
                                    style={{width: '3em'}} />;
            }
        };

        return (
            <div className="ktx-pagination">
                <form>
                    <div className="ktx-pagination-core">
                        <div className="ktx-pagination-left">
                            {props.hasPrevPage ?
                                (<a onClick={(e) => handlePageChangeByClick(props.currentPage, -1)}>
                                    <img className="over-img" src={he.createStaticUrl('img/prev-page.svg')}
                                            alt="další" title="další" />
                                </a>) : null}
                        </div>
                        <span className="curr-page">{renderPageNum()}</span>
                        <span className="numofpages">{'\u00a0/\u00a0'}{props.totalPages}</span>
                        <div className="ktx-pagination-right">
                            {props.hasNextPage ?
                                (<a onClick={(e) => handlePageChangeByClick(props.currentPage, 1)}>
                                    <img className="over-img" src={he.createStaticUrl('img/next-page.svg')}
                                            alt="další" title="další" />
                                </a>) : null}
                        </div>
                    </div>
                </form>
            </div>
        );
    };

    // ----------------------- <MinFreqInput /> -------------------------

    const MinFreqInput:React.FC<{
        minFreqVal:string;

    }> = (props) => {

        const handleInputChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<typeof Actions.ResultSetMinFreqVal>({
                name: Actions.ResultSetMinFreqVal.name,
                payload: {value: evt.target.value}
            });
        };

        const inputKeyDownHandler = (evt:React.KeyboardEvent<{}>) => {
            if (evt.key === Keyboard.Value.ENTER) {
                dispatcher.dispatch<typeof Actions.ResultApplyMinFreq>({
                    name: Actions.ResultApplyMinFreq.name,
                    payload: {}
                });
                evt.preventDefault();
                evt.stopPropagation();
            }
        };

        return (
            <label>
                {he.translate('freq__limit_input_label')}:
                {'\u00a0'}
                <input type="text" name="flimit" value={props.minFreqVal}
                        style={{width: '3em'}}
                        onChange={handleInputChange}
                        onKeyDown={inputKeyDownHandler} />
            </label>
        );
    };

    // ----------------------- <FilterForm /> -------------------------

    interface FilterFormProps {
        minFreqVal:string;
    }

    const FilterForm:React.FC<FilterFormProps> = (props) => {

        const handleApplyClick = (evt) => {
            dispatcher.dispatch<typeof Actions.ResultApplyMinFreq>({
                name: Actions.ResultApplyMinFreq.name,
                payload: {}
            });
        };

        return (
            <S.FilterForm action="freqs">
                <MinFreqInput minFreqVal={props.minFreqVal} />
                {'\u00a0'}
                <button type="button" className="util-button" onClick={handleApplyClick}>
                    {he.translate('global__apply_btn')}
                </button>
            </S.FilterForm>
        );
    };

    // ----------------------- <FreqResultView /> -------------------------

    const FreqResultView:React.FC<FreqDataRowsModelState> = (props) => {

        const handleSaveFormClose = () => {
            dispatcher.dispatch<typeof Actions.ResultCloseSaveForm>({
                name: Actions.ResultCloseSaveForm.name,
                payload: {}
            });
        }

        const hasNextPage = (state:FreqDataRowsModelState):boolean => {
            return parseInt(state.currentPage) < state.data[0].TotalPages;
        }

        const hasPrevPage = (state:FreqDataRowsModelState):boolean => {
            return parseInt(state.currentPage) > 1 && state.data[0].TotalPages > 1;
        }

        const handleTabSelection = (id:string) => {

        }

        return (
            <globalComponents.TabView
                    className="TagsetFormSelector"
                    callback={handleTabSelection}
                    items={[{id: 'tables', label: 'Tables'}, {id: 'charts', label: 'Charts'}]}
                    defaultId="tables"
                    noButtonSeparator={true} >
                <div className="FreqResultView">
                    {props.currentPage !== null ?
                        <Paginator currentPage={props.currentPage}
                            hasNextPage={hasNextPage(props)}
                            hasPrevPage={hasPrevPage(props)}
                            totalPages={props.data[0].TotalPages}
                            isLoading={props.isBusy} /> : null}
                    <div className="freq-blocks">
                        <FilterForm minFreqVal={props.flimit} />
                        {List.map((block, i) => {
                            return (
                                <div key={`block-${i}`}>
                                    <hr />
                                    <ResultSizeInfo totalPages={block.TotalPages} totalItems={block.Total} />
                                    <drViews.DataTable head={block.Head}
                                            sortColumn={props.sortColumn}
                                            rows={block.Items}
                                            hasSkippedEmpty={block.SkippedEmpty} />
                                </div>
                            );
                        }, props.data)}
                    </div>
                    {props.saveFormActive ?
                        <saveViews.SaveFreqForm onClose={handleSaveFormClose} /> :
                        null
                    }
                </div>
                <div>
                    Chart view
                </div>
            </globalComponents.TabView>
        );
    }


    return {
        FreqResultView: BoundWithProps(FreqResultView, freqDataRowsModel)
    };
}