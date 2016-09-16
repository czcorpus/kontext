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

/// <reference path="../../types/common.d.ts" />
/// <reference path="./view.d.ts" />
/// <reference path="../../types/plugins/liveAttributes.d.ts" />
/// <reference path="../../types/plugins/subcmixer.d.ts" />
/// <reference path="../../../ts/declarations/rsvp.d.ts" />


import textTypesStore = require('../../stores/textTypes/attrValues');
import liveAttrsStore = require('./store');
import RSVP = require('vendor/rsvp');
import common = require('./common');
import {init as viewInit} from './view';
import {create as createSubcMixer} from 'plugins/subcmixer/init';


export function getViews(
        dispatcher:Dispatcher.Dispatcher<any>,
        mixins:any,
        subcMixerViews:Subcmixer.SubcMixerViews,
        textTypesStore:TextTypes.ITextTypesStore,
        liveAttrsStore:any):LiveAttributesInit.LiveAttrsViews {

    return viewInit(dispatcher, mixins, subcMixerViews, textTypesStore, liveAttrsStore);
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