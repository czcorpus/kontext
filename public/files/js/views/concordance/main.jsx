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
import {init as lineSelViewsInit} from './lineSelection';
import {init as paginatorViewsInit} from './paginator';
import {init as linesViewInit} from './lines';


export function init(dispatcher, mixins, lineStore, lineSelectionStore, userInfoStore, layoutViews) {

    let lineSelViews = lineSelViewsInit(dispatcher, mixins, lineSelectionStore, userInfoStore);
    let paginationViews = paginatorViewsInit(dispatcher, mixins, lineStore);
    let linesViews = linesViewInit(dispatcher, mixins, lineStore, lineSelectionStore);


    // ------------------------- <LineSelectionMenu /> ---------------------------

    let LineSelectionMenu = React.createClass({

        _renderContents : function () {
            if (this.props.numItemsInLockedGroups > 0) {
                return <lineSelViews.LockedLineGroupsMenu
                        chartCallback={this.props.onChartFrameReady}
                        canSendMail={this.props.canSendMail} />;

            } else {
                return <lineSelViews.LineSelectionMenu />;
            }
        },

        _storeChangeHandler : function (store, action) {
            if (action === '$STATUS_UPDATED') {
                this.props.onCloseClick();
            }
        },

        componentDidMount : function () {
            lineSelectionStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            lineSelectionStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <layoutViews.PopupBox onCloseClick={this.props.onCloseClick}
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}>
                    {this._renderContents()}
                </layoutViews.PopupBox>
            );
        }
    });

    // ------------------------- <LineSelectionOps /> ---------------------------

    let LineSelectionOps = React.createClass({

        mixins : mixins,

        _selectChangeHandler : function (event) {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SET_LINE_SELECTION_MODE',
                props: {
                    mode: event.currentTarget.value
                }
            });
        },

        _selectMenuTriggerHandler : function () {
            this.setState({menuVisible: true});
        },

        _closeMenuHandler : function () {
            this.setState({menuVisible: false});
        },

        getInitialState : function () {
            return {menuVisible: false};
        },

        _renderNumSelected : function () {
            let numSelected = this.props.numSelected > 0 ?
                    this.props.numSelected : this.props.numItemsInLockedGroups;
            if (numSelected > 0) {
                return [
                    '(',
                    (<a key="numItems" onClick={this._selectMenuTriggerHandler}>
                        <span className="value">{numSelected}</span>
                        {'\u00A0'}{this.translate('concview__num_sel_lines')}</a>
                    ),
                    ')'
                ];

            } else {
                return null;
            }
        },

        _getMsgStatus : function () {
            let elmClass;
            let elmTitle;
            if (this.props.numItemsInLockedGroups > 0) {
                elmClass = 'info';
                elmTitle = this.translate('linesel__you_have_saved_line_groups');

            } else if (this.props.numSelected > 0) {
                elmClass = 'warn';
                elmTitle = this.translate('linesel__you_have_unsaved_line_sel');

            } else {
                elmClass = '';
                elmTitle = null;
            }
            return [elmClass, elmTitle];
        },

        render : function () {
            let mode = this.props.numItemsInLockedGroups > 0 ? 'groups' : lineSelectionStore.getMode();
            let [elmClass, elmTitle] = this._getMsgStatus();
            return (
                <div className="line-ops">
                    {this.translate('concview__line_sel')}:{'\u00A0'}
                    {/* TODO remove id */}
                    <select id="selection-mode-switch"
                            disabled={this.props.numItemsInLockedGroups > 0 ? true : false}
                            onChange={this._selectChangeHandler}
                            defaultValue={mode}>
                        <option value="simple">{this.translate('concview__line_sel_simple')}</option>
                        <option value="groups">{this.translate('concview__line_sel_groups')}</option>
                    </select>
                    <span className={'lines-selection ' + elmClass} title={elmTitle}>
                        {this._renderNumSelected()}
                    </span>
                    {this.state.menuVisible ?
                        <LineSelectionMenu
                                onCloseClick={this._closeMenuHandler}
                                numItemsInLockedGroups={this.props.numItemsInLockedGroups}
                                onChartFrameReady={this.props.onChartFrameReady}
                                canSendMail={this.props.canSendMail} />
                        :  null}
                </div>
            );
        }
    });



    // ------------------------- <ConcSummary /> ---------------------------

    let ConcSummary = React.createClass({

        mixins : mixins,

        _renderNumHits : function () {
            if (this.props.concSize === this.props.fullSize) {
                return [
                    <span key="hits:1" id="conc-loader"></span>,
                    <strong key="hits:2" id="fullsize" title={this.props.fullSize}>
                    {this.formatNumber(this.props.fullSize)}
                    </strong>
                ];

            } else {
                return [
                    <a key="hits:1b" className="size-warning"><img src={this.createStaticUrl('img/warning-icon.svg')} /></a>,
                    <span key="hits:2b" id="loader"></span>,
                    <strong key="hits:3b">{this.formatNumber(this.props.concSize)}</strong>,
                    this.translate('concview__out_of_total'),
                    <span key="hits:4b" id="fullsize" title={this.props.fullSize}>
                        {this.formatNumber(this.props.fullSize)}
                    </span>
                ];
            }
        },

        getInitialState : function () {
            return {
                numSelected: lineSelectionStore.size(),
                numItemsInLockedGroups: lineStore.getNumItemsInLockedGroups()
            };
        },

        _storeChangeHandler : function (store, action) {
            this.setState({
                numSelected: lineSelectionStore.size(),
                numItemsInLockedGroups: lineStore.getNumItemsInLockedGroups()
            });
        },

        componentDidMount : function () {
            lineSelectionStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            lineSelectionStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <div id="result-info">
                    {this.translate('concview__hits_label')}:  {this._renderNumHits()}
                    <span id="conc-calc-info" title="90"></span>
                    <span className="separ">|</span>
                    <abbr>i.p.m.</abbr>
                    <layoutViews.InlineHelp customStyle={{minWidth: '25em'}}>
                        {this.translate('concview__ipm_help')}
                        {'\u00A0'}
                        ({this.translate('concview__ipm_rel_to_the_{corpname}', {corpname: this.props.corpname})})
                    </layoutViews.InlineHelp>
                    :{'\u00A0'}
                    <span className="ipm">{this.props.ipm}</span>
                    {'\u00A0'}
                    ({this.props.ipmRelatedTo})
                    {'\u00A0'}
                    <span className="separ">|</span>
                    <abbr>ARF</abbr>
                    <layoutViews.InlineHelp customStyle={{minWidth: '20em'}}>
                    {this.translate('concview__arf_help')}
                    </layoutViews.InlineHelp>
                    :{'\u00A0'}
                    <strong id="arf">{this.props.arf ? this.props.arf : '-'}</strong>
                    <span className="separ">|</span>
                    <span className="notice-shuffled">
                    {this.props.isShuffled ?
                        this.translate('concview__result_shuffled')
                        : this.translate('concview__result_sorted')}
                    </span>
                    <br />
                    <LineSelectionOps
                            numSelected={this.state.numSelected}
                            numItemsInLockedGroups={this.state.numItemsInLockedGroups}
                            onChartFrameReady={this.props.onChartFrameReady}
                            canSendMail={this.props.canSendMail} />
                </div>
            );
        }
    });


    // ------------------------- <ConcordanceView /> ---------------------------

    let ConcordanceView = React.createClass({

        render : function () {
            return (
                <div>
                    <div id="conc-top-bar">
                        <ConcSummary {...this.props.concSummary}
                            numItemsInLockedGroups={this.props.NumItemsInLockedGroups}
                            onChartFrameReady={this.props.onChartFrameReady}
                            canSendMail={this.props.canSendMail}
                            corpname={this.props.baseCorpname} />
                        <paginationViews.Paginator {...this.props} />
                    </div>
                    <div id="conclines-wrapper">
                        <linesViews.ConcLines {...this.props} />
                    </div>
                    <div id="conc-bottom-bar">
                        <paginationViews.Paginator {...this.props} />
                    </div>
                </div>
            );
        }
    });

    return {
        ConcordanceView: ConcordanceView
    };

}