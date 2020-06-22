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
import { Speech, ConcDetailModel } from '../../../models/concordance/detail';
import { Subscription } from 'rxjs';
import { IActionDispatcher } from 'kombo';
import { Kontext } from '../../../types/common';
import { Color, pipe } from 'cnc-tskit';


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            concDetailModel:ConcDetailModel):React.ComponentClass<{}> {

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
            backgroundColor: Color.color2str(props.speech.colorCode),
            color: pipe(props.speech.colorCode, Color.textColorFromBg(), Color.color2str())
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
                            bulletColor={Color.color2str(props.speech.colorCode)}
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
                    backgroundColor: Color.color2str(speech.colorCode),
                    color: pipe(speech.colorCode, Color.textColorFromBg(), Color.color2str())
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
                                bulletColor={Color.color2str(speech.colorCode)}
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

    return SpeechView;

}