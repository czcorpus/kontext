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
define(['win', 'jquery', 'tpl/document', 'hideelem'], function (win, $, layoutModel, hideElem) {
    'use strict';

    var lib = {};

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
        layoutModel.init(conf);

        $('#mainform input.select-all').each(function () {
            layoutModel.applySelectAll(this, $(this).closest('fieldset'));
        });

        lib.setupStructattrCheckboxes();
    };

    return lib;
});