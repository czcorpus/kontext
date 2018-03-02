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

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import RSVP from 'rsvp';
import {QueryStorageModel} from './models';
import {init as viewsInit} from './view';

declare var require:any;
require('./style.less'); // webpack

export class QueryStoragePlugin implements PluginInterfaces.IQueryStorage {

    private pluginApi:IPluginApi;

    private model:QueryStorageModel;

    constructor(pluginApi:IPluginApi, model:QueryStorageModel) {
        this.pluginApi = pluginApi;
        this.model = model;
    }

    getWidgetView():React.ComponentClass {
        return viewsInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.model
        ).QueryStorage;
    }

    getModel():PluginInterfaces.IQueryStorageModel {
        return this.model;
    }

    importData(data:Array<Kontext.QueryHistoryItem>):void {
        this.model.importData(data);
    }

}

export default function create(pluginApi:IPluginApi, offset:number, limit:number, pageSize:number):RSVP.Promise<PluginInterfaces.IQueryStorage> {
    return new RSVP.Promise<PluginInterfaces.IQueryStorage>((resolve:(d:any)=>void, reject:(e:any)=>void) => {
        resolve(new QueryStoragePlugin(pluginApi, new QueryStorageModel(pluginApi, offset, limit, pageSize)));
    });
}
