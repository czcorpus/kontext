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

import {init as initMediaViews} from './media';
import {calcTextColorFromBg, color2str} from '../../util';


export function init(dispatcher, mixins, layoutViews, concDetailStore, refsDetailStore, lineStore) {

    const mediaViews = initMediaViews(dispatcher, mixins, lineStore);
    const he = mixins[0];


    // ------------------------- <RefLine /> ---------------------------

    const RefLine = (props) => {

        const renderCols = () => {
            const ans = [];
            const item = props.colGroups;

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
        };

        return <tr>{renderCols()}</tr>;
    };

    // ------------------------- <RefDetail /> ---------------------------

    class RefDetail extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
        }

        _fetchStoreState() {
            return {
                data: refsDetailStore.getData(),
                isWaiting: refsDetailStore.getIsBusy()
            }
        }

        _storeChangeHandler() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            refsDetailStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            refsDetailStore.removeChangeListener(this._storeChangeHandler);
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
                    {this._renderContents()}
                </layoutViews.PopupBox>
            );
        }
    }

    // ------------------------- <ExpandConcDetail /> ---------------------------

    const ExpandConcDetail = (props) => {

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

    // ------------------------- <DefaultView /> ---------------------------

    class DefaultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._handleDisplayWholeDocumentClick = this._handleDisplayWholeDocumentClick.bind(this);
        }

        _fetchStoreState() {
            return {
                data: concDetailStore.getConcDetail(),
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight(),
                canDisplayWholeDocument: concDetailStore.canDisplayWholeDocument(),
                expandingSide: concDetailStore.getExpaningSide(),
                storeIsBusy: concDetailStore.getIsBusy()
            };
        }

        _expandClickHandler(position) {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_EXPAND_KWIC_DETAIL',
                props: {
                    position: position
                }
            });
        }

        _storeChangeHandler(store, action) {
            this.setState(this._fetchStoreState());
        }

        _handleDisplayWholeDocumentClick() {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_SHOW_WHOLE_DOCUMENT',
                props: {}
            });
        }

        componentDidMount() {
            concDetailStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            concDetailStore.removeChangeListener(this._storeChangeHandler);
        }

        _isWaitingExpand(side) {
            return this.state.storeIsBusy && this.state.expandingSide === side;
        }

        render() {
            return (
                <div>
                    {this.state.hasExpandLeft ?
                        <ExpandConcDetail position="left" isWaiting={this._isWaitingExpand('left')}
                                clickHandler={this._expandClickHandler.bind(this, 'left')} />
                        : null
                    }
                    {(this.state.data || []).map((item, i) => {
                        return (
                            <span key={i} className={item.class ? item.class : null}>{item.str + ' '}</span>
                        );
                    })}
                    {this.state.hasExpandRight ?
                        <ExpandConcDetail position="right" isWaiting={this._isWaitingExpand('right')}
                                clickHandler={this._expandClickHandler.bind(this, 'right')} />
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
    }

    // ------------------------- <ExpandSpeechesButton /> ---------------------------

    const ExpandSpeechesButton = (props) => {

        const handleExpandClick = (position) => {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_EXPAND_SPEECH_DETAIL',
                props: {
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

    class PlaybackIcon extends React.Component {

        constructor(props) {
            super(props);
            this._interval = null;
            this.state = {img: 0};
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
                    img: 0
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

    class SpeechText extends React.Component {

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

    const TRSingleSpeech = React.createClass({

        render : function () {
            const style = {
                backgroundColor: color2str(this.props.speech.colorCode),
                color: color2str(calcTextColorFromBg(this.props.speech.colorCode))
            };
            return (
                <tr key={`speech-${this.props.idx}`} className="speech">
                    <th>
                        <strong className="speaker" title={exportMetadata(this.props.speech.metadata)}
                                style={style}>
                            {this.props.speech.speakerId}
                        </strong>
                    </th>
                    <td className="text">
                        <SpeechText data={this.props.speech.text} key={this.props.idx}
                                bulletColor={color2str(this.props.speech.colorCode)}
                                handleClick={this.props.handlePlayClick}
                                handleStopClick={this.props.handleStopClick}
                                isPlaying={this.props.isPlaying}
                                canStartPlayback={this.props.canStartPlayback} />
                    </td>
                </tr>
            );
        }
    });

    // ------------------------- <TROverlappingSpeeches /> ---------------------------

    const TROverlappingSpeeches = React.createClass({

        _renderOverlappingSpeakersLabel : function () {
            const ans = [];
            this.props.speeches.forEach((speech, i) => {
                if (i > 0) {
                    ans.push(<span key={`p-${this.props.idx}:${i}`} className="plus">{'\u00a0'}+{'\u00a0'}</span>);
                }
                const css = {
                    backgroundColor: color2str(speech.colorCode),
                    color: color2str(calcTextColorFromBg(speech.colorCode))
                };
                ans.push(<strong key={`${this.props.idx}:${i}`} className="speaker"
                                title={exportMetadata(speech.metadata)}
                                style={css}>{speech.speakerId}</strong>);
            });
            return ans;
        },

        render : function () {
            return (
                <tr key={`speech-${this.props.idx}`} className="speech">
                    <th>
                        {this._renderOverlappingSpeakersLabel(this.props.speeches)}
                    </th>
                    <td className="text overlapping-block">
                        {this.props.speeches.map((speech, i) => <SpeechText data={speech.text}
                                    key={`${this.props.idx}:${i}`}
                                    bulletColor={color2str(speech.colorCode)}
                                    handleClick={this.props.handlePlayClick}
                                    handleStopClick={this.props.handleStopClick}
                                    isPlaying={this.props.isPlaying}
                                    canStartPlayback={this.props.canStartPlayback} />)}
                    </td>
                </tr>
            );
        }
    });

    // ------------------------- <SpeechView /> ---------------------------

    class SpeechView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handlePlayClick = this._handlePlayClick.bind(this);
            this._handleStopClick = this._handleStopClick.bind(this);
            this._storeChangeHandler = this._storeChangeHandler.bind(this);

        }

        _fetchStoreState() {
            return {
                data: concDetailStore.getSpeechesDetail(),
                hasExpandLeft: concDetailStore.hasExpandLeft(),
                hasExpandRight: concDetailStore.hasExpandRight(),
                playerWaitingIdx: concDetailStore.getPlayingRowIdx(),
                storeIsBusy: concDetailStore.getIsBusy(),
                expandingSide: concDetailStore.getExpaningSide()
            };
        }

        _handlePlayClick(segments, rowIdx) {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_PLAY_SPEECH',
                props: {
                    segments: segments,
                    rowIdx: rowIdx
                }
            });
        }

        _handleStopClick() {
            dispatcher.dispatch({
                actionType: 'CONCORDANCE_STOP_SPEECH',
                props: {}
            });
        }

        _storeChangeHandler() {
            this.setState(this._fetchStoreState());
        }

        _isWaitingExpand(side) {
            return this.state.storeIsBusy && this.state.expandingSide === side;
        }

        componentDidMount() {
            concDetailStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            concDetailStore.removeChangeListener(this._storeChangeHandler);
        }

        _canStartPlayback(speechPart) {
            return this.props.speechSegment
                && this.props.speechSegment[1]
                && speechPart.segments.size > 0
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
                                speechOverlapVal={this.props.speechOverlapVal}
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

    const MenuLink = (props) => {

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

    const ConcDetailMenu = (props) => {

        const handleMenuClick = (mode) => {
            props.changeHandler(mode);
        };

        if (props.speakerIdAttr) {
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

    // ------------------------- <ConcDetail /> ---------------------------

    class ConcDetail extends React.Component {

        constructor(props) {
            super(props);
            this.state = {
                mode: concDetailStore.getDefaultViewMode()
            };
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
        }

        _storeChangeHandler() {
            this.setState({
                mode: concDetailStore.getDefaultViewMode()
            });
        }

        _reloadData(mode) {
            switch (mode) {
                case 'default':
                    dispatcher.dispatch({
                        actionType: 'CONCORDANCE_SHOW_KWIC_DETAIL',
                        props: {
                            corpusId: this.props.corpusId,
                            tokenNumber: this.props.tokenNumber,
                            kwicLength: this.props.kwicLength,
                            lineIdx: this.props.lineIdx
                        }
                    });
                break;
                case 'speech':
                    dispatcher.dispatch({
                        actionType: 'CONCORDANCE_SHOW_SPEECH_DETAIL',
                        props: {
                            corpusId: this.props.corpusId,
                            tokenNumber: this.props.tokenNumber,
                            kwicLength: this.props.kwicLength,
                            lineIdx: this.props.lineIdx
                        }
                    });
                break;
            }
        }

        componentDidMount() {
            concDetailStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            concDetailStore.removeChangeListener(this._storeChangeHandler);
        }

        _renderContents() {
            switch (this.state.mode) {
                case 'default':
                    return <DefaultView
                                corpusId={this.props.corpusId}
                                tokenNumber={this.props.tokenNumber}
                                kwicLength={this.props.kwicLength}
                                lineIdx={this.props.lineIdx} />;
                case 'speech':
                    return <SpeechView
                                corpusId={this.props.corpusId}
                                tokenNumber={this.props.tokenNumber}
                                kwicLength={this.props.kwicLength}
                                lineIdx={this.props.lineIdx}
                                speechOverlapAttr={this.props.speechOverlapAttr}
                                speechOverlapVal={this.props.speechOverlapVal}
                                speechSegment={this.props.speechSegment} />;
            }
        }

        render() {
            return (
                <layoutViews.PopupBox onCloseClick={this.props.closeClickHandler}
                        customClass="conc-detail"
                        customStyle={{overflowY: 'auto'}}
                        takeFocus={true}>
                    <div>
                        <ConcDetailMenu speakerIdAttr={this.props.speakerIdAttr} mode={this.state.mode} />
                        {this._renderContents()}
                    </div>
                </layoutViews.PopupBox>
            );
        }
    }


    return {
        RefDetail: RefDetail,
        ConcDetail: ConcDetail
    };
}