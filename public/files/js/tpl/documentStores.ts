/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/// <reference path="../../ts/declarations/common.d.ts" />

import win = require('win');
import util = require('util');


/**
 *
 */
export class QueryHintStore extends util.SimplePageStore {

    private hints:Array<string>;

    private currentHint:number;

    constructor(dispatcher:Dispatcher.Dispatcher<Kontext.DispatcherPayload>, hints:Array<string>) {
        super(dispatcher);
        var self = this;
        this.hints = hints ? hints : [];
        this.currentHint = this.randomIndex();

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'NEXT_QUERY_HINT':
                    self.setNextHint();
                    self.notifyChangeListeners();
                    break;
            }
        });
    }

    randomIndex():number {
        return Math.round((Math.random() * (this.hints.length - 1)))|0;
    }

    setNextHint():void {
        this.currentHint = (this.currentHint + 1) % this.hints.length;
    }

    getHint():string {
        return this.hints[this.currentHint];
    }

}


/**
 *
 */
export class MessageStore extends util.SimplePageStore implements Kontext.MessagePageStore {

    messages:Array<{messageType:string; messageText:string, messageId:string}>;

    pluginApi:Kontext.PluginApi;

    addMessage(messageType:string, messageText:string) {
        var msgId = String(Math.random()),
            timeout,
            self = this;

        this.messages.push({
            messageType: messageType,
            messageText: messageText,
            messageId: msgId
        });

        if (messageType !== 'error') {
            timeout = win.setTimeout(function () {
                self.removeMessage(msgId);
                win.clearTimeout(timeout);
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
    }

    constructor(pluginApi:Kontext.PluginApi, dispatcher:Dispatcher.Dispatcher<Kontext.DispatcherPayload>) {
        super(dispatcher);
        var self = this;
        this.messages = [];
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
export class CorpusInfoStore extends util.SimplePageStore {

    pluginApi:Kontext.PluginApi;

    data:{[corpusId:string]:any};


    constructor(pluginApi:Kontext.PluginApi, dispatcher:Dispatcher.Dispatcher<Kontext.DispatcherPayload>) {
        super(dispatcher);
        var self = this;
        this.pluginApi = pluginApi;
        this.dispatcher = dispatcher;
        this.data = {};

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'CORPUS_INFO_REQUIRED':
                    if (self.data.hasOwnProperty(payload.props['corpusId'])) {
                        self.notifyChangeListeners();

                    } else {
                        self.loadData(payload.props['corpusId']).then(
                            function (data) {
                                if (!data.error) {
                                    self.data[payload.props['corpusId']] = data;
                                    self.notifyChangeListeners();

                                } else {
                                    self.pluginApi.showMessage('error', data.error);
                                    self.notifyChangeListeners(CorpusInfoStore.ERROR_EVENT, data.error);
                                }
                            },
                            function (jqXHR, textStatus, errorThrown) {
                                self.notifyChangeListeners(CorpusInfoStore.ERROR_EVENT, errorThrown);
                                self.pluginApi.showMessage('error', errorThrown);
                            }
                        );
                    }
                    break;
            }
        });
    }

    getData(corpusId):any {
        return this.data[corpusId];
    }

    loadData(corpusId?:string):JQueryXHR {
        var url = this.pluginApi.createActionUrl('corpora/ajax_get_corp_details');

        if (!corpusId) {
            corpusId = this.pluginApi.getConf('corpname');
        }
        return $.get(url + '?corpname=' + corpusId);
    }
}