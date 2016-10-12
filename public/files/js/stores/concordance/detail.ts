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

/// <reference path="../../types/ajaxResponses.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />

import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';
import {ConcLineStore} from './lines';
import {AudioPlayer} from './media';
import * as Immutable from 'vendor/immutable';

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
    colorCode:string;
    metadata:Immutable.Map<string, string>;
}

export type SpeechLines = Array<Speech>;


type ExpandArgs = [number, number];


export interface SpeechOptions {
    speakerIdAttr:[string, string];
    speechSegment:[string, string];
    speechAttrs:Array<string>;
}

/**
 * A store providing access to a detailed/extended kwic information.
 */
export class ConcDetailStore extends SimplePageStore {

    private layoutModel:PageModel;

    private linesStore:ConcLineStore;

    private concDetail:ConcDetailText;

    private expandLeftArgs:ExpandArgs;

    private expandRightArgs:ExpandArgs;

    private corpusId:string;

    private tokenNum:number;

    private lineIdx:number;

    private wholeDocumentLoaded:boolean;

    private structCtx:string;

    private speakerIdAttr:[string, string];

    private speechSegment:[string, string];

    private speechAttrs:Array<string>;

    private audioPlayer:AudioPlayer;

    private speakerColors:Immutable.List<string>;

    /**
     * Speaker colors attachments must survive context expansion.
     * Otherwise it would confusing if e.g. green speaker '01'
     * changed into red one after a context expasion due to
     * some new incoming or outcoming users.
     */
    private speakerColorsAttachments:Immutable.Map<string,string>;


    constructor(layoutModel:PageModel, dispatcher:Dispatcher.Dispatcher<any>, linesStore:ConcLineStore, structCtx:string,
            speechOpts:SpeechOptions, speakerColors:Array<string>) {
        super(dispatcher);
        const self = this;
        this.layoutModel = layoutModel;
        this.linesStore = linesStore;
        this.structCtx = structCtx;
        this.speakerIdAttr = speechOpts.speakerIdAttr;
        this.speechSegment = speechOpts.speechSegment;
        this.speechAttrs = speechOpts.speechAttrs;
        this.lineIdx = null;
        this.wholeDocumentLoaded = false;
        this.speakerColors = Immutable.List<string>(speakerColors);
        this.speakerColorsAttachments = Immutable.Map<string, string>();
        this.audioPlayer = new AudioPlayer(
            this.layoutModel.createStaticUrl('misc/soundmanager2/'),
            () => {
                this.notifyChangeListeners();
            },
            () => {}, // TODO
            () => {
                this.audioPlayer.stop();
                this.layoutModel.showMessage('error',
                        this.layoutModel.translate('concview__failed_to_play_audio'));
            }
        );

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'CONCORDANCE_EXPAND_KWIC_DETAIL':
                    self.loadConcDetail(
                            self.corpusId,
                            self.tokenNum,
                            self.lineIdx,
                            [],
                            payload.props['position']).then(
                        () => {
                            self.linesStore.setLineFocus(self.lineIdx, true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_KWIC_DETAIL':
                    self.loadConcDetail(
                            payload.props['corpusId'],
                            payload.props['tokenNumber'],
                            payload.props['lineIdx'],
                            []).then(
                        () => {
                            self.linesStore.setLineFocus(payload.props['lineIdx'], true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_WHOLE_DOCUMENT':
                    self.loadWholeDocument().then(
                        () => {
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_SPEECH_DETAIL':
                    self.speakerColorsAttachments = self.speakerColorsAttachments.clear();
                    self.loadSpeechDetail(
                            payload.props['corpusId'],
                            payload.props['tokenNumber'],
                            payload.props['lineIdx']).then(
                        () => {
                            self.linesStore.setLineFocus(payload.props['lineIdx'], true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_EXPAND_SPEECH_DETAIL':
                    self.loadSpeechDetail(
                            self.corpusId,
                            self.tokenNum,
                            self.lineIdx,
                            payload.props['position']).then(
                        () => {
                            self.linesStore.setLineFocus(payload.props['lineIdx'], true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_RESET_DETAIL':
                    if (self.lineIdx !== null) {
                        self.linesStore.setLineFocus(self.lineIdx, false);
                        self.lineIdx = null;
                        self.corpusId = null;
                        self.tokenNum = null;
                        self.wholeDocumentLoaded = false;
                        self.speakerColorsAttachments = self.speakerColorsAttachments.clear();
                        self.notifyChangeListeners();
                        self.linesStore.notifyChangeListeners();
                    }
                break;
                case 'CONCORDANCE_PLAY_SPEECH':
                    self.audioPlayer.start(
                        (<Immutable.List<string>>payload.props['segments']).map(item => {
                            return self.layoutModel.createActionUrl(`audio?corpname=${self.corpusId}&chunk=${item}`);
                        }).toArray()
                    );
                break;
            }
        });
    }

    getConcDetail():ConcDetailText {
        return this.concDetail;
    }

    getSpeechesDetail():SpeechLines {
        const ans:SpeechLines = [];
        const self = this;
        let spkId = null;

        function parseTag(name:string, s:string):{[key:string]:string} {
            const srch = new RegExp(`<${name}(\\s+.*)>`).exec(s);
            if (srch) {
                const ans:{[key:string]:string} = {};
                srch[1].trim().split(/\s+/)
                    .map(item => new RegExp('([a-zA-Z0-9_]+)=([^\\s^>]+)').exec(item))
                    .filter(item => !!item)
                    .forEach(item => {
                        ans[item[1]] = item[2];
                    });
                return ans;
            }
            return null;
        }

        function createNewSpeech(speakerId:string, colorCode:string, metadata:{[attr:string]:string}):Speech {
            const importedMetadata = Immutable.Map<string, string>(metadata)
                    .filter((val, attr) => attr !== self.speechSegment[1] && attr !== self.speakerIdAttr[1])
                    .toMap();
            return {
                text: [],
                speakerId: speakerId,
                segments: Immutable.List<string>(),
                metadata: importedMetadata,
                colorCode: colorCode
            };
        }

        let currSpeech:Speech = createNewSpeech('\u2026', 'transparent', {});

        this.concDetail.forEach((item, i) => {
            if (item.class === 'strc') {
                const attrs = parseTag(this.speakerIdAttr[0], item.str);
                if (attrs !== null && attrs[this.speakerIdAttr[1]] !== currSpeech.speakerId) {
                        ans.push(currSpeech);
                        const newSpeakerId = attrs[this.speakerIdAttr[1]];
                        if (!this.speakerColorsAttachments.has(newSpeakerId)) {
                            this.speakerColorsAttachments = this.speakerColorsAttachments.set(
                                newSpeakerId, this.speakerColors.get(this.speakerColorsAttachments.size)
                            )
                        }
                        currSpeech = createNewSpeech(
                            newSpeakerId,
                            this.speakerColorsAttachments.get(newSpeakerId),
                            attrs
                        );

                }
                if (item.str.indexOf(`<${this.speechSegment[0]}`) > -1) {
                    const attrs = parseTag(this.speechSegment[0], item.str);
                    if (attrs) {
                        currSpeech.segments = currSpeech.segments.push(attrs[this.speechSegment[1]]);
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
            ans.push(currSpeech);
        }
        return ans;
    }

    private loadWholeDocument():RSVP.Promise<any> {

        return this.layoutModel.ajax<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('structctx'),
            {
                corpname: this.corpusId,
                pos: this.tokenNum,
                struct: this.structCtx
            },
            {}

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.concDetail = data.content;
                    this.wholeDocumentLoaded = true;
                    this.expandLeftArgs = null;
                    this.expandRightArgs = null;

                } else {
                    throw new Error(data.messages[0]);
                }
            }
        );
    }

    private loadSpeechDetail(corpusId:string, tokenNum:number, lineIdx:number, expand?:string):RSVP.Promise<any> {
        const args = this.speechAttrs.map(x => `${this.speakerIdAttr[0]}.${x}`)
                .concat([this.speechSegment.join('.')]);
        return this.loadConcDetail(corpusId, tokenNum, lineIdx, args, expand);
    }

    private loadConcDetail(corpusId:string, tokenNum:number, lineIdx:number, structs:Array<string>, expand?:string):RSVP.Promise<any> {
        this.corpusId = corpusId;
        this.tokenNum = tokenNum;
        this.lineIdx = lineIdx;
        this.wholeDocumentLoaded = false;

        const args = this.layoutModel.getConcArgs().toDict();
        args['corpname'] = corpusId; // just for sure (is should be already in args)
        // we must delete 'usesubcorp' as the server API does not need it
        // and in case of an aligned corpus it even produces an error
        delete args['usesubcorp'];
        args['pos'] = String(tokenNum);
        args['format'] = 'json'

        if (structs) {
            args['structs'] = (args['structs'] || '').split(',').concat(structs).join(',');
        }

        if (expand === 'left') {
            args['detail_left_ctx'] = String(this.expandLeftArgs[0]);
            args['detail_right_ctx'] = String(this.expandLeftArgs[1]);

        } else if (expand === 'right') {
            args['detail_left_ctx'] = String(this.expandRightArgs[0]);
            args['detail_right_ctx'] = String(this.expandRightArgs[1]);
        }

        return this.layoutModel.ajax<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('widectx'),
            args,
            {}

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.concDetail = data.content;
                    if (data.expand_left_args) {
                        this.expandLeftArgs = [
                            data.expand_left_args.detail_left_ctx, data.expand_left_args.detail_right_ctx
                        ];

                    } else {
                        this.expandLeftArgs = null;
                    }
                    if (data.expand_right_args) {
                        this.expandRightArgs = [
                            data.expand_right_args.detail_left_ctx, data.expand_right_args.detail_right_ctx
                        ];

                    } else {
                        this.expandRightArgs = null;
                    }

                } else {
                    throw new Error(data.messages[0]);
                }
            }
        );
    }

    hasExpandLeft():boolean {
        return !!this.expandLeftArgs;
    }

    hasExpandRight():boolean {
        return !!this.expandRightArgs;
    }

    canDisplayWholeDocument():boolean {
        return this.structCtx && !this.wholeDocumentLoaded;
    }
}


export interface RefsColumn {
    name:string;
    val:string;
}

/**
 * Store providing structural attribute information (aka "text types") related to a specific token
 */
export class RefsDetailStore extends SimplePageStore {

    private layoutModel:PageModel;

    private data:Array<RefsColumn>;

    private linesStore:ConcLineStore;

    private lineIdx:number;

    constructor(layoutModel:PageModel, dispatcher:Dispatcher.Dispatcher<any>, linesStore:ConcLineStore) {
        super(dispatcher);
        const self = this;
        this.layoutModel = layoutModel;
        this.linesStore = linesStore;
        this.lineIdx = null;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'CONCORDANCE_SHOW_REF_DETAIL':
                    self.loadRefs(payload.props['corpusId'], payload.props['tokenNumber'], payload.props['lineIdx']).then(
                        () => {
                            self.linesStore.setLineFocus(payload.props['lineIdx'], true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                            self.notifyChangeListeners();
                        }
                    );
                break;
                case 'CONCORDANCE_REF_RESET_DETAIL':
                    if (self.lineIdx !== null) {
                        self.linesStore.setLineFocus(self.lineIdx, false);
                        self.lineIdx = null;
                        self.notifyChangeListeners();
                        self.linesStore.notifyChangeListeners();
                    }
                break;
            }
        });
    }

    getData():Array<[RefsColumn, RefsColumn]> {
        const ans:Array<[RefsColumn, RefsColumn]> = [];
        for (let i = 0; i < this.data.length; i += 2) {
            ans.push([this.data[i], this.data[i+1]]);
        }
        return ans;
    }

    private loadRefs(corpusId:string, tokenNum:number, lineIdx:number):RSVP.Promise<any> {
        return this.layoutModel.ajax<AjaxResponse.FullRef>(
            'GET',
            this.layoutModel.createActionUrl('fullref'),
            {corpname: corpusId, pos: tokenNum},
            {
                contentType : 'application/x-www-form-urlencoded',
                accept: 'application/json'
            }

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.lineIdx = lineIdx;
                    this.data = data.Refs;

                } else {
                    throw new Error('Invalid response');
                }
            }
        );
    }
}
