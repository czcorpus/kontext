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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../../vendor.d.ts/immutable.d.ts" />

import {SimplePageStore} from '../base';
import {MultiDict, uid} from '../../util';
import * as RSVP from 'vendor/rsvp';
import * as Immutable from 'vendor/immutable';

export class UserNotification {
    messageId:string;
    messageType:string;
    messageText:string;
    fadingOut:boolean;
}

/**
 *
 */
export class MessageStore extends SimplePageStore implements Kontext.MessagePageStore {

    messages:Immutable.List<UserNotification>;

    onClose:{[id:string]:()=>void};

    pluginApi:Kontext.PluginApi;

    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        this.messages = Immutable.List<UserNotification>();
        this.onClose = {};
        this.pluginApi = pluginApi;

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
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

        if (viewTime > 0) {
            window.setTimeout(() => {
                if (this.messages.find(v => v.messageId === msgId)) {
                    this.fadeOutAndRemoveMessage(msgId);
                }
            }, this.pluginApi.getConf<number>('messageAutoHideInterval'));
        }
        this.notifyChangeListeners();
    }

    getMessages():Immutable.List<UserNotification> {
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

/**
 *
 */
export class CorpusInfoStore extends SimplePageStore {

    pluginApi:Kontext.PluginApi;

    corpusData:any;

    subcorpusData:any;

    currentCorpus:string;

    currentSubcorpus:string;

    currentInfoType:string;

    isWaiting:boolean = false;


    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        this.pluginApi = pluginApi;
        this.dispatcher = dispatcher;

        this.dispatcher.register((payload:Kontext.DispatcherPayload) => {
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
                            this.currentInfoType = 'corpus-info';
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
                                this.currentInfoType = 'citation-info';
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
                                this.currentInfoType = 'subcorpus-info';
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
                        this.currentInfoType = 'keyboard-shortcuts';
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
            return this.pluginApi.ajax<any>(
                'GET',
                this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
                {
                    corpname: this.pluginApi.getConf<string>('corpname')
                },
                {
                    contentType : 'application/x-www-form-urlencoded'
                }
            ).then(
                (data) => {
                    if (!data.contains_errors) {
                        this.corpusData = data;
                        this.currentCorpus = corpusId;
                        return data;

                    } else {
                        throw new Error(data.error);
                    }
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
                    return this.pluginApi.ajax<any>(
                        'GET',
                        this.pluginApi.createActionUrl('subcorpus/ajax_subcorp_info'),
                        {
                            'corpname': corpusId,
                            'subcname': subcorpusId
                        },
                        {
                            contentType : 'application/x-www-form-urlencoded'
                        }
                    ).then(
                        (data) => {
                            if (!data.contains_errors) {
                                if (!data.extended_info) {
                                    data.extended_info = {cql: '-'};
                                }
                                this.currentSubcorpus = subcorpusId;
                                this.subcorpusData = data;

                            } else {
                                throw new Error(data.error);
                            }
                        }
                    );
                }
            );
        }
    }

    getCurrentInfoType():string {
        return this.currentInfoType;
    }

    getCurrentInfoData():any {
        switch (this.currentInfoType) {
            case 'corpus-info':
                return this.corpusData;
            case 'citation-info':
                return this.corpusData['citation_info'];
            case 'subcorpus-info':
                return this.subcorpusData;
            default:
                return {};
        }
    }

    isLoading():boolean {
        return this.isWaiting;
    }
}