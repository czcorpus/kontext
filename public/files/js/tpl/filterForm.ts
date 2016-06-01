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

/// <reference path="../../ts/declarations/common.d.ts" />
/// <reference path="../../ts/declarations/abstract-plugins.d.ts" />

/// <amd-dependency path="../views/textTypes" name="ttViews" />
/// <amd-dependency path="../views/query/context" name="contextViews" />

import documentModule = require('./document');
import queryInput = require('../queryInput');
import queryStorage = require('plugins/queryStorage/init');
import liveAttributes = require('plugins/liveAttributes/init');
import initActions = require('../initActions');
import textTypesStore = require('../stores/textTypes');

declare var ttViews:any;
declare var contextViews:any;

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
        this.textTypesStore = new textTypesStore.TextTypesStore(this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(), textTypesData);
        let ttViewComponents = ttViews.init(
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
                let liveAttrsViews = liveAttributes.getViews(this.layoutModel.dispatcher,
                        this.layoutModel.exportMixins(), this.textTypesStore, liveAttrsStore);
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
                let contextViewComponents = contextViews.init(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins()
                );
                this.layoutModel.renderReactComponent(
                    contextViewComponents.SpecifyKontextForm,
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

/**
 * This module contains functionality related directly to the filter_form.tmpl template
 *
 */
export function init(conf:Kontext.Conf) {

    let layoutModel = new documentModule.PageModel(conf);
    let promises:initActions.InitActions = layoutModel.init();
    let corpusSetupHandler = new CorpusSetupHandler(layoutModel);
    let extendedApi = queryInput.extendedApi(layoutModel, corpusSetupHandler);


    let queryFormTweaks = new queryInput.QueryFormTweaks(extendedApi,
            layoutModel.userSettings, $('#mainform').get(0));

    promises.add({
        bindQueryFieldsetsEvents : queryFormTweaks.bindQueryFieldsetsEvents(),
        bindBeforeSubmitActions : queryFormTweaks.bindBeforeSubmitActions($('input.submit')),
        updateToggleableFieldsets : queryFormTweaks.updateToggleableFieldsets(),
        textareaSubmitOverride : queryFormTweaks.textareaSubmitOverride(),
        textareaHints : queryFormTweaks.textareaHints(),
        initQuerySwitching : queryFormTweaks.initQuerySwitching(),
        fixFormSubmit : queryFormTweaks.fixFormSubmit(),
        bindQueryHelpers: queryFormTweaks.bindQueryHelpers(),
        queryStorage : queryStorage.create(extendedApi),
        ttViews: corpusSetupHandler.createTTViews()
    });

    layoutModel.registerPlugin('queryStorage', promises.get<Kontext.Plugin>('queryStorage'));
}
