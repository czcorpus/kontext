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

/**
 * This module contains functionality related directly to the saveconc_form.tmpl template
 */
define(['jquery', 'tpl/document'], function ($, documentModule) {
    'use strict';

    var lib = {};

    lib.layoutModel = null;

    /**
     * @param {jquery} jqForm jquery object representing parent form of the radio buttons
     * @param {Element} currentElement
     */
    lib.updateExportTypeSwitch = function (jqForm, currentElement) {
        var jqHeadingInput = $(jqForm).find('input[name="heading"]'),
            jqHeadingRow = jqHeadingInput.closest('tr'),
            jqAlignKwicInput = $(jqForm).find('input[name="align_kwic"]'),
            jqAlignKwicRow = jqAlignKwicInput.closest('tr');

        if ($(currentElement).val() === 'csv') {
            jqHeadingInput.prop('disabled', true);
            jqHeadingRow.hide();
            jqAlignKwicInput.prop('disabled', true);
            jqAlignKwicRow.hide();

        } else {
            jqHeadingInput.prop('disabled', false);
            jqHeadingRow.show();
            jqAlignKwicInput.prop('disabled', false);
            jqAlignKwicRow.show();
        }
    };

    /**
     *
     */
    lib.bindStaticElements = function () {
        var jqForm = $('form[action="saveconc"]');

        jqForm.find('input[name="saveformat"]').on('click', function (event) {
            lib.updateExportTypeSwitch(jqForm, event.target);
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = documentModule.PageModel(conf);
        lib.layoutModel.init();

        $('input[type="submit"]').focus();
        if (lib.layoutModel.userSettings.get('concdesc_view') === 'show') {
            $('#concdescplusminus').attr('src', lib.layoutModel.conf.files_path + '/img/minus.png');
        }

        (function () {
            var jqForm = $('form[action="saveconc"]'),
                checkedRadio = jqForm.find('input[name="saveformat"]:checked').get(0);

            if (checkedRadio) {
                lib.updateExportTypeSwitch(jqForm, checkedRadio);
            }
        }());


        lib.bindStaticElements();
    };




    return lib;
});
