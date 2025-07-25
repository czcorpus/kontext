/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import * as PluginInterfaces from '../../types/plugins/index.js';
import { TextTypesModel } from '../../models/textTypes/main.js';
import * as liveAttrsModel from './models.js';
import { init as viewInit } from './view.js';
import { List, pipe } from 'cnc-tskit';
import { IPluginApi } from '../../types/plugins/common.js';
import { PluginName } from '../../app/plugin.js';


export class LiveAttributesPlugin implements PluginInterfaces.LiveAttributes.IPlugin {

    private readonly pluginApi:IPluginApi;

    private readonly model:liveAttrsModel.LiveAttrsModel;

    private readonly isEnabled:boolean;

    constructor(
        pluginApi:IPluginApi,
        store:liveAttrsModel.LiveAttrsModel,
        isEnabled:boolean
    ) {
        this.pluginApi = pluginApi;
        this.model = store;
        this.isEnabled = isEnabled;
    }

    isActive():boolean {
        return this.pluginApi.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES);
    }

    getViews(
        subcMixerView:PluginInterfaces.SubcMixer.View,
        textTypesModel:TextTypesModel,
        useAlignedCorpBox:boolean,
    ):PluginInterfaces.LiveAttributes.Views {

        const views = viewInit({
            dispatcher: this.pluginApi.dispatcher(),
            he: this.pluginApi.getComponentHelpers(),
            SubcmixerComponent: subcMixerView,
            textTypesModel: textTypesModel,
            liveAttrsModel: this.model
        });
        if (!useAlignedCorpBox) {
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
        pluginApi,
        isEnabled,
        args
) => {

    const currAligned = pluginApi.getConf<Array<string>>('alignedCorpora') || [];
    const firstCorpus = pluginApi.getCorpusIdent().id;
    // note: for aligned corpora, we have to recalculate individual attr sizes (=> undefined above)
    const alignedCorpora = List.map(
        item => ({
            value: item.n,
            label: item.label,
            selected: currAligned.indexOf(item.n) > -1,
            locked: !args.manualAlignCorporaMode
        }),
        args.availableAlignedCorpora
    );
    const store = new liveAttrsModel.LiveAttrsModel(
        pluginApi.dispatcher(),
        pluginApi,
        {
            structAttrs: pipe(
                args.textTypesData,
                x => x.Blocks[0].Line,
                List.map(x => x.name),
                List.map(n => ({n, selected: n === args.bibLabelAttr}))
            ),
            selectionSteps: [],
            selectionTypes: {},
            lastRemovedStep: null,
            initialCorpusSize: isEnabled ? null : pluginApi.getCorpusIdent().size,
            firstCorpus,
            alignedCorpora,
            initialAlignedCorpora: alignedCorpora,
            bibIdAttr: args.bibIdAttr,
            bibLabelAttr: args.bibLabelAttr,
            bibliographyIds: [],
            manualAlignCorporaMode: args.manualAlignCorporaMode,
            controlsEnabled: args.refineEnabled,
            isBusy: false,
            docSaveIsBusy: false,
            isTTListMinimized: false,
            isEnabled: isEnabled,
            resetConfirmed: false,
            subcorpDefinition: args.subcorpTTStructure,
            documentListWidgetVisible: false,
            documentListSaveFormat: 'csv',
            documentListTotalSize: undefined,
        },
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

    return new LiveAttributesPlugin(pluginApi, store, isEnabled);
}

export default create;