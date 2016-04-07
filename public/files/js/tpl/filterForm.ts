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

import documentModule = require('./document');
import queryInput = require('../queryInput');
import queryStorage = require('plugins/queryStorage/init');
import liveAttributes = require('plugins/liveAttributes/init');
import initActions = require('../initActions');


/**
 * Corpus handling actions are not used here on the "filter" page but
 * the ExtendedApi class needs them anyway.
 */
class CorpusSetupHandler implements Kontext.CorpusSetupHandler {

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void {}

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}
}

/**
 * This module contains functionality related directly to the filter_form.tmpl template
 *
 */
export function init(conf:Kontext.Conf) {

    let layoutModel = new documentModule.PageModel(conf);
    let promises:initActions.InitActions = layoutModel.init();
    let corpusSetupHandler = new CorpusSetupHandler();
    let extendedApi = queryInput.extendedApi(layoutModel, corpusSetupHandler);


    let queryFormTweaks = new queryInput.QueryFormTweaks(extendedApi,
            layoutModel.userSettings, $('#mainform').get(0));

    promises.add({
        bindQueryFieldsetsEvents : queryFormTweaks.bindQueryFieldsetsEvents(),
        bindBeforeSubmitActions : queryFormTweaks.bindBeforeSubmitActions($('input.submit')),
        updateToggleableFieldsets : queryFormTweaks.updateToggleableFieldsets(),
        liveAttributesInit : liveAttributes.create(extendedApi, conf,
                window.document.getElementById('live-attrs-update'),
                window.document.getElementById('live-attrs-reset'),
                $('.text-type-params').get(0)),
        textareaSubmitOverride : queryFormTweaks.textareaSubmitOverride(),
        textareaHints : queryFormTweaks.textareaHints(),
        initQuerySwitching : queryFormTweaks.initQuerySwitching(),
        fixFormSubmit : queryFormTweaks.fixFormSubmit(),
        bindQueryHelpers: queryFormTweaks.bindQueryHelpers(),
        queryStorage : queryStorage.create(extendedApi)
    });

    layoutModel.registerPlugin('queryStorage', promises.get<Kontext.Plugin>('queryStorage'));
}
