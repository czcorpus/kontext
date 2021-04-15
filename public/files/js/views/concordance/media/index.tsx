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
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';

import { Kontext } from '../../../types/common';
import { ConcordanceModel } from '../../../models/concordance/main';
import { PlayerStatus } from '../../../models/concordance/media';
import { Actions, ActionName } from '../../../models/concordance/actions';
import * as S from './style';


export interface AudioPlayerProps {
}


export interface MediaViews {
    AudioPlayer:React.ComponentClass<AudioPlayerProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            lineModel:ConcordanceModel):MediaViews {

    // ------------------------- <ProgressBar /> ---------------------------

    const ProgressBar:React.FC<{status:PlayerStatus}> = (props) => {

        const ref = React.useRef(null);

        const calcWidth = () => props.status.position ?
            `${Math.floor(props.status.position / props.status.duration * 100)}%` :
            '0';

        const setPosition = (e) => {           
            let totalOffset = ref.current.offsetLeft;
            let parent = ref.current.offsetParent;
            while (parent) {
                totalOffset += parent.offsetLeft;
                parent = parent.offsetParent;
            }

            let position = props.status.duration*(e.nativeEvent.clientX - totalOffset)/ref.current.offsetWidth;
            if (position < 0) {
                position = 0;
            
            } else if (position > props.status.duration) {
                position = props.status.duration;
            }
            
            dispatcher.dispatch<Actions.AudioPlayerSetPosition>({
                name: ActionName.AudioPlayerSetPosition,
                payload: {offset: position}
            })
        }

        return (
            <S.ProgressBar onClick={setPosition}>
                <div className="curr-time">
                    {Math.round(props.status.position / 1000)}
                </div>
                <div className="wrapper" ref={ref}>
                    <div className="progress" style={{width: calcWidth()}}></div>
                </div>
                <div className="duration">
                    {Math.round(props.status.duration / 1000)}
                </div>
            </S.ProgressBar>
        )
    }

    // ------------------------- <AudioPlayer /> ---------------------------

    class AudioPlayer extends React.Component<AudioPlayerProps, {playerStatus:PlayerStatus}> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            // no need to bind this._handleControlClick
            this._handleLineModelChange = this._handleLineModelChange.bind(this);
            this.state = {
                playerStatus: lineModel.getAudioPlayerStatus()
            };
        }

        _handleControlClick(action) {
            this.setState({playerStatus: action});
            dispatcher.dispatch<Actions.AudioPlayerClickControl>({
                name: ActionName.AudioPlayerClickControl,
                payload: {
                    action: action
                }
            });
        }

        _handleLineModelChange() {
            this.setState({
                playerStatus: lineModel.getAudioPlayerStatus()
            });
        }

        componentDidMount() {
            this.modelSubscription = lineModel.addListener(this._handleLineModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _autoSetHtmlClass(buttonId) {
            const ans = [];
            switch (buttonId) {
                case 'play':
                    ans.push('img-button-play');
                    if (this.state.playerStatus.playback === 'play') {
                        ans.push('img-button-play-active');
                    }
                break;
                case 'pause':
                    ans.push('img-button-pause');
                    if (this.state.playerStatus.playback === 'pause') {
                        ans.push('img-button-pause-active');
                    }
                break;
                case 'stop':
                    ans.push('img-button-stop');
                break;
            }
            return ans.join(' ');
        }

        _position(elm:HTMLElement) {

        }

        render() {
            return (
                <S.AudioPlayer id="audio-wrapper" ref={(elm) => elm ? this._position(elm) : null}>
                    <div className="audio-controls">
                        <a onClick={this._handleControlClick.bind(this, 'play')} className={this._autoSetHtmlClass('play')}></a>
                        <a onClick={this._handleControlClick.bind(this, 'pause')} className={this._autoSetHtmlClass('pause')}></a>
                        <a onClick={this._handleControlClick.bind(this, 'stop')} className={this._autoSetHtmlClass('stop')}></a>
                    </div>
                    <div>
                        <ProgressBar status={this.state.playerStatus} />
                    </div>
                </S.AudioPlayer>
            );
        }
    }

    return {
        AudioPlayer
    };
}
