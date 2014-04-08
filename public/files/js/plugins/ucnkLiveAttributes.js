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
     * Handles transforming of raw input attribute value selectors (i.e. the ones with too long lists
     * to display) to lists of checkboxes and back.
     *
     * @param pluginApi a plugin api object produced by document.js
     * @param attrFieldsetWrapper parent element of all the attribute selectors
     * @constructor
     */
    function RawInputs(pluginApi, attrFieldsetWrapper) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = attrFieldsetWrapper;
    }

    /**
     * Updates current state according to the 'data' argument
     *
     * @param data
     */
    RawInputs.prototype.update = function (data) {
        var self = this;

        self.attrFieldsetWrapper.find('.raw-selection').each(function () {
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
                self.pluginApi.applySelectAll($(this).closest('table.envelope').find('.select-all').find('input'), $(this).closest('table.envelope'));


            } else if (isObject(dataItem)) {
                var msg = self.pluginApi.translate('number of matching structures');
                attrTable.find('.metadata').html(msg + ': ' + dataItem.length);
            }
        });
    };

    /**
     * Resets the state back to its initial form (as loaded from server)
     */
    RawInputs.prototype.reset = function () {
        this.attrFieldsetWrapper.find('table.dynamic').remove();
        this.attrFieldsetWrapper.find('.metadata').empty();
        this.attrFieldsetWrapper.find('input.raw-selection').show();
        this.attrFieldsetWrapper.find('label.select-all.dynamic').hide().removeClass('dynamic');
    };

    /**
     * Handles state of checkboxes for selecting specific attribute values (i.e. hides the ones
     * representing values leading to an empty selection).
     *
     * @param attrFieldsetWrapper parent element of all the attribute selectors
     * @constructor
     */
    function Checkboxes(attrFieldsetWrapper) {
        this.attrFieldsetWrapper = attrFieldsetWrapper;
    }

    /**
     * Updates the checkboxes according to provided 'data' argument
     *
     * @param data
     */
    Checkboxes.prototype.update = function (data) {
        this.attrFieldsetWrapper.find('.attr-selector').each(function () {
            var id = stripPrefix($(this).attr('name')),
                trElm = $(this).closest('tr'),
                inputVal = $(this).val() != '--' ? $(this).val() : '';

            if ($.inArray(inputVal, data[id]) < 0) {
                trElm.addClass('excluded');

            } else {
                trElm.removeClass('excluded');
                if (this.checked) {
                    $(this).attr('disabled', 'disabled');
                    $(this).after('<input class="checkbox-substitute" type="hidden" '
                    + 'name="' + $(this).attr('name') + '" value="' + $(this).attr('value') + '" />');
                }
            }
        });
    };

    /**
     *
     */
    Checkboxes.prototype.reset = function () {
        this.attrFieldsetWrapper.find('.attr-selector').each(function () {
            $(this).closest('tr').removeClass('excluded');
            if (this.checked !== undefined) {
                this.checked = false;
            }
            if ($(this).attr('disabled')) {
                $(this).attr('disabled', null);
            }
        });

        this.attrFieldsetWrapper.find('input.checkbox-substitute').remove();
    };


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
     * @param obj
     * @returns {boolean}
     */
    function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    }

    /**
     *
     * @param obj
     * @returns {boolean}
     */
    function isObject(obj) {
        return Object.prototype.toString.call(obj) === '[object Object]';
    }

    /**
     *
     * @constructor
     */
    function AlignedCorpora() {

    }

    /**
     * Disables all the corpora not present in data.corpus_id
     *
     * @param data
     */
    AlignedCorpora.prototype.update = function (data) {
        var corpList = data.corpus_id || [];

        $('#add-searched-lang-widget select option').each(function () {

            if ($.inArray($(this).val(), corpList) < 0) {
                $(this).addClass('dynamic');
                $(this).attr('disabled', 'disabled');

            } else if ($(this).hasClass('dynamic')) {
                $(this).attr('disabled', null);
            }
        });
    };

    /**
     *
     */
    AlignedCorpora.prototype.reset = function () {
        // TODO
    };

    /**
     *
     * @param pluginApi
     * @constructor
     */
    function SelectionSteps(pluginApi) {
        this.pluginApi = pluginApi;
        this.jqSteps = $('.live-attributes div.steps');
    }

    SelectionSteps.prototype.numSteps = function (v) {
        if (this.jqSteps.data('num-steps') === undefined) {
            this.jqSteps.data('num-steps', 0);
        }
        if (v === undefined) {
            return this.jqSteps.data('num-steps');

        } else {
            this.jqSteps.data('num-steps', v);
        }
    };

    SelectionSteps.prototype.usedAttributes = function (v) {
        if (this.jqSteps.data('used-attrs') === undefined) {
            this.jqSteps.data('used-attrs', []);
        }

        if (v === undefined) {
            return this.jqSteps.data('used-attrs');

        } else {
            this.jqSteps.data('used-attrs', v);
        }
    };

    /**
     *
     * @param data
     * @param selectedAttrs
     */
    SelectionSteps.prototype.update = function (data, selectedAttrs) {
        var table;

        this.numSteps(this.numSteps() + 1);

        if (this.numSteps() > 1) {
            this.jqSteps.append('<span class="arrow">&#10142;</span>');
        }
        table = this.createStepTable(this.jqSteps, data, selectedAttrs);
        this.jqSteps.append(table);
    };

    /**
     *
     */
    SelectionSteps.prototype.reset = function () {
        this.numSteps(0);
        this.usedAttributes([]);
        this.jqSteps.empty();
    };

    /**
     *
     * @param jqSteps
     * @param data
     * @param selectedAttrs
     * @returns {string}
     */
    SelectionSteps.prototype.createStepTable = function (jqSteps, data, selectedAttrs) {
        var html,
            usedAttrs = this.usedAttributes(),
            positionInfo = '';

        function expandAttributes() {
            var p,
                ans = [],
                values;

            for (p in selectedAttrs) {
                if (selectedAttrs.hasOwnProperty(p) && $.inArray(p, usedAttrs) < 0) {
                    usedAttrs.push(p);
                    values = selectedAttrs[p];

                    if (values.length > 5) {
                        values = selectedAttrs[p].slice(0, 2);
                        values.push('...');
                        values = values.concat(selectedAttrs[p].slice(selectedAttrs[p].length - 3, selectedAttrs[p].length - 1));
                    }
                    ans.push('<strong>' + p + '</strong> &#8712; {' + values.join(', ') + '}');
                }
            }
            return ans.join('<br />');
        }

        if (data.poscount !== undefined) {
            positionInfo = this.pluginApi.translate('%s positions').replace('%s', data.poscount);
        }

        html = '<table class="step"><tr><td class="num">' + this.numSteps() + '</td> '
            + '<td class="data">' + expandAttributes() + '<br />'
            + positionInfo + '</td></tr></table>'

        return html;
    };

    /**
     *
     * @param pluginApi
     * @param updateButton
     * @param successAction
     */
    function bindSelectionUpdateEvent(pluginApi, updateButton, successAction) {

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

        updateButton.on('click', function () {
            var selectedAttrs = exportAttrStatus(),
                ajaxAnimElm,
                requestURL;

            /*
            The following json response structure is expected:
            {
                "poscount": "49 738 011", <- formatted number representing number of avail. positions in this selection
                "structure1.attribute1": ["a value", ...],
                "structure2.attribute1": ["a value", ...],
                ...
                "structureN.attributeM": {"length": 827} <- a structure with too many items to display reports only its size
            }
            */

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
                    successAction(data, selectedAttrs),
                    $(ajaxAnimElm).remove();
                },
                error : function (jqXHR, textStatus, errorThrown) {
                    $(ajaxAnimElm).remove();
                    pluginApi.showMessage('error', errorThrown);

                }
            });
        });
    }

    /**
     * @param {{}} pluginApi
     * @param {HTMLElement|jQuery|string} updateButton update button element
     * @param {HTMLElement|jQuery|string} resetButton reset button element
     * @param {HTMLElement|jQuery|string} attrFieldsetWrapper element containing attribute checkboxes
     */
    lib.init = function (pluginApi, updateButton, resetButton, attrFieldsetWrapper) {

        var attrFieldsetWrapper = $(attrFieldsetWrapper),
            resetButton = $(resetButton),
            rawInputs = new RawInputs(pluginApi, attrFieldsetWrapper),
            selectionSteps = new SelectionSteps(pluginApi),
            checkboxes = new Checkboxes(attrFieldsetWrapper),
            selectionSteps = new SelectionSteps(pluginApi),
            alignedCorpora = new AlignedCorpora(),
            resetAll;


        attrFieldsetWrapper.find('.attr-selector').on('click', function () {
            if ($(this).is(':checked')) {
                $(this).addClass('user-selected');

            } else {
                $(this).removeClass('user-selected');
            }
        });

        bindSelectionUpdateEvent(pluginApi, $(updateButton), function (data, selectedAttrs) {
            alignedCorpora.update(data);
            checkboxes.update(data);
            rawInputs.update(data);
            selectionSteps.update(data, selectedAttrs);
        });

        resetAll = function () {
            checkboxes.reset();
            alignedCorpora.reset();
            rawInputs.reset();
            selectionSteps.reset();
        };

        resetButton.on('click', resetAll);
        $(win).on('unload', resetAll);

    };

    return lib;
});