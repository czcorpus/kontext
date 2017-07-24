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
import {init as lineSelViewsInit} from './lineSelection';
import {init as paginatorViewsInit} from './paginator';
import {init as linesViewInit} from './lines';
import {init as concDetailViewsInit} from 'views/concordance/detail';
import {init as concSaveViewsInit} from 'views/concordance/save';


export function init(dispatcher, mixins, layoutViews, stores) {

    const lineSelectionStore = stores.lineSelectionStore;
    const lineStore = stores.lineViewStore;
    const concSaveStore = lineStore.getSaveStore();
    const concDetailStore = stores.concDetailStore;
    const refsDetailStore = stores.refsDetailStore;
    const userInfoStore = stores.userInfoStore;
    const mainMenuStore = stores.mainMenuStore;
    const syntaxViewStore = lineStore.getSyntaxViewStore();

    const util = mixins[0];

    const lineSelViews = lineSelViewsInit(dispatcher, mixins, lineSelectionStore, userInfoStore);
    const paginationViews = paginatorViewsInit(dispatcher, mixins, lineStore);
    const linesViews = linesViewInit(dispatcher, mixins, lineStore, lineSelectionStore);
    const concDetailViews = concDetailViewsInit(dispatcher, mixins, layoutViews, concDetailStore, refsDetailStore, lineStore);
    const concSaveViews = concSaveViewsInit(dispatcher, util, layoutViews, concSaveStore);


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
                        customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}
                        takeFocus={true}>
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

        _storeChangeHandler : function (store, action) {
            this.setState({
                canCalculateAdHocIpm: lineStore.providesAdHocIpm(),
                adHocIpm: lineStore.getAdHocIpm(),
                subCorpName: lineStore.getSubCorpName(),
                isWaiting: action === '$CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC' ? false : this.state.isWaiting
            });
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._storeChangeHandler);
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
            return (
                <span>
                    {this.translate('options__vmode_status_label')}
                    {':\u00a0'}
                    <img key="bubb" className="mouseover-available"
                            src={this.createStaticUrl(mouseoverImg)} alt={mouseoverAlt} title={mouseoverAlt} />
                </span>
            );
        },

        render : function () {
            return (
                <div className="conc-toolbar">
                    <span className="separ">|</span>
                    {this._renderMouseOverInfo()}
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
                        <ConcOptions usesMouseoverAttrs={this.props.usesMouseoverAttrs} />
                        : null}
                </div>
            );
        }
    });


    // ------------------------- <AnonymousUserLoginPopup /> ---------------------------

    const AnonymousUserLoginPopup = (props) => {

        const handleLoginClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'USER_SHOW_LOGIN_DIALOG',
                props: {}
            });
            evt.preventDefault();
        };

        return (
            <layoutViews.PopupBox onCloseClick={props.onCloseClick} takeFocus={true}
                customStyle={{left: '50%', width: '30em', marginLeft: '-15em'}}>
                <p>
                    <img className="info-icon" src={util.createStaticUrl('img/warning-icon.svg')} alt={util.translate('global__info_icon')} />
                    {util.translate('global__anonymous_user_warning')}
                </p>
                <p>
                    <button type="button" className="default-button"
                            ref={elm => elm ? elm.focus() : null}
                            onClick={handleLoginClick}>
                        {util.translate('global__login_label')}
                    </button>
                </p>
            </layoutViews.PopupBox>
        );
    };

    // ------------------------- <SyntaxViewPane /> ----------------------------

    class SyntaxViewPane extends React.Component {

        constructor(props) {
            super(props);
            this.state = {
                waiting: syntaxViewStore.isWaiting()
            };
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _handleStoreChange() {
            this.setState({
                waiting: syntaxViewStore.isWaiting()
            });
        }

        componentDidMount() {
            syntaxViewStore.addChangeListener(this._handleStoreChange);
            this.props.onReady(
                this.props.tokenNumber,
                this.props.kwicLength
            );
        }

        componentWillUnmount() {
            this.props.onClose();
            syntaxViewStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.onCloseClick} isScrollable={true}>
                    <layoutViews.PopupBox onCloseClick={this.props.onCloseClick}
                            customClass="syntax-tree">
                        <div id="syntax-view-pane">
                            {this.state.waiting ?
                                <img src={util.createStaticUrl('img/ajax-loader.gif')}
                                        alt={util.translate('global__loading')} /> : null}
                        </div>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    };


    // ------------------------- <ConcordanceView /> ---------------------------

    const ConcordanceView = React.createClass({

        getInitialState : function () {
            return {
                concDetailMetadata : null,
                refsDetailData: null,
                usesMouseoverAttrs: lineStore.getViewAttrsVmode() === 'mouseover',
                isUnfinishedCalculation: lineStore.isUnfinishedCalculation(),
                concSummary: lineStore.getConcSummary(),
                showAnonymousUserWarn: this.props.anonymousUser,
                saveFormVisible: concSaveStore.getFormIsActive(),
                supportsSyntaxView: lineStore.getSupportsSyntaxView(),
                syntaxBoxData: null
            };
        },

        _handleDetailCloseClick : function () {
            this.setState(React.addons.update(this.state, {concDetailMetadata: {$set: null}}));
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_STOP_SPEECH',
                props: {}
            });
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_RESET_DETAIL',
                props: {}
            });
        },

        _detailClickHandler : function (corpusId, tokenNumber, kwicLength, lineIdx) {
            this.setState(React.addons.update(this.state, {
                concDetailMetadata: {$set: {
                    corpusId: corpusId,
                    tokenNumber: tokenNumber,
                    kwicLength: kwicLength,
                    lineIdx: lineIdx,
                    speakerIdAttr: this.props.baseCorpname === corpusId ? this.props.SpeakerIdAttr : null,
                    speechOverlapAttr: this.props.baseCorpname === corpusId ? this.props.SpeechOverlapAttr : null,
                    speechOverlapVal: this.props.baseCorpname === corpusId ? this.props.SpeechOverlapVal : null,
                    speechSegment: this.props.baseCorpname === corpusId ? this.props.SpeechSegment : null
                }},
                refsDetailData: {$set: null}
            }));
            if (concDetailStore.getDefaultViewMode() === 'default') {
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_SHOW_KWIC_DETAIL',
                    props: {
                        corpusId: corpusId,
                        tokenNumber: tokenNumber,
                        kwicLength: kwicLength,
                        lineIdx: lineIdx
                    }
                });

            } else if (concDetailStore.getDefaultViewMode() === 'speech') {
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_SHOW_SPEECH_DETAIL',
                    props: {
                        corpusId: corpusId,
                        tokenNumber: tokenNumber,
                        kwicLength: kwicLength,
                        lineIdx: lineIdx
                    }
                });
            }
        },

        _handleAnonymousUserWarning : function () {
            this.setState(React.addons.update(this.state, {showAnonymousUserWarn: {$set: false}}));
        },

        _handleRefsDetailCloseClick : function () {
            this.setState(React.addons.update(this.state, {refsDetailData: {$set: null}}));
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_REF_RESET_DETAIL',
                props: {}
            });
        },

        _handleSyntaxBoxClick : function (tokenNumber, kwicLength) {
            this.setState(React.addons.update(this.state,
                {syntaxBoxData: {$set: {tokenNumber: tokenNumber, kwicLength: kwicLength}}}));
        },

        _handleSyntaxBoxClose : function () {
            this.setState(React.addons.update(this.state, {syntaxBoxData: {$set: null}}));
        },

        _refsDetailClickHandler : function (corpusId, tokenNumber, lineIdx) {
            this.setState(React.addons.update(this.state, {
                concDetailMetadata: {$set: null},
                refsDetailData: {$set: {corpusId: corpusId, tokenNumber: tokenNumber, lineIdx: lineIdx}}
            }));
        },

        _storeChangeHandler : function (store, action) {
            this.setState({
                concDetailMetadata: this.state.concDetailMetadata,
                refsDetailData:  this.state.refsDetailData,
                usesMouseoverAttrs: lineStore.getViewAttrsVmode() === 'mouseover',
                concSummary: lineStore.getConcSummary(),
                isUnfinishedCalculation: lineStore.isUnfinishedCalculation(),
                showAnonymousUserWarn: this.state.showAnonymousUserWarn,
                saveFormVisible: concSaveStore.getFormIsActive()
            });
        },

        componentDidMount : function () {
            lineStore.addChangeListener(this._storeChangeHandler);
            concSaveStore.addChangeListener(this._storeChangeHandler);
        },

        componentWillUnmount : function () {
            lineStore.removeChangeListener(this._storeChangeHandler);
            concSaveStore.removeChangeListener(this._storeChangeHandler);
        },

        render : function () {
            return (
                <div>
                    {this.state.syntaxBoxData ?
                        <SyntaxViewPane onCloseClick={this._handleSyntaxBoxClose}
                                tokenNumber={this.state.syntaxBoxData.tokenNumber}
                                kwicLength={this.state.syntaxBoxData.kwicLength}
                                onReady={this.props.onSyntaxPaneReady}
                                onClose={this.props.onSyntaxPaneClose} /> : null}
                    {this.state.concDetailMetadata ?
                        <concDetailViews.ConcDetail
                            closeClickHandler={this._handleDetailCloseClick}
                            corpusId={this.state.concDetailMetadata.corpusId}
                            tokenNumber={this.state.concDetailMetadata.tokenNumber}
                            kwicLength={this.state.concDetailMetadata.kwicLength}
                            lineIdx={this.state.concDetailMetadata.lineIdx}
                            speakerIdAttr={this.state.concDetailMetadata.speakerIdAttr}
                            speechOverlapAttr={this.state.concDetailMetadata.speechOverlapAttr}
                            speechOverlapVal={this.state.concDetailMetadata.speechOverlapVal}
                            speechSegment={this.state.concDetailMetadata.speechSegment}
                            speakerColors={this.props.SpeakerColors} />
                        : null
                    }
                    {this.state.refsDetailData ?
                        <concDetailViews.RefDetail
                            closeClickHandler={this._handleRefsDetailCloseClick}
                            corpusId={this.state.refsDetailData.corpusId}
                            tokenNumber={this.state.refsDetailData.tokenNumber}
                            lineIdx={this.state.refsDetailData.lineIdx} />
                        : null
                    }
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
                                usesMouseoverAttrs={this.state.usesMouseoverAttrs} />
                        {this.state.showAnonymousUserWarn ?
                            <AnonymousUserLoginPopup onCloseClick={this._handleAnonymousUserWarning} /> : null}
                    </div>
                    <div id="conclines-wrapper">
                        <linesViews.ConcLines {...this.props}
                            supportsSyntaxView={this.state.supportsSyntaxView}
                            onSyntaxViewClick={this._handleSyntaxBoxClick}
                            concDetailClickHandler={this._detailClickHandler}
                            refsDetailClickHandler={this._refsDetailClickHandler} />
                    </div>
                    <div id="conc-bottom-bar">
                        <div className="info-level">
                            <paginationViews.Paginator {...this.props} />
                        </div>
                    </div>
                    {this.state.saveFormVisible ? <concSaveViews.ConcSaveForm /> : null}
                </div>
            );
        }
    });

    return {
        ConcordanceView: ConcordanceView
    };

}