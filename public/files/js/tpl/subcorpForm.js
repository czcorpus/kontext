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
 * This module contains functionality related directly to the subcorp_form.tmpl template
 */
define(['jquery', 'tpl/document', 'plugins/corparch/init', 'popupbox', 'plugins/liveAttributes/init',
        'plugins/subcmixer/init'], function (
        $, documentModule, corplistComponent, popupBox, liveAttributes, subcMixer) {
    'use strict';

    var lib = {
        corplistComponent : null,
        layoutModel: null
    };

    lib.getConf = function (name) {
        return lib.layoutModel.getConf(name);
    };

    lib.translate = function (msg, values) {
        return lib.layoutModel.translate(msg, values);
    };

    lib.createActionUrl = function (path) {
        return lib.layoutModel.createActionUrl(path);
    };

    lib.createStaticUrl = function (path) {
        return lib.layoutModel.createStaticUrl(path);
    };

    lib.showMessage = function (type, message, callback) {
        return lib.layoutModel.showMessage(type, message, callback);
    };

    /**
     *
     * @param item
     */
    lib.formChangeCorpus = function (item) {
        var formAncestor,
            i,
            srch,
            ancestors = $(item.currentTarget).parents();

        for (i = 0; i < ancestors.length; i += 1) {
            if (ancestors[i].nodeName === 'FORM') {
                formAncestor = ancestors[i];
                break;
            }
        }
        if (formAncestor !== undefined) {
            srch = $(formAncestor).find('*[name="reload"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '1');
            }
            srch = $(formAncestor).find('*[name="usesubcorp"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '');
            }
            formAncestor.submit();
        }
    };

    /**
     *
     */
    lib.subcCreationVariantSwitch = function (value) {
        var widgetMap = {
            'raw': '#subc-within-row',
            'gui': '.text-type-params',
            'mixer': '#subc-mixer-row'
        };
        var jqSubmitBtn = $('#subcorp-form').find('input[type=submit]');
        (function () {
            var p;
            for (p in widgetMap) {
                if (widgetMap.hasOwnProperty(p)) {
                    $(widgetMap[p]).hide();
                }
            }
        }());
        if (value === 'raw') {
            $('#subc-within-row').show();
            $('.text-type-params').find('input[type="checkbox"]').attr('disabled', '');
            jqSubmitBtn.show();


        } else if (value === 'gui') {
            $('.text-type-params')
                .show()
                .find('input[type="checkbox"]').attr('disabled', null);
            jqSubmitBtn.show();

        } else if (value === 'mixer') {
            $(widgetMap['mixer']).show();
            jqSubmitBtn.hide(); // subcmixer uses its own button (nested React component); not sure about this
            subcMixer.create($(widgetMap['mixer']).find('.widget').get(0), lib.layoutModel.pluginApi());
        }
    };

    lib.initTreeComponent = function () {
        var subcForm = $('#subcorp-form');
        lib.corplistComponent = corplistComponent.create(
            subcForm.find('select[name="corpname"]').get(0),
            lib,
            {formTarget: 'subcorp_form', submitMethod: 'GET', editable: false}
        );
    };

    lib.initAttributeHints = function () {
        popupBox.bind($('#struct-hint'), function (tooltipBox, finalize) {
            var v;

            v = $('#within-struct-selector').find('option[value="' + $('#within-struct-selector').val() + '"]').attr('title');
            $(tooltipBox.getRootElement()).append('<strong>' + lib.layoutModel.translate('global__available_attributes')
                                                    + '</strong>: ');
            $(tooltipBox.getRootElement()).append(v);
            finalize();
        }, {width : 'nice'});
    };

    lib.initSubcCreationVariantSwitch = function () {
        $('input.method-select').on('click', function (event) {
            lib.subcCreationVariantSwitch($(event.target).val());
        });
        lib.subcCreationVariantSwitch($('input[name="method"]:checked').val());
    };

    /**
     * When user changes size from tokens to document counts (or other way around) he loses
     * current unsaved checkbox selection. This forces a dialog box to prevent unwanted action.
     */
    lib.sizeUnitsSafeSwitch = function () {
        $('.text-type-top-bar a').on('click', function (event) {
            var ans = confirm(lib.layoutModel.translate('global__this_action_resets_current_selection'));

            if (!ans) {
                event.preventDefault();
                event.stopPropagation(); // in case some other actions are bound
            }
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();

        var ExtendedApi = function () {
            this.queryFieldsetToggleEvents = [];
        };

        ExtendedApi.prototype = lib.layoutModel.pluginApi();

        ExtendedApi.prototype.bindFieldsetToggleEvent = function (fn) {
            this.queryFieldsetToggleEvents.push(fn);
        };

        lib.extendedApi = new ExtendedApi();

        lib.initTreeComponent();
        lib.initSubcCreationVariantSwitch();
        lib.initAttributeHints();
        lib.sizeUnitsSafeSwitch();
        liveAttributes.init(lib.extendedApi, conf, '#live-attrs-update',
                '#live-attrs-reset', '.text-type-params');
    };


    return lib;
});