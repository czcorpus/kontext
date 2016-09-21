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
import {init as structsAttrsViewInit} from 'views/options/structsAttrs';


export function init(dispatcher, mixins, lineStore, lineSelectionStore, userInfoStore,
        viewOptionsStore, layoutViews) {

    const lineSelViews = lineSelViewsInit(dispatcher, mixins, lineSelectionStore, userInfoStore);
    const paginationViews = paginatorViewsInit(dispatcher, mixins, lineStore);
    const linesViews = linesViewInit(dispatcher, mixins, lineStore, lineSelectionStore);
    const viewOptionsViews = structsAttrsViewInit(dispatcher, mixins, viewOptionsStore);


    // ------------------------- <LineSelectionMenu /> ---------------------------

    const LineSelectionMenu = React.createClass({

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

    const LineSelectionOps = React.createClass({

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
            this.setState({
                menuVisible: true
            });
        },

        _closeMenuHandler : function () {
            this.setState({
                menuVisible: false
            });
        },

        _storeChangeHandler : function () {
            this.setState({
                menuVisible: false // <- data of lines changed => no need for menu
            });
        },

        getInitialState : function () {
            return {
                menuVisible: false
            };
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._storeChangeHandler);
        },

        _getMsgStatus : function () {
            if (this.props.numItemsInLockedGroups > 0) {
                return [
                    'img/info-icon.svg',
                    this.translate('linesel__you_have_saved_line_groups')
                ];

            } else if (this.props.numSelected > 0) {
                return [
                    '/img/warning-icon.svg',
                    this.translate('linesel__you_have_unsaved_line_sel')
                ];

            } else {
                return ['', null];
            }
        },

        _renderNumSelected : function () {
            const [statusImg, elmTitle] = this._getMsgStatus();
            const numSelected = this.props.numSelected > 0 ?
                    this.props.numSelected : this.props.numItemsInLockedGroups;
            if (numSelected > 0) {
                return (
                    <span className="lines-selection" title={elmTitle}>
                        {'\u00A0'}
                        (<a key="numItems" onClick={this._selectMenuTriggerHandler}>
                        <span className="value">{numSelected}</span>
                        {'\u00A0'}{this.translate('concview__num_sel_lines')}</a>
                        )
                        {statusImg ?
                            <img src={this.createStaticUrl(statusImg)} alt="" title="" /> : null}
                    </span>
                );

            } else {
                return null;
            }
        },

        render : function () {
            const mode = this.props.numItemsInLockedGroups > 0 ? 'groups' : lineSelectionStore.getMode();
            return (
                <div className="lines-selection-controls">
                    {this.translate('concview__line_sel')}:{'\u00A0'}
                    {/* TODO remove id */}
                    <select id="selection-mode-switch"
                            disabled={this.props.numItemsInLockedGroups > 0 ? true : false}
                            onChange={this._selectChangeHandler}
                            defaultValue={mode}>
                        <option value="simple">{this.translate('concview__line_sel_simple')}</option>
                        <option value="groups">{this.translate('concview__line_sel_groups')}</option>
                    </select>
                    {this._renderNumSelected()}
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

    const ConcSummary = React.createClass({

        mixins : mixins,

        _renderNumHits : function () {
            const ans = [];
            if (this.props.isUnfinishedCalculation) {
                ans.push(<span key="hits:1" id="conc-loader">
                            <img src={this.createStaticUrl('img/ajax-loader-bar.gif')} title={this.translate('global__processing')}
                                alt={this.translate('global__processing')} />
                        </span>);
            }
            if (this.props.concSize === this.props.fullSize || this.props.fullSize === -1) { // TODO concSize vs. fullSize
                ans.push(<strong key="hits:2" id="fullsize" title={this.props.concSize}>
                        {this.formatNumber(this.props.concSize)}</strong>);

            } else {
                ans.push(<a key="hits:1b" className="size-warning"><img src={this.createStaticUrl('img/warning-icon.svg')} /></a>);
                ans.push(<span key="hits:2b" id="loader"></span>);
                ans.push(<strong key="hits:3b">{this.formatNumber(this.props.concSize)}</strong>);
                ans.push('\u00a0' + this.translate('concview__out_of_total') + '\u00a0');
                ans.push(<span key="hits:4b" id="fullsize" title={this.props.fullSize}>{this.formatNumber(this.props.fullSize)}</span>);
            }
            return ans;
        },

        getInitialState : function () {
            return {
                canCalculateAdHocIpm: lineStore.providesAdHocIpm(),
                adHocIpm: lineStore.getAdHocIpm(),
                subCorpName: lineStore.getSubCorpName(),
                isWaiting: false
            }
        },

        _lineStoreChangeHandler : function (store, action) {
            this.setState({
                canCalculateAdHocIpm: lineStore.providesAdHocIpm(),
                adHocIpm: lineStore.getAdHocIpm(),
                subCorpName: lineStore.getSubCorpName(),
                isWaiting: action === '$CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC' ? false : this.state.isWaiting
            });
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._lineStoreChangeHandler);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._lineStoreChangeHandler);
        },

        _getIpm : function () {
            if (this.state.isWaiting) {
                return <img src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={this.translate('global__calculating')}
                            title={this.translate('global__calculating')} />;

            } else if (this.props.ipm && !this.state.canCalculateAdHocIpm) {
                return <span className="ipm">{this.formatNumber(this.props.ipm)}</span>;

            } else if (this.state.adHocIpm) {
                return <span className="ipm">{this.formatNumber(this.state.adHocIpm)}</span>;

            } else if (this.state.canCalculateAdHocIpm) {
                return <a onClick={this._handleCalcIpmClick}>{this.translate('global__calculate')}</a>;

            } else {
                return null;
            }
        },

        _getIpmDesc : function () {
            if (this.state.canCalculateAdHocIpm) {
                if (this.state.adHocIpm) {
                    return '(' + this.translate('concview__ipm_rel_to_adhoc') + ')';

                } else {
                    return null;
                }

            } else if (this.state.subCorpName) {
                return '(' + this.translate('concview__ipm_rel_to_the_{subcname}',
                        {subcname: this.state.subCorpName}) + ')';

            } else {
                return '(' + this.translate('concview__ipm_rel_to_the_{corpname}',
                        {corpname: this.props.corpname}) + ')';
            }
        },

        _handleCalcIpmClick : function () {
            let userConfirm = window.confirm(this.translate('global__ipm_calc_may_take_time'));
            if (userConfirm) {
                this.setState(React.addons.update(this.state, {isWaiting: {$set: true}}));
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC',
                    props: {}
                });
            }
        },

        _getArf : function () {
            if (this.props.arf) {
                return <strong id="arf">{this.formatNumber(this.props.arf)}</strong>;

            } else {
                return <strong id="arf" title={this.translate('concview__arf_not_avail')}>-</strong>;
            }
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
                    </layoutViews.InlineHelp>
                    :{'\u00A0'}
                    {this._getIpm()}
                    {'\u00A0'}
                    {this._getIpmDesc()}
                    {'\u00A0'}
                    <span className="separ">|</span>
                    <abbr>ARF</abbr>
                    <layoutViews.InlineHelp customStyle={{minWidth: '20em'}}>
                    {this.translate('concview__arf_help')}
                    </layoutViews.InlineHelp>
                    :{'\u00A0'}
                    {this._getArf()}
                    <span className="separ">|</span>
                    <span className="notice-shuffled">
                    {this.props.isShuffled ?
                        this.translate('concview__result_shuffled')
                        : this.translate('concview__result_sorted')}
                    </span>
                </div>
            );
        }
    });

    // ------------------------- <ConcOptions /> ---------------------------

    const ConcOptions = React.createClass({

        mixins : mixins,

        _storeChangeHandler : function () {
            this.setState({currViewAttrs: lineStore.getViewAttrs()});
        },

        getInitialState : function () {
            return {
                currViewAttrs: lineStore.getViewAttrs()
            };
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._storeChangeHandler);
        },

        _renderMouseOverInfo : function () {
            let mouseoverImg;
            let mouseoverAlt;
            if (this.props.usesMouseoverAttrs) {
                mouseoverImg = 'img/mouseover-available.svg';
                mouseoverAlt = this.translate('options__attribs_are_on_mouseover_{attrs}',
                        {attrs: this.state.currViewAttrs.slice(1).join('/')});;

            } else {
                mouseoverImg = 'img/mouseover-not-available.svg';
                mouseoverAlt = this.translate('options__attribs_are_not_mouseover');
            }
            return <img key="bubb" className="mouseover-available"
                            src={this.createStaticUrl(mouseoverImg)} alt={mouseoverAlt} title={mouseoverAlt} />;
        },

        render : function () {
            return (
                <div className="conc-toolbar">
                    <span className="separ">|</span>
                    {this._renderMouseOverInfo()}
                    <a onClick={this.props.onViewOptionsClick}>
                        {this.translate('concview__change_display_settings')}
                    </a>
                </div>
            );
        }

    });


    // ------------------------- <ConcToolbar /> ---------------------------


    const ConcToolbarWrapper = React.createClass({

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
                <div className="toolbar-level">
                    <LineSelectionOps
                            numSelected={this.state.numSelected}
                            numItemsInLockedGroups={this.state.numItemsInLockedGroups}
                            onChartFrameReady={this.props.onChartFrameReady}
                            canSendMail={this.props.canSendMail} />
                    {this.props.showConcToolbar ?
                        <ConcOptions usesMouseoverAttrs={this.props.usesMouseoverAttrs}
                                onViewOptionsClick={this.props.onViewOptionsClick} />
                        : null}
                </div>
            );
        }
    });


    // ------------------------- <ConcordanceView /> ---------------------------

    const ConcordanceView = React.createClass({

        _toggleViewOptions : function () {
            this.setState(React.addons.update(this.state,
                {viewOptionsVisible: {$set: !this.state.viewOptionsVisible}}));
        },

        _onCloseOptionsClick : function () {
            this.setState(React.addons.update(this.state,
                {viewOptionsVisible: {$set: false}}));
        },

        getInitialState : function () {
            return {
                viewOptionsVisible: false,
                usesMouseoverAttrs: lineStore.getViewAttrsVmode() === 'mouseover',
                isUnfinishedCalculation: lineStore.isUnfinishedCalculation(),
                concSummary: lineStore.getConcSummary()
            };
        },

        _renderViewOptions : function () {
            return (
                <layoutViews.PopupBox onCloseClick={this._onCloseOptionsClick}
                        customStyle={{left: '1em', right: '1em'}}
                        customClass="view-options">
                    <viewOptionsViews.StructsAndAttrsForm isSubmitMode={false}
                        humanCorpname={this.props.baseCorpname}
                        externalCloseCallback={this._onCloseOptionsClick} />
                </layoutViews.PopupBox>
            );
        },

        _viewOptsStoreChangeHandler : function (store, action) {
            if (action === '$VIEW_OPTIONS_SAVE_SETTINGS') {
                this.setState({
                    viewOptionsVisible: true, // we are still waiting until new conc. lines are loaded
                    usesMouseoverAttrs: lineStore.getViewAttrsVmode() === 'mouseover',
                    isUnfinishedCalculation: lineStore.isUnfinishedCalculation()
                });
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_RELOAD_PAGE',
                    props: {}
                });
            }
        },

        _lineStoreChangeHandler : function (store, action) {
            this.setState({
                viewOptionsVisible: false,
                usesMouseoverAttrs: lineStore.getViewAttrsVmode() === 'mouseover',
                concSummary: lineStore.getConcSummary(),
                isUnfinishedCalculation: lineStore.isUnfinishedCalculation()
            });
        },

        componentDidMount : function () {
            viewOptionsStore.addChangeListener(this._viewOptsStoreChangeHandler);
            lineStore.addChangeListener(this._lineStoreChangeHandler);
        },

        componentWillUnmount : function () {
            viewOptionsStore.removeChangeListener(this._viewOptsStoreChangeHandler);
            lineStore.removeChangeListener(this._lineStoreChangeHandler);
        },

        render : function () {
            return (
                <div>
                    {this.state.viewOptionsVisible ? this._renderViewOptions() : null }
                    <div id="conc-top-bar">
                        <div className="info-level">
                            <paginationViews.Paginator {...this.props} />
                            <ConcSummary {...this.state.concSummary}
                                corpname={this.props.baseCorpname}
                                isUnfinishedCalculation={this.state.isUnfinishedCalculation}
                                />
                        </div>
                        <ConcToolbarWrapper numItemsInLockedGroups={this.props.NumItemsInLockedGroups}
                                onChartFrameReady={this.props.onChartFrameReady}
                                canSendMail={this.props.canSendMail}
                                showConcToolbar={this.props.ShowConcToolbar}
                                onViewOptionsClick={this._toggleViewOptions}
                                usesMouseoverAttrs={this.state.usesMouseoverAttrs} />
                    </div>
                    <div id="conclines-wrapper">
                        <linesViews.ConcLines {...this.props} />
                    </div>
                    <div id="conc-bottom-bar">
                        <div className="info-level">
                            <paginationViews.Paginator {...this.props} />
                        </div>
                    </div>
                </div>
            );
        }
    });

    return {
        ConcordanceView: ConcordanceView
    };

}