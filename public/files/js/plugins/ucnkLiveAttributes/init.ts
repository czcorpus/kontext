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
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../vendor.d.ts/rsvp.d.ts" />


import textTypesStore = require('../../stores/textTypes/attrValues');
import liveAttrsStore = require('./store');
import * as RSVP from 'vendor/rsvp';
import common = require('./common');
import {init as viewInit} from './view';
import createSubcMixer from 'plugins/subcmixer/init';


export class LiveAttributesPlugin implements PluginInterfaces.ILiveAttributes {

    private pluginApi:Kontext.PluginApi;

    private store:liveAttrsStore.LiveAttrsStore;

    constructor(pluginApi:Kontext.PluginApi, store:liveAttrsStore.LiveAttrsStore) {
        this.pluginApi = pluginApi;
        this.store = store;
    }

    getViews(subcMixerView:React.Component, textTypesStore:Kontext.PageStore):any {// TODO store types
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            subcMixerView,
            textTypesStore,
            this.store
        );
    }

    getAutoCompleteTrigger():(attrName:string, value:string)=>RSVP.Promise<any> {
        return this.store.getAutoCompleteTrigger();
    }

    getTextInputPlaceholder():string {
        return this.store.getTextInputPlaceholder();
    }

    addUpdateListener(fn:()=>void):void {
        this.store.addUpdateListener(fn);
    }

    removeUpdateListener(fn:()=>void):void {
        this.store.removeUpdateListener(fn);
    }

    getAlignedCorpora():Immutable.List<TextTypes.AlignedLanguageItem> {
        return this.store.getAlignedCorpora();
    }

    selectLanguages(languages:Immutable.List<string>, notifyListeners:boolean) {
        this.store.selectLanguages(languages, notifyListeners);
    }

    hasSelectedLanguages():boolean {
        return this.store.hasSelectedLanguages();
    }

    hasSelectionSteps():boolean {
        return this.store.hasSelectionSteps();
    }

    setControlsEnabled(v:boolean):void {
        this.store.setControlsEnabled(v);
    }

    reset():void {
        this.store.reset();
    }

    notifyChangeListeners():void {
        this.store.notifyChangeListeners();
    }
}


/**
 * @param pluginApi KonText plugin-api provider
 * @param textTypesStore
 * @param selectedCorporaProvider a function returning currently selected corpora (including the primary one)
 * @param ttCheckStatusProvider a function returning true if at least one item is checked within text types
 * @param bibAttr an attribute used to identify a bibliographic item (e.g. something like 'doc.id')
 */
export default function create(pluginApi:Kontext.PluginApi, textTypesStore:TextTypes.ITextTypesStore,
        selectedCorporaProvider:()=>Immutable.List<string>,
        ttCheckStatusProvider:()=>boolean, args:PluginInterfaces.ILiveAttrsInitArgs):RSVP.Promise<PluginInterfaces.ILiveAttributes> {
    return new RSVP.Promise((resolve, reject) => {
        try {
            const store = new liveAttrsStore.LiveAttrsStore(
                pluginApi.dispatcher(),
                pluginApi,
                textTypesStore,
                selectedCorporaProvider,
                ttCheckStatusProvider,
                args
            );
            resolve(new LiveAttributesPlugin(pluginApi, store));

        } catch (e) {
            reject(e);
        }
    });
}