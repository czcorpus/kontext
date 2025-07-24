/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { Subscription, timer as rxTimer } from 'rxjs';
import { take } from 'rxjs/operators';
import { Ident, List, pipe } from 'cnc-tskit';
import { AjaxError } from 'rxjs/ajax';
import { StatelessModel, IActionDispatcher } from 'kombo';

import * as Kontext from '../../types/kontext.js';
import { Actions } from './actions.js';
import { IPluginApi } from '../../types/plugins/common.js';


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

    private importMessages(
        state:MessageModelState,
        msgType:Kontext.UserMessageTypes,
        message:unknown
    ):Array<string> {
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

        const outMsg:Array<string> = [];
        if (msgType === 'error') {
            if (state.isDebug) {
                console.error(message);
            }

            if (message instanceof XMLHttpRequest) {
                switch (message.responseType) {
                    case 'json': {
                        outMsg.push(fetchJsonError(message));
                    }
                    break;
                    case 'text':
                    case '':
                        outMsg.push(`${message.status}: ${message.statusText} (${(
                            message.responseText).substr(0, 100)}...)`);
                    break;
                    default:
                        outMsg.push(`${message.status}: ${message.statusText}`);
                    break;
                }

            } else if (message instanceof AjaxError) {
                if (message.response && Array.isArray(message.response['messages'])) {
                    List.forEach(
                        msg => {
                            outMsg.push(msg[1])
                        },
                        message.response['messages']
                    );

                } else {
                    outMsg.push(message.message);
                }

            } else if (message instanceof Error) {
                outMsg.push(message.message || this.pluginApi.translate('global__unknown_error'));

            } else {
                outMsg.push(`${message}`);
            }

        } else {
            outMsg.push(`${message}`);
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
        message:unknown
    ):void {
        state.messages = pipe(
            this.importMessages(state, messageType, message),
            List.map(
                messageText => ({
                    messageType,
                    messageText,
                    messageId: Ident.puid(),
                    ttl: this.calcMessageTTL(messageType),
                    timeFadeout: MessageModel.TIME_FADEOUT
                })
            ),
            List.concatr(state.messages)
        )
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
