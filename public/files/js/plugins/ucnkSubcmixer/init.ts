/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
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
import * as Immutable from 'immutable';
import {PluginInterfaces, IPluginApi} from '../../types/plugins';
import {init as viewInit} from './view';
import { SubcMixerModel, SubcMixerExpression } from './model';
import { Kontext } from '../../types/common';

declare var require:any;
require('./style.less'); // webpack


class SubcmixerPlugin implements PluginInterfaces.SubcMixer.IPlugin {

    pluginApi:IPluginApi

    private model:SubcMixerModel;

    constructor(pluginApi:IPluginApi, model:SubcMixerModel) {
        this.pluginApi = pluginApi;
        this.model = model;
    }

    getWidgetView():React.ComponentClass {
        return viewInit(
            this.pluginApi.dispatcher(),
            this.pluginApi.getComponentHelpers(),
            this.model
        );
    }

}


const create:PluginInterfaces.SubcMixer.Factory = (pluginApi, textTypesModel, subcorpFormModel, corpusIdAttr) => {

    const WARNING_SIZE_ERROR_RATIO = 0.01;

    const model = new SubcMixerModel(
        pluginApi.dispatcher(),
        pluginApi,
        {
            ttAttributes: textTypesModel.getAttributes(),
            ttInitialAvailableValues: textTypesModel.getInitialAvailableValues(),
            currentSubcname: Kontext.newFormValue('', true),
            shares: Immutable.List<SubcMixerExpression>(),
            alignedCorpora: Immutable.List<string>(),
            corpusIdAttr: corpusIdAttr,
            currentResult: null,
            ratioLimit: WARNING_SIZE_ERROR_RATIO,
            isBusy: false,
            isVisible: false,
            numOfErrors: 0,
            subcIsPublic: false,
            subcDescription: Kontext.newFormValue('', false),
            liveattrsSelections:Immutable.Map<string, Immutable.List<string>>()
        }
    );
    return new SubcmixerPlugin(pluginApi, model);
}

export default create;
