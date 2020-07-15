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

/// <reference path="../../vendor.d.ts/soundmanager.d.ts" />

import * as SoundManager from 'vendor/SoundManager';
import { List } from 'cnc-tskit';


export enum AudioPlayerStatus {
    STOPPED = 'stop',
    PAUSED = 'pause',
    PLAYING = 'play',
    ERROR = 'error'
}

/**
 *
 */
export class AudioPlayer {

    private soundManager:SoundManager.SoundManager;

    private status:AudioPlayerStatus;

    private playSessionId:string = 'kontext-playback';

    private itemsToPlay:Array<string>;

    private onStop:()=>void;

    private onPlay:()=>void;

    private onError:()=>void;

    constructor(sm2FilesURL:string, onPlay:()=>void, onStop:()=>void, onError:()=>void) {
        this.status = AudioPlayerStatus.STOPPED;
        this.soundManager = SoundManager.soundManager;
        this.soundManager.ontimeout = function (status) {
            console.error(status); // TODO
        }
        this.soundManager.setup({
            url: sm2FilesURL,
            flashVersion: 9,
            debugMode : false,
            preferFlash : false
        });
        this.itemsToPlay = [];
        this.onPlay = onPlay;
        this.onStop = onStop;
        this.onError = onError;
    }

    start(itemsToPlay?:Array<string>):void {
        if (itemsToPlay) {
            this.itemsToPlay = this.itemsToPlay.concat(itemsToPlay);
        }
        let sound = this.soundManager.createSound({
            id: this.playSessionId,
            url: List.head(this.itemsToPlay),
            autoLoad: true,
            autoPlay: false,
            volume: 100,
            onload: (bSuccess) => {
                if (!bSuccess) {
                    this.status = AudioPlayerStatus.ERROR;
                    this.onError();
                }
            },
            onplay: () => {
                this.status = AudioPlayerStatus.PLAYING;
                this.onPlay();
            },
            onfinish: () => {
                this.status = AudioPlayerStatus.STOPPED;
                this.soundManager.destroySound(this.playSessionId);
                if (!List.empty(this.itemsToPlay)) {
                    this.soundManager.destroySound(this.playSessionId); // TODO do we need this (again)?
                    this.start();

                } else {
                    this.onStop();
                }
            }
        });
        this.itemsToPlay = List.shift(this.itemsToPlay);
        sound.play();
    }

    play():void {
        if (this.status === AudioPlayerStatus.STOPPED) {
            this.soundManager.play(this.playSessionId);
            this.status = AudioPlayerStatus.PLAYING;

        } else if (this.status === AudioPlayerStatus.PAUSED) {
            this.soundManager.play(this.playSessionId);
            this.status = AudioPlayerStatus.PLAYING;
        }
    }

    pause():void {
        if (this.status === AudioPlayerStatus.PAUSED) {
            this.soundManager.play(this.playSessionId);
            this.status = AudioPlayerStatus.PLAYING;

        } else if (this.status === AudioPlayerStatus.PLAYING) {
            this.soundManager.pause(this.playSessionId);
            this.status = AudioPlayerStatus.PAUSED;
        }
    }

    stop():void {
        this.soundManager.stop(this.playSessionId);
        this.soundManager.destroySound(this.playSessionId);
        this.itemsToPlay = [];
    }

    getStatus():AudioPlayerStatus {
        return this.status;
    }
}