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

import {MultiDict, importColor} from '../../util';
import {Kontext} from '../../types/common';
import {PluginInterfaces} from '../../types/plugins';
import {AjaxResponse} from '../../types/ajaxResponses';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ConcLineModel} from './lines';
import {AudioPlayer} from './media';
import * as Immutable from 'immutable';
import { Action, IFullActionControl } from 'kombo';
import { Observable, of as rxOf, forkJoin } from 'rxjs';
import { tap, map } from 'rxjs/operators';

/**
 *
 */
export type ConcDetailText = Array<{str:string; class:string}>;


/**
 *
 */
export interface Speech {
    text:ConcDetailText;
    speakerId:string;
    segments:Immutable.List<string>;
    colorCode:Kontext.RGBAColor;
    metadata:Immutable.Map<string, string>;
}

/**
 * Note: A single speech line contains an array of
 * simultaneous speeches (i.e. if two people speak
 * at the same time then the array contains two items).
 */
export type SpeechLine = Array<Speech>;

export type SpeechLines = Array<SpeechLine>;


type ExpandArgs = [number, number];


export interface SpeechOptions {
    speakerIdAttr:[string, string];
    speechSegment:[string, string];
    speechAttrs:Array<string>;
    speechOverlapAttr:[string, string];
    speechOverlapVal:string;
}

/**
 * A model providing access to a detailed/extended kwic information.
 */
export class ConcDetailModel extends StatefulModel {

    private static SPK_LABEL_OPACITY:number = 0.8;

    private static ATTR_NAME_ALLOWED_CHARS:string = 'a-zA-Z0-9_';

    private static SPK_OVERLAP_MODE_FULL:string = 'full';

    private static SPK_OVERLAP_MODE_SIMPLE:string = 'simple';

    private layoutModel:PageModel;

    private linesModel:ConcLineModel;

    private concDetail:ConcDetailText;

    private expandLeftArgs:Immutable.List<ExpandArgs>;

    private expandRightArgs:Immutable.List<ExpandArgs>;

    private corpusId:string;

    private kwicTokenNum:number;

    private tokenConnectData:PluginInterfaces.TokenConnect.TCData;

    private kwicLength:number;

    private lineIdx:number;

    private wholeDocumentLoaded:boolean;

    private structCtx:string;

    private speechOpts:SpeechOptions;

    private speechAttrs:Array<string>;

    private audioPlayer:AudioPlayer;

    private playingRowIdx:number;

    private speakerColors:Immutable.List<Kontext.RGBAColor>;

    private wideCtxGlobals:Array<[string, string]>;

    private spkOverlapMode:string;

    /**
     * Either 'default' or 'speech'.
     * An initial mode is inferred from speechOpts
     * (see constructor).
     */
    private mode:string;

    /**
     * Speaker colors attachments must survive context expansion.
     * Otherwise it would confusing if e.g. green speaker '01'
     * changed into red one after a context expasion due to
     * some new incoming or outcoming users.
     */
    private speakerColorsAttachments:Immutable.Map<string, Kontext.RGBAColor>;

    private isBusy:boolean;

    private tokenConnectIsBusy:boolean;

    /**
     * Currently expanded side. In case the model is not busy the
     * value represent last expanded side (it is not reset after expansion).
     * Values: 'left', 'right'
     */
    private expaningSide:string;

    private tokenConnectPlg:PluginInterfaces.TokenConnect.IPlugin;


    constructor(layoutModel:PageModel, dispatcher:IFullActionControl, linesModel:ConcLineModel, structCtx:string,
            speechOpts:SpeechOptions, speakerColors:Array<string>, wideCtxGlobals:Array<[string, string]>,
            tokenConnectPlg:PluginInterfaces.TokenConnect.IPlugin) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.linesModel = linesModel;
        this.structCtx = structCtx;
        this.speechOpts = speechOpts;
        this.mode = this.speechOpts.speakerIdAttr ? 'speech' : 'default';
        this.speechAttrs = speechOpts.speechAttrs;
        this.wideCtxGlobals = wideCtxGlobals;
        this.lineIdx = null;
        this.playingRowIdx = -1;
        this.wholeDocumentLoaded = false;
        this.speakerColors = Immutable.List<Kontext.RGBAColor>(speakerColors.map(item => importColor(item, ConcDetailModel.SPK_LABEL_OPACITY)));
        this.speakerColorsAttachments = Immutable.Map<string, Kontext.RGBAColor>();
        this.spkOverlapMode = (speechOpts.speechOverlapAttr || [])[1] ?
                ConcDetailModel.SPK_OVERLAP_MODE_FULL : ConcDetailModel.SPK_OVERLAP_MODE_SIMPLE;
        this.expandLeftArgs = Immutable.List<ExpandArgs>();
        this.expandRightArgs = Immutable.List<ExpandArgs>();
        this.tokenConnectPlg = tokenConnectPlg;
        this.tokenConnectData = {
            token: null,
            renders: Immutable.List<PluginInterfaces.TokenConnect.DataAndRenderer>()
        };
        this.concDetail = null;
        this.audioPlayer = new AudioPlayer(
            this.layoutModel.createStaticUrl('misc/soundmanager2/'),
            () => {
                this.emitChange();
            },
            () => {
                this.playingRowIdx = -1;
                this.emitChange();
            },
            () => {
                this.playingRowIdx = -1;
                this.audioPlayer.stop();
                this.emitChange();
                this.layoutModel.showMessage('error',
                        this.layoutModel.translate('concview__failed_to_play_audio'));
            }
        );
        this.isBusy = false;
        this.tokenConnectIsBusy = false;

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'CONCORDANCE_EXPAND_KWIC_DETAIL':
                    this.expaningSide = action.payload['position'];
                    this.isBusy = true;
                    this.emitChange();
                    this.loadConcDetail(
                            this.corpusId,
                            this.kwicTokenNum,
                            this.kwicLength,
                            this.lineIdx,
                            [],
                            action.payload['position']
                    ).subscribe(
                        () => {
                            this.isBusy = false;
                            this.linesModel.setLineFocus(this.lineIdx, true);
                            this.linesModel.emitChange();
                            this.emitChange();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.emitChange();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_KWIC_DETAIL':
                    this.isBusy = true;
                    this.tokenConnectIsBusy = true;
                    this.expandLeftArgs = Immutable.List<ExpandArgs>();
                    this.expandRightArgs = Immutable.List<ExpandArgs>();
                    forkJoin(
                        this.loadConcDetail(
                            action.payload['corpusId'],
                            action.payload['tokenNumber'],
                            action.payload['kwicLength'],
                            action.payload['lineIdx'],
                            [],
                            this.expandLeftArgs.size > 1 && this.expandRightArgs.size > 1 ? 'reload' : null
                        ),
                        this.loadTokenConnect(
                            action.payload['corpusId'],
                            action.payload['tokenNumber'],
                            action.payload['kwicLength'],
                            action.payload['lineIdx']
                        )

                    ).subscribe(
                        () => {
                            this.isBusy = false;
                            this.tokenConnectIsBusy = false;
                            this.linesModel.setLineFocus(action.payload['lineIdx'], true);
                            this.linesModel.emitChange();
                            this.emitChange();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.tokenConnectIsBusy = false;
                            this.emitChange();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_TOKEN_DETAIL':
                    this.resetKwicDetail();
                    this.resetTokenConnect();
                    this.tokenConnectIsBusy = true;
                    this.emitChange();
                    this.loadTokenConnect(
                        action.payload['corpusId'],
                        action.payload['tokenNumber'],
                        1,
                        action.payload['lineIdx']

                    ).subscribe(
                        () => {
                            this.tokenConnectIsBusy = false;
                            this.emitChange();
                        },
                        (err) => {
                            this.emitChange();
                            this.tokenConnectIsBusy = false;
                            this.layoutModel.showMessage('error', err);
                        }
                    );

                break;
                case 'CONCORDANCE_SHOW_WHOLE_DOCUMENT':
                    this.loadWholeDocument().subscribe(
                        () => {
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_SPEECH_DETAIL':
                    this.mode = 'speech';
                    this.expandLeftArgs = Immutable.List<ExpandArgs>();
                    this.expandRightArgs = Immutable.List<ExpandArgs>();
                    this.speakerColorsAttachments = this.speakerColorsAttachments.clear();
                    this.isBusy = true;
                    this.emitChange();
                    this.loadSpeechDetail(
                            action.payload['corpusId'],
                            action.payload['tokenNumber'],
                            action.payload['kwicLength'],
                            action.payload['lineIdx'],
                            this.expandLeftArgs.size > 1 && this.expandRightArgs.size > 1 ? 'reload' : null).subscribe(
                        () => {
                            this.isBusy = false;
                            this.linesModel.setLineFocus(action.payload['lineIdx'], true);
                            this.linesModel.emitChange();
                            this.emitChange();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.emitChange();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_EXPAND_SPEECH_DETAIL':
                    this.expaningSide = action.payload['position'];
                    this.isBusy = true;
                    this.emitChange();
                    this.loadSpeechDetail(
                            this.corpusId,
                            this.kwicTokenNum,
                            this.kwicLength,
                            this.lineIdx,
                            action.payload['position']).subscribe(
                        () => {
                            this.isBusy = false;
                            this.linesModel.setLineFocus(this.lineIdx, true);
                            this.linesModel.emitChange();
                            this.emitChange();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_DETAIL_SWITCH_MODE':
                    (() => {
                        if (action.payload['value'] === 'default') {
                            this.mode = 'default';
                            this.expandLeftArgs = Immutable.List<ExpandArgs>();
                            this.expandRightArgs = Immutable.List<ExpandArgs>();
                            this.expaningSide = null;
                            this.concDetail = null;
                            this.isBusy = true;
                            this.emitChange();
                            return this.reloadConcDetail();

                        } else if (action.payload['value'] === 'speech') {
                            this.mode = 'speech';
                            this.expandLeftArgs = Immutable.List<ExpandArgs>();
                            this.expandRightArgs = Immutable.List<ExpandArgs>();
                            this.speakerColorsAttachments = this.speakerColorsAttachments.clear();
                            this.expaningSide = null;
                            this.concDetail = null;
                            this.isBusy = true;
                            this.emitChange();
                            return this.reloadSpeechDetail();

                        } else {
                            this.mode = action.payload['value'];
                            this.expandLeftArgs = Immutable.List<ExpandArgs>();
                            this.expandRightArgs = Immutable.List<ExpandArgs>();
                            this.expaningSide = null;
                            this.concDetail = null;
                            this.isBusy = true;
                            this.emitChange();
                            return rxOf(null);
                        }
                    })().subscribe(
                        () => {
                            this.isBusy = false;
                            this.emitChange();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage('error', err);
                            this.emitChange();
                        }
                    );
                break;
                case 'CONCORDANCE_RESET_DETAIL':
                case 'CONCORDANCE_SHOW_REF_DETAIL':
                    this.resetKwicDetail();
                    this.resetTokenConnect();
                    this.emitChange();
                    this.linesModel.emitChange();
                break;
                case 'CONCORDANCE_PLAY_SPEECH':
                    if (this.playingRowIdx > -1) {
                        this.playingRowIdx = null;
                        this.audioPlayer.stop();
                        this.emitChange();
                    }
                    this.playingRowIdx = action.payload['rowIdx'];
                    const itemsToPlay = (<Immutable.List<string>>action.payload['segments']).map(item => {
                            return this.layoutModel.createActionUrl(`audio?corpname=${this.corpusId}&chunk=${item}`);
                        }).toArray();
                    if (itemsToPlay.length > 0) {
                        this.audioPlayer.start(itemsToPlay);

                    } else {
                        this.playingRowIdx = -1;
                        this.layoutModel.showMessage('error', this.layoutModel.translate('concview__nothing_to_play'));
                        this.emitChange();
                    }
                break;
                case 'CONCORDANCE_STOP_SPEECH':
                    if (this.playingRowIdx > -1) {
                        this.playingRowIdx = null;
                        this.audioPlayer.stop();
                        this.emitChange();
                    }
                break;
            }
        });
    }

    private resetKwicDetail():void {
        if (this.lineIdx !== null) {
            this.linesModel.setLineFocus(this.lineIdx, false);
            this.lineIdx = null;
            this.corpusId = null;
            this.kwicTokenNum = null;
            this.kwicLength = null;
            this.wholeDocumentLoaded = false;
            this.expandLeftArgs = this.expandLeftArgs.clear();
            this.expandRightArgs = this.expandRightArgs.clear();
            this.speakerColorsAttachments = this.speakerColorsAttachments.clear();
            this.concDetail = null;
        }
    }

    private resetTokenConnect():void {
        this.tokenConnectData = {
            token: null,
            renders: this.tokenConnectData.renders.clear()
        };
    }

    getPlayingRowIdx():number {
        return this.playingRowIdx;
    }

    getConcDetail():ConcDetailText {
        return this.concDetail;
    }

    hasConcDetailData():boolean {
        return this.concDetail !== null;
    }

    getSpeechesDetail():SpeechLines {
        let spkId = null;

        const parseTag = (name:string, s:string):{[key:string]:string} => {
            const srch = new RegExp(`<${name}(\\s+[^>]+)>`).exec(s);
            if (srch) {
                const ans:{[key:string]:string} = {};
                const items = srch[1].trim()
                    .split(new RegExp(`([${ConcDetailModel.ATTR_NAME_ALLOWED_CHARS}]+)=`)).slice(1);
                for (let i = 0; i < items.length; i += 2) {
                        ans[items[i]] = (items[i+1] || '').trim();
                }
                return ans;
            }
            return null;
        };

        const createNewSpeech = (speakerId:string, colorCode:Kontext.RGBAColor, metadata:{[attr:string]:string}):Speech => {
            const importedMetadata = Immutable.Map<string, string>(metadata)
                    .filter((val, attr) => attr !== this.speechOpts.speechSegment[1] &&
                                attr !== this.speechOpts.speakerIdAttr[1])
                    .toMap();
            return {
                text: [],
                speakerId: speakerId,
                segments: Immutable.List<string>(),
                metadata: importedMetadata,
                colorCode: colorCode
            };
        };

        const isOverlap = (s1:Speech, s2:Speech):boolean => {
            if (s1 && s2 && this.spkOverlapMode === ConcDetailModel.SPK_OVERLAP_MODE_FULL) {
                const flag1 = s1.metadata.get(this.speechOpts.speechOverlapAttr[1]);
                const flag2 = s2.metadata.get(this.speechOpts.speechOverlapAttr[1]);
                if (flag1 === flag2
                        && flag2 === this.speechOpts.speechOverlapVal
                        && s1.segments.get(0) === s2.segments.get(0)) {
                    return true;
                }
            }
            return false;
        };

        const mergeOverlaps = (speeches:Array<Speech>):SpeechLines => {
            const ans:SpeechLines = [];
            let prevSpeech:Speech = null;
            speeches.forEach((item, i) => {
                if (isOverlap(prevSpeech, item)) {
                    ans[ans.length - 1].push(item);
                    ans[ans.length - 1] = ans[ans.length - 1].sort((s1, s2) => {
                        if (s1.speakerId > s2.speakerId) {
                            return 1;

                        } else if (s1.speakerId < s2.speakerId) {
                            return -1;

                        } else {
                            return 0;
                        }
                    });

                } else {
                    ans.push([item]);
                }
                prevSpeech = item;
            });
            return ans;
        };

        let currSpeech:Speech = createNewSpeech('\u2026', null, {});
        let prevSpeech:Speech = null;
        const tmp:Array<Speech> = [];

        (this.concDetail || []).forEach((item, i) => {
            if (item.class === 'strc') {
                const attrs = parseTag(this.speechOpts.speakerIdAttr[0], item.str);
                if (attrs !== null && attrs[this.speechOpts.speakerIdAttr[1]]) {
                        tmp.push(currSpeech);
                        const newSpeakerId = attrs[this.speechOpts.speakerIdAttr[1]];
                        if (!this.speakerColorsAttachments.has(newSpeakerId)) {
                            this.speakerColorsAttachments = this.speakerColorsAttachments.set(
                                newSpeakerId, this.speakerColors.get(this.speakerColorsAttachments.size)
                            )
                        }
                        prevSpeech = currSpeech;
                        currSpeech = createNewSpeech(
                            newSpeakerId,
                            this.speakerColorsAttachments.get(newSpeakerId),
                            attrs
                        );
                }
                if (item.str.indexOf(`<${this.speechOpts.speechSegment[0]}`) > -1) {
                    const attrs = parseTag(this.speechOpts.speechSegment[0], item.str);
                    if (attrs) {
                        currSpeech.segments = currSpeech.segments.push(attrs[this.speechOpts.speechSegment[1]]);
                    }

                }
                if (this.spkOverlapMode === ConcDetailModel.SPK_OVERLAP_MODE_SIMPLE) {
                    const overlapSrch = new RegExp(`</?(${this.speechOpts.speechOverlapAttr[0]})(>|[^>]+>)`, 'g');
                    let srch;
                    let i = 0;
                    while ((srch = overlapSrch.exec(item.str)) !== null) {
                        if (srch[0].indexOf('</') === 0
                                && item.str.indexOf(`<${this.speechOpts.speakerIdAttr[0]}`) > 0) {
                            prevSpeech.text.push({str: srch[0], class: item.class});

                        } else {
                            currSpeech.text.push({str: srch[0], class: item.class});
                        }
                        i += 1;
                    }
                }

            } else {
                currSpeech.text.push({
                    str: item.str,
                    class: item.class
                });
            }
        });
        if (currSpeech.text.length > 0) {
            tmp.push(currSpeech);
        }
        return mergeOverlaps(tmp);
    }

    setWideCtxGlobals(data:Array<[string, string]>):void {
        this.wideCtxGlobals = data;
    }

    /**
     *
     */
    private loadWholeDocument():Observable<any> {

        return this.layoutModel.ajax$<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('structctx'),
            {
                corpname: this.corpusId,
                pos: this.kwicTokenNum,
                struct: this.structCtx
            },
            {}

        ).pipe(
            tap(
                (data) => {
                    this.concDetail = data.content;
                    this.wholeDocumentLoaded = true;
                    this.expandLeftArgs = Immutable.List<ExpandArgs>();
                    this.expandRightArgs = Immutable.List<ExpandArgs>();
                }
            )
        );
    }

    /**
     *
     */
    private loadSpeechDetail(corpusId:string, tokenNum:number, kwicLength:number, lineIdx:number, expand?:string):Observable<boolean> {
        const structs = this.layoutModel.getConcArgs().getList('structs');
        const args = this.speechAttrs
                .map(x => `${this.speechOpts.speakerIdAttr[0]}.${x}`)
                .concat([this.speechOpts.speechSegment.join('.')]);

        const [overlapStruct, overlapAttr] = (this.speechOpts.speechOverlapAttr || [undefined, undefined]);
        if (overlapStruct !== this.speechOpts.speakerIdAttr[0]
                && structs.indexOf(overlapStruct) === -1) {
            if (overlapStruct && overlapAttr) {
                args.push(`${overlapStruct}.${overlapAttr}`);

            } else if (overlapStruct) {
                args.push(overlapStruct);
            }
        }
        return this.loadConcDetail(corpusId, tokenNum, kwicLength, lineIdx, args, expand);
    }

    private reloadSpeechDetail():Observable<boolean> {
        return this.loadSpeechDetail(this.corpusId, this.kwicTokenNum, this.kwicLength, this.lineIdx);
    }

    private loadTokenConnect(corpusId:string, tokenNum:number, numTokens:number, lineIdx:number):Observable<boolean> {
        return (() => {
            if (this.tokenConnectPlg) {
                return this.tokenConnectPlg.fetchTokenConnect(corpusId, tokenNum, numTokens);

            } else {
                return rxOf<PluginInterfaces.TokenConnect.TCData>(null);
            }
        })().pipe(
            tap(
                (data) => {
                    if (data) {
                        this.tokenConnectData = {
                            token: data.token,
                            renders: data.renders
                        };
                        this.lineIdx = lineIdx;
                    }
                }
            ),
            map(
                (data) => data ? true : false
            )
        );
    }

    /**
     *
     */
    private loadConcDetail(corpusId:string, tokenNum:number, kwicLength:number, lineIdx:number, structs:Array<string>,
                expand?:string):Observable<boolean> {
        this.corpusId = corpusId;
        this.kwicTokenNum = tokenNum;
        this.kwicLength = kwicLength;
        this.lineIdx = lineIdx;
        this.wholeDocumentLoaded = false;

        const args = new MultiDict(this.wideCtxGlobals);
        args.set('corpname', corpusId); // just for sure (is should be already in args)
        // we must delete 'usesubcorp' as the server API does not need it
        // and in case of an aligned corpus it even produces an error
        args.remove('usesubcorp');
        args.set('pos', String(tokenNum));
        args.set('format', 'json');
        if (this.kwicLength && this.kwicLength > 1) {
            args.set('hitlen', this.kwicLength);
        }

        if (structs) {
            args.set('structs', (args.getFirst('structs') || '').split(',').concat(structs).join(','));
        }

        if (expand === 'left') {
            args.set('detail_left_ctx', String(this.expandLeftArgs.get(-1)[0]));
            args.set('detail_right_ctx', String(this.expandLeftArgs.get(-1)[1]));

        } else if (expand === 'right') {
            args.set('detail_left_ctx', String(this.expandRightArgs.get(-1)[0]));
            args.set('detail_right_ctx', String(this.expandRightArgs.get(-1)[1]));


        } else if (expand === 'reload' && this.expandLeftArgs.size > 1
                && this.expandRightArgs.size > 1) {
            // Please note that the following lines do not contain any 'left - right'
            // mismatch as we have to fetch the 'current' state, not the 'next' one and such
            // info is always on the other side of expansion (expand-left contains
            // also current right and vice versa)
            args.set('detail_left_ctx', String(this.expandRightArgs.get(-1)[0]));
            args.set('detail_right_ctx', String(this.expandLeftArgs.get(-1)[1]));
        }

        this.isBusy = true;
        this.emitChange();

        return this.layoutModel.ajax$<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('widectx'),
            args,
            {}

        ).pipe(
            tap(
                (data) => {
                    this.concDetail = data.content;
                    if (data.expand_left_args) {
                        this.expandLeftArgs = this.expandLeftArgs.push([
                            data.expand_left_args.detail_left_ctx, data.expand_left_args.detail_right_ctx
                        ]);

                    } else {
                        this.expandLeftArgs = this.expandLeftArgs.push(null);
                    }
                    if (data.expand_right_args) {
                        this.expandRightArgs = this.expandRightArgs.push([
                            data.expand_right_args.detail_left_ctx, data.expand_right_args.detail_right_ctx
                        ]);

                    } else {
                        this.expandRightArgs = this.expandRightArgs.push(null);
                    }
                }
            ),
            map(d =>  !!d)
        );
    }

    private reloadConcDetail():Observable<boolean> {
        return this.loadConcDetail(this.corpusId, this.kwicTokenNum, this.kwicLength, this.lineIdx, [], 'reload');
    }

    hasExpandLeft():boolean {
        return !!this.expandLeftArgs.get(-1);
    }

    hasExpandRight():boolean {
        return !!this.expandRightArgs.get(-1);
    }

    canDisplayWholeDocument():boolean {
        return this.structCtx && !this.wholeDocumentLoaded;
    }

    getViewMode():string {
        return this.mode;
    }

    getTokenConnectData():PluginInterfaces.TokenConnect.TCData {
        return this.tokenConnectData;
    }

    hasTokenConnectData():boolean {
        return this.tokenConnectData.renders.size > 0;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getTokenConnectIsBusy():boolean {
        return this.tokenConnectIsBusy;
    }

    getExpaningSide():string {
        return this.expaningSide;
    }

    supportsTokenConnect():boolean {
        return this.tokenConnectPlg  ? this.tokenConnectPlg.providesAnyTokenInfo() : false;
    }

    supportsSpeechView():boolean {
        return !!this.speechOpts.speakerIdAttr;
    }
}


export interface RefsColumn {
    name:string;
    val:string;
}

/**
 * Model providing structural attribute information (aka "text types") related to a specific token
 */
export class RefsDetailModel extends StatefulModel {

    private layoutModel:PageModel;

    private data:Immutable.List<RefsColumn>;

    private linesModel:ConcLineModel;

    private lineIdx:number;

    private isBusy:boolean;

    constructor(layoutModel:PageModel, dispatcher:IFullActionControl, linesModel:ConcLineModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.linesModel = linesModel;
        this.lineIdx = null;
        this.data = Immutable.List<RefsColumn>();
        this.isBusy = false;

        this.dispatcher.registerActionListener((action:Action) => {
            switch (action.name) {
                case 'CONCORDANCE_SHOW_REF_DETAIL':
                    this.isBusy = true;
                    this.emitChange();
                    this.loadRefs(action.payload['corpusId'], action.payload['tokenNumber'], action.payload['lineIdx']).subscribe(
                        () => {
                            this.linesModel.setLineFocus(action.payload['lineIdx'], true);
                            this.linesModel.emitChange();
                            this.isBusy = false;
                            this.emitChange();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.isBusy = false;
                            this.emitChange();
                        }
                    );
                break;
                case 'CONCORDANCE_REF_RESET_DETAIL':
                case 'CONCORDANCE_SHOW_SPEECH_DETAIL':
                case 'CONCORDANCE_SHOW_KWIC_DETAIL':
                case 'CONCORDANCE_SHOW_TOKEN_DETAIL':
                    if (this.lineIdx !== null) {
                        this.linesModel.setLineFocus(this.lineIdx, false);
                        this.lineIdx = null;
                        this.emitChange();
                        this.linesModel.emitChange();
                    }
                break;
            }
        });
    }

    getData():Immutable.List<[RefsColumn, RefsColumn]> {
        if (this.lineIdx !== null) {
            const ans:Array<[RefsColumn, RefsColumn]> = [];
            for (let i = 0; i < this.data.size; i += 2) {
                ans.push([this.data.get(i), this.data.get(i+1)]);
            }
            return Immutable.List<[RefsColumn, RefsColumn]>(ans);

        } else if (this.isBusy) {
            return Immutable.List<[RefsColumn, RefsColumn]>();

        } else {
            return null;
        }
    }

    private loadRefs(corpusId:string, tokenNum:number, lineIdx:number):Observable<boolean> {
        return this.layoutModel.ajax$<AjaxResponse.FullRef>(
            'GET',
            this.layoutModel.createActionUrl('fullref'),
            {corpname: corpusId, pos: tokenNum}

        ).pipe(
            tap(
                (data) => {
                    this.lineIdx = lineIdx;
                    this.data = Immutable.List<RefsColumn>(data.Refs);
                }
            ),
            map(data => !!data)
        );
    }

    getIsBusy():boolean {
        return this.isBusy;
    }
}
