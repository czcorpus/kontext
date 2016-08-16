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

/// <reference path="../../types/common.d.ts" />
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../../ts/declarations/immutable.d.ts" />
/// <reference path="../../types/plugins/subcmixer.d.ts" />


import util = require('../../util');
import $ = require('jquery');
import {init as viewInit} from './view';
import * as Immutable from 'vendor/immutable';


export enum Operator {
    EQ, NE, LTE, GTE
}

export interface TextTypeAttrAndVal {
    attr: TextTypes.AttributeSelection;
    val: TextTypes.AttributeValue;
}

/**
 *
 */
export class SubcMixerStore extends util.SimplePageStore implements Subcmixer.ISubcMixerStore {

    static DispatchToken:string;

    pluginApi:Kontext.PluginApi;

    textTypesStore:TextTypes.ITextTypesStore;

    constructor(dispatcher:Dispatcher.Dispatcher<any>, pluginApi:Kontext.PluginApi,
            textTypesStore:TextTypes.ITextTypesStore) {
        super(dispatcher);
        const self = this;
        this.pluginApi = pluginApi;
        this.textTypesStore = textTypesStore;
        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                // TODO
            }
        });
    }

    private getSelectedValues():Immutable.List<TextTypeAttrAndVal> {
        return Immutable.List(this.textTypesStore.getAttributes())
            .filter(item => item.hasUserChanges())
            .flatMap(item => item.getValues().map(subItem => {
                return {attr: item, val: subItem};
            }))
            .filter(item => item.val.selected)
            .toList();
    }
}


export function getViews(dispatcher:Dispatcher.Dispatcher<any>,
        mixins:Kontext.ComponentCoreMixins, layoutViews:any,
        subcmixerStore:SubcMixerStore):{[name:string]:any} {
    return viewInit(dispatcher, mixins, layoutViews, subcmixerStore);
}


export function create(pluginApi:Kontext.PluginApi,
        textTypesStore:TextTypes.ITextTypesStore):Subcmixer.ISubcMixerStore {
    return new SubcMixerStore(pluginApi.dispatcher(), pluginApi, textTypesStore);
}
