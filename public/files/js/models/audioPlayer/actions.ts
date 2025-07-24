/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Action } from 'kombo';
import { PlaybackStatus } from './player.js';


export class Actions {

    // public actions used to control audio player

    static PlayAudio:Action<{
        playerId:string;
        audioLinks:Array<string>;
        waveformLinks:Array<string>;
    }> = {
        name: 'AUDIO_PLAYER_PLAY_AUDIO'
    };

    static StopAudio:Action<{}> = {
        name: 'AUDIO_PLAYER_STOP_AUDIO'
    };

    // action audio player uses to signal status changes

    static StatusChange:Action<{
        activePlayerId:string|null;
        status:PlaybackStatus;
    }> = {
        name: 'AUDIO_PLAYER_STATUS_CHANGE'
    };

    // private actions used only by audio player

    static AudioPlayerClickControl:Action<{
        action:'play'|'pause'|'stop';
    }> = {
        name: 'AUDIO_PLAYER_CLICK_CONTROL'
    };

    static AudioPlayerSetPosition:Action<{
        offset:number;
    }> = {
        name: 'AUDIO_PLAYER_SET_POSITION'
    };
}
