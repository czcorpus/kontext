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
import { IActionDispatcher, BoundWithProps, IModel } from 'kombo';
import { Subscription } from 'rxjs';
import { tuple } from 'cnc-tskit';

import { Kontext, ViewOptions } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { init as lineSelViewsInit } from './lineSelection';
import { init as paginatorViewsInit } from './paginator';
import { init as linesViewInit } from './lines';
import { init as concDetailViewsInit } from './detail/index';
import { init as concSaveViewsInit } from './save';
import { init as extendedInfoViewsInit } from './extendedInfo';
import { LineSelectionModel, LineSelectionModelState }
    from '../../models/concordance/lineSelection';
import { ConcordanceModel, ConcordanceModelState } from '../../models/concordance/main';
import { ConcDetailModel } from '../../models/concordance/detail';
import { RefsDetailModel } from '../../models/concordance/refsDetail';
import { CollFormModel } from '../../models/coll/collForm';
import { TextTypesDistModel } from '../../models/concordance/ttDistModel';
import { ConcDashboard, ConcDashboardState } from '../../models/concordance/dashboard';
import { UsageTipsModel } from '../../models/usageTips';
import { MainMenuModelState } from '../../models/mainMenu';
import { Actions, ActionName } from '../../models/concordance/actions';
import { LineSelectionModes, DrawLineSelectionChart, ViewConfiguration } from '../../models/concordance/common';
import { Actions as UserActions, ActionName as UserActionName } from '../../models/user/actions';


export class ViewPageModels {
    lineSelectionModel:LineSelectionModel;
    lineViewModel:ConcordanceModel;
    concDetailModel:ConcDetailModel;
    refsDetailModel:RefsDetailModel;
    userInfoModel:IModel<Record<string, unknown>>;
    collFormModel:CollFormModel;
    mainMenuModel:IModel<MainMenuModelState>;
    ttDistModel:TextTypesDistModel;
    dashboardModel:ConcDashboard;
    usageTipsModel:UsageTipsModel;
    syntaxViewModel:IModel<PluginInterfaces.SyntaxViewer.BaseState>;
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
        KWICCorps:Array<string>;
        canSendEmail:boolean;
        ShowConcToolbar:boolean;
        anonymousUserConcLoginPrompt:boolean;
        onLineSelChartFrameReady:DrawLineSelectionChart;
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
    ttDistModel, dashboardModel, syntaxViewModel}:MainModuleArgs):MainViews
 {

    const layoutViews = he.getLayoutViews();

    const lconcSaveModel = lineViewModel.getSaveModel();

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
        refsDetailModel: refsDetailModel
    });
    const concSaveViews = concSaveViewsInit(dispatcher, he, lconcSaveModel);
    const extendedInfoViews = extendedInfoViewsInit({dispatcher, he, ttDistModel, usageTipsModel, dashboardModel});


    // ------------------------- <LineSelectionMenu /> ---------------------------

    const LineSelectionMenu:React.FC<{
        isLocked:boolean;
        canSendEmail:boolean;
        mode:LineSelectionModes;
        isBusy:boolean;
        corpusId:string;
        onCloseClick:()=>void;
        onChartFrameReady:DrawLineSelectionChart;

    }> = (props) => {

        const renderContents = () => {
            if (props.isLocked) {
                return <lineSelViews.LockedLineGroupsMenu
                            canSendEmail={props.canSendEmail}
                            mode={props.mode}
                            corpusId={props.corpusId}
                            onChartFrameReady={props.onChartFrameReady} />;

            } else {
                return <lineSelViews.UnsavedLineSelectionMenu mode={props.mode} isBusy={props.isBusy} />;
            }
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.onCloseClick}>
                <layoutViews.CloseableFrame scrollable={true} onCloseClick={props.onCloseClick} label={he.translate('linesel__operations_modal_heading')}>
                    {renderContents()}
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }

    // ------------------------- <LineSelectionOps /> ---------------------------

    interface LineSelectionOpsProps {
        numLinesInLockedGroups:number;
        visible:boolean;
        onChartFrameReady:DrawLineSelectionChart;
    }

    class LineSelectionOps extends React.PureComponent<LineSelectionOpsProps & LineSelectionModelState> {

        constructor(props) {
            super(props);
            this._selectChangeHandler = this._selectChangeHandler.bind(this);
            this._selectMenuTriggerHandler = this._selectMenuTriggerHandler.bind(this);
            this._closeMenuHandler = this._closeMenuHandler.bind(this);
        }

        _selectChangeHandler(event) {
            dispatcher.dispatch<Actions.SetLineSelectionMode>({
                name: ActionName.SetLineSelectionMode,
                payload: {
                    mode: event.currentTarget.value
                }
            });
        }

        _selectMenuTriggerHandler() {
            dispatcher.dispatch<Actions.ToggleLineSelOptions>({
                name: ActionName.ToggleLineSelOptions
            });
        }

        _closeMenuHandler() {
            dispatcher.dispatch<Actions.ToggleLineSelOptions>({
                name: ActionName.ToggleLineSelOptions
            });
        }

        _getMsgStatus() {
            if (this.props.isLocked) {
                return tuple(
                    he.createStaticUrl('img/info-icon.svg'),
                    he.translate('linesel__you_have_saved_line_groups')
                );

            } else if (LineSelectionModel.numSelectedItems(this.props) > 0) {
                return tuple(
                    he.createStaticUrl('/img/warning-icon.svg'),
                    he.translate('linesel__you_have_unsaved_line_sel')
                );

            } else {
                return tuple('', null);
            }
        }

        _renderNumSelected() {
            const numSel = this.props.numLinesInLockedGroups > 0 ?
                this.props.numLinesInLockedGroups : LineSelectionModel.numSelectedItems(this.props);
            const [statusImg, elmTitle] = this._getMsgStatus();
            if (numSel > 0) {
                return (
                    <span className="lines-selection" title={elmTitle}>
                        {'\u00A0'}
                        (<a key="numItems" onClick={this._selectMenuTriggerHandler}>
                        <span className="value">{numSel}</span>
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
            return (
                <div className="lines-selection-controls">
                    {he.translate('concview__line_sel')}:{'\u00A0'}
                    <select className="selection-mode-switch"
                            disabled={this.props.isLocked}
                            onChange={this._selectChangeHandler}
                            defaultValue={LineSelectionModel.actualSelection(this.props).mode}>
                        <option value="simple">{he.translate('concview__line_sel_simple')}</option>
                        <option value="groups">{he.translate('concview__line_sel_groups')}</option>
                    </select>
                    {this._renderNumSelected()}
                    {this.props.visible ?
                        <LineSelectionMenu
                                mode={LineSelectionModel.actualSelection(this.props).mode}
                                isBusy={this.props.isBusy}
                                isLocked={this.props.isLocked}
                                onCloseClick={this._closeMenuHandler}
                                canSendEmail={!!this.props.emailDialogCredentials}
                                corpusId={this.props.corpusId}
                                onChartFrameReady={this.props.onChartFrameReady} />
                        :  null}
                </div>
            );
        }
    }

    const BoundLineSelectionOps = BoundWithProps<LineSelectionOpsProps, LineSelectionModelState>(LineSelectionOps, lineSelectionModel);


    // ------------------------- <ConcSummary /> ---------------------------

    const ConcSummary:React.FC<{
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

            } else if (props.adHocIpm >= 0) {
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
                dispatcher.dispatch<Actions.CalculateIpmForAdHocSubc>({
                    name: ActionName.CalculateIpmForAdHocSubc,
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
            <div className="result-info">
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

    interface ConcToolbarWrapperProps {
        showConcToolbar:boolean;
        canSendEmail:boolean;
        viewMode:ViewOptions.AttrViewMode;
        lineSelOpsVisible:boolean;
        numLinesInLockedGroups:number;
        onChartFrameReady:DrawLineSelectionChart;
    }

    class ConcToolbarWrapper extends React.Component<ConcToolbarWrapperProps & LineSelectionModelState> {

        render() {
            return (
                <div className="toolbar-level">
                    <BoundLineSelectionOps
                            visible={this.props.lineSelOpsVisible}
                            numLinesInLockedGroups={this.props.numLinesInLockedGroups}
                            onChartFrameReady={this.props.onChartFrameReady} />
                    {this.props.showConcToolbar ?
                        <ConcOptions viewMode={this.props.viewMode} />
                        : null}
                </div>
            );
        }
    }

    const BoundConcToolbarWrapper = BoundWithProps<ConcToolbarWrapperProps, LineSelectionModelState>(ConcToolbarWrapper, lineSelectionModel);

    // ------------------------- <AnonymousUserLoginPopup /> ---------------------------

    const AnonymousUserLoginPopup:React.FC<{
        onCloseClick:()=>void;

    }> = (props) => {

        const handleLoginClick = (evt) => {
            dispatcher.dispatch<UserActions.UserShowLoginDialog>({
                name: UserActionName.UserShowLoginDialog,
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

    interface SyntaxViewPaneProps {
        onCloseClick:()=>void;
    }

    class SyntaxViewPane extends React.PureComponent<SyntaxViewPaneProps & PluginInterfaces.SyntaxViewer.BaseState> {

        render() {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.onCloseClick} isScrollable={true}>
                    <layoutViews.PopupBox onCloseClick={this.props.onCloseClick}
                            customClass="syntax-tree">
                        <div id="syntax-view-pane" className="SyntaxViewPane">
                            {this.props.isBusy ?
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

    const BoundSyntaxViewPane = BoundWithProps<SyntaxViewPaneProps, PluginInterfaces.SyntaxViewer.BaseState>(SyntaxViewPane, syntaxViewModel);


    // ------------------------- <ConcordanceView /> ---------------------------

    class ConcordanceView extends React.PureComponent<
    ConcordanceDashboardProps['concViewProps'] & ConcordanceModelState> {

        constructor(props) {
            super(props);
            this._handleDetailCloseClick = this._handleDetailCloseClick.bind(this);
            this._handleAnonymousUserWarning = this._handleAnonymousUserWarning.bind(this);
            this._handleSyntaxBoxClose = this._handleSyntaxBoxClose.bind(this);
        }

        _handleDetailCloseClick() {
            dispatcher.dispatch<Actions.StopSpeech>({
                name: ActionName.StopSpeech
            });
            dispatcher.dispatch<Actions.ResetDetail>({
                name: ActionName.ResetDetail
            });
        }

        _handleAnonymousUserWarning() {
            dispatcher.dispatch<Actions.HideAnonymousUserWarning>({
                name: ActionName.HideAnonymousUserWarning
            })
        }

        _handleRefsDetailCloseClick() {
            dispatcher.dispatch<Actions.RefResetDetail>({
                name: ActionName.RefResetDetail,
                payload: {}
            });
        }

        _handleSyntaxBoxClose() {
            dispatcher.dispatch<Actions.CloseSyntaxView>({
                name: ActionName.CloseSyntaxView
            });
        }

        render() {
            return (
                <div className="ConcordanceView">
                    {this.props.syntaxViewVisible ?
                        <BoundSyntaxViewPane onCloseClick={this._handleSyntaxBoxClose} /> : null}
                    {this.props.kwicDetailVisible ?
                        <concDetailViews.ConcordanceDetail closeClickHandler={this._handleDetailCloseClick} />
                        : null}
                    {this.props.refDetailVisible ?
                        <concDetailViews.RefDetail closeClickHandler={this._handleRefsDetailCloseClick} />
                        : null}
                    <div id="conc-top-bar">
                        <div className="info-level">
                            <ConcSummary {...this.props.concSummary}
                                    corpname={this.props.baseCorpname}
                                    isUnfinishedCalculation={this.props.unfinishedCalculation}
                                    canCalculateAdHocIpm={this.props.providesAdHocIpm}
                                    fastAdHocIpm={this.props.fastAdHocIpm}
                                    adHocIpm={this.props.adHocIpm}
                                    subCorpName={this.props.subCorpName}
                                    origSubcorpName={this.props.origSubcorpName}
                                    isWaiting={this.props.unfinishedCalculation} />
                            <paginationViews.Paginator {...this.props} />
                        </div>
                        <BoundConcToolbarWrapper
                                lineSelOpsVisible={this.props.lineSelOptionsVisible}
                                canSendEmail={this.props.canSendEmail}
                                showConcToolbar={this.props.ShowConcToolbar}
                                numLinesInLockedGroups={this.props.numItemsInLockedGroups}
                                viewMode={this.props.attrViewMode}
                                onChartFrameReady={this.props.onLineSelChartFrameReady} />
                        {this.props.showAnonymousUserWarn && this.props.anonymousUserConcLoginPrompt ?
                            <AnonymousUserLoginPopup onCloseClick={this._handleAnonymousUserWarning} /> : null}
                    </div>
                    <div id="conclines-wrapper">
                        {this.props.lines.length === 0 && this.props.unfinishedCalculation ?
                            <div className="no-data">
                                <p>{he.translate('concview__waiting_for_data')}</p>
                                <p>({he.translate('concview__waiting_elapsed_time')}:{'\u00a0'}{secs2hms(this.props.busyWaitSecs)})</p>
                                <p><layoutViews.AjaxLoaderImage /></p>
                            </div> :
                            <linesViews.ConcLines {...this.props} />
                        }
                    </div>
                    <div id="conc-bottom-bar">
                        <div className="info-level">
                            <div style={{flexGrow: 3}} />
                            <paginationViews.Paginator {...this.props} />
                        </div>
                    </div>
                    {this.props.saveFormVisible ? <concSaveViews.ConcSaveForm /> : null}
                </div>
            );
        }
    }


    const BoundConcordanceView = BoundWithProps<ConcordanceDashboardProps['concViewProps'],
            ConcordanceModelState>(ConcordanceView, lineViewModel);


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
                    <BoundConcordanceView
                        baseCorpname={this.props.concViewProps.baseCorpname}
                        mainCorp={this.props.concViewProps.mainCorp}
                        anonymousUser={this.props.concViewProps.anonymousUser}
                        SortIdx={this.props.concViewProps.SortIdx}
                        NumItemsInLockedGroups={this.props.concViewProps.NumItemsInLockedGroups}
                        KWICCorps={this.props.concViewProps.KWICCorps}
                        canSendEmail={this.props.concViewProps.canSendEmail}
                        ShowConcToolbar={this.props.concViewProps.ShowConcToolbar}
                        anonymousUserConcLoginPrompt={this.props.concViewProps.anonymousUserConcLoginPrompt}
                        onLineSelChartFrameReady={this.props.concViewProps.onLineSelChartFrameReady} />
                </div>
            );
        }
    };


    return {
        ConcordanceDashboard: BoundWithProps(ConcordanceDashboard, dashboardModel)
    };

}