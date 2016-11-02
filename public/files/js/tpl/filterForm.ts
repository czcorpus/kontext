/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
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

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../types/plugins/abstract.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import documentModule = require('./document');
import queryInput = require('../queryInput');
import queryStorage = require('plugins/queryStorage/init');
import liveAttributes = require('plugins/liveAttributes/init');
import subcMixer = require('plugins/subcmixer/init');
import textTypesStore = require('../stores/textTypes/attrValues');
import RSVP = require('vendor/rsvp');
import {init as ttViewsInit} from 'views/textTypes';
import {init as contextViewsInit} from 'views/query/context';

/**
 * Corpus handling actions are not used here on the "filter" page but
 * the ExtendedApi class needs them anyway.
 */
class CorpusSetupHandler implements Kontext.CorpusSetupHandler {

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void {}

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    private layoutModel:documentModule.PageModel;

    private textTypesStore:textTypesStore.TextTypesStore;

    private extendedApi:Kontext.QueryPagePluginApi;


    constructor(layoutModel:documentModule.PageModel) {
        this.layoutModel = layoutModel;
        this.extendedApi = queryInput.extendedApi(this.layoutModel, this);
    }


    createTTViews():RSVP.Promise<any> {
        let textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesStore = new textTypesStore.TextTypesStore(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData,
                this.layoutModel.getConf<TextTypes.ServerCheckedValues>('CheckedSca')
        );
        let ttViewComponents = ttViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.textTypesStore
        );
        let liveAttrsProm;
        if (this.layoutModel.hasPlugin('live_attributes')) {
            liveAttrsProm = liveAttributes.create(this.extendedApi, this.textTypesStore, textTypesData['bib_attr']);

        } else {
            liveAttrsProm = new RSVP.Promise((fulfill:(v)=>void, reject:(err)=>void) => {
                fulfill(null);
            });
        }
        let ttProm = liveAttrsProm.then(
            (liveAttrsStore:LiveAttributesInit.AttrValueTextInputListener) => {
                if (liveAttrsStore) {
                    this.textTypesStore.setTextInputChangeCallback(liveAttrsStore.getListenerCallback());
                }
                let subcmixerViews;
                if (this.layoutModel.getConf<boolean>('HasSubcmixer')) {
                    const subcmixerStore = subcMixer.create(this.layoutModel.pluginApi(), this.textTypesStore);
                    subcmixerViews = subcMixer.getViews(
                        this.layoutModel.dispatcher,
                        this.layoutModel.exportMixins(),
                        this.layoutModel.layoutViews,
                        subcmixerStore
                    );

                } else {
                    subcmixerViews = {
                        SubcMixer: null,
                        TriggerBtn: null
                    };
                }
                let liveAttrsViews = liveAttributes.getViews(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    subcmixerViews,
                    this.textTypesStore, liveAttrsStore);
                this.layoutModel.renderReactComponent(
                    ttViewComponents.TextTypesPanel,
                    $('#specify-query-metainformation div.contents').get(0),
                    {
                        liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                        liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                        attributes: this.textTypesStore.getAttributes(),
                        alignedCorpora: this.layoutModel.getConf<Array<any>>('availableAlignedCorpora')
                    }
                );
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
        return ttProm.then(
            (v) => {
                let contextViewComponents = contextViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins()
                );
                this.layoutModel.renderReactComponent(
                    contextViewComponents.SpecifyContextForm,
                    $('#specify-context div.contents').get(0),
                    {
                        lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                        posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                        hasLemmaAttr: this.layoutModel.getConf<boolean>('hasLemmaAttr'),
                        wPoSList: this.layoutModel.getConf<any>('Wposlist')
                    }
                );
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}


export function init(conf:Kontext.Conf) {

    let layoutModel = new documentModule.PageModel(conf);
    let queryFormTweaks;
    layoutModel.init().then(() => {
            let corpusSetupHandler = new CorpusSetupHandler(layoutModel);
            let extendedApi = queryInput.extendedApi(layoutModel, corpusSetupHandler);

            queryFormTweaks = new queryInput.QueryFormTweaks(extendedApi,
                    layoutModel.userSettings, $('#mainform').get(0));
            queryFormTweaks.bindQueryFieldsetsEvents();
            queryFormTweaks.bindBeforeSubmitActions($('input.submit'));
            queryFormTweaks.updateToggleableFieldsets();
            queryFormTweaks.textareaSubmitOverride();
            queryFormTweaks.textareaHints();
            queryFormTweaks.initQuerySwitching();
            queryFormTweaks.fixFormSubmit();
            queryFormTweaks.bindQueryHelpers();
            corpusSetupHandler.createTTViews();
            return queryStorage.create(extendedApi);
    }).then(
        (plugin) => {
            queryFormTweaks.bindQueryStorageDetach(plugin.detach.bind(plugin));
            queryFormTweaks.bindQueryStorageReset(plugin.reset.bind(plugin));
            let prom = new RSVP.Promise<Kontext.Plugin>(
                (resolve:(v:any)=>void, reject:(e:any)=>void) => {
                    resolve(plugin);
                }
            );
            return prom;
        },
        (err) => {
            layoutModel.showMessage('error', err);
        }
    );
}
