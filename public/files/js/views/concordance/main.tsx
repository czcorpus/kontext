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
import * as Immutable from 'immutable';
import { IActionDispatcher, BoundWithProps, IModel } from 'kombo';
import { Subscription } from 'rxjs';

import { Kontext, ViewOptions } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { init as lineSelViewsInit } from './lineSelection';
import { init as paginatorViewsInit } from './paginator';
import { init as linesViewInit } from './lines';
import { init as concDetailViewsInit } from './detail/index';
import { init as concSaveViewsInit } from './save';
import { init as extendedInfoViewsInit } from './extendedInfo';
import { LineSelectionModel } from '../../models/concordance/lineSelection';
import { ConcLineModel, ConcSummary as LinesConcSummary } from '../../models/concordance/lines';
import { ConcDetailModel, RefsDetailModel, RefsColumn } from '../../models/concordance/detail';
import { CollFormModel } from '../../models/coll/collForm';
import { TextTypesDistModel } from '../../models/concordance/ttDistModel';
import { ConcDashboard, ConcDashboardState } from '../../models/concordance/dashboard';
import { UsageTipsModel } from '../../models/usageTips';
import { MainMenuModelState } from '../../models/mainMenu';


export class ViewPageModels {
    lineSelectionModel:LineSelectionModel;
    lineViewModel:ConcLineModel;
    concDetailModel:ConcDetailModel;
    refsDetailModel:RefsDetailModel;
    userInfoModel:Kontext.IUserInfoModel;
    collFormModel:CollFormModel;
    mainMenuModel:IModel<MainMenuModelState>;
    ttDistModel:TextTypesDistModel;
    dashboardModel:ConcDashboard;
    usageTipsModel:UsageTipsModel;
}


export class MainModuleArgs extends ViewPageModels {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
}


export interface ConcordanceDashboardProps {
    concViewProps:{
        baseCorpname:string;
        mainCorp:string;
        anonymousUser:boolean;
        SortIdx:Array<{page:number; label:string}>;
        NumItemsInLockedGroups:number;
        catColors:Array<string>;
        KWICCorps:Array<string>;
        canSendEmail:boolean;
        ShowConcToolbar:boolean;
        anonymousUserConcLoginPrompt:boolean;
        onSyntaxPaneReady?:(tokenNumber:number, kwicLength:number)=>void;
        onSyntaxPaneClose:()=>void;
        onChartFrameReady?:(usePrevData?:boolean)=>void;
        onReady:()=>void;
    };
    kwicConnectView:PluginInterfaces.KwicConnect.WidgetWiew;
}


export interface MainViews {
    ConcordanceDashboard:React.ComponentClass<ConcordanceDashboardProps>;
}


function secs2hms(v:number) {
    const h = Math.floor(v / 3600);
    const m = Math.floor((v % 3600) / 60);
    const s = v % 60;
    const lz = (v:number) => v < 10 ? `0${v.toFixed()}` : v.toFixed();
    return `${lz(h)}:${lz(m)}:${lz(s)}`;
}


export function init({dispatcher, he, lineSelectionModel, lineViewModel,
    concDetailModel, refsDetailModel, usageTipsModel,
    ttDistModel, dashboardModel}:MainModuleArgs):MainViews
 {

    const layoutViews = he.getLayoutViews();

    const lconcSaveModel = lineViewModel.getSaveModel();
    const syntaxViewModel:PluginInterfaces.SyntaxViewer.IPlugin = lineViewModel.getSyntaxViewModel();

    const lineSelViews = lineSelViewsInit(dispatcher, he, lineSelectionModel);
    const paginationViews = paginatorViewsInit(dispatcher, he, lineViewModel);
    const linesViews = linesViewInit({
        dispatcher: dispatcher,
        he: he,
        lineModel: lineViewModel,
        lineSelectionModel: lineSelectionModel,
        concDetailModel: concDetailModel
    });
    const concDetailViews = concDetailViewsInit({
        dispatcher: dispatcher,
        he: he,
        concDetailModel: concDetailModel,
        refsDetailModel: refsDetailModel,
        lineModel: lineViewModel
    });
    const concSaveViews = concSaveViewsInit(dispatcher, he, lconcSaveModel);
    const extendedInfoViews = extendedInfoViewsInit({dispatcher, he, ttDistModel, usageTipsModel, dashboardModel});


    // ------------------------- <LineSelectionMenu /> ---------------------------

    const LineSelectionMenu:React.SFC<{
        numItemsInLockedGroups:number;
        canSendEmail:boolean;
        mode:string;
        onChartFrameReady?:()=>void;
        onCloseClick:()=>void;

    }> = (props) => {

        const renderContents = () => {
            if (props.numItemsInLockedGroups > 0) {
                return <lineSelViews.LockedLineGroupsMenu
                        chartCallback={props.onChartFrameReady}
                        canSendEmail={props.canSendEmail}
                        mode={props.mode} />;

            } else {
                return <lineSelViews.LineBinarySelectionMenu />;
            }
        };

        return (
            <layoutViews.PopupBox onCloseClick={props.onCloseClick}
                    customStyle={{position: 'absolute', left: '80pt', marginTop: '5pt'}}
                    takeFocus={true}>
                {renderContents()}
            </layoutViews.PopupBox>
        );
    }

    // ------------------------- <LineSelectionOps /> ---------------------------

    class LineSelectionOps extends React.Component<{
        numItemsInLockedGroups:number;
        numSelected:number;
        canSendEmail:boolean;
        onChartFrameReady?:()=>void;

    },
    {
        menuVisible:boolean;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._selectChangeHandler = this._selectChangeHandler.bind(this);
            this._selectMenuTriggerHandler = this._selectMenuTriggerHandler.bind(this);
            this._closeMenuHandler = this._closeMenuHandler.bind(this);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this.state = {
                menuVisible: false
            };
        }

        _selectChangeHandler(event) {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SET_LINE_SELECTION_MODE',
                payload: {
                    mode: event.currentTarget.value
                }
            });
        }

        _selectMenuTriggerHandler() {
            this.setState({
                menuVisible: true
            });
        }

        _closeMenuHandler() {
            this.setState({
                menuVisible: false
            });
        }

        _modelChangeHandler() {
            this.setState({
                menuVisible: false // <- data of lines changed => no need for menu
            });
        }

        componentDidMount() {
            this.modelSubscription = lineViewModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _getMsgStatus() {
            if (this.props.numItemsInLockedGroups > 0) {
                return [
                    he.createStaticUrl('img/info-icon.svg'),
                    he.translate('linesel__you_have_saved_line_groups')
                ];

            } else if (this.props.numSelected > 0) {
                return [
                    he.createStaticUrl('/img/warning-icon.svg'),
                    he.translate('linesel__you_have_unsaved_line_sel')
                ];

            } else {
                return ['', null];
            }
        }

        _renderNumSelected() {
            const [statusImg, elmTitle] = this._getMsgStatus();
            const numSelected = this.props.numSelected > 0 ?
                    this.props.numSelected : this.props.numItemsInLockedGroups;
            if (numSelected > 0) {
                return (
                    <span className="lines-selection" title={elmTitle}>
                        {'\u00A0'}
                        (<a key="numItems" onClick={this._selectMenuTriggerHandler}>
                        <span className="value">{numSelected}</span>
                        {'\u00A0'}{he.translate('concview__num_sel_lines')}</a>
                        )
                        {statusImg ?
                            <img src={statusImg} alt="" title="" /> : null}
                    </span>
                );

            } else {
                return null;
            }
        }

        render() {
            const mode = this.props.numItemsInLockedGroups > 0 ? 'groups' : lineSelectionModel.getMode();
            return (
                <div className="lines-selection-controls">
                    {he.translate('concview__line_sel')}:{'\u00A0'}
                    {/* TODO remove id */}
                    <select id="selection-mode-switch"
                            disabled={this.props.numItemsInLockedGroups > 0 ? true : false}
                            onChange={this._selectChangeHandler}
                            defaultValue={mode}>
                        <option value="simple">{he.translate('concview__line_sel_simple')}</option>
                        <option value="groups">{he.translate('concview__line_sel_groups')}</option>
                    </select>
                    {this._renderNumSelected()}
                    {this.state.menuVisible ?
                        <LineSelectionMenu
                                mode={mode}
                                onCloseClick={this._closeMenuHandler}
                                numItemsInLockedGroups={this.props.numItemsInLockedGroups}
                                onChartFrameReady={this.props.onChartFrameReady}
                                canSendEmail={this.props.canSendEmail} />
                        :  null}
                </div>
            );
        }
    }


    // ------------------------- <ConcSummary /> ---------------------------

    const ConcSummary:React.SFC<{
        corpname:string;
        isUnfinishedCalculation:boolean;
        concSize:number;
        fullSize:number;
        ipm:number;
        arf:number;
        isShuffled:boolean;
        canCalculateAdHocIpm:boolean;
        fastAdHocIpm:boolean;
        adHocIpm:number;
        subCorpName:string;
        origSubcorpName:string;
        isWaiting:boolean;
    }> = (props) => {

        const renderNumHits = () => {
            const ans = [];
            if (props.isUnfinishedCalculation) {
                ans.push(<span key="hits:1" className="conc-loader">
                            <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} title={he.translate('global__processing')}
                                alt={he.translate('global__processing')} />
                        </span>);
            }
            if (props.concSize === props.fullSize || props.fullSize === -1) {
                ans.push(<strong key="hits:2" className={`conc-size${props.isUnfinishedCalculation ? ' unfinished' : ''}`} title={String(props.concSize)}>
                        {he.formatNumber(props.concSize)}</strong>);

            } else {
                ans.push(<a key="hits:1b" className="size-warning"><img src={he.createStaticUrl('img/warning-icon.svg')} /></a>);
                ans.push(<span key="hits:2b" id="loader"></span>);
                ans.push(<strong key="hits:3b" className={`conc-size${props.isUnfinishedCalculation ? ' unfinished' : ''}`}>{he.formatNumber(props.concSize)}</strong>);
                ans.push('\u00a0' + he.translate('concview__out_of_total') + '\u00a0');
                ans.push(<span key="hits:4b" id="fullsize" title={String(props.fullSize)}>{he.formatNumber(props.fullSize)}</span>);
            }
            return ans;
        };

        const getIpm = () => {
            if (props.isWaiting) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={he.translate('global__calculating')}
                            title={he.translate('global__calculating')} />;

            } else if (typeof props.ipm === 'number' && !props.canCalculateAdHocIpm) {
                return <span className={`ipm${props.isUnfinishedCalculation ? ' unfinished' : ''}`}>{he.formatNumber(props.ipm)}</span>;

            } else if (props.adHocIpm) {
                return <span className={`ipm${props.isUnfinishedCalculation ? ' unfinished' : ''}`}>{he.formatNumber(props.adHocIpm)}</span>;

            } else if (props.canCalculateAdHocIpm) {
                return <a onClick={handleCalcIpmClick}>{he.translate('global__calculate')}</a>;

            } else {
                return null;
            }
        };

        const getIpmDesc = () => {
            if (props.canCalculateAdHocIpm) {
                if (props.adHocIpm) {
                    return (
                        <span className="ipm-note">(
                        <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')} />
                                {he.translate('concview__ipm_rel_to_adhoc')}
                        )</span>
                    );

                } else {
                    return null;
                }

            } else if (props.subCorpName) {
                return (
                    <span className="ipm-note">(
                        <img src={he.createStaticUrl('img/info-icon.svg')} alt={he.translate('global__info_icon')} />
                        {he.translate('concview__ipm_rel_to_the_{subcname}',
                        {subcname: props.origSubcorpName ? props.origSubcorpName : props.subCorpName})}
                    )</span>
                );

            } else {
                return (
                    <span className="ipm-note">({he.translate('concview__ipm_rel_to_the_whole_corp')})</span>
                );
            }
        };

        const handleCalcIpmClick = () => {
            const userConfirm = props.fastAdHocIpm ?
                    true : window.confirm(he.translate('global__ipm_calc_may_take_time'));
            if (userConfirm) {
                dispatcher.dispatch({
                    name: 'CONCORDANCE_CALCULATE_IPM_FOR_AD_HOC_SUBC',
                    payload: {}
                });
            }
        };

        const getArf = () => {
            if (props.arf) {
                return <strong id="arf">{he.formatNumber(props.arf)}</strong>;

            } else {
                return <strong id="arf" title={he.translate('concview__arf_not_avail')}>-</strong>;
            }
        };

        return (
            <div id="result-info">
                {he.translate('concview__hits_label')}:  {renderNumHits()}
                <span id="conc-calc-info" title="90"></span>
                <span className="separ">|</span>
                <layoutViews.Abbreviation url={he.getHelpLink('term_ipm')}
                        value={he.translate('global__abbr_ipm')}
                        desc={he.translate('concview__ipm_help')} />
                :{'\u00A0'}
                {getIpm()}
                {'\u00A0'}
                {getIpmDesc()}
                {'\u00A0'}
                <span className="separ">|</span>

                <layoutViews.Abbreviation url={he.getHelpLink('term_arf')}
                        value={he.translate('global__abbr_arf')}
                        desc={he.translate('concview__arf_help')} />
                :{'\u00A0'}
                {getArf()}
                <span className="separ">|</span>
                <span className="notice-shuffled">
                {props.isShuffled ?
                    he.translate('concview__result_shuffled') :
                    he.translate('concview__result_sorted')}
                </span>
            </div>
        );
    }

    // ------------------------- <ConcOptions /> ---------------------------

    class ConcOptions extends React.Component<{
        viewMode:ViewOptions.AttrViewMode;
    },
    {
        currViewAttrs:Array<string>;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this.state = {
                currViewAttrs: lineViewModel.getViewAttrs()
            };
        }

        _modelChangeHandler() {
            this.setState({currViewAttrs: lineViewModel.getViewAttrs()});
        }

        componentDidMount() {
            this.modelSubscription = lineViewModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div className="conc-toolbar">
                </div>
            );
        }
    }


    // ------------------------- <ConcToolbarWrapper /> ---------------------------


    class ConcToolbarWrapper extends React.Component<{
        showConcToolbar:boolean;
        canSendEmail:boolean;
        viewMode:ViewOptions.AttrViewMode;
        onChartFrameReady?:()=>void;
    },
    {
        numSelected:number;
        numItemsInLockedGroups:number;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this.state = this._fetchModelState();
        }

        _fetchModelState() {
            return {
                numSelected: lineSelectionModel.size(),
                numItemsInLockedGroups: lineViewModel.getNumItemsInLockedGroups()
            };
        }

        _modelChangeHandler() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            this.modelSubscription = lineSelectionModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div className="toolbar-level">
                    <LineSelectionOps
                            numSelected={this.state.numSelected}
                            numItemsInLockedGroups={this.state.numItemsInLockedGroups}
                            onChartFrameReady={this.props.onChartFrameReady}
                            canSendEmail={this.props.canSendEmail} />
                    {this.props.showConcToolbar ?
                        <ConcOptions viewMode={this.props.viewMode} />
                        : null}
                </div>
            );
        }
    }


    // ------------------------- <AnonymousUserLoginPopup /> ---------------------------

    const AnonymousUserLoginPopup:React.SFC<{
        onCloseClick:()=>void;

    }> = (props) => {

        const handleLoginClick = (evt) => {
            dispatcher.dispatch({
                name: 'USER_SHOW_LOGIN_DIALOG',
                payload: {
                    returnUrl: window.location.href
                }
            });
            evt.preventDefault();
        };

        return (
            <layoutViews.PopupBox onCloseClick={props.onCloseClick} takeFocus={true}
                customStyle={{left: '50%', width: '30em', marginLeft: '-15em'}}>
                <p>
                    <img className="info-icon" src={he.createStaticUrl('img/warning-icon.svg')} alt={he.translate('global__info_icon')} />
                    {he.translate('global__anonymous_user_warning')}
                </p>
                <p>
                    <button type="button" className="default-button"
                            ref={elm => elm ? elm.focus() : null}
                            onClick={handleLoginClick}>
                        {he.translate('global__login_label')}
                    </button>
                </p>
            </layoutViews.PopupBox>
        );
    };

    // ------------------------- <SyntaxViewPane /> ----------------------------

    class SyntaxViewPane extends React.Component<{
        tokenNumber:number;
        kwicLength:number;
        onReady:(tokNum:number, kwicLen:number)=>void;
        onClose:()=>void;
        onCloseClick:()=>void;
    },
    {
        waiting:boolean;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = {
                waiting: syntaxViewModel.isWaiting()
            };
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _handleModelChange() {
            this.setState({
                waiting: syntaxViewModel.isWaiting()
            });
        }

        componentDidMount() {
            this.modelSubscription = syntaxViewModel.addListener(this._handleModelChange);
            this.props.onReady(
                this.props.tokenNumber,
                this.props.kwicLength
            );
        }

        componentWillUnmount() {
            this.props.onClose();
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.onCloseClick} isScrollable={true}>
                    <layoutViews.PopupBox onCloseClick={this.props.onCloseClick}
                            customClass="syntax-tree">
                        <div id="syntax-view-pane" className="SyntaxViewPane">
                            {this.state.waiting ?
                                (<div className="ajax-loader">
                                    <img src={he.createStaticUrl('img/ajax-loader.gif')}
                                            alt={he.translate('global__loading')} />
                                </div>) : null
                            }
                        </div>
                    </layoutViews.PopupBox>
                </layoutViews.ModalOverlay>
            );
        }
    };


    // ------------------------- <ConcordanceView /> ---------------------------

    class ConcordanceView extends React.Component<
    ConcordanceDashboardProps['concViewProps'],
    {
        hasConcDetailData:boolean;
        tokenConnectData:PluginInterfaces.TokenConnect.TCData;
        tokenConnectIsBusy:boolean;
        concDetailModelIsBusy:boolean;
        refsDetailData:Immutable.List<[RefsColumn, RefsColumn]>;
        viewMode:string;
        attrViewMode:ViewOptions.AttrViewMode;
        isUnfinishedCalculation:boolean;
        concSummary:LinesConcSummary;
        showAnonymousUserWarn:boolean;
        saveFormVisible:boolean;
        supportsSyntaxView:boolean;
        syntaxBoxData:{tokenNumber:number; kwicLength:number};
        canCalculateAdHocIpm:boolean;
        fastAdHocIpm:boolean;
        adHocIpm:number;
        subCorpName:string;
        origSubcorpName:string;
        hasLines:boolean;
        isWaiting:boolean;
        numWaitingSecs:number;
    }> {

        private modelSubscriptions:Array<Subscription>;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleDetailCloseClick = this._handleDetailCloseClick.bind(this);
            this._refsDetailClickHandler = this._refsDetailClickHandler.bind(this);
            this._handleAnonymousUserWarning = this._handleAnonymousUserWarning.bind(this);
            this._handleSyntaxBoxClick = this._handleSyntaxBoxClick.bind(this);
            this._handleSyntaxBoxClose = this._handleSyntaxBoxClose.bind(this);
            this._detailClickHandler = this._detailClickHandler.bind(this);
            this.modelSubscriptions = [];
        }

        _fetchModelState() {
            return {
                hasConcDetailData: concDetailModel.hasConcDetailData(),
                tokenConnectData: concDetailModel.getTokenConnectData(),
                tokenConnectIsBusy: concDetailModel.getTokenConnectIsBusy(),
                concDetailModelIsBusy: concDetailModel.getIsBusy(),
                refsDetailData: refsDetailModel.getData(),
                viewMode: lineViewModel.getViewMode(),
                attrViewMode: lineViewModel.getViewAttrsVmode(),
                isUnfinishedCalculation: lineViewModel.isUnfinishedCalculation(),
                concSummary: lineViewModel.getConcSummary(),
                showAnonymousUserWarn: this.props.anonymousUser && this.props.anonymousUserConcLoginPrompt,
                saveFormVisible: lconcSaveModel.getFormIsActive(),
                supportsSyntaxView: lineViewModel.getSupportsSyntaxView(),
                syntaxBoxData: null,
                canCalculateAdHocIpm: lineViewModel.getProvidesAdHocIpm(),
                fastAdHocIpm: lineViewModel.getFastAdHocIpm(),
                adHocIpm: lineViewModel.getAdHocIpm(),
                subCorpName: lineViewModel.getSubCorpName(),
                origSubcorpName: lineViewModel.getCurrentSubcorpusOrigName(),
                hasLines: lineViewModel.getLines().size > 0,
                isWaiting: lineViewModel.getIsBusy(),
                numWaitingSecs: lineViewModel.getNumWaitingSecs()
            };
        }

        _handleModelChange() {
            const state = this._fetchModelState();
            state.showAnonymousUserWarn = this.state.showAnonymousUserWarn;
            this.setState(state);
        }

        _handleDetailCloseClick() {
            dispatcher.dispatch({
                name: 'CONCORDANCE_STOP_SPEECH',
                payload: {}
            });
            dispatcher.dispatch({
                name: 'CONCORDANCE_RESET_DETAIL',
                payload: {}
            });
        }

        _detailClickHandler(corpusId, tokenNumber, kwicLength, lineIdx) {
            if (concDetailModel.getViewMode() === 'speech') {
                dispatcher.dispatch({
                    name: 'CONCORDANCE_SHOW_SPEECH_DETAIL',
                    payload: {
                        corpusId: corpusId,
                        tokenNumber: tokenNumber,
                        kwicLength: kwicLength,
                        lineIdx: lineIdx
                    }
                });

            } else { // = default and custom modes
                if (kwicLength > 0) {
                    dispatcher.dispatch({
                        name: 'CONCORDANCE_SHOW_KWIC_DETAIL',
                        payload: {
                            corpusId: corpusId,
                            tokenNumber: tokenNumber,
                            kwicLength: kwicLength,
                            lineIdx: lineIdx
                        }
                    });

                } else if (kwicLength === -1) { // non kwic search (e.g. aligned language)
                    dispatcher.dispatch({
                        name: 'CONCORDANCE_SHOW_TOKEN_DETAIL',
                        payload: {
                            corpusId: corpusId,
                            tokenNumber: tokenNumber,
                            lineIdx: lineIdx
                        }
                    });
                }
            }
        }

        _refsDetailClickHandler(corpusId, tokenNumber, lineIdx) {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SHOW_REF_DETAIL',
                payload: {
                    corpusId: corpusId,
                    tokenNumber: tokenNumber,
                    lineIdx: lineIdx
                }
            });
        }

        _handleAnonymousUserWarning() {
            const state = this._fetchModelState();
            state.showAnonymousUserWarn = false;
            this.setState(state);
        }

        _handleRefsDetailCloseClick() {
            dispatcher.dispatch({
                name: 'CONCORDANCE_REF_RESET_DETAIL',
                payload: {}
            });
        }

        _handleSyntaxBoxClick(tokenNumber, kwicLength) {
            const newState = he.cloneState(this.state);
            newState.syntaxBoxData = {tokenNumber: tokenNumber, kwicLength: kwicLength};
            this.setState(newState);
        }

        _handleSyntaxBoxClose() {
            const newState = he.cloneState(this.state);
            newState.syntaxBoxData = null;
            this.setState(newState);
        }

        componentDidMount() {
            this.modelSubscriptions = [
                lineViewModel.addListener(this._handleModelChange),
                lconcSaveModel.addListener(this._handleModelChange),
                concDetailModel.addListener(this._handleModelChange),
                refsDetailModel.addListener(this._handleModelChange)
            ];
            syntaxViewModel.registerOnError(() => {
                const newState = he.cloneState(this.state);
                    newState.syntaxBoxData = null;
                    this.setState(newState);
                this.setState(newState);
            })
        }

        componentWillUnmount() {
            this.modelSubscriptions.forEach(s => s.unsubscribe());
        }

        _shouldDisplayConcDetailBox() {
            return this.state.hasConcDetailData
                    || this.state.tokenConnectData.renders.size > 0
                    || this.state.concDetailModelIsBusy
                    || this.state.tokenConnectIsBusy;
        }

        render() {
            return (
                <div className="ConcordanceView">
                    {this.state.syntaxBoxData ?
                        <SyntaxViewPane onCloseClick={this._handleSyntaxBoxClose}
                                tokenNumber={this.state.syntaxBoxData.tokenNumber}
                                kwicLength={this.state.syntaxBoxData.kwicLength}
                                onReady={this.props.onSyntaxPaneReady}
                                onClose={this.props.onSyntaxPaneClose} /> : null}
                    {this._shouldDisplayConcDetailBox() ?
                        <concDetailViews.TokenConnect closeClickHandler={this._handleDetailCloseClick} />
                        : null
                    }
                    {this.state.refsDetailData ?
                        <concDetailViews.RefDetail
                            closeClickHandler={this._handleRefsDetailCloseClick} />
                        : null
                    }
                    <div id="conc-top-bar">
                        <div className="info-level">
                            <paginationViews.Paginator {...this.props} />
                            <ConcSummary {...this.state.concSummary}
                                corpname={this.props.baseCorpname}
                                isUnfinishedCalculation={this.state.isUnfinishedCalculation}
                                canCalculateAdHocIpm={this.state.canCalculateAdHocIpm}
                                fastAdHocIpm={this.state.fastAdHocIpm}
                                adHocIpm={this.state.adHocIpm}
                                subCorpName={this.state.subCorpName}
                                origSubcorpName={this.state.origSubcorpName}
                                isWaiting={this.state.isWaiting}
                                />
                        </div>
                        <ConcToolbarWrapper
                                onChartFrameReady={this.props.onChartFrameReady}
                                canSendEmail={this.props.canSendEmail}
                                showConcToolbar={this.props.ShowConcToolbar}
                                viewMode={this.state.attrViewMode} />
                        {this.state.showAnonymousUserWarn ?
                            <AnonymousUserLoginPopup onCloseClick={this._handleAnonymousUserWarning} /> : null}
                    </div>
                    <div id="conclines-wrapper">
                        {!this.state.hasLines && this.state.isWaiting ?
                            <div className="no-data">
                                <p>{he.translate('concview__waiting_for_data')}</p>
                                <p>({he.translate('concview__waiting_elapsed_time')}:{'\u00a0'}{secs2hms(this.state.numWaitingSecs)})</p>
                                <p><layoutViews.AjaxLoaderImage /></p>
                            </div> :
                            <linesViews.ConcLines {...this.props}
                                supportsSyntaxView={this.state.supportsSyntaxView}
                                onSyntaxViewClick={this._handleSyntaxBoxClick}
                                tokenConnectClickHandler={this._detailClickHandler}
                                refsDetailClickHandler={this._refsDetailClickHandler} />
                        }
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
    }


    // ------------------------- <ConcordanceDashboard /> ---------------------------

    class ConcordanceDashboard extends React.PureComponent<ConcordanceDashboardProps & ConcDashboardState> {


        private getModClass():string {
            if (this.props.showFreqInfo || this.props.showKwicConnect) {
                return this.props.expanded ? '' : ' collapsed';

            } else {
                return ' disabled';
            }
        }

        render() {
            return (
                <div className={`ConcordanceDashboard${this.getModClass()}`}>
                    {this.props.showFreqInfo || this.props.showKwicConnect ?
                        <extendedInfoViews.ConcExtendedInfo kwicConnectView={this.props.kwicConnectView} /> :
                        null
                    }
                    <ConcordanceView {...this.props.concViewProps} />
                </div>
            );
        }
    };


    return {
        ConcordanceDashboard: BoundWithProps(ConcordanceDashboard, dashboardModel)
    };

}