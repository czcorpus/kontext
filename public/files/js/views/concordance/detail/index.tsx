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
import {Kontext} from '../../../types/common';
import {PluginInterfaces} from '../../../types/plugins';
import {init as initSpeechViews} from './speech';
import { ConcDetailModel, RefsDetailModel, RefsColumn } from '../../../models/concordance/detail';
import { ConcLineModel } from '../../../models/concordance/lines';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';


export interface RefDetailProps {
    closeClickHandler:()=>void;
}


interface RefDetailState {
    isWaiting:boolean;
    data:Immutable.List<[RefsColumn, RefsColumn]>;
}


export interface TokenConnectProps {
    closeClickHandler:()=>void;
}

interface TokenConnectState {
    mode:string;
    supportsSpeechView:boolean;
    data:Array<{str:string; class:string}>;
    hasConcDetailData:boolean;
    hasExpandLeft:boolean;
    hasExpandRight:boolean;
    canDisplayWholeDocument:boolean;
    expandingSide:string;
    modelIsBusy:boolean;
    tokenConnectIsBusy:boolean;
    tokenConnectData:PluginInterfaces.TokenConnect.TCData;
    hasTokenConnectData:boolean;
}


export interface DetailViews {
    RefDetail:React.ComponentClass<RefDetailProps>;
    TokenConnect:React.ComponentClass<TokenConnectProps>;
}


export interface DetailModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    concDetailModel:ConcDetailModel;
    refsDetailModel:RefsDetailModel;
    lineModel:ConcLineModel;
}

export function init({dispatcher, he, concDetailModel, refsDetailModel, lineModel}:DetailModuleArgs):DetailViews {

    const layoutViews = he.getLayoutViews();
    const SpeechView = initSpeechViews(dispatcher, he, concDetailModel);

    // ------------------------- <RefValue /> ---------------------------

    const RefValue:React.SFC<{
        val:string;

    }> = (props) => {
        if (props.val.indexOf('http://') === 0 || props.val.indexOf('https://') === 0) {
            return <a className="external" href={props.val} target="_blank">
                <layoutViews.Shortener text={props.val} limit={20} />
            </a>;

        } else {
            return <span>{props.val}</span>;
        }
    };


    // ------------------------- <RefLine /> ---------------------------

    const RefLine:React.SFC<{
        colGroups:Array<{name:string; val:string}>;

    }> = (props) => {

        const renderCols = () => {
            const ans = [];
            const item = props.colGroups;

            if (item[0]) {
                ans.push(<th key="c1">{item[0].name}</th>);
                ans.push(<td key="c2" className="data"><RefValue val={item[0].val} /></td>);

            } else {
                ans.push(<th key="c1" />);
                ans.push(<td key="c2" />);
            }
            if (item[1]) {
                ans.push(<th key="c3">{item[1].name}</th>);
                ans.push(<td key="c4" className="data"><RefValue val={item[1].val} /></td>);

            } else {
                ans.push(<th key="c3" />);
                ans.push(<td key="c4" />);
            }
            return ans;
        };

        return <tr>{renderCols()}</tr>;
    };

    // ------------------------- <RefDetail /> ---------------------------

    class RefDetail extends React.Component<RefDetailProps, RefDetailState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
        }

        _fetchModelState() {
            return {
                data: refsDetailModel.getData(),
                isWaiting: refsDetailModel.getIsBusy()
            }
        }

        _modelChangeHandler() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            this.modelSubscription = refsDetailModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _renderContents() {
            if (this.state.isWaiting) {
                return <img src={he.createStaticUrl('img/ajax-loader.gif')} alt={he.translate('global__loading')} />;

            } else if (this.state.data.size === 0) {
                return <p><strong>{he.translate('global__no_data_avail')}</strong></p>;

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
        }

        render() {
            return (
                <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler} customClass="refs-detail"
                        takeFocus={true}>
                    <div className="wrapper">
                        {this._renderContents()}
                    </div>
                </layoutViews.PopupBox>
            );
        }
    }

    // ------------------------- <ExpandConcDetail /> ---------------------------

    const ExpandConcDetail:React.SFC<{
        position:string; // TODO enum
        isWaiting:boolean;
        clickHandler:()=>void;

    }> = (props) => {

        const createTitle = () => {
            if (props.position === 'left') {
                return he.translate('concview__click_to_expand_left');

            } else if (props.position === 'right') {
                return he.translate('concview__click_to_expand_right');
            }
        };

        const createAlt = () => {
            if (props.position === 'left') {
                return he.translate('concview__expand_left_symbol');

            } else if (props.position === 'right') {
                return he.translate('concview__expand_right_symbol');
            }
        };

        const createImgPath = () => {
            if (props.position === 'left') {
                return he.createStaticUrl('/img/prev-page.svg');

            } else if (props.position === 'right') {
                return he.createStaticUrl('/img/next-page.svg');
            }
        };

        if (!props.isWaiting) {
            return (
                <a className={`expand${props.position === 'left' ? ' left' : ''}`}
                        title={createTitle()} onClick={props.clickHandler}>
                    <img src={createImgPath()} alt={createAlt()} />
                </a>
            );

        } else {
            return (
                <img className="expand"
                        src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                        alt={he.translate('global__loading')} />
            );
        }
    };

    // ------------------------- <TokenExternalInfo /> ---------------------------

    const TokenExternalInfo:React.SFC<{
        tokenConnectIsBusy:boolean;
        tokenConnectData:PluginInterfaces.TokenConnect.TCData;

    }> = (props) => {
        if (props.tokenConnectIsBusy) {
            return (
                <div className="token-detail" style={{textAlign: 'center'}}>
                    <layoutViews.AjaxLoaderImage />
                </div>
            );

        } else {
            return (
                <div className="token-detail">
                    <h2 className="token">{'"'}{props.tokenConnectData.token}{'"'}</h2>
                    {props.tokenConnectData.renders.filter(r => !r.isKwicView).map((v, i) => {
                        return (
                            <div key={`resource:${i}`}>
                                {v.heading ?
                                    <h2 className="tckc-provider">
                                        {v.heading} <img src={he.createStaticUrl('img/book.svg')}
                                                alt={he.translate('global__icon_book')} /></h2> :
                                    null
                                }
                                <hr />
                                <layoutViews.ErrorBoundary>
                                    <v.renderer data={v.contents} />
                                </layoutViews.ErrorBoundary>
                            </div>
                        );
                    })}
                </div>
            );
        }
    };

    // ------------------------- <TokenExternalKWICView /> ---------------------------

    const TokenExternalKWICView:React.SFC<{
        tokenConnectIsBusy:boolean;
        tokenConnectData:Immutable.List<PluginInterfaces.TokenConnect.DataAndRenderer>;
        viewMode:string;

    }> = (props) => {
        if (props.tokenConnectIsBusy) {
            return (
                <div className="token-detail" style={{textAlign: 'center'}}>
                    <layoutViews.AjaxLoaderImage />
                </div>
            );

        } else {
            const data = props.tokenConnectData.find(x => x.heading === props.viewMode);
            if (data) {
                return (
                    <div className="token-detail">
                        <layoutViews.ErrorBoundary>
                            <data.renderer data={data.contents} />
                        </layoutViews.ErrorBoundary>
                    </div>
                );
            } else {
                return (
                    <div className="token-detail">not ready yet</div>
                )
            }
        }
    };

    // ------------------------- <KwicDetailView /> ---------------------------

    const KwicDetailView:React.SFC<{
        modelIsBusy:boolean;
        hasExpandLeft:boolean;
        hasExpandRight:boolean;
        expandingSide:string;
        data:Array<{class:string; str:string}>;
        canDisplayWholeDocument:boolean;

    }> = (props) => {

        const isWaitingExpand = (side) => {
            return props.modelIsBusy && props.expandingSide === side;
        };

        const expandClickHandler = (position) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_EXPAND_KWIC_DETAIL',
                payload: {
                    position: position
                }
            });
        };

        const handleDisplayWholeDocumentClick = () => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_SHOW_WHOLE_DOCUMENT',
                payload: {}
            });
        };

        return (
            <div>
                {props.hasExpandLeft ?
                    <ExpandConcDetail position="left" isWaiting={isWaitingExpand('left')}
                        clickHandler={() => expandClickHandler('left')} />
                : null
                }

                {(props.data || []).map((item, i) => {
                    return (
                        <span key={i} className={item.class ? item.class : null}>{item.str + ' '}</span>
                    );
                })}

                {props.hasExpandRight ?
                    <ExpandConcDetail position="right" isWaiting={isWaitingExpand('right')}
                            clickHandler={() => expandClickHandler('right')} />
                    : null
                }
                {props.canDisplayWholeDocument ?
                    <div className="footer">
                        <a id="ctx-link" onClick={handleDisplayWholeDocumentClick}>
                            {he.translate('concview__display_whole_document')}
                        </a>
                    </div>
                    : null
                }
            </div>
        );
    };

    // ------------------------- <DefaultView /> ---------------------------

    const DefaultView:React.SFC<{
        data:Array<{str:string; class:string}>;
        hasConcDetailData:boolean;
        hasExpandLeft:boolean;
        hasExpandRight:boolean;
        canDisplayWholeDocument:boolean;
        expandingSide:string;
        modelIsBusy:boolean;
        tokenConnectIsBusy:boolean;
        tokenConnectData:PluginInterfaces.TokenConnect.TCData;
        hasTokenConnectData:boolean;

    }> = (props) => {
        const hasNonKwicRenders = props.tokenConnectData.renders.filter(r => !r.isKwicView).size > 0;
        return (
            <div className="concordance_DefaultView">
                {props.hasConcDetailData ?
                    <KwicDetailView modelIsBusy={props.modelIsBusy}
                                    expandingSide={props.expandingSide}
                                    hasExpandLeft={props.hasExpandLeft}
                                    hasExpandRight={props.hasExpandRight}
                                    data={props.data}
                                    canDisplayWholeDocument={props.canDisplayWholeDocument} /> :
                    null
                }
                {props.hasConcDetailData && (props.hasTokenConnectData || props.tokenConnectIsBusy) ?
                    <hr /> : null}
                {props.hasTokenConnectData && hasNonKwicRenders || props.tokenConnectIsBusy ?
                    <TokenExternalInfo tokenConnectData={props.tokenConnectData}
                            tokenConnectIsBusy={props.tokenConnectIsBusy} /> : null}
            </div>
        );
    }

    // ------------------------- <MenuLink /> ---------------------------

    const MenuLink:React.SFC<{
        active:boolean;
        label:string;
        clickHandler:()=>void;

    }> = (props) => {

        if (!props.active) {
            return (
                <a onClick={props.clickHandler}>
                    {props.label}
                </a>
            );

        } else {
            return (
                <strong>
                    {props.label}
                </strong>
            );
        }
    };

    // ------------------------- <ConcDetailMenu /> ---------------------------

    const ConcDetailMenu:React.SFC<{
        supportsSpeechView:boolean;
        mode:string; // TODO enum
        tcData:Immutable.List<PluginInterfaces.TokenConnect.DataAndRenderer>;
    }> = (props) => {

        const handleMenuClick = (mode) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_DETAIL_SWITCH_MODE',
                payload: {value: mode}
            });
        };

        if (props.supportsSpeechView || props.tcData.size > 0) {
            return (
                <ul className="view-mode">
                    <li className={props.mode === 'default' ? 'current' : null}>
                        <MenuLink clickHandler={handleMenuClick.bind(null, 'default')}
                            label={he.translate('concview__detail_default_mode_menu')}
                            active={props.mode === 'default'} />
                    </li>
                    {props.supportsSpeechView ?
                        <li className={props.mode === 'speech' ? 'current' : null}>
                            <MenuLink clickHandler={handleMenuClick.bind(null, 'speech')}
                                label={he.translate('concview__detail_speeches_mode_menu')}
                                active={props.mode === 'speech'} />
                        </li> : null
                    }
                    {props.tcData.size > 0 ?
                        props.tcData.map(d => (
                            <li key={`tcItem:${d.heading}`}>
                                <MenuLink clickHandler={handleMenuClick.bind(null, d.heading)}
                                    label={d.heading}
                                    active={props.mode === d.heading}
                                    />
                            </li>
                        )) : null
                    }
                </ul>
            );

        } else {
            return <div className="view-mode" />;
        }
    };

    // ------------------------- <TokenConnect /> ---------------------------

    class TokenConnect extends React.Component<TokenConnectProps, TokenConnectState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
        }

        _fetchModelState() {
            return {
                mode: concDetailModel.getViewMode(),
                supportsSpeechView: concDetailModel.supportsSpeechView(),
                data: concDetailModel.getConcDetail(),
                hasConcDetailData: concDetailModel.hasConcDetailData(),
                hasExpandLeft: concDetailModel.hasExpandLeft(),
                hasExpandRight: concDetailModel.hasExpandRight(),
                canDisplayWholeDocument: concDetailModel.canDisplayWholeDocument(),
                expandingSide: concDetailModel.getExpaningSide(),
                modelIsBusy: concDetailModel.getIsBusy(),
                tokenConnectIsBusy: concDetailModel.getTokenConnectIsBusy(),
                tokenConnectData: concDetailModel.getTokenConnectData(),
                hasTokenConnectData: concDetailModel.hasTokenConnectData()
            };
        }

        _modelChangeHandler() {
            this.setState(this._fetchModelState());
        }

        componentDidMount() {
            this.modelSubscription = concDetailModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _renderContents() {
            switch (this.state.mode) {
                case 'default':
                    return <DefaultView {...this.state} />;
                case 'speech':
                    return <SpeechView />;
                default:
                    return <TokenExternalKWICView tokenConnectIsBusy={this.state.modelIsBusy}
                                tokenConnectData={this.state.tokenConnectData.renders} viewMode={this.state.mode}  />;
            }
        }

        render() {
            const kwicViewRenders = this.state.tokenConnectData.renders.filter(r => r.isKwicView).toList();
            const customCSS:React.CSSProperties = {overflowY: 'auto'};
            return (
                <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler}
                        customClass={`conc-detail${kwicViewRenders.size > 0 ? ' custom' : ''}`}
                        customStyle={customCSS}
                        takeFocus={true}>
                    <div>
                        <ConcDetailMenu supportsSpeechView={this.state.supportsSpeechView} mode={this.state.mode}
                                tcData={kwicViewRenders} />
                        {this._renderContents()}
                    </div>
                </layoutViews.PopupBox>
            );
        }
    }


    return {
        RefDetail: RefDetail,
        TokenConnect: TokenConnect
    };
}