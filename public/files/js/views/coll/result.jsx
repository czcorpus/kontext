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

import * as React from 'vendor/react';
import {init as initSaveViews} from './save';

export function init(dispatcher, utils, layoutViews, collResultStore) {

    const saveViews = initSaveViews(dispatcher, utils, layoutViews, collResultStore.getSaveStore());

    /**
     *
     * @param {*} props
     */
    const TDPosNegFilterLink = (props) => {
        return (
            <td>
                <a href="" title="negative filter">n</a>
            </td>
        );
    };

    /**
     *
     * @param {*} props
     */
    const DataRow = (props) => {
        return (
            <tr>
                <td className="num">
                    {props.idx}.
                </td>
                <TDPosNegFilterLink />
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

    /**
     *
     * @param {*} props
     */
    const THSortable = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: 'COLL_RESULT_SORT_BY_COLUMN',
                props: {
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

    /**
     *
     * @param {*} props
     */
    const TRDataHeading = (props) => {
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

    /**
     *
     * @param {*} props
     */
    const DataTable = (props) => {
        return (
            <table className="data">
                <tbody>
                    <TRDataHeading data={props.heading} sortFn={props.sortFn} cattr={props.cattr} />
                    {props.rows.map((item, i) => <DataRow key={i} idx={props.lineOffset + i + 1} data={item} />)}
                </tbody>
            </table>
        );
    };

    /**
     *
     * @param {*} props
     */
    const PageInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'COLL_RESULT_SET_PAGE_INPUT_VAL',
                props: {
                    value: evt.target.value
                }
            });
        };

        return (
            <span className="curr-page">
                {props.isWaiting ?
                    <img className="ajax-loader-bar" src={utils.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={utils.translate('global__loading')} /> :
                    <input type="text" value={props.currPageInput}
                        onChange={handleInputChange}
                        title={utils.translate('global__hit_enter_to_confirm')} />
                }
            </span>
        );
    }

    /**
     *
     * @param {*} props
     */
    const PrevPageLink = (props) => {

        const handleClick = (props) => {
            dispatcher.dispatch({
                actionType: 'COLL_RESULT_GET_PREV_PAGE',
                props: {}
            });
        };

        return (
            <div className="bonito-pagination-left">
                <a onClick={handleClick}>
                    <img src={utils.createStaticUrl('img/prev-page.svg')}
                            alt={utils.translate('concview_prev_page_btn')} />
                </a>
            </div>
        );
    };

    /**
     *
     * @param {*} props
     */
    const NextPageLink = (props) => {

        const handleClick = (props) => {
            dispatcher.dispatch({
                actionType: 'COLL_RESULT_GET_NEXT_PAGE',
                props: {}
            });
        };

        return (
            <div className="bonito-pagination-right">
                <a onClick={handleClick}>
                    <img src={utils.createStaticUrl('img/next-page.svg')}
                            alt={utils.translate('concview__next_page_btn')} />
                </a>
            </div>
        );
    };

    /**
     *
     * @param {*} props
     */
    const Pagination = (props) => {

        const handleKeyPress = (evt) => {
            if (evt.keyCode === 13) {
                dispatcher.dispatch({
                    actionType: 'COLL_RESULT_CONFIRM_PAGE_VALUE',
                    props: {}
                });
                evt.preventDefault();
                evt.stopPropagation();
            }
        };

        return (
            <form className="bonito-pagination" onKeyDown={handleKeyPress}>
                <fieldset className="float">
                    {props.currPage > 1 ? <PrevPageLink /> : null}
                    <div className="bonito-pagination-core">
                        <PageInput isWaiting={props.isWaiting} currPageInput={props.currPageInput} />
                    </div>
                    {props.hasNextPage ? <NextPageLink /> : null}
                </fieldset>
            </form>
        );
    }

    /**
     *
     * @param {*} props
     */
    const CalcStatusBar = (props) => {
        return (
            <div id="progress_message">
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
            </div>
        );
    };

    /**
     *
     */
    class CollResultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleSaveFormClose = this._handleSaveFormClose.bind(this);
        }

        _fetchStoreState() {
            return {
                data: collResultStore.getData(),
                heading: collResultStore.getHeading(),
                currPageInput: collResultStore.getCurrPageInput(),
                isWaiting: collResultStore.getIsWaiting(),
                lineOffset: collResultStore.getLineOffset(),
                currPage: collResultStore.getCurrPage(),
                hasNextPage: collResultStore.getHasNextPage(),
                sortFn: collResultStore.getSortFn(),
                cattr: collResultStore.getCattr(),
                saveFormVisible: collResultStore.getSaveStore().getFormIsActive(),
                saveLinesLimit: collResultStore.getSaveLinesLimit(),
                calcStatus: collResultStore.getCalcStatus()
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        _handleSaveFormClose() {
            dispatcher.dispatch({
                actionType: 'COLL_RESULT_CLOSE_SAVE_FORM',
                props: {}
            });
        }

        componentDidMount() {
            collResultStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            collResultStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <div className="CollResultView">
                    {this.state.saveFormVisible ?
                        <saveViews.SaveCollForm onClose={this._handleSaveFormClose} saveLinesLimit={this.state.saveLinesLimit} />
                        : null
                    }
                    {this.state.calcStatus < 100 ?
                        <CalcStatusBar status={this.state.calcStatus} /> :
                        (<div>
                            <Pagination currPageInput={this.state.currPageInput}
                                currPage={this.state.currPage}
                                isWaiting={this.state.isWaiting} hasNextPage={this.state.hasNextPage} />
                            <DataTable rows={this.state.data} heading={this.state.heading}
                                    lineOffset={this.state.lineOffset} sortFn={this.state.sortFn}
                                    cattr={this.state.cattr} />
                        </div>)
                    }
                </div>
            );
        }
    }

    return {
        CollResultView: CollResultView
    };

}