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

import { Howl } from 'howler';
import { List } from 'cnc-tskit';
import { ajax } from 'rxjs/ajax';


export type PlaybackStatus = 'stop'|'pause'|'play'|'error';

export interface PlayerStatus {
    playback:PlaybackStatus;
    duration:number;
    position:number;
    waveform:Array<number>;
}

/**
 *
 */
export class AudioPlayer {

    private sound:Howl;

    private status:PlayerStatus;

    private itemsToPlay:Array<string>;

    private waveformSources:Array<string>;

    private currentWaveformSource:string;

    private onStop:()=>void;

    private onPlay:()=>void;

    private onError:()=>void;

    private whilePlaying:()=>void;

    constructor(
        onPlay:()=>void,
        onStop:()=>void,
        onError:()=>void,
        whilePlaying:()=>void,
    ) {
        this.status = {
            playback: 'stop',
            duration: 0,
            position: 0,
            waveform: []
        };
        this.itemsToPlay = [];
        this.waveformSources = [];
        this.onPlay = onPlay;
        this.onStop = onStop;
        this.onError = onError;
        this.whilePlaying = whilePlaying;
    }

    private getExtensionFromURL(url: string):string {
        const urlParams = new URLSearchParams(new URL(url).search);
        const chunk = urlParams.get('chunk');
        if (chunk) {
            return chunk.split('.').pop() as string;
        }

        return url.split('.').pop() as string;
    }

    private updateStatus(playback:PlaybackStatus):void {
        if (playback === 'error') {
            this.status = {
                playback: playback,
                duration: 0,
                position: 0,
                waveform: [],
            };
            
        } else {
            this.status = {
                playback: playback,
                duration: this.sound.duration(),
                position: this.sound.seek(),
                waveform: this.status.waveform,
            };
        }
    }

    start(itemsToPlay?:Array<string>, waveformSources?:Array<string>):void {
        if (itemsToPlay) {
            this.itemsToPlay = this.itemsToPlay.concat(itemsToPlay);
            if (waveformSources) {
                this.waveformSources = this.waveformSources.concat(waveformSources);
            } else {
                this.waveformSources = this.waveformSources.concat(List.map(v => null, this.itemsToPlay));
            }
        }

        const parent = this;
        this.sound = new Howl({
            src: [List.head(this.itemsToPlay)],
            autoplay: false,
            volume: 1.0,
            format: [this.getExtensionFromURL(List.head(this.itemsToPlay))],
            onload: function () {
                parent.updateStatus('play');
                parent.onPlay();
            },
            onplay: function () {
                parent.updateStatus('play');
                parent.onPlay();
            },
            onend: function () {
                parent.updateStatus('stop');
                if (!List.empty(parent.itemsToPlay)) {
                    parent.start();
                } else {
                    parent.onStop();
                }
            },
            onstop: function () {
                parent.onStop();
            },
            onloaderror: function () {
                parent.updateStatus('error');
                parent.onError();
            },
            onplayerror: function () {
                parent.updateStatus('error');
                parent.onError();
            },
            onplaying: function () {
                parent.updateStatus('play');
                parent.whilePlaying();
            },
        });

        this.currentWaveformSource = List.head(this.waveformSources);
        if (this.currentWaveformSource) {
            ajax<number[]>(this.currentWaveformSource).subscribe(
                next => {
                    this.status = { ...this.status, waveform: next.response };
                }
            );
        }

        this.waveformSources = List.shift(this.waveformSources);
        this.itemsToPlay = List.shift(this.itemsToPlay);
        this.sound.play();
    }

    play():void {
        if (this.sound && this.status.playback !== 'play') {
            this.sound.play();
            this.updateStatus('play');
        }
    }

    pause():void {
        if (this.sound && this.status.playback === 'play') {
            this.sound.pause();
            this.updateStatus('pause');
        }
    }

    stop():void {
        if (this.sound) {
            this.sound.unload();
            this.itemsToPlay = [];
        }
    }

    setPosition(offset: number): void {
        if (this.sound) {
            this.sound.seek(offset);
            this.updateStatus(this.status.playback);
        }
    }

    getStatus():PlayerStatus {
        return this.status;
    }
}