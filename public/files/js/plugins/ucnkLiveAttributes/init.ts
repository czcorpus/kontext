/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { PluginInterfaces, IPluginApi } from '../../types/plugins';
import { TextTypesModel } from '../../models/textTypes/main';
import * as liveAttrsModel from './models';
import { init as viewInit } from './view';
import { List } from 'cnc-tskit';


export class LiveAttributesPlugin implements PluginInterfaces.LiveAttributes.IPlugin {

    private readonly pluginApi:IPluginApi;

    private readonly model:liveAttrsModel.LiveAttrsModel;

    private readonly useAlignedCorpBox:boolean;

    private readonly isEnabled:boolean;

    constructor(pluginApi:IPluginApi, store:liveAttrsModel.LiveAttrsModel, useAlignedCorpBox:boolean, isEnabled:boolean) {
        this.pluginApi = pluginApi;
        this.model = store;
        this.useAlignedCorpBox = useAlignedCorpBox;
        this.isEnabled = isEnabled;
    }

    isActive():boolean {
        return true;
    }

    getViews(subcMixerView:PluginInterfaces.SubcMixer.View, textTypesModel:TextTypesModel):PluginInterfaces.LiveAttributes.Views {
        const views = viewInit({
            dispatcher: this.pluginApi.dispatcher(),
            he: this.pluginApi.getComponentHelpers(),
            SubcmixerComponent: subcMixerView,
            textTypesModel: textTypesModel,
            liveAttrsModel: this.model
        });
        if (!this.useAlignedCorpBox) {
            views.LiveAttrsCustomTT = null;
        }
        return views;
    }

    unregister():void {
        this.model.unregister();
    }

    getRegistrationId():string {
        return this.model.getRegistrationId();
    }

    getTextInputPlaceholder():string {
        if (this.isEnabled) {
            return this.pluginApi.translate('ucnkLA__start_writing_for_suggestions');
        }
        return this.pluginApi.translate('ucnkLA__too_many_values_placeholder');
    }

}


/**
 * @param pluginApi KonText plugin-api provider
 * @param bibAttr an attribute used to identify a bibliographic item (e.g. something like 'doc.id')
 */
const create:PluginInterfaces.LiveAttributes.Factory = (
        pluginApi, isEnabled, controlsAlignedCorpora, args) => {
    const currAligned = pluginApi.getConf<Array<string>>('alignedCorpora') || [];
    const alignedCorpora = List.map(
        item => ({
            value: item.n,
            label: item.label,
            selected: currAligned.indexOf(item.n) > -1,
            locked: !controlsAlignedCorpora
        }),
        args.availableAlignedCorpora
    );

    const store = new liveAttrsModel.LiveAttrsModel(
        pluginApi.dispatcher(),
        pluginApi,
        {
            selectionSteps: [],
            selectionTypes: {},
            lastRemovedStep: null,
            alignedCorpora: alignedCorpora,
            initialAlignedCorpora: alignedCorpora,
            bibliographyAttribute: args.bibAttr,
            bibliographyIds: [],
            manualAlignCorporaMode: args.manualAlignCorporaMode,
            controlsEnabled: args.refineEnabled,
            isBusy: false,
            isTTListMinimized: false,
            isEnabled: isEnabled,
            resetConfirmed: false
        },
        controlsAlignedCorpora
    );

    let numSelectionSteps = 0;
    store.addListener((state) => {
        numSelectionSteps = state.selectionSteps.length;
    })

    // we must capture (= decide whether they should really be passed to the action queue)
    // as we have no control on how the action is triggered in a core KonText component
    // (which we cannot modify as plug-in developers here).

    pluginApi.dispatcher().captureAction(
        'QUERY_INPUT_ADD_ALIGNED_CORPUS',
        _ => numSelectionSteps === 0 || window.confirm(pluginApi.translate('ucnkLA__are_you_sure_to_mod_align_lang'))
    );
    pluginApi.dispatcher().captureAction(
        'QUERY_INPUT_REMOVE_ALIGNED_CORPUS',
        _ => numSelectionSteps === 0 || window.confirm(pluginApi.translate('ucnkLA__are_you_sure_to_mod_align_lang'))
    );

    return new LiveAttributesPlugin(pluginApi, store, !List.empty(alignedCorpora), isEnabled);
}

export default create;