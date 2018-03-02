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

/// <reference path="../../types/plugins.d.ts" />

import {MultiDict, importColor} from '../../util';
import {Kontext} from '../../types/common';
import {PluginInterfaces} from '../../types/plugins';
import {AjaxResponse} from '../../types/ajaxResponses';
import {StatefulModel} from '../base';
import {PageModel} from '../../app/main';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {ConcLineModel} from './lines';
import {AudioPlayer} from './media';
import * as Immutable from 'immutable';
import RSVP from 'rsvp';

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

    private tokenDetailData:Array<PluginInterfaces.TokenDetail.DataAndRenderer>;

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

    private tokenDetailIsBusy:boolean;

    /**
     * Currently expanded side. In case the model is not busy the
     * value represent last expanded side (it is not reset after expansion).
     * Values: 'left', 'right'
     */
    private expaningSide:string;

    private tokenDetailPlg:PluginInterfaces.TokenDetail.IPlugin;


    constructor(layoutModel:PageModel, dispatcher:ActionDispatcher, linesModel:ConcLineModel, structCtx:string,
            speechOpts:SpeechOptions, speakerColors:Array<string>, wideCtxGlobals:Array<[string, string]>,
            tokenDetailPlg:PluginInterfaces.TokenDetail.IPlugin) {
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
        this.tokenDetailPlg = tokenDetailPlg;
        this.tokenDetailData = [];
        this.concDetail = null;
        this.audioPlayer = new AudioPlayer(
            this.layoutModel.createStaticUrl('misc/soundmanager2/'),
            () => {
                this.notifyChangeListeners();
            },
            () => {
                this.playingRowIdx = -1;
                this.notifyChangeListeners();
            },
            () => {
                this.playingRowIdx = -1;
                this.audioPlayer.stop();
                this.notifyChangeListeners();
                this.layoutModel.showMessage('error',
                        this.layoutModel.translate('concview__failed_to_play_audio'));
            }
        );
        this.isBusy = false;
        this.tokenDetailIsBusy = false;

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'CONCORDANCE_EXPAND_KWIC_DETAIL':
                    this.expaningSide = payload.props['position'];
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.loadConcDetail(
                            this.corpusId,
                            this.kwicTokenNum,
                            this.kwicLength,
                            this.lineIdx,
                            [],
                            payload.props['position']
                    ).then(
                        () => {
                            this.isBusy = false;
                            this.linesModel.setLineFocus(this.lineIdx, true);
                            this.linesModel.notifyChangeListeners();
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_KWIC_DETAIL':
                    this.isBusy = true;
                    this.tokenDetailIsBusy = true;
                    this.mode = 'default';
                    this.expandLeftArgs = Immutable.List<ExpandArgs>();
                    this.expandRightArgs = Immutable.List<ExpandArgs>();
                    this.loadConcDetail(
                            payload.props['corpusId'],
                            payload.props['tokenNumber'],
                            payload.props['kwicLength'],
                            payload.props['lineIdx'],
                            [],
                            this.expandLeftArgs.size > 1 && this.expandRightArgs.size > 1 ? 'reload' : null
                    ).then(
                        () => {
                            this.isBusy = false;
                            this.linesModel.setLineFocus(payload.props['lineIdx'], true);
                            this.linesModel.notifyChangeListeners();
                            this.notifyChangeListeners();

                            return this.loadTokenDetail(
                                payload.props['corpusId'],
                                payload.props['tokenNumber'],
                                payload.props['lineIdx']
                            );
                        }

                    ).then(
                        () => {
                            this.tokenDetailIsBusy = false;
                            this.notifyChangeListeners();
                        }
                    ).catch(
                        (err) => {
                            this.isBusy = false;
                            this.tokenDetailIsBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_TOKEN_DETAIL':
                    this.resetKwicDetail();
                    this.tokenDetailIsBusy = true;
                    this.notifyChangeListeners();
                    this.loadTokenDetail(
                        payload.props['corpusId'],
                        payload.props['tokenNumber'],
                        payload.props['lineIdx']

                    ).then(
                        () => {
                            this.tokenDetailIsBusy = false;
                            this.notifyChangeListeners();
                        }

                    ).catch(
                        (err) => {
                            this.tokenDetailIsBusy = false;
                            this.layoutModel.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );

                break;
                case 'CONCORDANCE_SHOW_WHOLE_DOCUMENT':
                    this.loadWholeDocument().then(
                        () => {
                            this.notifyChangeListeners();
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
                    this.notifyChangeListeners();
                    this.loadSpeechDetail(
                            payload.props['corpusId'],
                            payload.props['tokenNumber'],
                            payload.props['kwicLength'],
                            payload.props['lineIdx'],
                            this.expandLeftArgs.size > 1 && this.expandRightArgs.size > 1 ? 'reload' : null).then(
                        () => {
                            this.isBusy = false;
                            this.linesModel.setLineFocus(payload.props['lineIdx'], true);
                            this.linesModel.notifyChangeListeners();
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.notifyChangeListeners();
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_EXPAND_SPEECH_DETAIL':
                    this.expaningSide = payload.props['position'];
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.loadSpeechDetail(
                            this.corpusId,
                            this.kwicTokenNum,
                            this.kwicLength,
                            this.lineIdx,
                            payload.props['position']).then(
                        () => {
                            this.isBusy = false;
                            this.linesModel.setLineFocus(this.lineIdx, true);
                            this.linesModel.notifyChangeListeners();
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_DETAIL_SWITCH_MODE':
                    (() => {
                        if (payload.props['value'] === 'default') {
                            this.mode = 'default';
                            this.expandLeftArgs = Immutable.List<ExpandArgs>();
                            this.expandRightArgs = Immutable.List<ExpandArgs>();
                            this.expaningSide = null;
                            this.isBusy = true;
                            this.notifyChangeListeners();
                            return this.reloadConcDetail();

                        } else if (payload.props['value'] === 'speech') {
                            this.mode = 'speech';
                            this.expandLeftArgs = Immutable.List<ExpandArgs>();
                            this.expandRightArgs = Immutable.List<ExpandArgs>();
                            this.speakerColorsAttachments = this.speakerColorsAttachments.clear();
                            this.expaningSide = null;
                            this.isBusy = true;
                            this.notifyChangeListeners();
                            return this.reloadSpeechDetail();
                        }
                    })().then(
                        () => {
                            this.isBusy = false;
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isBusy = false;
                            this.layoutModel.showMessage('error', err);
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'CONCORDANCE_RESET_DETAIL':
                    this.resetKwicDetail();
                    this.resetTokenDetail();
                    this.notifyChangeListeners();
                    this.linesModel.notifyChangeListeners();
                break;
                case 'CONCORDANCE_PLAY_SPEECH':
                    if (this.playingRowIdx > -1) {
                        this.playingRowIdx = null;
                        this.audioPlayer.stop();
                        this.notifyChangeListeners();
                    }
                    this.playingRowIdx = payload.props['rowIdx'];
                    const itemsToPlay = (<Immutable.List<string>>payload.props['segments']).map(item => {
                            return this.layoutModel.createActionUrl(`audio?corpname=${this.corpusId}&chunk=${item}`);
                        }).toArray();
                    if (itemsToPlay.length > 0) {
                        this.audioPlayer.start(itemsToPlay);

                    } else {
                        this.playingRowIdx = -1;
                        this.layoutModel.showMessage('error', this.layoutModel.translate('concview__nothing_to_play'));
                        this.notifyChangeListeners();
                    }
                break;
                case 'CONCORDANCE_STOP_SPEECH':
                    if (this.playingRowIdx > -1) {
                        this.playingRowIdx = null;
                        this.audioPlayer.stop();
                        this.notifyChangeListeners();
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

    private resetTokenDetail():void {
        this.tokenDetailData = [];
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
    private loadWholeDocument():RSVP.Promise<any> {

        return this.layoutModel.ajax<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('structctx'),
            {
                corpname: this.corpusId,
                pos: this.kwicTokenNum,
                struct: this.structCtx
            },
            {}

        ).then(
            (data) => {
                this.concDetail = data.content;
                this.wholeDocumentLoaded = true;
                this.expandLeftArgs = Immutable.List<ExpandArgs>();
                this.expandRightArgs = Immutable.List<ExpandArgs>();
            }
        );
    }

    /**
     *
     */
    private loadSpeechDetail(corpusId:string, tokenNum:number, kwicLength:number, lineIdx:number, expand?:string):RSVP.Promise<any> {
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

    private reloadSpeechDetail():RSVP.Promise<any> {
        return this.loadSpeechDetail(this.corpusId, this.kwicTokenNum, this.kwicLength, this.lineIdx);
    }

    private loadTokenDetail(corpusId:string, tokenNum:number, lineIdx:number):RSVP.Promise<boolean> {
        return (() => {
            if (this.tokenDetailPlg) {
                return this.tokenDetailPlg.fetchTokenDetail(corpusId, tokenNum);

            } else {
                return new RSVP.Promise<Array<PluginInterfaces.TokenDetail.DataAndRenderer>>((resolve:(data)=>void, reject:(err)=>void) => {
                    resolve(null);
                });
            }
        })().then(
            (data) => {
                if (data) {
                    this.tokenDetailData = data;
                    this.lineIdx = lineIdx;
                    return true;

                } else {
                    return false;
                }
            }
        );
    }

    /**
     *
     */
    private loadConcDetail(corpusId:string, tokenNum:number, kwicLength:number, lineIdx:number, structs:Array<string>,
                expand?:string):RSVP.Promise<any> {
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
            args.add('structs', (args.getFirst('structs') || '').split(',').concat(structs).join(','));
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
        this.notifyChangeListeners();

        return this.layoutModel.ajax<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('widectx'),
            args,
            {}

        ).then(
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
        );
    }

    private reloadConcDetail():RSVP.Promise<any> {
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

    getTokenDetailData():Array<PluginInterfaces.TokenDetail.DataAndRenderer> {
        return this.tokenDetailData;
    }

    hasTokenDetailData():boolean {
        return this.tokenDetailData.length > 0;
    }

    getIsBusy():boolean {
        return this.isBusy;
    }

    getTokenDetailIsBusy():boolean {
        return this.tokenDetailIsBusy;
    }

    getExpaningSide():string {
        return this.expaningSide;
    }

    supportsTokenDetail():boolean {
        return !!this.tokenDetailPlg;
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

    constructor(layoutModel:PageModel, dispatcher:ActionDispatcher, linesModel:ConcLineModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.linesModel = linesModel;
        this.lineIdx = null;
        this.data = Immutable.List<RefsColumn>();
        this.isBusy = false;

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'CONCORDANCE_SHOW_REF_DETAIL':
                    this.isBusy = true;
                    this.notifyChangeListeners();
                    this.loadRefs(payload.props['corpusId'], payload.props['tokenNumber'], payload.props['lineIdx']).then(
                        () => {
                            this.linesModel.setLineFocus(payload.props['lineIdx'], true);
                            this.linesModel.notifyChangeListeners();
                            this.isBusy = false;
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                            this.isBusy = false;
                            this.notifyChangeListeners();
                        }
                    );
                break;
                case 'CONCORDANCE_REF_RESET_DETAIL':
                    if (this.lineIdx !== null) {
                        this.linesModel.setLineFocus(this.lineIdx, false);
                        this.lineIdx = null;
                        this.notifyChangeListeners();
                        this.linesModel.notifyChangeListeners();
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

    private loadRefs(corpusId:string, tokenNum:number, lineIdx:number):RSVP.Promise<any> {
        return this.layoutModel.ajax<AjaxResponse.FullRef>(
            'GET',
            this.layoutModel.createActionUrl('fullref'),
            {corpname: corpusId, pos: tokenNum}

        ).then(
            (data) => {
                this.lineIdx = lineIdx;
                this.data = Immutable.List<RefsColumn>(data.Refs);
            }
        );
    }

    getIsBusy():boolean {
        return this.isBusy;
    }
}
