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

import * as React from 'react';
import { IActionDispatcher } from 'kombo';
import { Keyboard } from 'cnc-tskit';
import { Subscription } from 'rxjs';

import {ConcordanceModel} from '../../models/concordance/main';
import {Actions, ActionName} from '../../models/concordance/actions'
import { Kontext } from '../../types/common';
import { PaginationActions } from '../../models/concordance/common';


export interface PaginatorProps {
    SortIdx:Array<{page:number; label:string}>;
}


export interface PaginatorState {
    firstPage:number;
    prevPage:number;
    nextPage:number;
    lastPage:number;
    currentPage:number;
    currentPageInput:string;
    loader:boolean;
}


export interface PaginatorViews {
    Paginator:React.ComponentClass<PaginatorProps>;
}



export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, lineModel:ConcordanceModel) {

    const layoutViews = he.getLayoutViews();

    // ------------------------- <JumpTo /> ---------------------------
    // TODO implement a proper initialization of currently selected item


    const JumpTo:React.FC<{
        sortIdx:Array<{page:number; label:string}>;
        clickHandler:()=>void;

    }> = (props) => {

        const selectChangeHandler = (event) => {
            if (typeof props.clickHandler === 'function') {
                props.clickHandler();
            }
            dispatcher.dispatch<Actions.ChangePage>({
                name: ActionName.ChangePage,
                payload: {
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

    const NavigButton:React.FC<{
        action:PaginationActions;
        image:string;
        label:string;
        clickHandler:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        const clickHandler = (evt:React.MouseEvent<{}>) => {
            if (typeof props.clickHandler === 'function') {
                props.clickHandler(evt);
            }
            dispatcher.dispatch<Actions.ChangePage>({
                name: ActionName.ChangePage,
                payload: {
                    action: props.action,
                    pageNum: null
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

    const FirstPgButton:React.FC<{
        clickHandler:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        return <NavigButton image="img/first-page.svg"
                    action="firstPage" label={he.translate('concview__first_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <PrevPgButton /> ---------------------------

    const PrevPgButton:React.FC<{
        clickHandler:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        return <NavigButton image="img/prev-page.svg"
                    action="prevPage" label={he.translate('concview__prev_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <NextPgButton /> ---------------------------

    const NextPgButton:React.FC<{
        clickHandler:(evt:React.MouseEvent<{}>)=>void;

    }> = (props) => {

        return <NavigButton image="img/next-page.svg"
                    action="nextPage" label={he.translate('concview__next_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <LastPgButton /> ---------------------------

    const LastPgButton:React.FC<{
        clickHandler:()=>void;

    }> = (props) => {

        return <NavigButton image="img/last-page.svg"
                    action="lastPage" label={he.translate('concview__last_page_btn')}
                    clickHandler={props.clickHandler} />;
    };

    // ------------------------- <PositionInfo /> ---------------------------

    const PositionInfo:React.FC<{
        inputHandler:(evt:React.KeyboardEvent<{}>)=>void;
        inputKeyDownHandler:(evt:React.KeyboardEvent<{}>)=>void;
        loader:boolean;
        currentPageInput:string;
        currentPage:number;
        lastPage:number;

    }> = (props) => {

        const inputChangeHandler = (event) => {
            props.inputHandler(event);
        };

        const inputKeyDownHandler = (event) => {
            props.inputKeyDownHandler(event);
        };

        const renderCurrentPage = (totalPages) => {
            if (props.loader) {
                return <>
                    <span className="overlay">
                        <img className="ajax-loader-bar" src={he.createStaticUrl('img/ajax-loader-bar.gif')} />
                    </span>
                    <input type="text" />
                </>;

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
            <div className="ktx-pagination-core">
                <span className="curr-page">{renderCurrentPage(numPages)}</span>
                {'\u00A0/\u00A0'}
                <span className="numofpages">{he.formatNumber(numPages)}</span>
            </div>
        );
    };


    // ------------------------- <Paginator /> ---------------------------

    class Paginator extends React.Component<PaginatorProps, PaginatorState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._modelChangeListener = this._modelChangeListener.bind(this);
            this._navigActionHandler = this._navigActionHandler.bind(this);
            this._pageInputHandler = this._pageInputHandler.bind(this);
            this._inputKeyDownHandler = this._inputKeyDownHandler.bind(this);
            this.state = this._importPaginationInfo();
        }

        _importPaginationInfo() {
            const pagination = lineModel.getPagination();
            return {
                firstPage: pagination.firstPage,
                prevPage: pagination.prevPage,
                nextPage: pagination.nextPage,
                lastPage: pagination.lastPage,
                currentPage: lineModel.getCurrentPage(),
                currentPageInput: String(lineModel.getCurrentPage()),
                loader: false
            };
        }

        _modelChangeListener() {
            const state = this._importPaginationInfo();
            state.loader = false;
            window.scrollTo(0, 0);
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

        _inputKeyDownHandler(evt:React.KeyboardEvent<{}>) {
            if (evt.key === Keyboard.Value.ENTER) {
                this._navigActionHandler();
                dispatcher.dispatch<Actions.ChangePage>({
                    name: ActionName.ChangePage,
                    payload: {
                        action: 'customPage',
                        pageNum: Number(this.state.currentPageInput)
                    }
                });
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        componentDidMount() {
            this.modelSubscription = lineModel.addListener(this._modelChangeListener);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div className="ktx-pagination">
                    {this.state.currentPage > 1 ?
                        (<div className="ktx-pagination-left">
                            <FirstPgButton clickHandler={this._navigActionHandler} />
                            <PrevPgButton clickHandler={this._navigActionHandler} />
                        </div>) : null}

                    <PositionInfo
                        currentPage={this.state.currentPage}
                        currentPageInput={this.state.currentPageInput}
                        lastPage={this.state.lastPage}
                        loader={this.state.loader}
                        inputHandler={this._pageInputHandler}
                        inputKeyDownHandler={this._inputKeyDownHandler} />

                    {this.state.currentPage < this.state.lastPage ?
                        (<div className="ktx-pagination-right">
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