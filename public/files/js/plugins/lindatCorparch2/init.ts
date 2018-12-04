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
import {CorplistPage, CorplistDataResponse, CorplistServerData, CorplistTableModelState} from './corplist';
import {init as viewInit} from './corplistView';
import {init as widgetInit} from './widgetView';
import {init as overviewViewInit} from '../../views/overview';
import {CorplistTableModel} from './corplist';
import * as common from './common';
import {SearchEngine} from './search';

declare var require:any;
require('./style.less'); // webpack


export class Plugin {

    protected pluginApi:IPluginApi;

    constructor(pluginApi:IPluginApi) {
        this.pluginApi = pluginApi;
    }

    /**
     * Creates a corplist widget which is a box containing two tabs
     *  1) user's favorite items
     *  2) corpus search tool
     *
     * @param selectElm A HTML SELECT element for default (= non JS) corpus selection we want to be replaced by this widget
     * @param options A configuration for the widget
     */
    createWidget(targetAction:string, corpSel:PluginInterfaces.Corparch.ICorpSelection,
                options:Kontext.GeneralProps):React.ComponentClass<{}> { // TODO opts type

        const pluginData = this.pluginApi.getConf<any>('pluginData')['corparch'] || {}; // TODO type
        const favData:Array<common.ServerFavlistItem> = pluginData['favorite'] || [];
        const featData = pluginData['featured'] || [];

        const corporaLabels:Array<[string,string,string]> = this.pluginApi.getConf<Array<[string,string,string]>>('pluginData')['corparch']['corpora_labels'];

        const searchEngine = new SearchEngine(
            this.pluginApi,
            10,
        );

        const model = new CorplistWidgetModel({
            dispatcher: this.pluginApi.dispatcher(),
            pluginApi: this.pluginApi,
            corpusIdent: this.pluginApi.getConf<Kontext.FullCorpusIdent>('corpusIdent'),
            corpSelection: corpSel,
            anonymousUser: this.pluginApi.getConf<boolean>('anonymousUser'),
            searchEngine: searchEngine,
            dataFav: favData,
            dataFeat: featData,
            onItemClick: options.itemClickAction,
            corporaLabels: corporaLabels
        });
        this.pluginApi.registerSwitchCorpAwareObject(model);
        return widgetInit({
            dispatcher: this.pluginApi.dispatcher(),
            util: this.pluginApi.getComponentHelpers(),
            widgetModel: model,
            corpusSelection: corpSel
        });
        // TODO corplist.getCorpusSwitchAwareObjects().forEach(item => pluginApi.registerSwitchCorpAwareObject(item));
    }


    /**
     *
     * @param pluginApi
     * @returns {CorplistPage}
     */
    initCorplistPageComponents(initialData:CorplistServerData):PluginInterfaces.Corparch.ICorplistPage {
        const overviewViews = overviewViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.pluginApi.getModels().corpusInfoModel
        );
        const initViews = (listModel:CorplistTableModel) => {
            const ans:any = viewInit({
                dispatcher: this.pluginApi.dispatcher(),
                he: this.pluginApi.getComponentHelpers(),
                CorpusInfoBox: overviewViews.CorpusInfoBox,
                listModel: listModel
            });
            return ans;
        }
        return new CorplistPage(this.pluginApi, initialData, initViews);
    }
}


const create:PluginInterfaces.Corparch.Factory = (pluginApi) => {
    return new Plugin(pluginApi);
}

export default create;

