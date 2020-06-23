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

import { Observable, Subscription, timer as rxTimer, of as rxOf, empty as rxEmpty } from 'rxjs';
import { take, concatMap } from 'rxjs/operators';
import {Kontext} from '../../types/common';
import { StatelessModel, StatefulModel, IActionDispatcher, Action, SEDispatcher, IFullActionControl } from 'kombo';
import {IPluginApi} from '../../types/plugins';
import * as Immutable from 'immutable';
import { Ident } from 'cnc-tskit';


export interface MessageModelState {
    messages:Immutable.List<Kontext.UserNotification>;
}


/**
 *
 */
export class MessageModel extends StatelessModel<MessageModelState> {

    private pluginApi:IPluginApi;

    private autoRemoveMessages:boolean;

    private static TIME_TICK = 50;

    private static TIME_FADEOUT = 300;

    private timerSubsc:Subscription;

    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, autoRemoveMessages:boolean) {
        super(
            dispatcher,
            {messages: Immutable.List<Kontext.UserNotification>()}
        );
        this.pluginApi = pluginApi;
        this.autoRemoveMessages = autoRemoveMessages;
        this.actionMatch = {
            'MESSAGE_ADD': (state, action) => {
                const newState = this.copyState(state);
                this.addMessage(
                    newState,
                    action.payload['messageType'],
                    action.payload['messageText']
                );
                return newState;
            },
            'MESSAGE_DECREASE_TTL': (state, action) => {
                const newState = this.copyState(state);
                newState.messages = newState.messages.map(msg => {
                    return {
                        messageId: msg.messageId,
                        messageType: msg.messageType,
                        messageText: msg.messageText,
                        ttl: msg.ttl -= MessageModel.TIME_TICK,
                        timeFadeout: msg.timeFadeout
                    }
                }).filter(msg => msg.ttl > 0).toList();
                return newState;
            },
            'MESSAGE_CLOSED': (state, action) => {
                const newState = this.copyState(state);
                this.removeMessage(newState, action.payload['messageId']);
                return newState;
            }
        };
    }

    sideEffects(state:MessageModelState, action:Action, dispatch:SEDispatcher):void {
        switch (action.name) {
            case 'MESSAGE_ADD':
                if (this.autoRemoveMessages) {
                    const ticksWait = this.calcMessageTTL(action.payload['messageType']) / MessageModel.TIME_TICK;
                    const ticksFadeOut = MessageModel.TIME_FADEOUT / MessageModel.TIME_TICK;
                    if (this.timerSubsc) {
                        this.timerSubsc.unsubscribe();
                    }
                    const src = rxTimer(0, MessageModel.TIME_TICK).pipe(take(ticksWait + ticksFadeOut));
                    this.timerSubsc = src.subscribe((x) => {
                        dispatch({
                            name: 'MESSAGE_DECREASE_TTL',
                            payload: {}
                        });
                    });
                }
            break;
        }
    }

    private calcMessageTTL(messageType:string):number {
        const baseInterval = this.pluginApi.getConf<number>('messageAutoHideInterval');
        switch (messageType) {
            case 'error':
            case 'mail':
                return 3 * baseInterval;
            case 'warning':
                return 2 * baseInterval;
            case 'info':
            default:
                return baseInterval;
        }
    }

    private addMessage(state:MessageModelState, messageType:string, messageText:string):void {
        state.messages = state.messages.push({
            messageType: messageType,
            messageText: messageText,
            messageId: Ident.puid(),
            ttl: this.calcMessageTTL(messageType),
            timeFadeout: MessageModel.TIME_FADEOUT
        });
    }

    private removeMessage(state:MessageModelState, messageId:string):void {
        const srchIdx = state.messages.findIndex(v => v.messageId === messageId);
        if (srchIdx > -1) {
            const msg = state.messages.get(srchIdx);
            state.messages = state.messages.set(srchIdx,
            {
                messageId: msg.messageId,
                messageType: msg.messageType,
                messageText: msg.messageText,
                ttl: MessageModel.TIME_FADEOUT,
                timeFadeout: MessageModel.TIME_FADEOUT
            });
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
    attrlist:Array<{name:string; size:number}>;
    structlist:Array<{name:string; size:number}>;
    web_url:string;
    citation_info:CitationInfo;
    keywords:Array<{name:string; color:string}>;
}

export interface CorpusInfo extends CorpusInfoResponse {
    type:CorpusInfoType.CORPUS;
}

export interface SubcorpusInfoResponse {
    corpusId:string;
    corpusName:string;
    corpusSize:string; // formatted num
    created:number; // UNIX timestamp
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
export interface CorpusInfoModelState {
    corpusData:CorpusInfoResponse;
    subcorpusData:SubcorpusInfoResponse;
    currentCorpus:string;
    currentSubcorpus:string;
    currentInfoType:CorpusInfoType;
    isWaiting:boolean;
}

export class CorpusInfoModel extends StatefulModel<CorpusInfoModelState> implements Kontext.ICorpusInfoModel {

    pluginApi:IPluginApi;

    constructor(dispatcher:IFullActionControl, pluginApi:IPluginApi) {
        super(
            dispatcher,
            {
                corpusData: null,
                subcorpusData: null,
                currentCorpus: null,
                currentSubcorpus: null,
                currentInfoType: null,
                isWaiting: false
            }
        );
        this.pluginApi = pluginApi;
    }

    onAction(action:Action):void {
        switch (action.name) {
            case 'OVERVIEW_CLOSE':
                this.changeState(state => {state.currentInfoType = null})
                this.emitChange();
            break;
            case 'OVERVIEW_CORPUS_INFO_REQUIRED':
                this.changeState(state => {state.isWaiting = true})
                this.emitChange();
                this.loadCorpusInfo(action.payload['corpusId']).subscribe(
                    null,
                    (err) => {
                        this.changeState(state => {state.isWaiting = false});
                        this.emitChange();
                        this.pluginApi.showMessage('error', err);
                    },
                    () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload['corpusId'];
                            state.currentInfoType = CorpusInfoType.CORPUS;
                            state.isWaiting = false;
                        });
                        this.emitChange();
                    },
                )
            break;
            case 'OVERVIEW_SHOW_CITATION_INFO':
                this.changeState(state => {state.isWaiting = true})
                this.emitChange();
                this.loadCorpusInfo(action.payload['corpusId']).subscribe(
                    null,
                    (err) => {
                        this.changeState(state => {state.isWaiting = false});
                        this.emitChange();
                        this.pluginApi.showMessage('error', err);
                    },
                    () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload['corpusId'];
                            state.currentInfoType = CorpusInfoType.CITATION;
                            state.isWaiting = false;
                        });
                        this.emitChange();
                    },
                )
            break;
            case 'OVERVIEW_SHOW_SUBCORPUS_INFO':
                this.changeState(state => {state.isWaiting = true})
                this.emitChange();
                this.loadSubcorpusInfo(action.payload['corpusId'], action.payload['subcorpusId']).subscribe(
                    null,
                    (err) => {
                        this.changeState(state => {state.isWaiting = false});
                        this.emitChange();
                        this.pluginApi.showMessage('error', err);
                    },
                    () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload['corpusId'];
                            state.currentSubcorpus = action.payload['subcorpusId'];
                            state.currentInfoType = CorpusInfoType.SUBCORPUS;
                            state.isWaiting = false;
                        });
                        this.emitChange();
                    }
                )
            break;
            case 'OVERVIEW_SHOW_KEY_SHORTCUTS':
                this.changeState(state => {state.currentInfoType = CorpusInfoType.KEY_SHORTCUTS})
                this.emitChange();
            break;
        }
    }

    unregister():void {
    }

    private loadCorpusInfo(corpusId:string):Observable<any> {
        if (this.state.corpusData && this.state.currentCorpus === corpusId) {
            return rxOf(this.state.corpusData);

        } else {
            return this.pluginApi.ajax$<CorpusInfoResponse>(
                'GET',
                this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
                {
                    corpname: this.pluginApi.getCorpusIdent().id
                }
            ).pipe(
                concatMap(
                    (data) => {
                        this.changeState(state => {
                            state.corpusData = data;
                            state.currentCorpus = corpusId;
                        })
                        return rxOf(data);
                    }
                )
            );
        }
    }

    private loadSubcorpusInfo(corpusId:string, subcorpusId:string):Observable<any> {

        const prom = corpusId !== this.state.currentCorpus ?
            this.loadCorpusInfo(corpusId) :
            rxOf(this.state.corpusData);

        if (this.state.subcorpusData && this.state.currentSubcorpus === subcorpusId) {
            return prom.pipe(concatMap((_) => rxOf(this.state.subcorpusData)));

        } else {
            return prom.pipe(
                concatMap(
                    (data) => {
                        return this.pluginApi.ajax$<SubcorpusInfoResponse>(
                            'GET',
                            this.pluginApi.createActionUrl('subcorpus/ajax_subcorp_info'),
                            {
                                'corpname': corpusId,
                                'subcname': subcorpusId
                            }
                        ).pipe(
                            concatMap(
                                (data) => {
                                    if (!data.extended_info) {
                                        data.extended_info = {cql: '-'};
                                    }
                                    this.changeState(state => {
                                        state.subcorpusData = data;
                                        state.currentCorpus = corpusId;
                                        state.currentSubcorpus = subcorpusId;
                                    })
                                    return rxEmpty();
                                }
                            )
                        );
                    }
                )
            );
        }
    }

    getCurrentInfoType():CorpusInfoType {
        return this.state.currentInfoType;
    }

    getCurrentInfoData():AnyOverviewInfo {
        switch (this.state.currentInfoType) {
            case CorpusInfoType.CORPUS:
                return {...this.state.corpusData, type:CorpusInfoType.CORPUS};
            case CorpusInfoType.CITATION:
                return {...this.state.corpusData['citation_info'], corpname: this.state.currentCorpus, type:CorpusInfoType.CITATION};
            case CorpusInfoType.SUBCORPUS:
                return {...this.state.subcorpusData, type:CorpusInfoType.SUBCORPUS};
            case CorpusInfoType.KEY_SHORTCUTS:
                return {type:CorpusInfoType.KEY_SHORTCUTS};
            default:
                return null;
        }
    }

    isLoading():boolean {
        return this.state.isWaiting;
    }
}