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
import {Kontext} from '../../types/common';
import {PluginInterfaces} from '../../types/plugins';
import {init as initMediaViews} from './media';
import {calcTextColorFromBg, color2str} from '../../util';
import { ConcDetailModel, RefsDetailModel, RefsColumn, Speech } from '../../models/concordance/detail';
import { ConcLineModel } from '../../models/concordance/lines';
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

    const mediaViews = initMediaViews(dispatcher, he, lineModel);
    const layoutViews = he.getLayoutViews();

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
                    {props.tokenConnectData.renders.map((v, i) => {
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
    }

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

    class DefaultView extends React.Component<{
    },
    {
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
    }> {


        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
        }

        _fetchModelState() {
            return {
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

        _isWaitingExpand(side) {
            return this.state.modelIsBusy && this.state.expandingSide === side;
        }

        render() {
            return (
                <div className="concordance_DefaultView">
                    {this.state.hasConcDetailData ?
                        <KwicDetailView modelIsBusy={this.state.modelIsBusy}
                                        expandingSide={this.state.expandingSide}
                                        hasExpandLeft={this.state.hasExpandLeft}
                                        hasExpandRight={this.state.hasExpandRight}
                                        data={this.state.data}
                                        canDisplayWholeDocument={this.state.canDisplayWholeDocument} /> :
                        null
                    }
                    {this.state.hasConcDetailData && (this.state.hasTokenConnectData || this.state.tokenConnectIsBusy) ?
                        <hr /> : null}
                    {this.state.hasTokenConnectData || this.state.tokenConnectIsBusy ?
                        <TokenExternalInfo tokenConnectData={this.state.tokenConnectData}
                                tokenConnectIsBusy={this.state.tokenConnectIsBusy} /> : null}
                </div>
            );
        }
    }

    // ------------------------- <ExpandSpeechesButton /> ---------------------------

    const ExpandSpeechesButton:React.SFC<{
        position:string;
        isWaiting:boolean;

    }> = (props) => {

        const handleExpandClick = (position) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_EXPAND_SPEECH_DETAIL',
                payload: {
                    position: position
                }
            });
        };

        const ifTopThenElseIfBottom = (val1, val2) => {
            if (props.position === 'top') {
                return val1;

            } else if (props.position === 'bottom') {
                return val2;
            }
        };

        const mapPosition = () => {
            if (props.position === 'top') {
                return 'left';

            } else if (props.position === 'bottom') {
                return 'right';
            }
        };

        const createImgPath = () => {
            return he.createStaticUrl(ifTopThenElseIfBottom(
                'img/sort_asc.svg', 'img/sort_desc.svg'
            ));
        };

        const createImgAlt = () => {
            return he.translate(ifTopThenElseIfBottom(
                'concview__expand_up_symbol', 'concview__expand_down_symbol'
            ));
        };

        const createTitle = () => {
            return he.translate(ifTopThenElseIfBottom(
                'concview__click_to_expand_up', 'concview__click_to_expand_down'
            ));
        };

        if (props.isWaiting) {
            return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} />;

        } else {
            return (
                <a onClick={handleExpandClick.bind(null, mapPosition())}
                        title={createTitle()}>
                    <img src={createImgPath()} alt={createImgAlt()} />
                </a>
            );
        }
    };

    // ----------------------------------------------------------------------

    function exportMetadata(data) {
        if (data.size > 0) {
            return data.map((val, attr) => `${attr}: ${val}`).join(', ');

        } else {
            return he.translate('concview__no_speech_metadata_available');
        }
    }

    function renderSpeech(data, key) {
        return data.map((item, i) => {
            return <span key={`${key}-${i}`} className={item.class ? item.class : null}>{item.str + ' '}</span>;
        });
    }

    // ------------------------- <PlaybackIcon /> ---------------------------

    class PlaybackIcon extends React.Component<{
        isPlaying:boolean;
        setFocusFn:(v:boolean)=>void;
        handleStopClick:()=>void;
        handleClick:()=>void;
    },
    {
        img:number;
    }> {

        private _interval:number;

        constructor(props) {
            super(props);
            this._interval = null;
            this.state = {img: 3};
            this._handleMouseOver = this._handleMouseOver.bind(this);
            this._handleMouseOut = this._handleMouseOut.bind(this);
        }

        componentDidUpdate() {
            if (this.props.isPlaying && this._interval === null) {
                this._interval = window.setInterval(() => {
                    this.setState({
                        img: (this.state.img + 1) % 4
                    });
                }, 250);

            } else if (!this.props.isPlaying && this._interval !== null) {
                window.clearInterval(this._interval);
                this._interval = null;
                this.setState({
                    img: 3
                });
            }
        }

        componentWillUnmount() {
            if (this._interval !== null) {
                window.clearInterval(this._interval);
            }
        }

        _handleMouseOver() {
            this.props.setFocusFn(true);
        }

        _handleMouseOut() {
            this.props.setFocusFn(false);
        }

        _getTitle() {
            if (this.props.isPlaying) {
                return he.translate('concview__playing');

            } else {
                return he.translate('concview__click_to_play_audio');
            }
        }

        _getClickHandler() {
            if (this.props.isPlaying) {
                return this.props.handleStopClick;

            } else {
                return this.props.handleClick;
            }
        }

        render() {
            return (
                <span className="play-audio" onMouseOver={this._handleMouseOver} onMouseOut={this._handleMouseOut}>
                    <img src={he.createStaticUrl(`img/audio-${this.state.img}w.svg`)} title={this._getTitle()}
                            onClick={this._getClickHandler()} />
                </span>
            );
        }
    }

    // ------------------------- <SpeechText /> ---------------------------

    class SpeechText extends React.Component<{
        bulletColor:string;
        canStartPlayback:boolean;
        isPlaying:boolean;
        data:Array<{class:string; str:string}>;
        handleClick:()=>void;
        handleStopClick:()=>void;
    },
    {
        hasFocus:boolean;
    }> {

        constructor(props) {
            super(props);
            this.state = {hasFocus: false};
            this._setFocus = this._setFocus.bind(this);
        }

        _setFocus(focus) {
            this.setState({hasFocus: focus});
        }

        render() {
            return (
                <div className={'speech-text' + (this.state.hasFocus ? ' focus' : '')}>
                    <span style={{color: this.props.bulletColor}}>{'\u25cf\u00a0'}</span>
                    {this.props.data.map((item, i) => {
                        return <span key={i} className={item.class ? item.class : null}>{item.str + ' '}</span>;
                    })}
                    {this.props.canStartPlayback ?
                    <PlaybackIcon handleClick={this.props.handleClick}
                                handleStopClick={this.props.handleStopClick}
                                isPlaying={this.props.isPlaying}
                                setFocusFn={this._setFocus} />
                    : null}
                </div>
            );
        }
    }

    // ------------------------- <TRSingleSpeech /> ---------------------------

    const TRSingleSpeech:React.SFC<{
        idx:number;
        speech:Speech;
        isPlaying:boolean;
        canStartPlayback:boolean;
        handlePlayClick:()=>void;
        handleStopClick:()=>void;

    }> = (props) => {

        const style = {
            backgroundColor: color2str(props.speech.colorCode),
            color: color2str(calcTextColorFromBg(props.speech.colorCode))
        };
        return (
            <tr key={`speech-${props.idx}`} className="speech">
                <th>
                    <strong className="speaker" title={exportMetadata(props.speech.metadata)}
                            style={style}>
                        {props.speech.speakerId}
                    </strong>
                </th>
                <td className="text">
                    <SpeechText data={props.speech.text} key={props.idx}
                            bulletColor={color2str(props.speech.colorCode)}
                            handleClick={props.handlePlayClick}
                            handleStopClick={props.handleStopClick}
                            isPlaying={props.isPlaying}
                            canStartPlayback={props.canStartPlayback} />
                </td>
            </tr>
        );
    };

    // ------------------------- <TROverlappingSpeeches /> ---------------------------

    const TROverlappingSpeeches:React.SFC<{
        idx:number;
        speeches:Array<Speech>;
        isPlaying:boolean;
        canStartPlayback:boolean;
        handlePlayClick:()=>void;
        handleStopClick:()=>void;

    }> = (props) => {

        const renderOverlappingSpeakersLabel = () => {
            const ans = [];
            props.speeches.forEach((speech, i) => {
                if (i > 0) {
                    ans.push(<span key={`p-${props.idx}:${i}`} className="plus">{'\u00a0'}+{'\u00a0'}</span>);
                }
                const css = {
                    backgroundColor: color2str(speech.colorCode),
                    color: color2str(calcTextColorFromBg(speech.colorCode))
                };
                ans.push(<strong key={`${props.idx}:${i}`} className="speaker"
                                title={exportMetadata(speech.metadata)}
                                style={css}>{speech.speakerId}</strong>);
            });
            return ans;
        };

        return (
            <tr key={`speech-${props.idx}`} className="speech">
                <th>
                    {renderOverlappingSpeakersLabel()}
                </th>
                <td className="text overlapping-block">
                    {props.speeches.map((speech, i) => <SpeechText data={speech.text}
                                key={`${props.idx}:${i}`}
                                bulletColor={color2str(speech.colorCode)}
                                handleClick={props.handlePlayClick}
                                handleStopClick={props.handleStopClick}
                                isPlaying={props.isPlaying}
                                canStartPlayback={props.canStartPlayback} />)}
                </td>
            </tr>
        );
    };

    // ------------------------- <SpeechView /> ---------------------------

    class SpeechView extends React.Component<{
    },
    {
        data:Array<Array<Speech>>;
        hasExpandLeft:boolean;
        hasExpandRight:boolean;
        playerWaitingIdx:number;
        modelIsBusy:boolean;
        expandingSide:string;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handlePlayClick = this._handlePlayClick.bind(this);
            this._handleStopClick = this._handleStopClick.bind(this);
            this._modelChangeHandler = this._modelChangeHandler.bind(this);

        }

        _fetchModelState() {
            return {
                data: concDetailModel.getSpeechesDetail(),
                hasExpandLeft: concDetailModel.hasExpandLeft(),
                hasExpandRight: concDetailModel.hasExpandRight(),
                playerWaitingIdx: concDetailModel.getPlayingRowIdx(),
                modelIsBusy: concDetailModel.getIsBusy(),
                expandingSide: concDetailModel.getExpaningSide()
            };
        }

        _handlePlayClick(segments, rowIdx) {
            dispatcher.dispatch({
                name: 'CONCORDANCE_PLAY_SPEECH',
                payload: {
                    segments: segments,
                    rowIdx: rowIdx
                }
            });
        }

        _handleStopClick() {
            dispatcher.dispatch({
                name: 'CONCORDANCE_STOP_SPEECH',
                payload: {}
            });
        }

        _modelChangeHandler() {
            this.setState(this._fetchModelState());
        }

        _isWaitingExpand(side) {
            return this.state.modelIsBusy && this.state.expandingSide === side;
        }

        componentDidMount() {
            this.modelSubscription = concDetailModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _canStartPlayback(speechPart) {
            return speechPart.segments.size > 0
                && speechPart.segments.find(v => !!v);
        }

        _renderSpeechLines() {
            return (this.state.data || []).map((item, i) => {
                if (item.length === 1) {
                    return <TRSingleSpeech
                                key={`sp-line-${i}`}
                                speech={item[0]}
                                idx={i}
                                handlePlayClick={this._handlePlayClick.bind(this, item[0].segments, i)}
                                handleStopClick={this._handleStopClick}
                                isPlaying={this.state.playerWaitingIdx === i}
                                canStartPlayback={this._canStartPlayback(item[0])} />;

                } else if (item.length > 1) {
                    return <TROverlappingSpeeches
                                key={`sp-line-${i}`}
                                speeches={item}
                                idx={i}
                                handlePlayClick={this._handlePlayClick.bind(this, item[0].segments, i)}
                                handleStopClick={this._handleStopClick}
                                isPlaying={this.state.playerWaitingIdx === i}
                                canStartPlayback={this._canStartPlayback(item[0])} />;

                } else {
                    return null;
                }
            });
        }

        render() {
            return (
                <div>
                    <table className="speeches">
                        <tbody>
                            <tr className="expand">
                                <th>
                                    {this.state.hasExpandLeft ?
                                        <ExpandSpeechesButton position="top"
                                            isWaiting={this._isWaitingExpand('left')} />
                                    : null}
                                </th>
                                <td />
                            </tr>
                            {this._renderSpeechLines()}
                            <tr className="expand">
                                <th>
                                    {this.state.hasExpandRight ?
                                        <ExpandSpeechesButton position="bottom"
                                            isWaiting={this._isWaitingExpand('right')} />
                                    : null}
                                </th>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        }
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
    }> = (props) => {

        const handleMenuClick = (mode) => {
            dispatcher.dispatch({
                name: 'CONCORDANCE_DETAIL_SWITCH_MODE',
                payload: {value: mode}
            });
        };

        if (props.supportsSpeechView) {
            return (
                <ul className="view-mode">
                    <li className={props.mode === 'default' ? 'current' : null}>
                        <MenuLink clickHandler={handleMenuClick.bind(null, 'default')}
                            label={he.translate('concview__detail_default_mode_menu')}
                            active={props.mode === 'default'} />
                    </li>
                    <li className={props.mode === 'speech' ? 'current' : null}>
                        <MenuLink clickHandler={handleMenuClick.bind(null, 'speech')}
                            label={he.translate('concview__detail_speeches_mode_menu')}
                            active={props.mode === 'speech'} />
                    </li>
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
                supportsSpeechView: concDetailModel.supportsSpeechView()
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
                    return <DefaultView />;
                case 'speech':
                    return <SpeechView />;
            }
        }

        render() {
            return (
                <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler}
                        customClass="conc-detail"
                        customStyle={{overflowY: 'auto'}}
                        takeFocus={true}>
                    <div>
                        <ConcDetailMenu supportsSpeechView={this.state.supportsSpeechView} mode={this.state.mode} />
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