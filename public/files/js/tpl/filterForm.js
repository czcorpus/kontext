/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 * Copyright (c) 2003-2009  Pavel Rychly
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

/**
 * This module contains functionality related directly to the filter_form.tmpl template
 *
 */
define(['tpl/document', 'queryInput', 'plugins/queryStorage/init', 'plugins/liveAttributes/init'], function (
    documentModule, queryInput, queryStorage, liveAttributes) {
    'use strict';

    var lib = {};
    lib.layoutModel = null;
    lib.extendedApi = null;

    /**
     *
     * @param conf page configuration data
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        lib.extendedApi = queryInput.extendedApi(lib.layoutModel.pluginApi());

        var promises = lib.layoutModel.init(conf).add({
            bindQueryFieldsetsEvents : queryInput.bindQueryFieldsetsEvents(
                lib.extendedApi, lib.layoutModel.userSettings),
            bindBeforeSubmitActions : queryInput.bindBeforeSubmitActions(
                $('#mainform input.submit'), lib.layoutModel),
            updateToggleableFieldsets : queryInput.updateToggleableFieldsets(
                lib.extendedApi, lib.layoutModel.userSettings),
            queryStorage : queryStorage.createInstance(lib.extendedApi),
            liveAttributesInit : liveAttributes.init(lib.extendedApi, '#live-attrs-update', '#live-attrs-reset',
                '.text-type-params')
        });

        lib.layoutModel.registerPlugin('queryStorage', promises.get('queryStorage'));
    };

    return lib;
});