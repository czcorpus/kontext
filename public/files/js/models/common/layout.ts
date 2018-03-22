/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import {Kontext} from '../../types/common';
import {StatefulModel} from '../base';
import {IPluginApi} from '../../types/plugins';
import {ActionDispatcher, ActionPayload} from '../../app/dispatcher';
import {MultiDict, uid} from '../../util';
import RSVP from 'rsvp';
import * as Immutable from 'immutable';

/**
 *
 */
export class MessageModel extends StatefulModel implements Kontext.IMessagePageModel {

    private messages:Immutable.List<Kontext.UserNotification>;

    private onClose:{[id:string]:()=>void};

    private pluginApi:IPluginApi;

    private autoRemoveMessages:boolean;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi, autoRemoveMessages:boolean) {
        super(dispatcher);
        this.messages = Immutable.List<Kontext.UserNotification>();
        this.onClose = {};
        this.pluginApi = pluginApi;
        this.autoRemoveMessages = autoRemoveMessages;

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'MESSAGE_FADE_OUT_ITEM':
                    this.fadeOutMessage(payload.props['messageId']);
                    this.notifyChangeListeners();
                break;
                case 'MESSAGE_CLOSED':
                    this.removeMessage(payload.props['messageId']);
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    addMessage(messageType:string, messageText:string, onClose:()=>void) {
        const msgId = uid();
        const baseInterval = this.pluginApi.getConf<number>('messageAutoHideInterval');

        let viewTime;
        switch (messageType) {
            case 'error':
            case 'mail':
                viewTime = 3 * baseInterval;
            break;
            case 'warning':
                viewTime = 2 * baseInterval;
            break;
            case 'info':
            default:
                viewTime = baseInterval;
        }

        this.messages = this.messages.push({
            messageType: messageType,
            messageText: messageText,
            messageId: msgId,
            fadingOut: false
        });

        if (onClose) {
            this.onClose[msgId] = onClose;
        }

        if (viewTime > 0 && this.autoRemoveMessages) {
            window.setTimeout(() => {
                if (this.messages.find(v => v.messageId === msgId)) {
                    this.fadeOutAndRemoveMessage(msgId);
                }
            }, this.pluginApi.getConf<number>('messageAutoHideInterval'));
        }
        this.notifyChangeListeners();
    }

    getMessages():Immutable.List<Kontext.UserNotification> {
        return this.messages;
    }

    getTransitionTime():number {
        return 500;
    }

    fadeOutMessage(messageId:string):void {
        const srchIdx = this.messages.findIndex(v => v.messageId === messageId);
        if (srchIdx > -1 ) {
            const curr = this.messages.get(srchIdx);
            this.messages = this.messages.set(srchIdx, {
                messageId: curr.messageId,
                messageType: curr.messageType,
                messageText: curr.messageText,
                fadingOut: true
            });
        } else {
            throw new Error(`Cannot fade out message, ID ${messageId} not found`);
        }
    }

    fadeOutAndRemoveMessage(messageId:string):void {
        const srchIdx = this.messages.findIndex(v => v.messageId === messageId);
        if (srchIdx > -1 ) {
            const curr = this.messages.get(srchIdx);
            this.messages = this.messages.set(srchIdx, {
                messageId: curr.messageId,
                messageType: curr.messageType,
                messageText: curr.messageText,
                fadingOut: true
            });
            this.notifyChangeListeners();
            window.setTimeout(() => {
                this.removeMessage(messageId);
                this.notifyChangeListeners();
            }, this.getTransitionTime());
        }
    }

    removeMessage(messageId:string):void {
        const srchIdx = this.messages.findIndex(v => v.messageId === messageId);
        if (srchIdx > -1 ) {
            this.messages = this.messages.remove(srchIdx);
            if (typeof this.onClose[messageId] === 'function') {
                const fn = this.onClose[messageId];
                delete(this.onClose[messageId]);
                fn();
            }
        }
    }
}


export interface CitationInfoResponse {
    default_ref:string;
    article_ref:Array<string>;
    other_bibliography:string;
}

export interface CitationInfo extends CitationInfoResponse {
    corpname:string;
    type:CorpusInfoType.CITATION;
}

export interface KeyShortcutsInfo {
    type:CorpusInfoType.KEY_SHORTCUTS;
}

export interface CorpusInfoResponse {
    corpname:string;
    description:string;
    size:number;
    attrlist:Array<{name:string; size:string}>;
    structlist:Array<{name:string; size:string}>;
    web_url:string;
    citation_info:CitationInfo;
}

export interface CorpusInfo extends CorpusInfoResponse {
    type:CorpusInfoType.CORPUS;
}

export interface SubcorpusInfoResponse {
    corpusName:string;
    corpusSize:string; // formatted num
    created:string;
    extended_info:{[key:string]:string};
    subCorpusName:string;
    origSubCorpusName:string;
    subCorpusSize:string; // formatted num
    description:string; // a desc. for public corpora
}

export interface SubcorpusInfo extends SubcorpusInfoResponse {
    type:CorpusInfoType.SUBCORPUS;
}

export enum CorpusInfoType {
    CORPUS = 'corpus-info',
    CITATION = 'citation-info',
    SUBCORPUS = 'subcorpus-info',
    KEY_SHORTCUTS = 'keyboard-shortcuts'
}

export type AnyOverviewInfo = CorpusInfo|SubcorpusInfo|CitationInfo|KeyShortcutsInfo;

/**
 *
 */
export class CorpusInfoModel extends StatefulModel implements Kontext.ICorpusInfoModel {

    pluginApi:IPluginApi;

    corpusData:CorpusInfoResponse;

    subcorpusData:SubcorpusInfoResponse;

    currentCorpus:string;

    currentSubcorpus:string;

    currentInfoType:CorpusInfoType;

    isWaiting:boolean = false;


    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.dispatcher = dispatcher;

        this.dispatcher.register((payload:ActionPayload) => {
            switch (payload.actionType) {
                case 'OVERVIEW_CLOSE':
                    this.currentInfoType = null;
                    this.notifyChangeListeners();
                break;
                case 'OVERVIEW_CORPUS_INFO_REQUIRED':
                    this.isWaiting = true;
                    this.notifyChangeListeners();
                    this.loadCorpusInfo(payload.props['corpusId']).then(
                        (data) => {
                            this.currentCorpus = payload.props['corpusId'];
                            this.currentInfoType = CorpusInfoType.CORPUS;
                            this.isWaiting = false;
                            this.notifyChangeListeners();
                        },
                        (err) => {
                            this.isWaiting = false;
                            this.pluginApi.showMessage('error', err);
                        }
                    )
                    break;
                    case 'OVERVIEW_SHOW_CITATION_INFO':
                        this.isWaiting = true;
                        this.notifyChangeListeners();
                        this.loadCorpusInfo(payload.props['corpusId']).then(
                            (data) => {
                                this.currentCorpus = payload.props['corpusId'];
                                this.currentInfoType = CorpusInfoType.CITATION;
                                this.isWaiting = false;
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.isWaiting = false;
                                this.pluginApi.showMessage('error', err);
                            }
                        );
                    break;
                    case 'OVERVIEW_SHOW_SUBCORPUS_INFO':
                        this.isWaiting = true;
                        this.notifyChangeListeners();
                        this.loadSubcorpusInfo(payload.props['corpusId'], payload.props['subcorpusId']).then(
                            (data) => {
                                this.currentCorpus = payload.props['corpusId'];
                                this.currentSubcorpus = payload.props['subcorpusId'];
                                this.currentInfoType = CorpusInfoType.SUBCORPUS;
                                this.isWaiting = false;
                                this.notifyChangeListeners();
                            },
                            (err) => {
                                this.isWaiting = false;
                                this.pluginApi.showMessage('error', err);
                            }
                        )
                    break;
                    case 'OVERVIEW_SHOW_KEY_SHORTCUTS':
                        this.currentInfoType = CorpusInfoType.KEY_SHORTCUTS;
                        this.notifyChangeListeners();
                    break;
            }
        });
    }

    private loadCorpusInfo(corpusId:string):RSVP.Promise<any> {
        if (this.corpusData && this.currentCorpus === corpusId) {
            return new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
                resolve(this.corpusData);
            });

        } else {
            return this.pluginApi.ajax<CorpusInfoResponse>(
                'GET',
                this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
                {
                    corpname: this.pluginApi.getConf<string>('corpname')
                }
            ).then(
                (data) => {
                    this.corpusData = data;
                    this.currentCorpus = corpusId;
                    return data;
                }
            );
        }
    }

    private loadSubcorpusInfo(corpusId:string, subcorpusId:string):RSVP.Promise<any> {

        let prom;
        if (corpusId !== this.currentCorpus) {
            prom = this.loadCorpusInfo(corpusId);

        } else {
            prom = new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
                resolve(this.corpusData);
            });
        }

        if (this.subcorpusData && this.currentSubcorpus === subcorpusId) {
            return prom.then(
                (data) => {
                    return new RSVP.Promise((resolve:(v:any)=>void, reject:(e:any)=>void) => {
                        resolve(this.subcorpusData);
                    });
                }
            );

        } else {
            return prom.then(
                (data) => {
                    return this.pluginApi.ajax<SubcorpusInfoResponse>(
                        'GET',
                        this.pluginApi.createActionUrl('subcorpus/ajax_subcorp_info'),
                        {
                            'corpname': corpusId,
                            'subcname': subcorpusId
                        }
                    ).then(
                        (data) => {
                            if (!data.extended_info) {
                                data.extended_info = {cql: '-'};
                            }
                            this.currentSubcorpus = subcorpusId;
                            this.subcorpusData = data;
                        }
                    );
                }
            );
        }
    }

    getCurrentInfoType():CorpusInfoType {
        return this.currentInfoType;
    }

    getCurrentInfoData():AnyOverviewInfo {
        switch (this.currentInfoType) {
            case CorpusInfoType.CORPUS:
                return {...this.corpusData, type:CorpusInfoType.CORPUS};
            case CorpusInfoType.CITATION:
                return {...this.corpusData['citation_info'], corpname: this.currentCorpus, type:CorpusInfoType.CITATION};
            case CorpusInfoType.SUBCORPUS:
                return {...this.subcorpusData, type:CorpusInfoType.SUBCORPUS};
            case CorpusInfoType.KEY_SHORTCUTS:
                return {type:CorpusInfoType.KEY_SHORTCUTS};
            default:
                return null;
        }
    }

    isLoading():boolean {
        return this.isWaiting;
    }
}