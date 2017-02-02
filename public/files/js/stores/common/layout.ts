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
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

import {SimplePageStore, MultiDict} from '../../util';
import * as RSVP from 'vendor/rsvp';

/**
 *
 */
export class MessageStore extends SimplePageStore implements Kontext.MessagePageStore {

    messages:Array<{messageType:string; messageText:string, messageId:string}>;

    onClose:{[id:string]:()=>void};

    pluginApi:Kontext.PluginApi;

    addMessage(messageType:string, messageText:string, onClose:()=>void) {
        let msgId = String(Math.random());
        let self = this;

        let viewTime;
        if (messageType === 'warning') {
            viewTime = self.pluginApi.getConf<number>('messageAutoHideInterval') * 1.5;

        } else if (messageType !== 'error' && messageType !== 'mail') {
            viewTime = self.pluginApi.getConf<number>('messageAutoHideInterval');

        } else {
            viewTime = -1;
        }

        this.messages.push({
            messageType: messageType,
            messageText: messageText,
            messageId: msgId
        });

        if (onClose) {
            this.onClose[msgId] = onClose;
        }

        if (viewTime > 0) {
            let timeout = window.setTimeout(function () {
                self.removeMessage(msgId);
                window.clearTimeout(timeout);
                self.notifyChangeListeners();
            }, self.pluginApi.getConf('messageAutoHideInterval'));
        }
        this.notifyChangeListeners();
    }

    getMessages():Array<{messageType:string; messageText:string, messageId:string}> {
        return this.messages;
    }

    removeMessage(messageId:string) {
        this.messages = this.messages.filter(function (x) { return x.messageId !== messageId; });
        if (typeof this.onClose[messageId] === 'function') {
            let fn = this.onClose[messageId];
            delete(this.onClose[messageId]);
            fn();
        }
    }

    constructor(dispatcher:Kontext.FluxDispatcher, pluginApi:Kontext.PluginApi) {
        super(dispatcher);
        var self = this;
        this.messages = [];
        this.onClose = {};
        this.pluginApi = pluginApi;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'MESSAGE_CLOSED':
                    self.removeMessage(payload.props['messageId']);
                    self.notifyChangeListeners();
                    break;
            }
        });
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
        const self = this;
        this.pluginApi = pluginApi;
        this.dispatcher = dispatcher;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'OVERVIEW_CLOSE':
                    self.currentInfoType = null;
                    self.notifyChangeListeners();
                break;
                case 'OVERVIEW_CORPUS_INFO_REQUIRED':
                    self.isWaiting = true;
                    self.notifyChangeListeners();
                    self.loadCorpusInfo(payload.props['corpusId']).then(
                        (data) => {
                            self.currentCorpus = payload.props['corpusId'];
                            self.currentInfoType = 'corpus-info';
                            self.isWaiting = false;
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.isWaiting = false;
                            self.pluginApi.showMessage('error', err);
                        }
                    )
                    break;
                    case 'OVERVIEW_SHOW_CITATION_INFO':
                        self.isWaiting = true;
                        self.notifyChangeListeners();
                        self.loadCorpusInfo(payload.props['corpusId']).then(
                            (data) => {
                                self.currentCorpus = payload.props['corpusId'];
                                self.currentInfoType = 'citation-info';
                                self.isWaiting = false;
                                self.notifyChangeListeners();
                            },
                            (err) => {
                                self.isWaiting = false;
                                self.pluginApi.showMessage('error', err);
                            }
                        );
                    break;
                    case 'OVERVIEW_SHOW_SUBCORPUS_INFO':
                        self.isWaiting = true;
                        self.notifyChangeListeners();
                        self.loadSubcorpusInfo(payload.props['corpusId'], payload.props['subcorpusId']).then(
                            (data) => {
                                self.currentCorpus = payload.props['corpusId'];
                                self.currentSubcorpus = payload.props['subcorpusId'];
                                self.currentInfoType = 'subcorpus-info';
                                self.isWaiting = false;
                                self.notifyChangeListeners();
                            },
                            (err) => {
                                self.isWaiting = false;
                                self.pluginApi.showMessage('error', err);
                            }
                        )
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