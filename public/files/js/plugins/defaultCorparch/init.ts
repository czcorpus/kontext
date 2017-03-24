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

/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/typeahead.d.ts" />
/// <reference path="../../../ts/declarations/flux.d.ts" />
/// <reference path="../../types/plugins/abstract.d.ts" />
/// <reference path="../../types/plugins/corparch.d.ts" />
/// <reference path="./view.d.ts" />
/// <reference path="../../types/views.d.ts" />

/// <amd-dependency path="vendor/typeahead" />
/// <amd-dependency path="vendor/bloodhound" name="Bloodhound" />

import * as $ from 'jquery';
import {Corplist} from './widget';
import {CorplistPage} from './corplist';
import {init as viewInit} from './view';
import {init as overviewViewInit} from 'views/overview';
import {CorplistFormStore, CorplistTableStore} from './corplist';

/**
 *
 * @param pluginApi
 * @returns {CorplistPage}
 */
export function initCorplistPageComponents(pluginApi:Kontext.PluginApi):CorplistPage {
    const overviewViews = overviewViewInit(
        pluginApi.dispatcher(),
        pluginApi.exportMixins(),
        pluginApi.getStores().corpusInfoStore,
        pluginApi.getViews().PopupBox
    );
    const initViews = (formStore:CorplistFormStore, listStore:CorplistTableStore) => {
        const ans:any = viewInit(
            pluginApi.dispatcher(),
            pluginApi.exportMixins(),
            pluginApi.getViews(),
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
export function create(
        selectElm:HTMLElement, targetAction:string, pluginApi:Kontext.PluginApi,
        querySetupHandler:Kontext.QuerySetupHandler,
        options:CorparchCommon.Options):CorparchCommon.Widget {

    const corplist:Corplist = new Corplist(
        targetAction,
        $(selectElm).closest('form').get(0),
        pluginApi,
        querySetupHandler,
        options
    );
    corplist.bind(selectElm);
    corplist.getCorpusSwitchAwareObjects().forEach(item => pluginApi.registerSwitchCorpAwareObject(item));
    return corplist;
}
