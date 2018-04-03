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
import {CorplistItemUcnk} from './common';
import {CorplistPage} from './corplist';
import {IPluginApi, PluginInterfaces} from '../../types/plugins';
import {init as viewInit} from './view';
import {init as overviewViewInit} from '../../views/overview';
import {CorplistFormModel, CorplistTableModel} from './corplist';
import {Plugin as DCPlugin} from '../defaultCorparch/init';

class Plugin extends DCPlugin {

    constructor(pluginApi:IPluginApi) {
        super(pluginApi);
    }

    /**
     *
     */
    initCorplistPageComponents():PluginInterfaces.Corparch.ICorplistPage {
        const overviewViews = overviewViewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.pluginApi.getModels().corpusInfoModel
        );
        const initViews = (formModel:CorplistFormModel, listModel:CorplistTableModel) => {
            const ans = viewInit({
                dispatcher: this.pluginApi.dispatcher(),
                he: this.pluginApi.getComponentHelpers(),
                CorpusInfoBox: overviewViews.CorpusInfoBox,
                formModel,
                listModel
            });
            return ans;
        }
        return new CorplistPage(this.pluginApi, initViews);
    }

    /**
     *
     * @param targetAction
     * @param pluginApi
     * @param queryModel
     * @param options
     */
    createWidget(targetAction:string, queryModel:PluginInterfaces.Corparch.ICorpSelection,
                options:Kontext.GeneralProps):React.ComponentClass {
        return super.createWidget(targetAction, queryModel, options);
    }
}


const create:PluginInterfaces.Corparch.Factory = (pluginApi) => {
    return new Plugin(pluginApi);
}

export default create;