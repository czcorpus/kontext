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
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { List } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import * as PluginInterfaces from '../../../types/plugins';
import { init as initSpeechViews } from './speech';
import { ConcDetailModel, ConcDetailModelState } from '../../../models/concordance/detail';
import { RefsDetailModel, RefsDetailModelState } from '../../../models/concordance/refsDetail';
import { Actions } from '../../../models/concordance/actions';
import { DetailExpandPositions } from '../../../models/concordance/common';
import * as S from './style';


export interface RefDetailProps {
    closeClickHandler:()=>void;
}


export interface ConcordanceDetailProps {
    closeClickHandler:()=>void;
}


export interface DetailViews {
    RefDetail:React.ComponentClass<RefDetailProps>;
    ConcordanceDetail:React.ComponentClass<ConcordanceDetailProps>;
}


export interface DetailModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    concDetailModel:ConcDetailModel;
    refsDetailModel:RefsDetailModel;
}

export function init({dispatcher, he, concDetailModel, refsDetailModel}:DetailModuleArgs):DetailViews {

    const layoutViews = he.getLayoutViews();
    const SpeechView = initSpeechViews(dispatcher, he, concDetailModel);

    // ------------------------- <CustomPopupBox /> ---------------------------

    const CustomPopupBox:React.FC<{
        customClass:string;
        customStyle?:React.CSSProperties;
        takeFocus:boolean;
        onCloseClick:()=>void;

    }> = (props) => {
        const baseCSS:React.CSSProperties = {
            position: 'fixed',
            bottom: '1em',
            left: '50%',
            transform: 'translate(-50%, 0)'
        };
        return (
            <layoutViews.PopupBox
                    onCloseClick={props.onCloseClick}
                    customClass={props.customClass}
                    customStyle={{...baseCSS, ...props.customStyle}}
                    takeFocus={props.takeFocus}>
                {props.children}
            </layoutViews.PopupBox>
        );
    };

    // ------------------------- <RefValue /> ---------------------------

    const RefValue:React.FC<{
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

    const RefLine:React.FC<{
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

    const RefDetail:React.FC<RefDetailProps & RefsDetailModelState> = (props) => {

        const renderContents = () => {
            if (props.isBusy) {
                return <img src={he.createStaticUrl('img/ajax-loader.gif')} alt={he.translate('global__loading')} />;

            } else if (props.data.length === 0) {
                return <p><strong>{he.translate('global__no_data_avail')}</strong></p>;

            } else {
                return(
                    <table className="full-ref">
                        <tbody>
                            {List.map(
                                (item, i) => <RefLine key={i} colGroups={item} />,
                                props.data
                            )}
                        </tbody>
                    </table>
                );
            }
        }

        return (
            <CustomPopupBox onCloseClick={props.closeClickHandler} customClass="refs-detail"
                    takeFocus={true}>
                <S.RefsDetail>
                    {renderContents()}
                </S.RefsDetail>
            </CustomPopupBox>
        );
    }

    const BoundRefDetail = BoundWithProps<RefDetailProps, RefsDetailModelState>(RefDetail, refsDetailModel);

    // ------------------------- <ExpandConcDetail /> ---------------------------

    const ExpandConcDetail:React.FC<{
        position:DetailExpandPositions;
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

        const createAlt = () => props.position === 'left' ?
            he.translate('concview__expand_left_symbol') :
            he.translate('concview__expand_right_symbol');

        const createImgPath = () => props.position === 'left' ?
            he.createStaticUrl('/img/prev-page.svg') :
            he.createStaticUrl('/img/next-page.svg');

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

    const TokenExternalInfo:React.FC<{
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

    const TokenExternalKWICView:React.FC<{
        tokenConnectIsBusy:boolean;
        tokenConnectData:Array<PluginInterfaces.TokenConnect.DataAndRenderer>;
        viewMode:string;
        expandingSide:DetailExpandPositions;

    }> = (props) => {

        const isWaitingExpand = (side) => {
            return props.tokenConnectIsBusy && props.expandingSide === side;
        };

        const expandClickHandler = (position:DetailExpandPositions) => {
            dispatcher.dispatch<typeof Actions.ExpandKwicDetail>({
                name: Actions.ExpandKwicDetail.name,
                payload: {
                    position: position
                }
            });
        };

        if (props.tokenConnectIsBusy && props.expandingSide === null) {
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
                            {data.contents.expand_left_args ?
                                <ExpandConcDetail position="left" isWaiting={isWaitingExpand('left')}
                                    clickHandler={() => expandClickHandler('left')} />
                                : null
                            }

                            <data.renderer data={data.contents} />

                            {data.contents.expand_right_args ?
                                <ExpandConcDetail position="right" isWaiting={isWaitingExpand('right')}
                                    clickHandler={() => expandClickHandler('right')} />
                                : null
                            }
                        </layoutViews.ErrorBoundary>
                    </div>
                );
            } else {
                return <div className="token-detail"></div>
            }
        }
    };

    // ------------------------- <KwicDetailView /> ---------------------------

    const KwicDetailView:React.FC<{
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
            dispatcher.dispatch<typeof Actions.ExpandKwicDetail>({
                name: Actions.ExpandKwicDetail.name,
                payload: {
                    position: position
                }
            });
        };

        const handleDisplayWholeDocumentClick = () => {
            dispatcher.dispatch<typeof Actions.ShowWholeDocument>({
                name: Actions.ShowWholeDocument.name
            });
        };

        return (
            <div>
                {props.hasExpandLeft ?
                    <ExpandConcDetail position="left" isWaiting={isWaitingExpand('left')}
                        clickHandler={() => expandClickHandler('left')} />
                : null
                }

                {List.map(
                    (item, i) => (
                        <span key={i} className={item.class ? item.class : null}>{item.str + ' '}</span>
                    ),
                    (props.data || [])
                )}

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

    const DefaultView:React.FC<{
        data:Array<{str:string; class:string}>;
        hasExpandLeft:boolean;
        hasExpandRight:boolean;
        canDisplayWholeDocument:boolean;
        expandingSide:string;
        modelIsBusy:boolean;

    }> = (props) => {
        return (
            <div className="concordance_DefaultView">
                {props.data.length > 0 ?
                    <KwicDetailView modelIsBusy={props.modelIsBusy}
                                    expandingSide={props.expandingSide}
                                    hasExpandLeft={props.hasExpandLeft}
                                    hasExpandRight={props.hasExpandRight}
                                    data={props.data}
                                    canDisplayWholeDocument={props.canDisplayWholeDocument} /> :
                    null
                }
            </div>
        );
    }

    // ------------------------- <MenuLink /> ---------------------------

    const MenuLink:React.FC<{
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

    const ConcDetailMenu:React.FC<{
        supportsSpeechView:boolean;
        mode:string; // TODO enum
        tcData:Array<PluginInterfaces.TokenConnect.DataAndRenderer>;

    }> = (props) => {

        const handleMenuClick = (mode) => {
            dispatcher.dispatch<typeof Actions.DetailSwitchMode>({
                name: Actions.DetailSwitchMode.name,
                payload: {
                    value: mode
                }
            });
        };

        if (props.supportsSpeechView || props.tcData.length > 0) {
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
                    {List.map(d => (
                        <li key={`tcItem:${d.heading}`}>
                            <MenuLink clickHandler={handleMenuClick.bind(null, d.heading)}
                                label={d.heading}
                                active={props.mode === d.heading}
                                />
                        </li>),
                        props.tcData
                    )}
                </ul>
            );

        } else {
            return <div className="view-mode" />;
        }
    };

    // ------------------------- <ConcordanceDetail /> ---------------------------

    class ConcordanceDetail extends React.PureComponent<ConcordanceDetailProps & ConcDetailModelState> {

        _renderContents() {
            switch (this.props.mode) {
                case 'default':
                    return <DefaultView data={this.props.concDetail}
                                hasExpandLeft={ConcDetailModel.hasExpandLeft(this.props)}
                                hasExpandRight={ConcDetailModel.hasExpandRight(this.props)}
                                canDisplayWholeDocument={ConcDetailModel.canDisplayWholeDocument(this.props)}
                                expandingSide={this.props.expandingSide}
                                modelIsBusy={this.props.isBusy} />;
                case 'speech':
                    return <SpeechView />;
                default:
                    return <TokenExternalKWICView tokenConnectIsBusy={this.props.isBusy}
                                tokenConnectData={this.props.tokenConnectData.renders} viewMode={this.props.mode}
                                expandingSide={this.props.expandingSide} />;
            }
        }

        render() {
            const kwicViewRenders = List.filter(r => r.isKwicView, this.props.tokenConnectData.renders);
            const customCSS:React.CSSProperties = {overflowY: 'auto'};
            return (
                <CustomPopupBox onCloseClick={this.props.closeClickHandler}
                        customClass={`conc-detail${kwicViewRenders.length > 0 ? ' custom' : ''}`}
                        customStyle={customCSS}
                        takeFocus={true}>
                    <S.ConcordanceDetail>
                        <ConcDetailMenu supportsSpeechView={ConcDetailModel.supportsSpeechView(this.props)} mode={this.props.mode}
                                tcData={kwicViewRenders} />
                        {this._renderContents()}
                        {this.props.concDetail.length > 0 && concDetailModel.supportsTokenConnect() ?
                            <hr /> : null
                        }
                        {concDetailModel.supportsTokenConnect() || this.props.tokenConnectIsBusy ?
                            <TokenExternalInfo tokenConnectData={this.props.tokenConnectData}
                                tokenConnectIsBusy={this.props.tokenConnectIsBusy} /> : null}
                    </S.ConcordanceDetail>
                </CustomPopupBox>
            );
        }
    }

    const BoundConcordanceDetail = BoundWithProps<ConcordanceDetailProps, ConcDetailModelState>(ConcordanceDetail, concDetailModel);


    return {
        RefDetail: BoundRefDetail,
        ConcordanceDetail: BoundConcordanceDetail
    };
}