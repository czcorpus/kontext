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


/// <reference path="../../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../types/ajaxResponses.d.ts" />


import {SimplePageStore} from '../../stores/base';
import * as Immutable from 'vendor/immutable';


export class QueryStorageStore extends SimplePageStore {

    static DispatchToken:string;

    private pluginApi:Kontext.PluginApi;

    private data:Immutable.List<AjaxResponse.QueryHistoryItem>;

    constructor(pluginApi:Kontext.PluginApi) {
        super(pluginApi.dispatcher());
        const self = this;
        this.pluginApi = pluginApi;
        this.data = Immutable.List<AjaxResponse.QueryHistoryItem>();

        QueryStorageStore.DispatchToken = this.dispatcher.register(
            function (payload:Kontext.DispatcherPayload) {
                switch (payload.actionType) {
                    case 'QUERY_STORAGE_LOAD_HISTORY':
                        self.loadData().then(
                            () => {
                                self.notifyChangeListeners();
                            },
                            (err) => {
                                self.pluginApi.showMessage('error', err);
                            }
                        )
                    break;
                }
            }
        );
    }

    private loadData():RSVP.Promise<any> {
        return this.pluginApi.ajax(
            'GET',
            this.pluginApi.createActionUrl('user/ajax_query_history'),
            {corpname: this.pluginApi.getConf('corpname')},
            {contentType : 'application/x-www-form-urlencoded'}

        ).then(
            (data:AjaxResponse.QueryHistory) => {
                if (data.contains_errors) {
                    throw new Error(data.messages[0]);

                } else {
                    this.data = Immutable.List<AjaxResponse.QueryHistoryItem>(data.data);
                }
            }
        );
    }

    getData():Immutable.List<AjaxResponse.QueryHistoryItem> {
        return this.data;
    }

}