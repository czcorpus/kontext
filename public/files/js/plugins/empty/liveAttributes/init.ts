/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IPluginApi, PluginInterfaces } from '../../../types/plugins';
import { TextTypesModel } from '../../../models/textTypes/main';
import { Actions as GlobalActions } from '../../../models/common/actions';


export class EmptyLiveAttributesPlugin implements PluginInterfaces.LiveAttributes.IPlugin {

    constructor(pluginApi:IPluginApi) {
        pluginApi.dispatcher().registerActionListener((action) => {
            if (action.name === GlobalActions.SwitchCorpus.name) {
                pluginApi.dispatcher().dispatch<typeof GlobalActions.SwitchCorpusReady>({
                    name: GlobalActions.SwitchCorpusReady.name,
                    payload: {
                        modelId: this.getRegistrationId(),
                        data: {}
                    }
                })
            }
        });
    }

    isActive():boolean {
        return false;
    }

    getViews(
        subcMixerView:PluginInterfaces.SubcMixer.View,
        textTypesModel:TextTypesModel
    ):PluginInterfaces.LiveAttributes.Views {

        return {
            LiveAttrsView: null,
            LiveAttrsCustomTT: null
        };
    }

    unregister():void {
    }

    getRegistrationId():string {
        return 'empty-live-attributes';
    }
}


const create:PluginInterfaces.LiveAttributes.Factory = (
    pluginApi,
    isEnabled,
    controlsAlignedCorpora,
    args
) => new EmptyLiveAttributesPlugin(pluginApi);

export default create;