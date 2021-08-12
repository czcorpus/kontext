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
import { Ident, List, pipe, HTTP } from 'cnc-tskit';
import { AjaxError } from 'rxjs/ajax';
import { StatelessModel, StatefulModel, IActionDispatcher, IFullActionControl } from 'kombo';

import * as Kontext from '../../types/kontext';
import { Actions } from './actions';
import { IPluginApi } from '../../types/plugins/common';


export interface MessageModelState {
    messages:Array<Kontext.UserNotification>;
    isDebug:boolean;
}


/**
 *
 */
export class MessageModel extends StatelessModel<MessageModelState> {

    private readonly pluginApi:IPluginApi;

    private autoRemoveMessages:boolean;

    private static TIME_TICK = 50;

    private static TIME_FADEOUT = 300;

    private timerSubsc:Subscription;

    constructor(dispatcher:IActionDispatcher, pluginApi:IPluginApi, autoRemoveMessages:boolean) {
        super(
            dispatcher,
            {
                messages: [],
                isDebug: pluginApi.getConf<boolean>('isDebug')
            }
        );
        this.pluginApi = pluginApi;
        this.autoRemoveMessages = autoRemoveMessages;

        this.addActionHandler<typeof Actions.MessageAdd>(
            Actions.MessageAdd.name,
            (state, action) => {
                this.addMessage(
                    state,
                    action.payload.messageType,
                    action.payload.message
                );
            },
            (state, action, dispatch) => {
                if (this.autoRemoveMessages) {
                    const ticksWait = this.calcMessageTTL(action.payload.messageType) /
                        MessageModel.TIME_TICK;
                    const ticksFadeOut = MessageModel.TIME_FADEOUT / MessageModel.TIME_TICK;
                    if (this.timerSubsc) {
                        this.timerSubsc.unsubscribe();
                    }
                    const src = rxTimer(0, MessageModel.TIME_TICK).pipe(
                        take(ticksWait + ticksFadeOut)
                    );
                    this.timerSubsc = src.subscribe((x) => {
                        dispatch<typeof Actions.MessageDecreaseTTL>({
                            name: Actions.MessageDecreaseTTL.name
                        });
                    });
                }
            }
        );

        this.addActionHandler<typeof Actions.MessageDecreaseTTL>(
            Actions.MessageDecreaseTTL.name,
            (state, action) => {
                state.messages = pipe(
                    state.messages,
                    List.map(
                        msg => ({
                            ...msg,
                            ttl: msg.ttl -= MessageModel.TIME_TICK,
                        })
                    ),
                    List.filter(msg => msg.ttl > 0)
                )
            }
        );

        this.addActionHandler<typeof Actions.MessageClose>(
            Actions.MessageClose.name,
            (state, action) => {
                this.removeMessage(state, action.payload.messageId);
            }
        );
    }

    private importMessage(
        state:MessageModelState,
        msgType:Kontext.UserMessageTypes,
        message:any
    ):string {
        const fetchJsonError = (message:XMLHttpRequest) => {
            const respObj = message.response || {};
            if (respObj['error_code']) {
                return this.pluginApi.translate(respObj['error_code'], respObj['error_args'] || {});

            } else if (respObj['messages']) {
                return respObj['messages'].join(', ');

            } else {
                return `${message.status}: ${message.statusText}`;
            }
        };

        let outMsg:string;
        if (msgType === 'error') {
            if (state.isDebug) {
                console.error(message);
            }

            if (message instanceof XMLHttpRequest) {
                switch (message.responseType) {
                    case 'json': {
                        outMsg = fetchJsonError(message);
                    }
                    break;
                    case 'text':
                    case '':
                        outMsg = `${message.status}: ${message.statusText} (${(
                            message.responseText).substr(0, 100)}...)`;
                    break;
                    default:
                        outMsg = `${message.status}: ${message.statusText}`
                    break;
                }

            } else if (message instanceof AjaxError) {
                if (message.response && Array.isArray(message.response['messages'])) {
                    outMsg = message.response['messages'][0][1];

                } else {
                    outMsg = message.message;
                }

            } else if (message instanceof Error) {
                outMsg = message.message || this.pluginApi.translate('global__unknown_error');

            } else {
                outMsg = `${message}`;
            }

        } else {
            outMsg = `${message}`;
        }
        return outMsg;
    }

    private calcMessageTTL(messageType:Kontext.UserMessageTypes):number {
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

    private addMessage(
        state:MessageModelState,
        messageType:Kontext.UserMessageTypes,
        message:any
    ):void {
        state.messages.push({
            messageType,
            messageText: this.importMessage(state, messageType, message),
            messageId: Ident.puid(),
            ttl: this.calcMessageTTL(messageType),
            timeFadeout: MessageModel.TIME_FADEOUT
        });
    }

    private removeMessage(state:MessageModelState, messageId:string):void {
        const srchIdx = state.messages.findIndex(v => v.messageId === messageId);
        if (srchIdx > -1) {
            const msg = state.messages[srchIdx];
            state.messages[srchIdx] = {
                ...msg,
                ttl: MessageModel.TIME_FADEOUT,
                timeFadeout: MessageModel.TIME_FADEOUT
            };
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
    webUrl:string;
    citationInfo:CitationInfo;
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

export class CorpusInfoModel extends StatefulModel<CorpusInfoModelState>
        implements Kontext.ICorpusInfoModel {

    private readonly pluginApi:IPluginApi;

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

        this.addActionHandler<typeof Actions.OverviewClose>(
            Actions.OverviewClose.name,
            action => {
                this.changeState(state => {state.currentInfoType = null})
            }
        );

        this.addActionHandler<typeof Actions.OverviewCorpusInfoRequired>(
            Actions.OverviewCorpusInfoRequired.name,
            action => {
                this.changeState(state => {state.isWaiting = true})
                this.emitChange();
                this.loadCorpusInfo(action.payload.corpusId).subscribe(
                    null,
                    (err) => {
                        this.changeState(state => {state.isWaiting = false});
                        this.pluginApi.showMessage('error', err);
                    },
                    () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload.corpusId;
                            state.currentInfoType = CorpusInfoType.CORPUS;
                            state.isWaiting = false;
                        });
                    },
                )
            }
        );

        this.addActionHandler<typeof Actions.OverviewShowActionCitationInfo>(
            Actions.OverviewShowActionCitationInfo.name,
            action => {
                this.changeState(
                    state => {
                        state.isWaiting = true;
                    }
                );
                this.loadCorpusInfo(action.payload.corpusId).subscribe({
                    error: err => {
                        this.changeState(state => {state.isWaiting = false});
                        this.emitChange();
                        this.pluginApi.showMessage('error', err);
                    },
                    complete: () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload.corpusId;
                            state.currentInfoType = CorpusInfoType.CITATION;
                            state.isWaiting = false;
                        });
                    },
                });
            }
        );

        this.addActionHandler<typeof Actions.OverviewShowSubcorpusInfo>(
            Actions.OverviewShowSubcorpusInfo.name,
            action => {
                this.changeState(state => {state.isWaiting = true})
                this.loadSubcorpusInfo(
                    action.payload.corpusId,
                    action.payload.subcorpusId

                ).subscribe({
                    error: err => {
                        this.changeState(state => {state.isWaiting = false});
                        this.pluginApi.showMessage('error', err);
                    },
                    complete: () => {
                        this.changeState(state => {
                            state.currentCorpus = action.payload.corpusId;
                            state.currentSubcorpus = action.payload.subcorpusId;
                            state.currentInfoType = CorpusInfoType.SUBCORPUS;
                            state.isWaiting = false;
                        });
                    }
                });
            }
        );

        this.addActionHandler<typeof Actions.OverviewShowKeyShortcuts>(
            Actions.OverviewShowKeyShortcuts.name,
            action => {
                this.changeState(state => {
                    state.currentInfoType = CorpusInfoType.KEY_SHORTCUTS
                });
            }
        );
    }

    private loadCorpusInfo(corpusId:string):Observable<any> {
        if (this.state.corpusData && this.state.currentCorpus === corpusId) {
            return rxOf(this.state.corpusData);

        } else {
            return this.pluginApi.ajax$<CorpusInfoResponse>(
                HTTP.Method.GET,
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
                            HTTP.Method.GET,
                            this.pluginApi.createActionUrl('subcorpus/subcorpus_info'),
                            {
                                'corpname': corpusId,
                                'usesubcorp': subcorpusId
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
                return {
                    ...this.state.corpusData.citationInfo,
                    corpname: this.state.currentCorpus,
                    type: CorpusInfoType.CITATION
                };
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