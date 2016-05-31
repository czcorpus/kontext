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

/// <reference path="../../../ts/declarations/common.d.ts" />
/// <reference path="../../common/plugins/liveAttributes.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />

/// <amd-dependency path="./view" name="views" />


import textTypesStore = require('../../stores/textTypes');
import liveAttrsStore = require('./store');
import RSVP = require('vendor/rsvp');
import common = require('./common');
declare var views:any;



export function getViews(dispatcher:Dispatcher.Dispatcher<any>,
        mixins:Kontext.ComponentCoreMixins, ...stores:any[]):{[name:string]:any} {
    let components = views.init(dispatcher, mixins, stores[0], stores[1]);
    return components;
}


export function create(pluginApi:Kontext.QueryPagePluginApi,
                     textTypesStore:TextTypes.ITextTypesStore, bibAttr:string):RSVP.Promise<Kontext.PageStore> {
    return new RSVP.Promise(function (resolve, reject) {
        try {
            resolve(new liveAttrsStore.LiveAttrsStore(pluginApi, pluginApi.dispatcher(), textTypesStore, bibAttr));

        } catch (e) {
            reject(e);
        }
    });
}