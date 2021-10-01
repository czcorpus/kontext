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
import { IActionDispatcher, BoundWithProps } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { Keyboard } from 'cnc-tskit';import { init as initSaveViews } from '../save';
import { CollResultModel, CollResultModelState } from '../../../models/coll/result';
import { CollResultsSaveModel } from '../../../models/coll/save';
import { CollResultRow, CollResultHeadingCell } from '../../../models/coll/common';
import { Actions } from '../../../models/coll/actions';
import * as S from './style';


export interface CollResultViewProps {
    onClose:()=>void;
}


export interface ResultViews {
    CollResultView:React.ComponentClass<CollResultViewProps>;
}


export function init(
    dispatcher:IActionDispatcher,
    utils:Kontext.ComponentHelpers,
    collResultModel:CollResultModel,
    collSaveModel:CollResultsSaveModel
):ResultViews {

    const saveViews = initSaveViews({
        dispatcher,
        utils,
        collSaveModel
    });

    // ---------------- <TDPosNegFilterLink /> ------------------------

    const TDPosNegFilterLink:React.FC<{
        pfilter: {[key:string]:string};
        nfilter: {[key:string]:string};

    }> = (props) => {

        const handleClick = (args) => {
            return (e) => {
                dispatcher.dispatch<typeof Actions.ResultApplyQuickFilter>({
                    name: Actions.ResultApplyQuickFilter.name,
                    payload: {
                        args: args,
                        blankWindow: e.ctrlKey
                    }
                });
            };
        };

        return (
            <td>
                <a onClick={handleClick(props.pfilter)}
                        title={utils.translate('global__pnfilter_label_p')}>p</a>
                {'\u00a0/\u00a0'}
                <a onClick={handleClick(props.nfilter)}
                        title={utils.translate('global__pnfilter_label_n')}>n</a>
            </td>
        );
    };

    // ---------------- <DataRow /> ------------------------

    const DataRow:React.FC<{
        idx:number;
        data:CollResultRow;
    }> = (props) => {
        return (
            <tr>
                <td className="num">
                    {props.idx}.
                </td>
                <TDPosNegFilterLink pfilter={props.data.pfilter} nfilter={props.data.nfilter} />
                <td className="left monospace">
                    {props.data.str}
                </td>
                <td className="num">
                    {props.data.freq}
                </td>
                {props.data.Stats.map((stat, si) => <td key={`stat_${si}`} className="num">{stat.s}</td>)}
            </tr>
        );
    }

    // ---------------- <THSortable /> ------------------------

    const THSortable:React.FC<{
        sortFn:string;
        isActive:boolean;
        label:string;

    }> = (props) => {
        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.ResultSortByColumn>({
                name: Actions.ResultSortByColumn.name,
                payload: {
                    sortFn: props.sortFn
                }
            });
        };

        const renderSortingIcon = () => {
            if (props.isActive) {
                return (
                    <span title={utils.translate('global__sorted')}>
                         {props.label}
                        <img className="sort-flag" src={utils.createStaticUrl('img/sort_desc.svg')} />
                    </span>
                );

            } else {
                return (
                    <a onClick={handleClick} title={utils.translate('global__click_to_sort')}>
                         {props.label}
                    </a>
                );
            }
        };

        return <th>{renderSortingIcon()}</th>;
    };

    // ---------------- <TRDataHeading /> ------------------------

    const TRDataHeading:React.FC<{
        cattr:string;
        sortFn:string;
        data:Array<CollResultHeadingCell>;

    }> = (props) => {
        return (
            <tr>
                <th />
                <th>{utils.translate('coll__cattr_col_hd')}</th>
                <th>{props.cattr}</th>
                {props.data.map((item, i) => <THSortable key={`head${i}`}
                        sortFn={item.s} label={item.n} isActive={props.sortFn === item.s} />)}
            </tr>
        );
    };

    // ---------------- <DataTable /> ------------------------

    const DataTable:React.FC<{
        heading:Array<CollResultHeadingCell>;
        sortFn:string;
        cattr:string;
        lineOffset:number;
        rows:Array<CollResultRow>;

    }> = (props) => {
        return (
            <table className="data">
                <tbody>
                    <TRDataHeading data={props.heading} sortFn={props.sortFn} cattr={props.cattr} />
                    {props.rows.map((item, i) => <DataRow key={i} idx={props.lineOffset + i + 1} data={item} />)}
                </tbody>
            </table>
        );
    };

    // ---------------- <PageInput /> ------------------------

    const PageInput:React.FC<{
        isWaiting:boolean;
        currPageInput:string;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.ResultSetPageInputVal>({
                name: Actions.ResultSetPageInputVal.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <span className="curr-page">
                {props.isWaiting ?
                    <>
                        <span className="overlay">
                            <img className="ajax-loader-bar" src={utils.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={utils.translate('global__loading')} />
                        </span>
                        <input type="text" readOnly={true} />
                    </> :
                    <input type="text" value={props.currPageInput}
                        onChange={handleInputChange}
                        title={utils.translate('global__hit_enter_to_confirm')} />
                }
            </span>
        );
    }

    // ---------------- <PrevPageLink /> ------------------------

    const PrevPageLink:React.FC<{}> = (props) => {

        const handleClick = (props) => {
            dispatcher.dispatch<typeof Actions.ResultGetPrevPage>({
                name: Actions.ResultGetPrevPage.name
            });
        };

        return (
            <div className="ktx-pagination-left">
                <a onClick={handleClick}>
                    <img src={utils.createStaticUrl('img/prev-page.svg')}
                            alt={utils.translate('concview_prev_page_btn')} />
                </a>
            </div>
        );
    };

    // ---------------- <NextPageLink /> ------------------------

    const NextPageLink:React.FC<{}> = (props) => {

        const handleClick = (props) => {
            dispatcher.dispatch<typeof Actions.ResultGetNextPage>({
                name: Actions.ResultGetNextPage.name
            });
        };

        return (
            <div className="ktx-pagination-right">
                <a onClick={handleClick}>
                    <img src={utils.createStaticUrl('img/next-page.svg')}
                            alt={utils.translate('concview__next_page_btn')} />
                </a>
            </div>
        );
    };

    // ---------------- <Pagination /> ------------------------

    const Pagination:React.FC<{
        isWaiting:boolean;
        currPage:number;
        hasNextPage:boolean;
        currPageInput:string;

    }> = (props) => {

        const handleKeyPress = (evt) => {
            if (evt.key === Keyboard.Value.ENTER) {
                dispatcher.dispatch<typeof Actions.ResultConfirmPageValue>({
                    name: Actions.ResultConfirmPageValue.name
                });
                evt.preventDefault();
                evt.stopPropagation();
            }
        };

        return (
            <S.Pagination className="ktx-pagination" onKeyDown={handleKeyPress}>
                <fieldset className="float">
                    {props.currPage > 1 ? <PrevPageLink /> : null}
                    <div className="ktx-pagination-core">
                        <PageInput isWaiting={props.isWaiting} currPageInput={props.currPageInput} />
                    </div>
                    {props.hasNextPage ? <NextPageLink /> : null}
                </fieldset>
            </S.Pagination>
        );
    }

    // ---------------- <CalcStatusBar /> ------------------------

    const CalcStatusBar:React.FC<{
        status:number;

    }> = (props) => {
        return (
            <S.CalcStatusBar>
                <div className="progress-info">
                    <div>
                        {utils.translate('global__calculating')}
                        <a className="context-help">
                            <img src={utils.createStaticUrl('img/question-mark.svg')} />
                        </a>
                    </div>
                    <div id="progress_scale">
                        <div id="processbar" style={{width: `${props.status}%`}} />
                    </div>
                </div>
            </S.CalcStatusBar>
        );
    };

    // ---------------- <CollResultView /> ------------------------

    class CollResultView extends React.PureComponent<CollResultViewProps & CollResultModelState> {

        constructor(props) {
            super(props);
            this._handleSaveFormClose = this._handleSaveFormClose.bind(this);
        }

        _handleSaveFormClose() {
            dispatcher.dispatch<typeof Actions.ResultCloseSaveForm>({
                name: Actions.ResultCloseSaveForm.name
            });
        }

        render() {
            return (
                <S.CollResultView>
                    {this.props.saveFormVisible ?
                        <saveViews.SaveCollForm onClose={this._handleSaveFormClose} saveLinesLimit={this.props.saveLinesLimit} />
                        : null
                    }
                    {this.props.calcStatus < 100 ?
                        <CalcStatusBar status={this.props.calcStatus} /> :
                        (<div>
                            <Pagination currPageInput={this.props.currPageInput}
                                currPage={this.props.currPage}
                                isWaiting={this.props.isWaiting} hasNextPage={this.props.hasNextPage} />
                            <DataTable rows={this.props.data} heading={this.props.heading}
                                    lineOffset={this.props.pageSize * (this.props.currPage - 1)} sortFn={this.props.sortFn}
                                    cattr={this.props.cattr} />
                        </div>)
                    }
                </S.CollResultView>
            );
        }
    }

    return {
        CollResultView: BoundWithProps<CollResultViewProps, CollResultModelState>(CollResultView, collResultModel)
    };

}