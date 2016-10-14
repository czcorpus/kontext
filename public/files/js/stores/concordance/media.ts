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

/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../../ts/declarations/soundmanager.d.ts" />

import * as SoundManager from 'SoundManager';
import * as Immutable from 'vendor/immutable';


/**
 *
 */
export class AudioPlayer {

    static PLAYER_STATUS_STOPPED = 0;

    static PLAYER_STATUS_PAUSED = 1;

    static PLAYER_STATUS_PLAYING = 2;

    private soundManager:SoundManager.SoundManager;

    private status:number;

    private playSessionId:string = 'kontext-playback';

    private itemsToPlay:Immutable.List<string>;

    private onStop:()=>void;

    private onPlay:()=>void;

    private onError:()=>void;

    constructor(sm2FilesURL:string, onPlay:()=>void, onStop:()=>void, onError:()=>void) {
        this.status = AudioPlayer.PLAYER_STATUS_STOPPED;
        this.soundManager = SoundManager.getInstance();
        this.soundManager.ontimeout = function (status) {
            console.error(status); // TODO
        }
        this.soundManager.setup({
            url: sm2FilesURL,
            flashVersion: 9,
            debugMode : false,
            preferFlash : false
        });
        this.itemsToPlay = Immutable.List([]);
        this.onPlay = onPlay;
        this.onStop = onStop;
        this.onError = onError;
    }

    start(itemsToPlay?:Array<string>):void {
        const self = this;

        if (itemsToPlay) {
            this.itemsToPlay = this.itemsToPlay.concat(Immutable.List<string>(itemsToPlay)).toList();
        }
        let sound = this.soundManager.createSound({
            id: this.playSessionId,
            url: this.itemsToPlay.first(),
            autoLoad: true,
            autoPlay: false,
            volume: 100,
            onload: (bSuccess) => {
                if (!bSuccess) {
                    self.onError();
                }
            },
            onplay: function () {
                self.status = AudioPlayer.PLAYER_STATUS_PLAYING;
                self.onPlay();
            },
            onfinish: function () {
                self.status = AudioPlayer.PLAYER_STATUS_STOPPED;
                self.soundManager.destroySound(self.playSessionId);
                if (self.itemsToPlay.size > 0) {
                    self.soundManager.destroySound(self.playSessionId); // TODO do we need this (again)?
                    self.start();

                } else {
                    self.onStop();
                }
            }
        });
        this.itemsToPlay = this.itemsToPlay.shift();
        sound.play();
    }

    play():void {
        if (this.status === AudioPlayer.PLAYER_STATUS_STOPPED) {
            this.soundManager.play(this.playSessionId);
            this.status = AudioPlayer.PLAYER_STATUS_PLAYING;

        } else if (this.status === AudioPlayer.PLAYER_STATUS_PAUSED) {
            this.soundManager.play(this.playSessionId);
            this.status = AudioPlayer.PLAYER_STATUS_PLAYING;
        }
    }

    pause():void {
        if (this.status === AudioPlayer.PLAYER_STATUS_PAUSED) {
            this.soundManager.play(this.playSessionId);
            this.status = AudioPlayer.PLAYER_STATUS_PLAYING;

        } else if (this.status === AudioPlayer.PLAYER_STATUS_PLAYING) {
            this.soundManager.pause(this.playSessionId);
            this.status = AudioPlayer.PLAYER_STATUS_PAUSED;
        }
    }

    stop():void {
        this.soundManager.stop(this.playSessionId);
        this.soundManager.destroySound(this.playSessionId);
        this.itemsToPlay = this.itemsToPlay.clear();
    }

    getStatus():number {
        return this.status;
    }
}