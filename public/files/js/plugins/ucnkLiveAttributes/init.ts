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

import {TextTypes} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {TextTypesModel} from '../../models/textTypes/main';
import liveAttrsModel = require('./models');
import RSVP from 'rsvp';
import * as Immutable from 'immutable';
import {init as viewInit, Views} from './view';

declare var require:any;
require('./style.less'); // webpack


export class LiveAttributesPlugin implements PluginInterfaces.LiveAttributes.IPlugin {

    private pluginApi:IPluginApi;

    private store:liveAttrsModel.LiveAttrsModel;

    constructor(pluginApi:IPluginApi, store:liveAttrsModel.LiveAttrsModel) {
        this.pluginApi = pluginApi;
        this.store = store;
    }

    getViews(subcMixerView:PluginInterfaces.SubcMixer.View, textTypesModel:TextTypesModel):Views {
        const views = viewInit({
            dispatcher: this.pluginApi.dispatcher(),
            he: this.pluginApi.getComponentHelpers(),
            SubcmixerComponent: subcMixerView,
            textTypesModel: textTypesModel,
            liveAttrsModel: this.store
        });
        if (!this.store.hasAvailableAlignedCorpora()) {
            views.LiveAttrsCustomTT = null;
        }
        return views;
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

    emitChange():void {
        this.store.emitChange();
    }
}


/**
 * @param pluginApi KonText plugin-api provider
 * @param textTypesModel
 * @param selectedCorporaProvider a function returning currently selected corpora (including the primary one)
 * @param ttCheckStatusProvider a function returning true if at least one item is checked within text types
 * @param bibAttr an attribute used to identify a bibliographic item (e.g. something like 'doc.id')
 */
const create:PluginInterfaces.LiveAttributes.Factory = (
        pluginApi, textTypesModel, isEnabled, selectedCorporaProvider, ttCheckStatusProvider, args) => {

    const store = new liveAttrsModel.LiveAttrsModel(
        pluginApi.dispatcher(),
        pluginApi,
        textTypesModel,
        isEnabled,
        selectedCorporaProvider,
        ttCheckStatusProvider,
        args
    );
    return new LiveAttributesPlugin(pluginApi, store);
}

export default create;