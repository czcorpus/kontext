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

import {Kontext} from '../../types/common';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {CorplistWidgetModel} from './widget';
import {CorplistPage} from './corplist';
import {init as viewInit} from './corplistView';
import {init as widgetInit} from './widgetView';
import {init as overviewViewInit} from '../../views/overview';
import {CorplistFormModel, CorplistTableModel} from './corplist';
import * as common from './common';
import {SearchEngine} from './search';

declare var require:any;
require('./style.less'); // webpack

/**
 *
 * @param pluginApi
 * @returns {CorplistPage}
 */
export function initCorplistPageComponents(pluginApi:IPluginApi):CorplistPage {
    const overviewViews = overviewViewInit(
        pluginApi.dispatcher(),
        pluginApi.getComponentHelpers(),
        pluginApi.getModels().corpusInfoModel
    );
    const initViews = (formModel:CorplistFormModel, listModel:CorplistTableModel) => {
        const ans:any = viewInit({
            dispatcher: pluginApi.dispatcher(),
            he: pluginApi.getComponentHelpers(),
            CorpusInfoBox: overviewViews.CorpusInfoBox,
            formModel: formModel,
            listModel: listModel
        });
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
export function createWidget(targetAction:string, pluginApi:IPluginApi,
        corpSel:PluginInterfaces.Corparch.ICorpSelection, options:any):React.ComponentClass { // TODO opts type

    const pluginData = pluginApi.getConf<any>('pluginData')['corparch'] || {}; // TODO type
    const favData:Array<common.ServerFavlistItem> = pluginData['favorite'] || [];
    const featData = pluginData['featured'] || [];

    const corporaLabels:Array<[string,string,string]> = pluginApi.getConf<Array<[string,string,string]>>('pluginData')['corparch']['corpora_labels'];

    const searchEngine = new SearchEngine(
        pluginApi,
        10,
        corporaLabels
    );

    const model = new CorplistWidgetModel(
        pluginApi.dispatcher(),
        pluginApi,
        pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
        corpSel,
        pluginApi.getConf<boolean>('anonymousUser'),
        searchEngine,
        favData,
        featData,
        options.itemClickAction
    );
    model.initHandlers();
    return widgetInit({
        dispatcher: pluginApi.dispatcher(),
        util: pluginApi.getComponentHelpers(),
        widgetModel: model,
        corpusSelection: corpSel
    });
    // TODO corplist.getCorpusSwitchAwareObjects().forEach(item => pluginApi.registerSwitchCorpAwareObject(item));
}
