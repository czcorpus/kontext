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
 * This module contains functionality related directly to the first_form.tmpl template
 */
define(['win', 'jquery', 'tpl/document'], function (win, $, documentModule) {
    'use strict';

    var lib = {};

    lib.layoutModel = null;
    lib.changed = false;

    function blockUnsaved() {
        $('#mainform input[type!="hidden"][type!="submit"]').on('change', function () {
            lib.changed = true;
        });

        $(win).on('beforeunload', function (event) {
            if (lib.changed) {
                event.returnValue = lib.layoutModel.translate('there_are_unsaved_changes');
                return event.returnValue;
            }
            return undefined;
        });

        $('#mainform input[type="submit"]').on('click', function () {
            lib.changed = false;
        });
    }

    /**
     *
     * @param parentElm
     * @returns {boolean}
     */
    function uncheckChecked(parentElm) {
        $(parentElm).find('input[type="checkbox"]:checked').each(function () {
            $(this).prop('checked', false);
        });
    }

    /**
     *
     */
    lib.setupStructattrCheckboxes = function () {
        $('.structattr-checkbox').on('click', function (event) {
            var triggerElm = $(event.target),
                structId = triggerElm.attr('data-struct-id'),
                parentCheckbox;

            parentCheckbox = triggerElm.closest('fieldset').find('input[name="setstructs"][value="' + structId + '"]');

            if (triggerElm.is(':checked') && !parentCheckbox.is(':checked')) {
                parentCheckbox.prop('checked', true);
            }
        });

        $('input[type="checkbox"][name="setstructs"]').on('click', function (event) {
            uncheckChecked($(event.target).closest('fieldset').find('ul[data-struct-id="' + $(event.target).val() + '"]'));
        });
    };

    /**
     *
     * @param conf
     */
    lib.init = function (conf) {
        lib.layoutModel = new documentModule.PageModel(conf);
        lib.layoutModel.init();

        $('#mainform input.select-all').each(function () {
            lib.layoutModel.applySelectAll(this, $(this).closest('fieldset'));
        });

        lib.setupStructattrCheckboxes();
        blockUnsaved();
    };

    return lib;
});