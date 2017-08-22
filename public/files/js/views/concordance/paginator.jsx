/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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


export function init(dispatcher, he, lineStore) {

    const layoutViews = he.getLayoutViews();

    // ------------------------- <JumpTo /> ---------------------------
    // TODO implement a proper initialization of currently selected item
    const JumpTo = (props) => {

        const selectChangeHandler = (event) => {
            if (typeof props.clickHandler === 'function') {
                props.clickHandler();
            }
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_CHANGE_PAGE',
                props: {
                    action: 'customPage',
                    pageNum: Number(event.currentTarget.value)
                }
            });
        };

        return (
            <div className="jump-to">
                {he.translate('concview__sort_jump_to')}
                {'\u00A0'}
                <select onChange={selectChangeHandler}>
                {props.sortIdx.map((item) => {
                    return <option key={item.page + ':' + item.label}
                                value={item.page}>{item.label}</option>;
                })}
                </select>
            </div>
        );
    };

    // ------------------------- <FirstPgButton /> ---------------------------

    const NavigButton = (props) => {

        const clickHandler = () => {
            if (typeof props.clickHandler === 'function') {
                props.clickHandler();
            }
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_CHANGE_PAGE',
                props: {
                    action: props.action
                }
            });
        };

        return (
            <a onClick={clickHandler}>
                <layoutViews.ImgWithMouseover
                    src={he.createStaticUrl(props.image)}
                    alt={props.label} />
            </a>
        );
    };

    // ------------------------- <FirstPgButton /> ---------------------------

    const FirstPgButton = (props) => {

        return <NavigButton image="img/first-page.svg"
                    action="firstPage" label={he.translate('concview__first_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <PrevPgButton /> ---------------------------

    const PrevPgButton = (props) => {

        return <NavigButton image="img/prev-page.svg"
                    action="prevPage" label={he.translate('concview__prev_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <NextPgButton /> ---------------------------

    const NextPgButton = (props) => {

        return <NavigButton image="img/next-page.svg"
                    action="nextPage" label={he.translate('concview__next_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <LastPgButton /> ---------------------------

    const LastPgButton = (props) => {

        return <NavigButton image="img/last-page.svg"
                    action="lastPage" label={he.translate('concview__last_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <PositionInfo /> ---------------------------

    const PositionInfo = (props) => {

        const inputChangeHandler = (event) => {
            props.inputHandler(event);
        };

        const inputKeyDownHandler = (event) => {
            props.inputKeyDownHandler(event);
        };

        const renderCurrentPage = (totalPages) => {
            if (props.loader) {
                return <img className="ajax-loader-bar" src={he.createStaticUrl('img/ajax-loader-bar.gif')} />;

            } else if (totalPages > 1) {
                return <input type="text" value={props.currentPageInput}
                            onChange={inputChangeHandler}
                            onKeyDown={inputKeyDownHandler} />;

            } else {
                return <span>1</span>;
            }
        };

        const numPages = props.lastPage ? props.lastPage : props.currentPage;
        return (
            <div className="bonito-pagination-core">
                <span className="curr-page">{renderCurrentPage(numPages)}</span>
                {'\u00A0/\u00A0'}
                <span className="numofpages">{he.formatNumber(numPages)}</span>
            </div>
        );
    };


    // ------------------------- <Paginator /> ---------------------------

    class Paginator extends React.Component {

        constructor(props) {
            super(props);
            this._storeChangeListener = this._storeChangeListener.bind(this);
            this._navigActionHandler = this._navigActionHandler.bind(this);
            this._pageInputHandler = this._pageInputHandler.bind(this);
            this._inputKeyDownHandler = this._inputKeyDownHandler.bind(this);
            this.state = this._importPaginationInfo();
        }

        _importPaginationInfo() {
            const pagination = lineStore.getPagination();
            return {
                firstPage: pagination.firstPage,
                prevPage: pagination.prevPage,
                nextPage: pagination.nextPage,
                lastPage: pagination.lastPage,
                currentPage: lineStore.getCurrentPage(),
                currentPageInput: lineStore.getCurrentPage(),
                loader: false
            };
        }

        _storeChangeListener() {
            const state = this._importPaginationInfo();
            state.loader = false;
            this.setState(state);
        }

        _navigActionHandler() {
            const newState = he.cloneState(this.state);
            newState.loader = true;
            this.setState(newState);
        }

        _pageInputHandler(event) {
            const newState = he.cloneState(this.state);
            newState.currentPageInput = event.currentTarget.value
            this.setState(newState);
        }

        _inputKeyDownHandler(event) {
            if (event.keyCode === 13) {
               this._navigActionHandler();
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_CHANGE_PAGE',
                    props: {
                        action: 'customPage',
                        pageNum: this.state.currentPageInput
                    }
                });
                event.preventDefault();
                event.stopPropagation();
            }
        }

        componentDidMount() {
            lineStore.addChangeListener(this._storeChangeListener);
        }

        componentWillUnmount() {
            lineStore.removeChangeListener(this._storeChangeListener);
        }

        render() {
            return (
                <div className="bonito-pagination">
                    {this.state.currentPage > 1 ?
                        (<div className="bonito-pagination-left">
                            <FirstPgButton clickHandler={this._navigActionHandler} />
                            <PrevPgButton clickHandler={this._navigActionHandler} />
                        </div>) : null}

                    <PositionInfo
                        currentPage={this.state.currentPage}
                        currentPageInput={this.state.currentPageInput}
                        lastPage={this.state.lastPage}
                        loader={this.state.loader}
                        enterHitHandler={this._navigActionHandler}
                        inputHandler={this._pageInputHandler}
                        inputKeyDownHandler={this._inputKeyDownHandler} />

                    {this.state.currentPage < this.state.lastPage ?
                        (<div className="bonito-pagination-right">
                            <NextPgButton clickHandler={this._navigActionHandler} />
                            <LastPgButton clickHandler={this._navigActionHandler} />
                        </div>) : null}

                    {this.props.SortIdx.length > 0 ? <JumpTo sortIdx={this.props.SortIdx}
                            clickHandler={this._navigActionHandler} /> : null}
                </div>
            );
        }
    }

    return {
        Paginator: Paginator
    }
}