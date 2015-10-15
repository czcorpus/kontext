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
 * This module contains functionality related directly to the savewl_form.tmpl template
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
        var jqHeadingInput = $(jqForm).find('input[name="colheaders"]'),
            jqHeadingRow = jqHeadingInput.closest('tr'),
            jqHeadingInput2 = $(jqForm).find('input[name="heading"]'),
            jqHeadingRow2 = jqHeadingInput2.closest('tr');

        if ($(currentElement).val() === 'csv' || $(currentElement).val() === 'xlsx') {
            jqHeadingInput.prop('disabled', false);
            jqHeadingRow.show();
            jqHeadingInput2.prop('disabled', true);
            jqHeadingRow2.hide();

        } else {
            jqHeadingInput.prop('disabled', true);
            jqHeadingRow.hide();
            jqHeadingInput2.prop('disabled', false);
            jqHeadingRow2.show();
        }
    };

    /**
     *
     */
    lib.bindStaticElements = function () {
        var jqForm = $('form[action="savewl"]');

        jqForm.find('input[name="saveformat"]').on('click', function (event) {
            lib.updateExportTypeSwitch(jqForm, event.target);
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();
        lib.bindStaticElements();

        // obtain current state of the form and update
        (function () {
            var jqForm = $('form[action="savewl"]'),
                checkedRadio = jqForm.find('input[name="saveformat"]:checked').get(0);

            if (checkedRadio) {
                lib.updateExportTypeSwitch(jqForm, checkedRadio);
            }
        }());
    };

    return lib;
});