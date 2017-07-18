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

/**
 */
export function init(dispatcher, utils, layoutViews, wordlistResultStore) {

    // ---------------------- <THSortableColumn /> -------------------

    const THSortableColumn = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_RESULT_SET_SORT_COLUMN',
                props: {
                    sortKey: props.sortKey
                }
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
     * @param {*} props
     */
    const ResultRowPosFilter = (props) => {

        const handleViewConcClick = () => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_RESULT_VIEW_CONC',
                props: {
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

    const TRResultRow = (props) => {
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

    const PaginatorTextInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_RESULT_SET_PAGE',
                props: {
                    page: evt.target.value
                }
            });
        };

        return (
            <span className="curr-page">
                {props.storeIsBusy ?
                    <img className="ajax-loader-bar" src={utils.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={utils.translate('global__loading')} /> :
                    <input type="text" value={props.value}
                        onChange={handleInputChange} style={{width: '3em'}} />
                }
            </span>
        );
    };

    // ---------------------- <Paginator /> -------------------

    const Paginator = (props) => {

        const handlePrevPageClick = () => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_RESULT_PREV_PAGE',
                props: {}
            });
        };

        const handleNextPageClick = () => {
            dispatcher.dispatch({
                actionType: 'WORDLIST_RESULT_NEXT_PAGE',
                props: {}
            });
        };

        const handleKeyPress = (evt) => {
            if (evt.keyCode === 13) {
                evt.preventDefault();
                evt.stopPropagation();
                dispatcher.dispatch({
                    actionType: 'WORDLIST_RESULT_CONFIRM_PAGE',
                    props: {}
                });
            }
        };

        return (
            <div className="bonito-pagination">
                <form onKeyDown={handleKeyPress}>
                    <div className="bonito-pagination-left">
                        <a onClick={handlePrevPageClick}>
                            <img src={utils.createStaticUrl('img/prev-page.svg')} />
                        </a>
                    </div>
                    <div className="bonito-pagination-core">
                        <PaginatorTextInput value={props.currPage} storeIsBusy={props.storeIsBusy} />
                    </div>
                    <div className="bonito-pagination-right">
                        <a onClick={handleNextPageClick}>
                            <img src={utils.createStaticUrl('img/next-page.svg')} />
                        </a>
                    </div>
                </form>
            </div>
        );
    }

    // ---------------------- <WordlistResult /> -------------------

    class WordlistResult extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _fetchStoreState() {
            return {
                data: wordlistResultStore.getData(),
                headings: wordlistResultStore.getHeadings(),
                currPageInput: wordlistResultStore.getCurrPageInput(),
                storeIsBusy: wordlistResultStore.getIsBusy(),
                usesStructAttr: wordlistResultStore.usesStructAttr(),
                wlsort: wordlistResultStore.getWlsort()
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            wordlistResultStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            wordlistResultStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <div className="WordlistResult">
                    <Paginator currPage={this.state.currPageInput} storeIsBusy={this.state.storeIsBusy} />
                    <table className="data">
                        <thead>
                            <tr>
                                <th />
                                <th>
                                    {utils.translate('wordlist__filter_th')}
                                </th>
                                {this.state.headings.map(item =>
                                    <THSortableColumn key={item.sortKey} str={item.str} sortKey={item.sortKey}
                                            isActive={this.state.wlsort === item.sortKey} />)}
                            </tr>
                        </thead>
                        <tbody>
                            {this.state.data.map((item, i) =>
                                <TRResultRow key={item.idx} idx={item.idx} str={item.str} freq={item.freq}
                                        usesStructAttr={this.state.usesStructAttr} />)}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    return {
        WordlistResult: WordlistResult
    };

}