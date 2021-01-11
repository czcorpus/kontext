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
import { IActionDispatcher, Bound } from 'kombo';

import { Speech, ConcDetailModel, ConcDetailModelState } from '../../../models/concordance/detail';
import { Kontext } from '../../../types/common';
import { Actions, ActionName } from '../../../models/concordance/actions';
import { Color, pipe, List, Dict } from 'cnc-tskit';


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            concDetailModel:ConcDetailModel):React.ComponentClass<{}> {

    function exportMetadata(data:{[k:string]:unknown}) {
        if (!Dict.empty(data)) {
            return pipe(
                data,
                Dict.toEntries(),
                List.map(([attr, val]) => `${attr}: ${val}`)
            ).join(', ');

        } else {
            return he.translate('concview__no_speech_metadata_available');
        }
    }

    // ------------------------- <ExpandSpeechesButton /> ---------------------------

    const ExpandSpeechesButton:React.FC<{
        position:string;
        isWaiting:boolean;

    }> = (props) => {

        const handleExpandClick = (position) => {
            dispatcher.dispatch<Actions.ExpandSpeechDetail>({
                name: ActionName.ExpandSpeechDetail,
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

    const TRSingleSpeech:React.FC<{
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

    const TROverlappingSpeeches:React.FC<{
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

    class SpeechView extends React.PureComponent<ConcDetailModelState> {

        constructor(props) {
            super(props);
            this._handlePlayClick = this._handlePlayClick.bind(this);
            this._handleStopClick = this._handleStopClick.bind(this);

        }

        _handlePlayClick(segments, rowIdx) {
            dispatcher.dispatch<Actions.PlaySpeech>({
                name: ActionName.PlaySpeech,
                payload: {
                    segments: segments,
                    rowIdx: rowIdx
                }
            });
        }

        _handleStopClick() {
            dispatcher.dispatch<Actions.StopSpeech>({
                name: ActionName.StopSpeech
            });
        }

        _isWaitingExpand(side) {
            return this.props.isBusy && this.props.expandingSide === side;
        }

        _canStartPlayback(speechPart:Speech) {
            return !List.empty(speechPart.segments) && List.some(v => !!v, speechPart.segments);
        }

        _renderSpeechLines() {
            return List.map(
                (item, i) => {
                    if (item.length === 1) {
                        return <TRSingleSpeech
                                    key={`sp-line-${i}`}
                                    speech={List.head(item)}
                                    idx={i}
                                    handlePlayClick={this._handlePlayClick.bind(this, List.head(item).segments, i)}
                                    handleStopClick={this._handleStopClick}
                                    isPlaying={this.props.playingRowIdx === i}
                                    canStartPlayback={this._canStartPlayback(List.head(item))} />;

                    } else if (item.length > 1) {
                        return <TROverlappingSpeeches
                                    key={`sp-line-${i}`}
                                    speeches={item}
                                    idx={i}
                                    handlePlayClick={this._handlePlayClick.bind(this, List.head(item).segments, i)}
                                    handleStopClick={this._handleStopClick}
                                    isPlaying={this.props.playingRowIdx === i}
                                    canStartPlayback={this._canStartPlayback(List.head(item))} />;

                    } else {
                        return null;
                    }
                },
                this.props.speechDetail
            );
        }

        render() {
            return (
                <div>
                    <table className="speeches">
                        <tbody>
                            <tr className="expand">
                                <th>
                                    {ConcDetailModel.hasExpandLeft(this.props) ?
                                        <ExpandSpeechesButton position="top"
                                            isWaiting={this._isWaitingExpand('left')} />
                                    : null}
                                </th>
                                <td />
                            </tr>
                            {this._renderSpeechLines()}
                            <tr className="expand">
                                <th>
                                    {ConcDetailModel.hasExpandRight(this.props) ?
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

    return Bound(SpeechView, concDetailModel);

}