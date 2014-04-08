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

    function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    }

    function isObject(obj) {
        return Object.prototype.toString.call(obj) === '[object Object]';
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
                trElm = $(this).closest('tr'),
                inputVal = $(this).val() != '--' ? $(this).val() : '';

            //console.log('testing ' + $(this).val() + ' vs ' + data[id]);
            if ($.inArray(inputVal, data[id]) < 0) {
                trElm.addClass('excluded');

            } else {
                trElm.removeClass('excluded');
            }
        });
    }

    function updateRawInputs(api, data) {

        lib.attrFieldsetWrapper.find('.raw-selection').each(function () {
            var ident = stripPrefix($(this).attr('name')),
                dataItem = data[ident],
                inputElm = this,
                attrTable = $(this).closest('table.envelope');


            attrTable.find('table.dynamic').remove();
            attrTable.find('.select-all').css('display', 'none');
            $(inputElm).show();

            if (isArray(dataItem)) {
                var table = win.document.createElement('table');

                attrTable.find('.metadata').empty();
                $(table).addClass('dynamic');
                $(inputElm).after(table);
                $.each(dataItem, function (i, v) {
                    $(table).append('<tr><td><label><input class="attr-selector" type="checkbox" name="sca_'
                        + ident + '" value="' + v + '" /> ' + v + '</label></td></tr>');
                });

                $(inputElm).hide();

                attrTable.find('.select-all').addClass('dynamic').css('display', 'inherit');
                api.applySelectAll($(this).closest('table.envelope').find('.select-all').find('input'), $(this).closest('table.envelope'));


            } else if (isObject(dataItem)) {
                var msg = api.translate('number of matching structures');
                attrTable.find('.metadata').html(msg + ': ' + dataItem.length);
            }
        });
    }

    function resetRawInputs() {
        lib.attrFieldsetWrapper.find('table.dynamic').remove();
        lib.attrFieldsetWrapper.find('.metadata').empty();
        lib.attrFieldsetWrapper.find('input.raw-selection').show();
        lib.attrFieldsetWrapper.find('label.select-all.dynamic').hide().removeClass('dynamic');
    }

    function resetCheckboxes() {
        lib.attrFieldsetWrapper.find('.attr-selector').each(function () {
            $(this).closest('tr').removeClass('excluded');
            this.checked = false;
        });
    }

    function updateSummary(pluginApi, data) {
        $('.live-attributes .summary').empty().append(pluginApi.translate('number of matching positions')
            + ': <strong>' + data.poscount + '</strong>');
    }

    function resetSummary() {
        $('.live-attributes .summary').empty();
    }

    function resetCorpList() {
        // TODO
    }

    function getRawSelectionAttributes() {
        var ans = [];

        lib.attrFieldsetWrapper.find('.raw-selection').each(function () {
            ans.push($(this).attr('name'));
        });
        return ans;
    }

    /**
     * @param {{}} pluginApi
     * @param {HTMLElement|jQuery|string} updateButton update button element
     * @param {HTMLElement|jQuery|string} resetButton reset button element
     * @param {HTMLElement|jQuery|string} attrFieldsetWrapper element containing attribute checkboxes
     */
    lib.init = function (pluginApi, updateButton, resetButton, attrFieldsetWrapper) {
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
            var selectedAttrs = exportAttrStatus(),
                ajaxAnimElm,
                requestURL;

            ajaxAnimElm = pluginApi.ajaxAnim();
            $(ajaxAnimElm).css({
                'position' : 'absolute',
                'left' : ($(win).width() / 2 - $(ajaxAnimElm).width() / 2) +  'px',
                'top' : ($(win).height() / 2) + 'px'
            });
            $('#content').append(ajaxAnimElm);

            requestURL = 'filter_attributes?corpname=' + pluginApi.conf.corpname
                + '&attrs=' + JSON.stringify(selectedAttrs);
            pluginApi.ajax(requestURL, {
                dataType : 'json',
                success : function (data) {
                    updateAlignedCorpora(data);
                    updateCheckboxes(data);
                    updateSummary(pluginApi, data);
                    updateRawInputs(pluginApi, data);
                    $(ajaxAnimElm).remove();
                },
                error : function (jqXHR, textStatus, errorThrown) {
                    resetSummary();
                    $(ajaxAnimElm).remove();
                    pluginApi.showMessage('error', errorThrown);

                }
            });
        });

        lib.resetButton.on('click', function () {
            resetCheckboxes();
            resetCorpList();
            resetSummary();
            resetRawInputs();
        });

        $(win).on('unload', function () {
            resetCheckboxes();
            resetCorpList();
            resetSummary();
            resetRawInputs();
        });

        lib.attrFieldsetWrapper.find('.attr-selector').on('click', function (event) {
            var label = $('label[for="' + $(event.target).attr('id') + '"]').css('text-decoration', 'none');
        });
    };

    return lib;
});