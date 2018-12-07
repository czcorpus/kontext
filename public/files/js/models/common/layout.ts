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
import {StatelessModel, StatefulModel} from '../base';
import {IPluginApi} from '../../types/plugins';
import {ActionDispatcher, Action, SEDispatcher} from '../../app/dispatcher';
import {puid} from '../../util';
import RSVP from 'rsvp';
import * as Immutable from 'immutable';
import * as Rx from '@reactivex/rxjs';


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

    private timerSubsc:Rx.Subscription;

    constructor(dispatcher:ActionDispatcher, pluginApi:IPluginApi, autoRemoveMessages:boolean) {
        super(
            dispatcher,
            {messages: Immutable.List<Kontext.UserNotification>()}
        );
        this.pluginApi = pluginApi;
        this.autoRemoveMessages = autoRemoveMessages;
    }

    reduce(state:MessageModelState, action:Action):MessageModelState {
        let newState;
        switch (action.actionType) {
            case 'MESSAGE_ADD':
                newState = this.copyState(state);
                this.addMessage(
                    newState,
                    action.props['messageType'],
                    action.props['messageText']
                )
            break;
            case 'MESSAGE_DECREASE_TTL':
                newState = this.copyState(state);
                newState.messages = newState.messages.map(msg => {
                    return {
                        messageId: msg.messageId,
                        messageType: msg.messageType,
                        messageText: msg.messageText,
                        ttl: msg.ttl -= MessageModel.TIME_TICK,
                        timeFadeout: msg.timeFadeout
                    }
                }).filter(msg => msg.ttl > 0);
            break;
            case 'MESSAGE_CLOSED':
                newState = this.copyState(state);
                this.removeMessage(newState, action.props['messageId']);
            break;
            default:
                newState = state;
        }
        return newState;
    }

    sideEffects(state:MessageModelState, action:Action, dispatch:SEDispatcher):void {
        switch (action.actionType) {
            case 'MESSAGE_ADD':
                if (this.autoRemoveMessages) {
                    const ticksWait = this.calcMessageTTL(action.props['messageType']) / MessageModel.TIME_TICK;
                    const ticksFadeOut = MessageModel.TIME_FADEOUT / MessageModel.TIME_TICK;
                    if (this.timerSubsc) {
                        this.timerSubsc.unsubscribe();
                    }
                    const src = Rx.Observable.timer(0, MessageModel.TIME_TICK).take(ticksWait + ticksFadeOut);
                    this.timerSubsc = src.subscribe((x) => {
                        dispatch({
                            actionType: 'MESSAGE_DECREASE_TTL',
                            props: {}
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
            messageId: puid(),
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

        this.dispatcher.register((action:Action) => {
            switch (action.actionType) {
                case 'OVERVIEW_CLOSE':
                    this.currentInfoType = null;
                    this.notifyChangeListeners();
                break;
                case 'OVERVIEW_CORPUS_INFO_REQUIRED':
                    this.isWaiting = true;
                    this.notifyChangeListeners();
                    this.loadCorpusInfo(action.props['corpusId']).subscribe(
                        null,
                        (err) => {
                            this.isWaiting = false;
                            this.pluginApi.showMessage('error', err);
                        },
                        () => {
                            this.currentCorpus = action.props['corpusId'];
                            this.currentInfoType = CorpusInfoType.CORPUS;
                            this.isWaiting = false;
                            this.notifyChangeListeners();
                        },
                    )
                    break;
                    case 'OVERVIEW_SHOW_CITATION_INFO':
                        this.isWaiting = true;
                        this.notifyChangeListeners();
                        this.loadCorpusInfo(action.props['corpusId']).subscribe(
                            null,
                            (err) => {
                                this.isWaiting = false;
                                this.pluginApi.showMessage('error', err);
                            },
                            () => {
                                this.currentCorpus = action.props['corpusId'];
                                this.currentInfoType = CorpusInfoType.CITATION;
                                this.isWaiting = false;
                                this.notifyChangeListeners();
                            },
                        );
                    break;
                    case 'OVERVIEW_SHOW_SUBCORPUS_INFO':
                        this.isWaiting = true;
                        this.notifyChangeListeners();
                        this.loadSubcorpusInfo(action.props['corpusId'], action.props['subcorpusId']).subscribe(
                            null,
                            (err) => {
                                this.isWaiting = false;
                                this.pluginApi.showMessage('error', err);
                            },
                            () => {
                                this.currentCorpus = action.props['corpusId'];
                                this.currentSubcorpus = action.props['subcorpusId'];
                                this.currentInfoType = CorpusInfoType.SUBCORPUS;
                                this.isWaiting = false;
                                this.notifyChangeListeners();
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

    private loadCorpusInfo(corpusId:string):Rx.Observable<any> {
        if (this.corpusData && this.currentCorpus === corpusId) {
            return Rx.Observable.of(this.corpusData);

        } else {
            return this.pluginApi.ajax$<CorpusInfoResponse>(
                'GET',
                this.pluginApi.createActionUrl('corpora/ajax_get_corp_details'),
                {
                    corpname: this.pluginApi.getCorpusIdent().id
                }
            ).concatMap(
                (data) => {
                    this.corpusData = data;
                    this.currentCorpus = corpusId;
                    return Rx.Observable.of(data);
                }
            );
        }
    }

    private loadSubcorpusInfo(corpusId:string, subcorpusId:string):Rx.Observable<any> {

        const prom = corpusId !== this.currentCorpus ?
            this.loadCorpusInfo(corpusId) :
            Rx.Observable.of(this.corpusData);

        if (this.subcorpusData && this.currentSubcorpus === subcorpusId) {
            return prom.concatMap((_) => Rx.Observable.of(this.subcorpusData));

        } else {
            return prom.concatMap(
                (data) => {
                    return this.pluginApi.ajax$<SubcorpusInfoResponse>(
                        'GET',
                        this.pluginApi.createActionUrl('subcorpus/ajax_subcorp_info'),
                        {
                            'corpname': corpusId,
                            'subcname': subcorpusId
                        }
                    ).concatMap(
                        (data) => {
                            if (!data.extended_info) {
                                data.extended_info = {cql: '-'};
                            }
                            this.currentSubcorpus = subcorpusId;
                            this.subcorpusData = data;
                            return Rx.Observable.empty();
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