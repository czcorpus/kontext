/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as RSVP from 'vendor/rsvp';
import {QueryStorageStore} from './stores';
import {init as viewsInit} from './view';

export class QueryStoragePlugin implements PluginInterfaces.IQueryStorage {

    private pluginApi:Kontext.PluginApi;

    private store:QueryStorageStore;

    constructor(pluginApi:Kontext.PluginApi, store:QueryStorageStore) {
        this.pluginApi = pluginApi;
        this.store = store;
    }

    getWidgetView():React.ReactClass {
        return viewsInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.store
        ).QueryStorage;
    }

    getStore():PluginInterfaces.IQueryStorageStore {
        return this.store;
    }

    importData(data:Array<Kontext.QueryHistoryItem>):void {
        this.store.importData(data);
    }

}

export default function create(pluginApi:Kontext.PluginApi, offset:number, limit:number, pageSize:number):RSVP.Promise<PluginInterfaces.IQueryStorage> {
    return new RSVP.Promise<PluginInterfaces.IQueryStorage>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
        resolve(new QueryStoragePlugin(pluginApi, new QueryStorageStore(pluginApi, offset, limit, pageSize)));
    });
}
