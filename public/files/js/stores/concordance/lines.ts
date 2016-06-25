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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />

import {SimplePageStore, MultiDict} from '../../util';
import {PageModel} from '../../tpl/document';
import Immutable = require('vendor/immutable');
import {Line, LangSection, KWICSection, TextChunk} from './line';
import SoundManager = require('SoundManager');
import RSVP = require('vendor/rsvp');

export interface ServerTextChunk {
    class:string;
    str:string;
    open_link?:{speech_path:string};
    close_link?:{speech_path:string};
    continued?:boolean;
}

export interface ServerPagination {
    firstPage:number;
    prevPage:number;
    nextPage:number;
    lastPage:number;
}

export interface SingleCorpServerLineData {
    Left:Array<ServerTextChunk>;
    Right:Array<ServerTextChunk>;
    Kwic:Array<ServerTextChunk>;
    rightsize:number;
    hitlen:string;
    linegroup:string;
    leftsize:number;
    ref:string;
    rightspace:string;
    linenum:number;
    leftspace:string;
    kwiclen:number;
    toknum:number;
}

export interface ServerLineData extends SingleCorpServerLineData {
    Align:Array<SingleCorpServerLineData>;
}

export interface ViewConfiguration {
    ViewMode:string;
    ShowLineNumbers:boolean;
    KWICCorps:Array<string>;
    CorporaColumns:Array<{n:string; label:string}>;
    WideCtxGlobals:Array<Array<string>>;
    baseCorpname:string;
    mainCorp:string;
    pagination:ServerPagination;
    currentPage:number;
    onReady?:()=>void;
}

/**
 *
 */
function importData(data:Array<ServerLineData>):Immutable.List<Line> {
    let ans:Array<Line> = [];

    function importTextChunk(item:ServerTextChunk):TextChunk {
        return {
            className: item.class,
            text: item.str,
            openLink: item.open_link ? {speechPath: item.open_link.speech_path} : undefined,
            closeLink: item.close_link ? {speechPath: item.close_link.speech_path} : undefined,
            continued: item.continued,
            showAudioPlayer: false
        };
    }

    data.forEach((item:ServerLineData) => {
        let line:Array<KWICSection> = [];

        line.push(new KWICSection(
            item.toknum,
            item.linenum,
            item.ref,
            Immutable.List<TextChunk>(item.Left.map(importTextChunk)),
            Immutable.List<TextChunk>(item.Kwic.map(importTextChunk)),
            Immutable.List<TextChunk>(item.Right.map(importTextChunk))
        ));

        line = line.concat((item.Align || []).map((item) => {
            return new KWICSection(
                item.toknum,
                item.linenum,
                item.ref,
                Immutable.List<TextChunk>(item.Left.map(importTextChunk)),
                Immutable.List<TextChunk>(item.Kwic.map(importTextChunk)),
                Immutable.List<TextChunk>(item.Right.map(importTextChunk))
            );
        }));

        let ansItem:Line = new Line();
        ansItem.lineNumber = item.linenum;
        ansItem.lineGroup = item.linegroup;
        ansItem.kwicLength = item.kwiclen;
        ansItem.languages = Immutable.List(line);
        ans.push(ansItem); // TODO
    });

    return Immutable.List(ans);
}


/**
 *
 */
class AudioPlayer {

    static PLAYER_STATUS_STOPPED = 0;

    static PLAYER_STATUS_PAUSED = 1;

    static PLAYER_STATUS_PLAYING = 2;

    private soundManager:SoundManager.SoundManager;

    private status:number;

    private playSessionId:string;

    private itemsToPlay:Immutable.List<string>;

    private onStop:()=>void;

    constructor(onStop:()=>void) {
        this.status = AudioPlayer.PLAYER_STATUS_STOPPED;
        this.soundManager = SoundManager.getInstance();
        this.itemsToPlay = Immutable.List([]);
    }

    start(itemsToPlay?:Array<string>):void {
        if (itemsToPlay) {
            this.itemsToPlay = this.itemsToPlay.concat(Immutable.List<string>(itemsToPlay)).toList();
        }
        let sound = this.soundManager.createSound({
            id: this.playSessionId,
            url: this.itemsToPlay.first(),
            autoLoad: true,
            autoPlay: false,
            volume: 100,
            onload: function (bSuccess) {
                if (!bSuccess) {
                    // TODO handle error
                }
            },
            onplay: () => {
            },
            onerror: (err) => {
                console.error(err); // TODO
            },
            onfinish: () => {
                this.status = AudioPlayer.PLAYER_STATUS_STOPPED;
                this.soundManager.destroySound(this.playSessionId);
                if (this.itemsToPlay.size > 0) {
                    this.soundManager.destroySound(this.playSessionId); // TODO do we need this (again)?
                    this.start();

                } else {
                    this.onStop();
                }
            }
        });
        sound.play();
        this.itemsToPlay = this.itemsToPlay.shift();
        this.status = AudioPlayer.PLAYER_STATUS_PLAYING;
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
        this.soundManager.stop('speech-player'); // TODO wtf value?
        this.soundManager.destroySound(this.playSessionId);
    }
}

/**
 *
 */
export class ConcLineStore extends SimplePageStore {

    private layoutModel:PageModel;

    private lines:Immutable.List<Line>;

    private viewMode:string;

    private showLineNumbers:boolean;

    private kwicCorps:Immutable.List<string>;

    private corporaColumns:Immutable.List<{n:string; label:string}>;

    private wideCtxGlobals:Array<Array<string>>;

    private baseCorpname:string;

    private mainCorp:string;

    private audioPlayer:AudioPlayer;

    private playerAttachedChunk:TextChunk;

    private pagination:ServerPagination;

    private currentPage:number;

    private focusedLine:number;

    private externalRefsDetailFn:(corpusId:string, tokenNum:number, lineIdx:number)=>void;

    private externalKwicDetailFn:(corpusId:string, tokenNum:number, lineIdx:number)=>void;


    constructor(layoutModel:PageModel, dispatcher:Dispatcher.Dispatcher<any>,
            lineViewProps:ViewConfiguration, initialData:Array<ServerLineData>) {
        super(dispatcher);
        let self = this;
        this.layoutModel = layoutModel;
        this.viewMode = lineViewProps.ViewMode;
        this.showLineNumbers = lineViewProps.ShowLineNumbers;
        this.kwicCorps = Immutable.List(lineViewProps.KWICCorps);
        this.corporaColumns = Immutable.List(lineViewProps.CorporaColumns);
        this.baseCorpname = lineViewProps.baseCorpname;
        this.mainCorp = lineViewProps.mainCorp;
        this.lines = importData(initialData);
        this.pagination = lineViewProps.pagination; // TODO possible mutable mess
        this.currentPage = lineViewProps.currentPage;
        this.audioPlayer = new AudioPlayer(this.setStopStatus.bind(this));


        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'CONCORDANCE_CHANGE_MAIN_CORPUS':
                    self.changeMainCorpus(payload.props['maincorp']);
                break;
                case 'CONCORDANCE_PLAY_AUDIO_SEGMENT':
                    self.playAudio(payload.props['lineIdx'], payload.props['chunks']);
                    self.notifyChangeListeners();
                break;
                case 'AUDIO_PLAYER_CLICK_CONTROL':
                    self.handlePlayerControls(payload.props['action']);
                    self.notifyChangeListeners();
                break;
                case 'CONCORDANCE_CHANGE_PAGE':
                    let action = payload.props['action'];
                    self.changePage(payload.props['action'], payload.props['pageNum']).then(
                        (data) => {
                            try {
                                self.lines = importData(data['Lines']);
                                self.pagination = data['pagination'];
                                self.currentPage = data['fromp'];

                            } catch (e) {
                                console.error(e);
                            }
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                            // TODO notify
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_REF_DETAIL':
                    if (typeof self.externalRefsDetailFn === 'function') {
                        self.externalRefsDetailFn(payload.props['corpusId'],
                                payload.props['tokenNumber'], payload.props['lineIdx']);
                    }
                break;
            }
        });
    }

    private changePage(action:string, pageNumber?:number):RSVP.Promise<any> {
        let args = this.layoutModel.getConcArgs();
        args.set('fromp', action === 'customPage' ? pageNumber : this.pagination[action]);
        args.set('format', 'json');
        let url = this.layoutModel.createActionUrl('view') + '?' +
            this.layoutModel.encodeURLParameters(args);
        return this.layoutModel.ajax(
            'GET',
            url,
            {},
            {contentType : 'application/x-www-form-urlencoded'}
        );
    }

    private createAudioLink(textChunk:TextChunk):string {
        let tmp = textChunk.openLink || textChunk.closeLink;
        if (tmp) {
            return this.layoutModel.createActionUrl('audio?corpname=' +
                    this.baseCorpname + '&' + 'chunk='+encodeURIComponent(tmp.speechPath));
        } else {
            return null;
        }
    }

    private changeMainCorpus(corpusId:string) {
        let args:MultiDict = this.layoutModel.getConcArgs();
        if (this.hasKwic(corpusId)) {
            args.set('maincorp', corpusId);
            args.set('viewmode', 'align');
            args.add('q', 'x-' + corpusId);

        } else {
            args.set('maincorp', corpusId);
            args.set('within', 1);
        }
        let link = this.layoutModel.createActionUrl('view') + '?' + this.layoutModel.encodeURLParameters(args);
        window.location.href = link; // TODO
    }

    private playAudio(lineIdx:number, chunks:Array<TextChunk>) {
        if (this.playerAttachedChunk) {
            this.playerAttachedChunk.showAudioPlayer = false;
        }
        let availChunks = this.lines.get(lineIdx).languages.get(0).getAllChunks();
        let triggerIdx = availChunks.indexOf(chunks[chunks.length - 1]);
        let line = this.lines.get(lineIdx);
        availChunks.get(triggerIdx).showAudioPlayer = true;
        this.playerAttachedChunk = availChunks.get(triggerIdx);
        this.audioPlayer.start(chunks.map(item => this.createAudioLink(item)).filter(item => !!item));
    }

    private setStopStatus():void {
        if (this.playerAttachedChunk) {
            this.playerAttachedChunk.showAudioPlayer = false;
            this.playerAttachedChunk = null;
        }
    }

    private handlePlayerControls(action) {
        switch (action) {
            case 'play':
                this.audioPlayer.play();
            break;
            case 'pause':
                this.audioPlayer.pause();
            break;
            case 'stop':
                this.audioPlayer.stop();
                this.setStopStatus();
            break;
        }
    }

    hasKwic(corpusId:string):boolean {
        return this.kwicCorps.indexOf(corpusId) > -1;
    }

    getLines():Immutable.List<Line> {
        return this.lines;
    }

    getPagination():ServerPagination {
        return this.pagination;
    }

    getCurrentPage():number {
        return this.currentPage;
    }

    bindExternalRefsDetailFn(fn:(corpusId:string, tokenNum:number, lineIdx:number)=>void):void {
        this.externalRefsDetailFn = fn;
    }

    setLineFocus(lineIdx:number, focus:boolean) {
        this.lines.get(lineIdx).hasFocus = focus; // TODO mutability issues
    }
}

