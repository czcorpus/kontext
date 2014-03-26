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

define(['win', 'jquery'], function (win, $) {
    var lib = {};

    /**
     *
     * @param s
     * @returns {*}
     */
    function stripPrefix(s) {
        var x = /^sca_(.+)$/,
            ans;

        ans = x.exec(s);
        if (ans) {
            return ans[1];
        }
        return null;
    }

    /**
     *
     */
    function exportAttrStatus() {
        var ans = {};

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

            if ($.inArray($(this).val(), corpList) < 0) {
                $(this).addClass('dynamic');
                $(this).attr('disabled', 'disabled');

            } else if ($(this).hasClass('dynamic')) {
                $(this).attr('disabled', null);
            }
        });
    }

    function updateCheckboxes(data) {
        lib.attrFieldsetWrapper.find('.attr-selector').each(function () {
            var id = stripPrefix($(this).attr('name')),
                label = $('label[for="' + $(this).attr('id') + '"]');

            if ($.inArray($(this).val(), data[id]) < 0) {
                label.css('text-decoration', 'line-through');

            } else {
                label.css('text-decoration', 'none');
            }
        });
    }

    function resetCheckboxes() {
        lib.attrFieldsetWrapper.find('.attr-selector').each(function () {
            $('label[for="' + $(this).attr('id') + '"]').css('text-decoration', 'none'); // fix label
            $(this).attr('disabled', null); // re-enable checkbox
            this.checked = false;
        });
    }

    function resetCorpList() {
        // TODO
    }

    /**
     * @param {{}} conf
     * @param {function} ajaxFunc
     * @param {function} ajaxAnimFunc
     * @param {HTMLElement|jQuery|string} updateButton update button element
     * @param {HTMLElement|jQuery|string} resetButton reset button element
     * @param {HTMLElement|jQuery|string} attrFieldsetWrapper element containing attribute checkboxes
     */
    lib.init = function (conf, ajaxFunc, ajaxAnimFunc, updateButton, resetButton, attrFieldsetWrapper) {
        if (ajaxFunc) {
            lib.ajax = ajaxFunc;

        } else {
            lib.ajax = $.ajax;
        }
        lib.conf = conf;
        lib.updateButton = $(updateButton);
        lib.resetButton = $(resetButton);
        lib.attrFieldsetWrapper = $(attrFieldsetWrapper);
        lib.ajaxAnimFunc = ajaxAnimFunc;


        lib.attrFieldsetWrapper.find('.attr-selector').on('click', function () {
            if ($(this).is(':checked')) {
                $(this).addClass('user-selected');

            } else {
                $(this).removeClass('user-selected');
            }

        });

        lib.updateButton.on('click', function () {
            var selectedAttrs = exportAttrStatus(),
                ajaxAnimElm;

            ajaxAnimElm = lib.ajaxAnimFunc();
            $(ajaxAnimElm).css({
                'position' : 'absolute',
                'left' : ($(win).width() / 2 - $(ajaxAnimElm).width() / 2) +  'px',
                'top' : ($(win).height() / 2) + 'px'
            });
            $('#content').append(ajaxAnimElm);

            lib.ajax('filter_attributes?attrs=' + JSON.stringify(selectedAttrs), {
                dataType : 'json',
                success : function (data) {
                    updateAlignedCorpora(data);
                    updateCheckboxes(data);
                    $(ajaxAnimElm).remove();
                },
                error : function () {
                    $(ajaxAnimElm).remove();
                }
            });
        });

        lib.resetButton.on('click', function () {
            resetCheckboxes();
            resetCorpList();
        });

        $(win).on('unload', function () {
            resetCheckboxes();
            resetCorpList();
        });

        lib.attrFieldsetWrapper.find('.attr-selector').on('click', function (event) {
            var label = $('label[for="' + $(event.target).attr('id') + '"]').css('text-decoration', 'none');
        });
    };

    return lib;
});