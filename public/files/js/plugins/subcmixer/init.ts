/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as PluginInterfaces from '../../types/plugins/index.js';
import { init as viewInit } from './view.js';
import { SubcMixerModel } from './model.js';
import * as Kontext from '../../types/kontext.js';
import { IPluginApi } from '../../types/plugins/common.js';
import { Ident } from 'cnc-tskit';


class SubcmixerPlugin implements PluginInterfaces.SubcMixer.IPlugin {

    pluginApi:IPluginApi;

    private model:SubcMixerModel;

    constructor(pluginApi:IPluginApi, model:SubcMixerModel) {
        this.pluginApi = pluginApi;
        this.model = model;
    }

    isActive():boolean {
        return true;
    }

    getWidgetView():PluginInterfaces.SubcMixer.View {
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.model,
            Ident.puid()
        );
    }

}


const create:PluginInterfaces.SubcMixer.Factory = (pluginApi, ttSelections, corpusIdAttr) => {

    const WARNING_SIZE_ERROR_RATIO = 0.01;

    const model = new SubcMixerModel(
        pluginApi.dispatcher(),
        pluginApi,
        {
            ttAttributes: [],
            ttInitialAvailableValues: ttSelections,
            subcname: Kontext.newFormValue('', true),
            description: Kontext.newFormValue('', false),
            otherValidationError: null,
            subcIsPublic: false,
            shares: [],
            alignedCorpora: [],
            corpusIdAttr: corpusIdAttr,
            currentResult: null,
            ratioLimit: WARNING_SIZE_ERROR_RATIO,
            isBusy: false,
            isVisible: false,
            numOfErrors: 0,
            liveattrsSelections: {}
        }
    );
    return new SubcmixerPlugin(pluginApi, model);
}

export default create;
