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


export function init(dispatcher, mixins, layoutViews, concDetailStore, refsDetailStore) {

    // ------------------------- <RefLine /> ---------------------------

    const RefLine = React.createClass({

        _renderCols : function () {
            let ans = [];
            let item = this.props.colGroups;

            if (item[0]) {
                ans.push(<th key="c1">{item[0].name}</th>);
                ans.push(<td key="c2" className="data">{item[0].val}</td>);

            } else {
                ans.push(<th key="c1" />);
                ans.push(<td key="c2" />);
            }
            if (item[1]) {
                ans.push(<th key="c3">{item[1].name}</th>);
                ans.push(<td key="c4" className="data">{item[1].val}</td>);

            } else {
                ans.push(<th key="c3" />);
                ans.push(<td key="c4" />);
            }
            return ans;
        },

        render : function () {
            return <tr>{this._renderCols()}</tr>;
        }
    });

    // ------------------------- <RefDetail /> ---------------------------

    const RefDetail = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {data: null, isWaiting: true};
        },

        _storeChangeHandler : function (store) {
            this.setState({
                data: refsDetailStore.getData(),
                isWaiting: false
            });
        },

        componentDidMount : function () {
            refsDetailStore.addChangeListener(this._storeChangeHandler);
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SHOW_REF_DETAIL',
                props: {
                    corpusId: this.props.corpusId,
                    tokenNumber: this.props.tokenNumber,
                    lineIdx: this.props.lineIdx
                }
            });
        },

        componentWillUnmount : function () {
            refsDetailStore.removeChangeListener(this._storeChangeHandler);
        },

        _renderContents : function () {
            if (this.state.isWaiting) {
                return <img src={this.createStaticUrl('img/ajax-loader.gif')} alt={this.translate('global__loading')} />;

            } else {
                return(
                    <table className="full-ref">
                        <tbody>
                            {this.state.data.map(
                                (item, i) => <RefLine key={i} colGroups={item} />)
                            }
                        </tbody>
                    </table>
                );
            }
        },

        render: function () {
            return (
                <layoutViews.ModalOverlay>
                    <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler} customClass="refs-detail">
                        {this._renderContents()}
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    });

    // ------------------------- <ExpandConcDetail /> ---------------------------

    const ExpandConcDetail = React.createClass({

        mixins : mixins,

        _createAlt : function () {
            if (this.props.position === 'left') {
                return this.translate('global__click_to_expand_left');

            } else if (this.props.position === 'right') {
                return this.translate('global__click_to_expand_right');
            }
        },

        _createImgPath : function () {
            if (this.props.position === 'left') {
                return this.createStaticUrl('/img/prev-page.svg');

            } else if (this.props.position === 'right') {
                return this.createStaticUrl('/img/next-page.svg');
            }
        },

        render : function () {
            if (this.props.waitingFor !== this.props.waitingKey) {
                return (
                    <a className="expand"
                            alt={this._createAlt()} onClick={this.props.clickHandler}>
                        <img src={this._createImgPath()} />
                    </a>
                );

            } else {
                return (
                    <img className="expand"
                            src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={this.translate('global__loading')} />
                );
            }
        }

    });

    // ------------------------- <ConcDetailMenu /> ---------------------------

    const ConcDetailMenu = React.createClass({
        // speechStruct
        render : function () {
            return (
                <ul className="view-mode">
                    <li><a>default view</a></li>
                    <li><a>view as speeches</a></li>
                </ul>
            );
        }
    });

    // ------------------------- <ConcDetail /> ---------------------------

    const ConcDetail = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                data: null,
                waitingFor: 1, // 0 = nothing, 1 = initial data, 2 = expand left, 3 = expand right
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight(),
                canDisplayWholeDocument: false
            };
        },

        _renderContents : function () {
            if (this.state.waitingFor === 1) {
                return <img src={this.createStaticUrl('img/ajax-loader.gif')} alt={this.translate('global__loading')} />;

            } else {
                return (
                    <div>
                        <ConcDetailMenu />
                        {this.state.hasExpandLeft ?
                            <ExpandConcDetail position="left" waitingFor={this.state.waitingFor}
                                    clickHandler={this._expandClickHandler.bind(this, 'left')}
                                    waitingKey={2} />
                            : null
                        }
                        {(this.state.data || []).map((item, i) => {
                            return (
                                <span key={i} className={item.class ? item.class : null}>{item.str + ' '}</span>
                            );
                        })}
                        {this.state.hasExpandRight ?
                            <ExpandConcDetail position="right" waitingFor={this.state.waitingFor}
                                    clickHandler={this._expandClickHandler.bind(this, 'right')}
                                    waitingKey={3} />
                            : null
                        }
                        {this.state.canDisplayWholeDocument ?
                            <div className="footer">
                                <a id="ctx-link"
                                    onClick={this._handleDisplayWholeDocumentClick}>display whole document</a>
                            </div>
                            : null
                        }
                    </div>
                );
            }
        },

        _handleDisplayWholeDocumentClick : function () {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SHOW_WHOLE_DOCUMENT',
                props: {}
            });
        },

        _expandClickHandler : function (position) {
            this.setState({
                data: this.state.data,
                waitingFor : position === 'left' ? 2 : 3, // TODO test 'right' properly
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight()
            });
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_EXPAND_KWIC_DETAIL',
                props: {
                    position: position
                }
            });
        },

        _storeChangeHandler : function (store, action) {
            this.setState({
                data: concDetailStore.getConcDetail(),
                waitingFor: 0,
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight(),
                canDisplayWholeDocument: concDetailStore.canDisplayWholeDocument()
            });
        },

        componentDidMount : function () {
            concDetailStore.addChangeListener(this._storeChangeHandler);
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SHOW_KWIC_DETAIL',
                props: {
                    corpusId: this.props.corpusId,
                    tokenNumber: this.props.tokenNumber,
                    lineIdx: this.props.lineIdx
                }
            });
        },

        componentWillUnmount : function () {
            concDetailStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay>
                    <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler} customClass="conc-detail">
                        {this._renderContents()}
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }

    });

    return {
        RefDetail: RefDetail,
        ConcDetail: ConcDetail
    };
}