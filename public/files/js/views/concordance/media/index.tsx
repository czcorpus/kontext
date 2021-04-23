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

import { Kontext } from '../../../types/common';
import { PlayerStatus } from '../../../models/concordance/media';
import { Actions, ActionName } from '../../../models/concordance/actions';
import * as S from './style';
import { Time } from 'cnc-tskit';


export interface AudioPlayerProps {
    playerId: string;
    status: PlayerStatus;
}


export interface MediaViews {
    AudioPlayer:React.ComponentClass<AudioPlayerProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers):MediaViews {

    // ------------------------- <ProgressBar /> ---------------------------

    const ProgressBar:React.FC<{playerId:string; status:PlayerStatus}> = (props) => {

        const ref = React.useRef(null);

        const calcWidth = () => props.status.position ?
            `${Math.floor(props.status.position / props.status.duration * 100)}%` :
            '0';

        const printTime = (secs:number) => {
            const timeString = Time.secs2hms(Math.round(secs));
            if (typeof timeString === 'string') {
                return timeString.split(':').slice(1).join(':');
            }
            return '00:00'
        }

        const setPosition = (e) => {           
            let position = props.status.duration*(e.nativeEvent.layerX - ref.current.offsetLeft - ref.current.clientLeft)/ref.current.offsetWidth;
            if (position < 0) {
                position = 0;
            
            } else if (position > props.status.duration) {
                position = props.status.duration;
            }
            
            dispatcher.dispatch<Actions.AudioPlayerSetPosition>({
                name: ActionName.AudioPlayerSetPosition,
                payload: {
                    playerId: props.playerId,
                    offset: position
                }
            })
        }

        return (
            <S.ProgressBar onClick={setPosition}>
                <div className="curr-time">
                    {printTime(props.status.position / 1000)}
                </div>
                <div className="wrapper" ref={ref}>
                    <div className="progress" style={{width: calcWidth()}}></div>
                </div>
                <div className="duration">
                    {printTime(props.status.duration / 1000)}
                </div>
            </S.ProgressBar>
        )
    }

    // ------------------------- <AudioPlayer /> ---------------------------

    class AudioPlayer extends React.Component<AudioPlayerProps> {

        _handleControlClick(action) {
            dispatcher.dispatch<Actions.AudioPlayerClickControl>({
                name: ActionName.AudioPlayerClickControl,
                payload: {
                    playerId: this.props.playerId,
                    action: action
                }
            });
        }

        _autoSetHtmlClass(buttonId) {
            const ans = [];
            switch (buttonId) {
                case 'play':
                    ans.push('img-button-play');
                    if (this.props.status.playback === 'play') {
                        ans.push('img-button-play-active');
                    }
                break;
                case 'pause':
                    ans.push('img-button-pause');
                    if (this.props.status.playback === 'pause') {
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
                        <ProgressBar playerId={this.props.playerId} status={this.props.status} />
                    </div>
                </S.AudioPlayer>
            );
        }
    }

    return {
        AudioPlayer: AudioPlayer
    };
}
