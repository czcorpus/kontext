/*
 * Copyright (c) 2025 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2025 Martin Zimandl <martin.zimandl@gmail.com>
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

import { IFullActionControl, StatefulModel } from 'kombo';
import { PageModel } from '../../app/page.js';
import { AudioPlayer, PlaybackStatus, PlayerStatus } from './player.js';
import { Actions } from './actions.js';


export interface AudioPlayerModelState {
    activePlayerId:string|null;
    status:PlayerStatus;
}


export class AudioPlayerModel extends StatefulModel<AudioPlayerModelState> {

    private readonly layoutModel:PageModel;

    private readonly audioPlayer:AudioPlayer;

    constructor(
        layoutModel:PageModel,
        dispatcher:IFullActionControl,
    ) {
        super(
            dispatcher,
            {
                activePlayerId: null,
                status: {
                    playback: 'stop',
                    duration: 0,
                    position: 0,
                    waveform: []
                },
            }
        );
        this.layoutModel = layoutModel;
        this.audioPlayer = new AudioPlayer(
            () => {
                this.changeState(state => {
                    state.status = this.audioPlayer.getStatus();
                });
                dispatcher.dispatchSideEffect(
                    Actions.StatusChange,
                    {
                        activePlayerId: this.state.activePlayerId,
                        status: 'play',
                    }
                );
            },
            (finish) => {
                this.changeState(state => {
                    if (finish) {
                        state.activePlayerId = null;
                    }
                    state.status = this.audioPlayer.getStatus();
                });
                dispatcher.dispatchSideEffect(
                    Actions.StatusChange,
                    {
                        activePlayerId: this.state.activePlayerId,
                        status: 'stop',
                    }
                );
            },
            (err) => {
                this.changeState(state => {
                    state.status = this.audioPlayer.getStatus();
                });
                dispatcher.dispatchSideEffect(
                    Actions.StatusChange,
                    {
                        activePlayerId: this.state.activePlayerId,
                        status: 'error',
                    }
                );
                this.layoutModel.showMessage('error', this.layoutModel.translate('concview__failed_to_play_audio'));
            },
            () => {
                this.changeState(state => {
                    state.status = this.audioPlayer.getStatus();
                });
            }
        );

        this.addActionHandler(
            Actions.PlayAudio,
            action => {
                this.changeState(state => {
                    state.activePlayerId = action.payload.playerId;
                });
                this.audioPlayer.stop();
                this.audioPlayer.start(action.payload.audioLinks, action.payload.waveformLinks);
            }
        );

        this.addActionHandler(
            Actions.StopAudio,
            _ => {
                this.changeState(state => {
                    state.activePlayerId = null;
                });
                this.audioPlayer.stop();
            }
        );

        this.addActionHandler(
            Actions.AudioPlayerClickControl,
            action => {
                switch (action.payload.action) {
                    case 'play':
                        this.audioPlayer.play();
                    break;
                    case 'pause':
                        this.audioPlayer.pause();
                    break;
                    case 'stop':
                        this.changeState(state => {
                            state.activePlayerId = null;
                        });
                        this.audioPlayer.stop();
                    break;
                }
                this.changeState(state => {
                    state.status = this.audioPlayer.getStatus()
                });
            }
        );

        this.addActionHandler(
            Actions.AudioPlayerSetPosition,
            action => {
                this.audioPlayer.setPosition(action.payload.offset);
                this.changeState(state => {
                    state.status = this.audioPlayer.getStatus()
                });
            }
        );
    }
}