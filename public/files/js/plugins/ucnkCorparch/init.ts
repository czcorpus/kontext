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

import * as Kontext from '../../types/kontext';
import { CorplistPage } from './corplist';
import * as PluginInterfaces from '../../types/plugins';
import { init as viewInit } from './view';
import { init as overviewViewInit } from '../../views/overview';
import { CorplistTableModel } from './corplist';
import { Plugin as DCPlugin } from '../defaultCorparch/init';
import { CorplistServerData } from '../defaultCorparch/corplist';
import { IPluginApi } from '../../types/plugins/common';

class Plugin extends DCPlugin {

    constructor(pluginApi:IPluginApi) {
        super(pluginApi);
    }

    isActive():boolean {
        return true;
    }

    /**
     *
     */
    initCorplistPageComponents(initialData:CorplistServerData):PluginInterfaces.Corparch.ICorplistPage {
        const overviewViews = overviewViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.pluginApi.getModels().corpusInfoModel
        );
        const initViews = (listModel:CorplistTableModel) => {
            const ans = viewInit({
                dispatcher: this.pluginApi.dispatcher(),
                he: this.pluginApi.getComponentHelpers(),
                CorpusInfoBox: overviewViews.CorpusInfoBox,
                listModel
            });
            return ans;
        }
        return new CorplistPage(this.pluginApi, initialData, initViews);
    }

    /**
     *
     * @param targetAction
     * @param pluginApi
     * @param queryModel
     * @param options
     */
    createWidget(targetAction:string, options:Kontext.GeneralProps):React.ComponentClass {
        return super.createWidget(targetAction, options);
    }
}


const create:PluginInterfaces.Corparch.Factory = (pluginApi) => {
    return new Plugin(pluginApi);
}

export default create;