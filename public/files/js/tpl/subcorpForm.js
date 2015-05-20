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
define(['jquery', 'tpl/document', 'corplist', 'popupbox', 'plugins/liveAttributes'], function (
        $, documentModule, corplistComponent, popupBox, liveAttributes) {
    'use strict';

    var lib = {
        corplistComponent : null,
        layoutModel: null
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
        if (value === 'raw') {
            $('#subc-within-row').css({ display: 'table-row' });
            $('.text-type-params').find('input[type="checkbox"]').attr('disabled', '');
            $('.text-type-params').css('display', 'none');

        } else if (value === 'gui') {
            $('#subc-within-row').css({ display: 'none' });
            $('.text-type-params')
                .css('display', 'inherit')
                .find('input[type="checkbox"]').attr('disabled', null);
        }
    };

    lib.initTreeComponent = function () {
        lib.corplistComponent = corplistComponent.create(
            $('form[action="subcorp"] select[name="corpname"]'),
            lib.layoutModel.pluginApi(),
            {formTarget: 'subcorp_form', submitMethod: 'GET', editable: false}
        );
    };

    lib.initAttributeHints = function () {
        popupBox.bind($('#struct-hint'), function (tooltipBox, finalize) {
            var v;

            v = $('#within-struct-selector').find('option[value="' + $('#within-struct-selector').val() + '"]').attr('title');
            $(tooltipBox.getRootElement()).append('<strong>' + lib.layoutModel.conf.messages.available_attributes + '</strong>: ');
            $(tooltipBox.getRootElement()).append(v);
            finalize();
        }, {width : 'nice'});
    };

    lib.initSubcCreationVariantSwitch = function () {
        $('subc-within-row').css({ display : 'none' });

        $('input.method-select').each(function (i, item) {
            $(item).bind('click', function (event) {
                lib.subcCreationVariantSwitch($(event.target).val());
            });
        });

        lib.subcCreationVariantSwitch($('input[name="method"]:checked').val());
    };

    /**
     * When user changes size from tokens to document counts (or other way around) he loses
     * current unsaved checkbox selection. This forces a dialog box to prevent unwanted action.
     */
    lib.sizeUnitsSafeSwitch = function () {
        $('.text-type-top-bar a').on('click', function (event) {
            var ans = confirm(lib.layoutModel.conf.messages['this_action_resets_current_selection']);

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
        liveAttributes.init(lib.extendedApi, '#live-attrs-update', '#live-attrs-reset',
            '.text-type-params');
    };


    return lib;
});