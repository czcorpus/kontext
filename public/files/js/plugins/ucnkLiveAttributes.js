/*
 * Copyright (c) 2014 Institute of the Czech National Corpus
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

define(['jquery'], function ($) {
    var lib = {};

    /**
     *
     */
    function exportAttrStatus() {
        var ans = {},
            stripPrefix;

        stripPrefix = function (s) {
            var x = /^sca_(.+)$/,
                ans;

            ans = x.exec(s);
            if (ans) {
                return ans[1];
            }
            return null;
        };

        $('.text-type-params .attr-selector:checked').each(function () {
            var key = stripPrefix($(this).attr('name'));

            if (!ans.hasOwnProperty(key)) {
                ans[key] = [];
            }
            ans[key].push($(this).val());
        });
        return ans;
    }

    /**
     * Disables all the corpora not present in data.corpus_id
     *
     * @param data
     */
    function updateAlignedCorpora(data) {
        var corpList = data.corpus_id || [];

        $('#add-searched-lang-widget select option').each(function () {
            console.log($(this).val());
            if ($.inArray($(this).val(), corpList) < 0) {
                console.log('not there');
                $(this).attr('disabled', 'disabled');
            }
        });
    }

    function updateCheckboxes(data) {
       // TODO
    }

    /**
     * @param {function} [ajax]
     * @param {HTMLElement|jQuery|string} updateButton update button element
     * @param {HTMLElement|jQuery|string} resetButton reset button element
     * @param {HTMLElement|jQuery|string} attrFieldsetWrapper element containing attribute checkboxes
     */
    lib.init = function (ajaxFunc, updateButton, resetButton, attrFieldsetWrapper) {

        if (ajaxFunc) {
            lib.ajax = ajaxFunc;

        } else {
            lib.ajax = $.ajax;
        }
        lib.updateButton = $(updateButton);
        lib.resetButton = $(resetButton);
        lib.attrFieldsetWrapper = $(attrFieldsetWrapper);


        lib.attrFieldsetWrapper.find('.attr-selector').on('click', function () {
            if ($(this).is(':checked')) {
                $(this).addClass('user-selected');

            } else {
                $(this).removeClass('user-selected');
            }

        });

        lib.updateButton.on('click', function () {
            var selectedAttrs = exportAttrStatus();

            lib.ajax('/filter_attributes?attrs=' + JSON.stringify(selectedAttrs), {
                dataType : 'json',
                success : function (data) {
                    updateAlignedCorpora(data);
                    updateCheckboxes(data);
                },
                error : function () {
                    console.log('error');
                }
            });
        });

        lib.resetButton.on('click', function () {
            lib.attrFieldsetWrapper.find('.attr-selector:checked').each(function () {
                this.checked = false;
            });
        });
    };

    return lib;
});