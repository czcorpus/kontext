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
import { IActionDispatcher, BoundWithProps, IModel, Bound } from 'kombo';
import { Subscription } from 'rxjs';
import { tuple } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import * as ViewOptions from '../../../types/viewOptions';
import * as PluginInterfaces from '../../../types/plugins';
import { init as lineSelViewsInit } from '../lineSelection';
import { init as paginatorViewsInit } from '../paginator';
import { init as linesViewInit } from '../lines';
import { init as concDetailViewsInit } from '../detail/index';
import { init as concSaveViewsInit } from '../save';
import { init as extendedInfoViewsInit } from '../extendedInfo';
import { LineSelectionModel, LineSelectionModelState }
    from '../../../models/concordance/lineSelection';
import { ConcordanceModel, ConcordanceModelState } from '../../../models/concordance/main';
import { ConcDetailModel } from '../../../models/concordance/detail';
import { ConcSummaryModel, ConcSummaryModelState } from '../../../models/concordance/summary';
import { RefsDetailModel } from '../../../models/concordance/refsDetail';
import { CollFormModel } from '../../../models/coll/collForm';
import { TextTypesDistModel } from '../../../models/concordance/ttdist/model';
import { ConcDashboard, ConcDashboardState } from '../../../models/concordance/dashboard';
import { UsageTipsModel } from '../../../models/usageTips';
import { MainMenuModelState } from '../../../models/mainMenu';
import { Actions } from '../../../models/concordance/actions';
import { LineSelectionModes, DrawLineSelectionChart } from '../../../models/concordance/common';
import { Actions as UserActions } from '../../../models/user/actions';
import * as S2 from '../style';
import * as S from './style';


export class ViewPageModels {
    lineSelectionModel:LineSelectionModel;
    lineViewModel:ConcordanceModel;
    concSummaryModel:ConcSummaryModel;
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


export function init({
    dispatcher,
    he,
    lineSelectionModel,
    lineViewModel,
    concDetailModel,
    refsDetailModel,
    usageTipsModel,
    concSummaryModel,
    ttDistModel,
    dashboardModel,
    syntaxViewModel
}:MainModuleArgs):MainViews {

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

        const [contents, label] = (() => {
            if (props.isLocked) {
                return tuple(
                            <lineSelViews.LockedLineGroupsMenu
                                canSendEmail={props.canSendEmail}
                                mode={props.mode}
                                corpusId={props.corpusId}
                                onChartFrameReady={props.onChartFrameReady} />,
                            props.mode === 'simple' ?
                                he.translate('linesel__unsaved_line_selection_heading') :
                                he.translate('linesel__saved_line_groups_heading')
                );

            } else {
                return tuple(
                    <lineSelViews.UnsavedLineSelectionMenu mode={props.mode} isBusy={props.isBusy} />,
                    he.translate('linesel__unsaved_line_selection_heading')
                );
            }
        })();

        return (
            <layoutViews.ModalOverlay onCloseKey={props.onCloseClick}>
                <layoutViews.CloseableFrame onCloseClick={props.onCloseClick} label={label}>
                    {contents}
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

    const _LineSelectionOps:React.FC<LineSelectionOpsProps & LineSelectionModelState> = (props) => {

        const _selectChangeHandler = (event) => {
            dispatcher.dispatch(
                Actions.SetLineSelectionMode,
                {
                    mode: event.currentTarget.value
                }
            );
        };

        const _selectMenuTriggerHandler = () => {
            dispatcher.dispatch(
                Actions.ToggleLineSelOptions
            );
        };

        const _closeMenuHandler = () => {
            dispatcher.dispatch(
                Actions.ToggleLineSelOptions
            );
        };

        const _getMsgStatus = () => {
            if (props.isLocked) {
                return tuple(
                    he.createStaticUrl('img/info-icon.svg'),
                    he.translate('linesel__you_have_saved_line_groups')
                );

            } else if (LineSelectionModel.numSelectedItems(props) > 0) {
                return tuple(
                    he.createStaticUrl('/img/warning-icon.svg'),
                    he.translate('linesel__you_have_unsaved_line_sel')
                );

            } else {
                return tuple('', null);
            }
        };

        const _renderNumSelected = () => {
            const numSel = props.numLinesInLockedGroups > 0 ?
                props.numLinesInLockedGroups : LineSelectionModel.numSelectedItems(props);
            const [statusImg, elmTitle] = _getMsgStatus();
            if (numSel > 0) {
                return (
                    <span className="lines-selection" title={elmTitle}>
                        {'\u00A0'}
                        (<a key="numItems" onClick={_selectMenuTriggerHandler}>
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
        };

        return (
            <S.LineSelectionOps>
                {he.translate('concview__line_sel')}:{'\u00A0'}
                <select className="selection-mode-switch"
                        disabled={props.isLocked}
                        onChange={_selectChangeHandler}
                        defaultValue={LineSelectionModel.actualSelection(props).mode}>
                    <option value="simple">{he.translate('concview__line_sel_simple')}</option>
                    <option value="groups">{he.translate('concview__line_sel_groups')}</option>
                </select>
                {_renderNumSelected()}
                {props.visible ?
                    <LineSelectionMenu
                            mode={LineSelectionModel.actualSelection(props).mode}
                            isBusy={props.isBusy}
                            isLocked={props.isLocked}
                            onCloseClick={_closeMenuHandler}
                            canSendEmail={!!props.emailDialogCredentials}
                            corpusId={props.corpusId}
                            onChartFrameReady={props.onChartFrameReady} />
                    :  null}
            </S.LineSelectionOps>
        );
    }

    const LineSelectionOps = BoundWithProps<LineSelectionOpsProps, LineSelectionModelState>(_LineSelectionOps, lineSelectionModel);


    // ------------------------- <ConcSummary /> ---------------------------

    const ConcSummary:React.FC<ConcSummaryModelState> = (props) => {

        const renderNumHits = () => {
            const ans = [];
            if (props.isUnfinishedConc) {
                ans.push(<span key="hits:1" className="conc-loader">
                            <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} title={he.translate('global__processing')}
                                alt={he.translate('global__processing')} />
                        </span>);
            }
            if (props.concSize === props.fullSize || props.fullSize === -1) {
                ans.push(<strong key="hits:2" className={`conc-size${props.isUnfinishedConc ? ' unfinished' : ''}`} title={String(props.concSize)}>
                        {he.formatNumber(props.concSize)}</strong>);

            } else {
                ans.push(<a key="hits:1b" className="size-warning"><img src={he.createStaticUrl('img/warning-icon.svg')} /></a>);
                ans.push(<span key="hits:2b" id="loader"></span>);
                ans.push(<strong key="hits:3b" className={`conc-size${props.isUnfinishedConc ? ' unfinished' : ''}`}>{he.formatNumber(props.concSize)}</strong>);
                ans.push('\u00a0' + he.translate('concview__out_of_total') + '\u00a0');
                ans.push(<span key="hits:4b" id="fullsize" title={String(props.fullSize)}>{he.formatNumber(props.fullSize)}</span>);
            }
            return ans;
        };

        const getIpm = () => {
            if (props.isBusy) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={he.translate('global__calculating')}
                            title={he.translate('global__calculating')} />;

            } else if (props.ipm !== null) {
                return <span className={`ipm${props.isUnfinishedConc ? ' unfinished' : ''}`}>{he.formatNumber(props.ipm)}</span>;

            } else if (props.corpusIpm >= 0 && !props.providesAdHocIpm) {
                return <span className={`ipm${props.isUnfinishedConc ? ' unfinished' : ''}`}>{he.formatNumber(props.corpusIpm)}</span>;

            } else if (props.providesAdHocIpm) {
                return <a onClick={handleCalcIpmClick}>{he.translate('global__calculate')}</a>;

            } else {
                return null;
            }
        };

        const getIpmDesc = () => {
            if (props.providesAdHocIpm) {
                if (props.ipm) {
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
                dispatcher.dispatch<typeof Actions.CalculateIpmForAdHocSubc>({
                    name: Actions.CalculateIpmForAdHocSubc.name,
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

    const BoundConcSummary = Bound<ConcSummaryModelState>(ConcSummary, concSummaryModel)

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

    const _ConcToolbarWrapper:React.FC<ConcToolbarWrapperProps & LineSelectionModelState> = (props) => (
        <div className="toolbar-level">
            <LineSelectionOps
                    visible={props.lineSelOpsVisible}
                    numLinesInLockedGroups={props.numLinesInLockedGroups}
                    onChartFrameReady={props.onChartFrameReady} />
            {props.showConcToolbar ?
                <ConcOptions viewMode={props.viewMode} />
                : null}
        </div>
    );

    const ConcToolbarWrapper = BoundWithProps<ConcToolbarWrapperProps, LineSelectionModelState>(_ConcToolbarWrapper, lineSelectionModel);

    // ------------------------- <AnonymousUserLoginPopup /> ---------------------------

    const AnonymousUserLoginPopup:React.FC<{
        onCloseClick:()=>void;

    }> = (props) => {

        const handleLoginClick = (evt) => {
            dispatcher.dispatch<typeof UserActions.UserShowLoginDialog>({
                name: UserActions.UserShowLoginDialog.name,
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
                        <S2.SyntaxViewPane id="syntax-view-pane">
                            {this.props.isBusy ?
                                (<div className="ajax-loader">
                                    <img src={he.createStaticUrl('img/ajax-loader.gif')}
                                            alt={he.translate('global__loading')} />
                                </div>) : null
                            }
                        </S2.SyntaxViewPane>
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
            dispatcher.dispatch<typeof Actions.AudioPlayerClickControl>({
                name: Actions.AudioPlayerClickControl.name,
                payload: {
                    action: 'stop',
                    playerId: ConcDetailModel.AUDIO_PLAYER_ID
                }
            });
            dispatcher.dispatch<typeof Actions.ResetDetail>({
                name: Actions.ResetDetail.name
            });
        }

        _handleAnonymousUserWarning() {
            dispatcher.dispatch<typeof Actions.HideAnonymousUserWarning>({
                name: Actions.HideAnonymousUserWarning.name
            })
        }

        _handleRefsDetailCloseClick() {
            dispatcher.dispatch<typeof Actions.RefResetDetail>({
                name: Actions.RefResetDetail.name,
                payload: {}
            });
        }

        _handleSyntaxBoxClose() {
            dispatcher.dispatch<typeof Actions.CloseSyntaxView>({
                name: Actions.CloseSyntaxView.name
            });
        }

        render() {
            return (
                <S.ConcordanceView>
                    {this.props.syntaxViewVisible ?
                        <BoundSyntaxViewPane onCloseClick={this._handleSyntaxBoxClose} /> : null}
                    {this.props.kwicDetailVisible ?
                        <concDetailViews.ConcordanceDetail closeClickHandler={this._handleDetailCloseClick} />
                        : null}
                    {this.props.refDetailVisible ?
                        <concDetailViews.RefDetail closeClickHandler={this._handleRefsDetailCloseClick} />
                        : null}
                    <S.ConcTopBar>
                        <div className="info-level">
                            <BoundConcSummary />
                            <paginationViews.Paginator {...this.props} />
                        </div>
                        <ConcToolbarWrapper
                                lineSelOpsVisible={this.props.lineSelOptionsVisible}
                                canSendEmail={this.props.canSendEmail}
                                showConcToolbar={this.props.ShowConcToolbar}
                                numLinesInLockedGroups={this.props.numItemsInLockedGroups}
                                viewMode={this.props.attrViewMode}
                                onChartFrameReady={this.props.onLineSelChartFrameReady} />
                        {this.props.showAnonymousUserWarn && this.props.anonymousUserConcLoginPrompt ?
                            <AnonymousUserLoginPopup onCloseClick={this._handleAnonymousUserWarning} /> : null}
                    </S.ConcTopBar>
                    <S.ConclinesWrapper>
                        {this.props.lines.length === 0 && this.props.unfinishedCalculation ?
                            <div className="no-data">
                                <p>{he.translate('concview__waiting_for_data')}</p>
                                <p>({he.translate('concview__waiting_elapsed_time')}:{'\u00a0'}{secs2hms(this.props.busyWaitSecs)})</p>
                                <p><layoutViews.AjaxLoaderImage /></p>
                            </div> :
                            <linesViews.ConcLines {...this.props} />
                        }
                    </S.ConclinesWrapper>
                    <S.ConcBottomBar>
                        <div className="info-level">
                            <div style={{flexGrow: 3}} />
                            <paginationViews.Paginator {...this.props} />
                        </div>
                    </S.ConcBottomBar>
                    {this.props.saveFormVisible ? <concSaveViews.ConcSaveForm /> : null}
                </S.ConcordanceView>
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
                <S.ConcordanceDashboard className={this.getModClass()}>
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
                </S.ConcordanceDashboard>
            );
        }
    };


    return {
        ConcordanceDashboard: BoundWithProps<ConcordanceDashboardProps, ConcDashboardState>(
            ConcordanceDashboard, dashboardModel)
    };

}