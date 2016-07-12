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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';


export function init(dispatcher, mixins, lineStore) {

    // ------------------------- <JumpTo /> ---------------------------

    let JumpTo = React.createClass({
        /*
        #if $Sort_idx
                <div class="jump-to">
                    $_("Jump to"):
                    <select onchange="this.form.fromp.value = this.value; this.form.submit();">
                    #for $idx in $Sort_idx
                        <option value="$idx.page" title="$idx.label" #if $idx.page == $fromp#selected="selected"#end if#>
                        #filter $Shortener
                        ${idx.label, length=20}
                        #end filter
                        </option>
                    #end for
                    </select>
                </div>
            #end if
        */
        render : function () {
            return (
                <div className="jump-to">jump to</div>
            );
        }
    });

    // ------------------------- <FirstPgButton /> ---------------------------

    let NavigButton = React.createClass({

        mixins : mixins,

        _clickHandler : function () {
            if (typeof this.props.clickHandler === 'function') {
                this.props.clickHandler();
            }
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_CHANGE_PAGE',
                props: {
                    action: this.props.action
                }
            });
        },

        _onMouseOver : function () {
            let image = this.state.image2;
            let image2 = this.state.image;
            this.setState({
                image: image,
                image2: image2
            });
        },

        getInitialState : function () {
            return {
                image: this.createStaticUrl(this.props.image),
                image2: this.createStaticUrl(this.props.image2)
            };
        },


        render : function () {
            return (
                <a>
                    <img src={this.state.image}
                        alt={this.props.label}
                        title={this.props.label}
                        onClick={this._clickHandler}
                        onMouseOver={this._onMouseOver}
                        onMouseOut={this._onMouseOver} />
                </a>
            );
        }
    });

    // ------------------------- <FirstPgButton /> ---------------------------

    let FirstPgButton = React.createClass({
        mixins : mixins,
        render : function () {
            return <NavigButton image="img/first-page.svg" image2="img/first-page_s.svg"
                        action="firstPage" label={this.translate('concview__first_page_btn')}
                        clickHandler={this.props.clickHandler} />;
        }
    });

    // ------------------------- <PrevPgButton /> ---------------------------

    let PrevPgButton = React.createClass({
        mixins : mixins,
        render : function () {
            return <NavigButton image="img/prev-page.svg" image2="img/prev-page_s.svg"
                        action="prevPage" label={this.translate('concview__prev_page_btn')}
                        clickHandler={this.props.clickHandler} />;
        }
    });

    // ------------------------- <NextPgButton /> ---------------------------

    let NextPgButton = React.createClass({
        mixins : mixins,
        render : function () {
            return <NavigButton image="img/next-page.svg" image2="img/next-page_s.svg"
                        action="nextPage" label={this.translate('concview__next_page_btn')}
                        clickHandler={this.props.clickHandler} />;
        }
    });

    // ------------------------- <LastPgButton /> ---------------------------

    let LastPgButton = React.createClass({
        mixins : mixins,
        render : function () {
            return <NavigButton image="img/last-page.svg" image2="img/last-page_s.svg"
                        action="lastPage" label={this.translate('concview__last_page_btn')}
                        clickHandler={this.props.clickHandler} />;
        }
    });

    // ------------------------- <PositionInfo /> ---------------------------

    let PositionInfo = React.createClass({

        mixins : mixins,

        _inputChangeHandler : function (event) {
            this.setState({
                currentPage: event.currentTarget.value
            });
        },

        _inputKeyDownHandler : function (event) {
            if (event.keyCode === 13) {
                if (typeof this.props.enterHitHandler === 'function') {
                    this.props.enterHitHandler();
                }
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_CHANGE_PAGE',
                    props: {
                        action: 'customPage',
                        pageNum: this.state.currentPage
                    }
                });
                event.preventDefault();
                event.stopPropagation();
            }
        },

        _storeChangeListener : function (store, action) {
            this.setState({currentPage: lineStore.getCurrentPage()});
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._storeChangeListener);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._storeChangeListener);
        },

        getInitialState : function () {
            return {
                currentPage: this.props.currentPage
            };
        },

        _renderCurrentPage : function (totalPages) {
            if (this.props.loader) {
                return <img className="ajax-loader-bar" src={this.createStaticUrl('img/ajax-loader-bar.gif')} />;

            } else if (totalPages > 1) {
                return <input type="text" value={this.state.currentPage}
                            onChange={this._inputChangeHandler}
                            onKeyDown={this._inputKeyDownHandler} />;

            } else {
                return <span>1</span>;
            }
        },

        render : function () {
            let numPages = this.props.lastPage ? this.props.lastPage : this.props.currentPage;
            return (
                <div className="bonito-pagination-core">
                    <span className="curr-page">{this._renderCurrentPage(numPages)}</span>
                    {'\u00A0/\u00A0'}
                    <span className="numofpages" title={numPages}>{numPages}</span>
                </div>
            );
        }
    });


    // ------------------------- <Paginator /> ---------------------------

    let Paginator = React.createClass({

        _importPaginationInfo : function () {
            let pagination = lineStore.getPagination();
            return {
                firstPage: pagination.firstPage,
                prevPage: pagination.prevPage,
                nextPage: pagination.nextPage,
                lastPage: pagination.lastPage,
                currentPage: lineStore.getCurrentPage()
            };
        },

        _storeChangeListener : function (store, action) {
            let state = this._importPaginationInfo();
            state['loader'] = false;
            this.setState(state);
        },

        getInitialState : function () {
            let state = this._importPaginationInfo();
            state['loader'] = false;
            return state;
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._storeChangeListener);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._storeChangeListener);
        },

        _navigActionHandler : function () {
            this.setState(React.addons.update(this.state, {loader: {$set: true}}));
        },

        render : function () {
            return (
                <div>
                    {this.state.currentPage > 1 ?
                        (<div className="bonito-pagination-left">
                            <FirstPgButton clickHandler={this._navigActionHandler} />
                            <PrevPgButton clickHandler={this._navigActionHandler} />
                        </div>) : null}

                    <PositionInfo currentPage={this.state.currentPage}
                        lastPage={this.state.lastPage} loader={this.state.loader}
                        enterHitHandler={this._navigActionHandler} />

                    {this.state.currentPage < this.state.lastPage ?
                        (<div className="bonito-pagination-right">
                            <NextPgButton clickHandler={this._navigActionHandler} />
                            <LastPgButton clickHandler={this._navigActionHandler} />
                        </div>) : null}
                </div>
            );
        }
    });

    return {
        Paginator: Paginator
    }
}