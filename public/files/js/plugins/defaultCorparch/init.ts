/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

/// <reference path="../../vendor.d.ts/react.d.ts" />
/// <reference path="../../types/plugins.d.ts" />
/// <reference path="../../types/views.d.ts" />
/// <reference path="./corplistView.d.ts" />
/// <reference path="./widgetView.d.ts" />

import {CorplistWidgetStore} from './widget';
import {CorplistPage} from './corplist';
import {init as viewInit} from './corplistView';
import {init as widgetInit} from './widgetView';
import {init as overviewViewInit} from 'views/overview';
import {CorplistFormStore, CorplistTableStore} from './corplist';
import * as common from './common';
import {SearchEngine} from './search';

declare var require:any;
require('./style.less'); // webpack

/**
 *
 * @param pluginApi
 * @returns {CorplistPage}
 */
export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):CorplistPage {
    const overviewViews = overviewViewInit(
        pluginApi.dispatcher(),
        pluginApi.getComponentHelpers(),
        pluginApi.getStores().corpusInfoStore
    );
    const initViews = (formStore:CorplistFormStore, listStore:CorplistTableStore) => {
        const ans:any = viewInit(
            pluginApi.dispatcher(),
            pluginApi.getComponentHelpers(),
            overviewViews.CorpusInfoBox,
            formStore,
            listStore
        );
        return ans;
    }
    return new CorplistPage(pluginApi, initViews);
}

/**
 * Creates a corplist widget which is a box containing two tabs
 *  1) user's favorite items
 *  2) corpus search tool
 *
 * @param selectElm A HTML SELECT element for default (= non JS) corpus selection we want to be replaced by this widget
 * @param pluginApi
 * @param options A configuration for the widget
 */
export function createWidget(targetAction:string, pluginApi:Kontext.PluginApi,
        queryStore:PluginInterfaces.ICorparchStore, querySetupHandler:Kontext.QuerySetupHandler, options:any):React.ComponentClass { // TODO opts type

    const pluginData = pluginApi.getConf<any>('pluginData')['corparch'] || {}; // TODO type
    const favData:Array<common.ServerFavlistItem> = pluginData['favorite'] || [];
    const featData = pluginData['featured'] || [];

    const corporaLabels:Array<[string,string,string]> = pluginApi.getConf<Array<[string,string,string]>>('pluginData')['corparch']['corpora_labels'];

    const searchEngine = new SearchEngine(
        pluginApi,
        10,
        corporaLabels
    );

    const store = new CorplistWidgetStore(
        pluginApi.dispatcher(),
        pluginApi,
        pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
        pluginApi.getConf<boolean>('anonymousUser'),
        querySetupHandler,
        searchEngine,
        favData,
        featData,
        options.itemClickAction
    );
    store.initHandlers();
    return widgetInit(
        pluginApi.dispatcher(),
        pluginApi.getComponentHelpers(),
        store,
        queryStore
    );
    // TODO corplist.getCorpusSwitchAwareObjects().forEach(item => pluginApi.registerSwitchCorpAwareObject(item));
}
