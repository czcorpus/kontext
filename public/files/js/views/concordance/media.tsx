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
import {IActionDispatcher} from 'kombo';
import {Kontext} from '../../types/common';
import { ConcLineModel } from '../../models/concordance/lines';
import { AudioPlayerStatus } from '../../models/concordance/media';
import { Subscription } from 'rxjs';


export interface AudioPlayerProps {
}


export interface MediaViews {
    AudioPlayer:React.ComponentClass<AudioPlayerProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            lineModel:ConcLineModel):MediaViews {

    // ------------------------- <ConcColsHeading /> ---------------------------

    class AudioPlayer extends React.Component<AudioPlayerProps, {playerStatus:AudioPlayerStatus}> {

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
            dispatcher.dispatch({
                name: 'AUDIO_PLAYER_CLICK_CONTROL',
                payload: {
                    action: action
                }
            });
        }

        _handleLineModelChange() {
            const playerStatus = lineModel.getAudioPlayerStatus();
            if (playerStatus !== AudioPlayerStatus.STOPPED && playerStatus !== AudioPlayerStatus.ERROR) {
                this.setState({
                    playerStatus: playerStatus
                });
            }
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
                    if (this.state.playerStatus === 'play') {
                        ans.push('img-button-play-active');
                    }
                break;
                case 'pause':
                    ans.push('img-button-pause');
                    if (this.state.playerStatus === 'pause') {
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
                <div id="audio-wrapper" ref={(elm) => elm ? this._position(elm) : null}>
                    <div className="audio-controls">
                        <a onClick={this._handleControlClick.bind(this, 'play')} className={this._autoSetHtmlClass('play')}></a>
                        <a onClick={this._handleControlClick.bind(this, 'pause')} className={this._autoSetHtmlClass('pause')}></a>
                        <a onClick={this._handleControlClick.bind(this, 'stop')} className={this._autoSetHtmlClass('stop')}></a>
                    </div>
                </div>
            );
        }
    }

    return {
        AudioPlayer: AudioPlayer
    };
}
