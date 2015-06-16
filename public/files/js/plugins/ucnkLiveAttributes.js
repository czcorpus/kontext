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

define(['win', 'jquery', 'popupbox'], function (win, $, popupBox) {
    'use strict';

    var lib = {
        pluginApi : null
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
     * Handles transforming of raw input attribute value selectors (i.e. the ones with too long lists
     * to display) to lists of checkboxes and back.
     *
     * @param pluginApi a plugin api object produced by document.js
     * @param attrFieldsetWrapper parent element of all the attribute selectors
     * @constructor
     */
    function LiveData(pluginApi, attrFieldsetWrapper) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = attrFieldsetWrapper;
    }

    /**
     *
     * @param {{}} data
     * @param {HTMLElement|jQuery}
     */
    LiveData.prototype.renderBibliography = function (data, rootElm) {
        var p;

        rootElm = $(rootElm);

        for (p in data) {
            if (data.hasOwnProperty(p) && data[p]) {
                rootElm.append('<strong>' + p + '</strong>: ' + data[p] + '<br />');
            }
        }
    };

    /**
     * Updates current state according to the 'data' argument
     *
     * @param data
     */
    LiveData.prototype.update = function (data) {
        var self = this;

        function createSelectAllBib() {
            var wrapper = window.document.createElement('label');

            $(wrapper).append(' <input type="checkbox" /> ' + self.pluginApi.translate('select_all'))
                .addClass('select-all');
            return wrapper;
        }

        /**
         *
         * @param {{}} rows
         * @param {string} defaultRowIdKey
         * @params {{'id_attr': '...', 'label_attr': '...'}} bibConf
         * @param checkedItems
         * @returns {*|HTMLElement} created data table
         */
        function createDataTable(rows, defaultRowIdKey, bibConf, checkedItems) {
            var table = win.document.createElement('table'),
                rowIdentKey,   // specifies data key which uniquely identifies data rows
                rowIdentValue; // specifies unique value which identifies respective data row

            $(table).addClass('dynamic');
            $.each(rows, function (i, row) {
                var checked = $.inArray(typeof row === 'object' ? row[1] : row, checkedItems) > -1,
                    bibLink,
                    itemLabel,
                    labelAttrName;

                if ($.isArray(row)) { // => value and label differ
                    itemLabel = row[0];
                    rowIdentValue = row[1];

                } else {
                    itemLabel = row;
                    rowIdentValue = row;
                }

                if (defaultRowIdKey === bibConf.label_attr) { // => special column representing a list of bib. entries
                    rowIdentKey = bibConf.id_attr;
                    labelAttrName = bibConf.label_attr;
                    bibLink = '<a class="bib-info" data-bib-id="' + rowIdentValue + '">i</a>';

                } else {
                    rowIdentKey = defaultRowIdKey;
                    labelAttrName = null;
                    bibLink = '';
                }

                if (checked) {
                    $(table).append('<tr><td><label><input class="attr-selector" type="checkbox" name="sca_'
                        + rowIdentKey + '" ' + (labelAttrName ? ' data-virt-name="' + labelAttrName + '" ' : '')
                        + ' value="' + (typeof row === 'object' ? row[1] : row) + '" checked="checked" disabled="disabled" /> '
                        + '<input type="hidden" name="sca_' + rowIdentKey + '" value="' + rowIdentValue + '" /> '
                        + itemLabel + '</label></td><td>' + bibLink + '</td></tr>');

                } else {
                    $(table).append('<tr><td><label><input class="attr-selector" type="checkbox" name="sca_'
                        + rowIdentKey + '" ' + (labelAttrName ? ' data-virt-name="' + labelAttrName + '" ' : '')
                        + ' value="' + rowIdentValue + '" /> ' + itemLabel + '</label></td><td>'
                        + bibLink + '</td></tr>');
                }
            });
            return table;
        }

        /**
         * Note: the target element must contain a 'data-bib-id' attribute
         *
         * @param {HTMLElement|string|jQuery} target
         */
        function bindBibLink(target) {
            popupBox.bind($(target),
                function (tooltipBox, finalizeCallback) {
                    var ajaxAnimElm = self.pluginApi.ajaxAnim();

                    $(ajaxAnimElm).css({
                        'position' : 'absolute',
                        'left' : ($(win).width() / 2 - $(ajaxAnimElm).width() / 2) +  'px',
                        'top' : ($(win).height() / 2) + 'px'
                    });
                    $('#content').append(ajaxAnimElm);

                    // close all the other bib-info boxes
                    $('.bib-info').each(function () {
                        if (!$(this).is($(target))) {
                            popupBox.close(this);
                        }
                    });

                    self.pluginApi.ajax('bibliography?corpname=' + self.pluginApi.conf('corpname')
                        + '&id=' + $(target).attr('data-bib-id'),
                        {
                            dataType : 'json',
                            success : function (data) {
                                var bibHtml = $('<div></div>');

                                $(ajaxAnimElm).remove();
                                self.renderBibliography(data['bib_data'], bibHtml);
                                tooltipBox.importElement(bibHtml);
                                finalizeCallback();
                            },
                            error : function (jqXHR, textStatus, errorThrown) {
                                $(ajaxAnimElm).remove();
                                self.pluginApi.showMessage('error', errorThrown);
                            }
                        });
                },
                {
                    type : 'plain'
                });
        }

        self.attrFieldsetWrapper.find('.raw-selection').each(function () {
            var ident = stripPrefix($(this).attr('name')),
                dataItem = data[ident],
                inputElm = this,
                attrTable = $(this).closest('table.envelope'),
                checkedItems = [],
                selectAll,
                dataTable,
                msg = self.pluginApi.translate('number of matching items'),
                helpLink = win.document.createElement('a');

            attrTable.find('table.dynamic .attr-selector:checked').each(function () {
                checkedItems.push($(this).val());
            });


            attrTable.find('table.dynamic').remove();
            attrTable.find('.select-all').css('display', 'none');
            $(inputElm).show();

            if ($.isArray(dataItem)) {
                attrTable.find('.metadata').empty();
                dataTable = createDataTable(dataItem, ident, self.pluginApi.conf('bibConf'), checkedItems);

                $(inputElm).after(dataTable);
                $(dataTable).find('.bib-info').each(function () {
                    bindBibLink(this);
                });

                $(inputElm).hide();

                selectAll = createSelectAllBib();
                attrTable.find('.last-line td').append(selectAll);

                $(selectAll).addClass('dynamic').css('display', 'inherit');
                self.pluginApi.applySelectAll($(selectAll).find('input').get(0), attrTable.get(0));

            } else if (Object.prototype.toString.call(dataItem) === '[object Object]') {
                attrTable.find('.metadata').html(msg + ': <strong>' + dataItem.length + '</strong>');
                attrTable.find('.metadata').append(helpLink);
                self.pluginApi.contextHelp(helpLink, self.pluginApi.translate('bib_list_warning'));
            }
        });
    };

    /**
     * Resets the state back to its initial form (as loaded from server)
     */
    LiveData.prototype.reset = function () {
        this.attrFieldsetWrapper.find('table.dynamic').remove();
        this.attrFieldsetWrapper.find('.metadata').empty();
        this.attrFieldsetWrapper.find('input.raw-selection').show();
        this.attrFieldsetWrapper.find('label.select-all.dynamic').hide().removeClass('dynamic');
    };

    /**
     * Handles state of checkboxes for selecting specific attribute values (i.e. hides the ones
     * representing values leading to an empty selection).
     *
     * @param pluginApi
     * @param attrFieldsetWrapper parent element of all the attribute selectors
     * @constructor
     */
    function Checkboxes(pluginApi, attrFieldsetWrapper) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = attrFieldsetWrapper;
    }

    /**
     * Updates the checkboxes according to provided 'data' argument
     *
     * @param data
     */
    Checkboxes.prototype.update = function (data) {
        var self = this;

        function attrValsContain(value, vals) {
            var ans;

            if (vals.length === 0) {
                ans = false;

            } else if (typeof vals[0] === 'string') {
                ans = $.inArray(value, vals) > -1;

            } else if (typeof vals[0] === 'object') {
                ans = false;
                $.each(vals, function (i, item) {
                    if (item[1] === value) {
                        ans = true;
                        return false;
                    }
                });
            }
            return ans;
        }


        this.attrFieldsetWrapper.find('.attr-selector').each(function () {
            var id,
                trElm = $(this).closest('tr'),
                labelElm = $(this).closest('label'),
                inputVal = $(this).val() !== self.pluginApi.conf('emptyAttrValuePlaceholder') ? $(this).val() : '';


            if ($(this).attr('data-virt-name')) {
                id = $(this).attr('data-virt-name');

            } else {
                id = stripPrefix($(this).attr('name'));
            }

            if (!attrValsContain(inputVal, data[id])) {
                trElm.addClass('excluded');
                labelElm.removeClass('locked');

            } else {
                trElm.removeClass('excluded');
                if ($(this).is(':checked')) {
                    labelElm.addClass('locked');
                    $(this).attr('disabled', 'disabled');
                    $(this).after('<input class="checkbox-substitute" type="hidden" '
                        + 'name="' + $(this).attr('name') + '" value="' + $(this).attr('value') + '" />');

                } else {
                    labelElm.removeClass('locked');
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

        this.attrFieldsetWrapper.find('.select-all').each(function () {
            if (this.checked) {
                this.checked = false;
            }
        });
    };

    /**
     * For all the attributes, the method finds all the checked values:
     * {
     *    attr_1 : [value_1_1, value_1_2,...],
     *    attr_2 : [value_2_1, value_2_2,...],
     *    ...
     * }
     *
     * @returns {{}}
     */
    Checkboxes.prototype.exportStatus = function () {
        var ans = {};

        this.attrFieldsetWrapper.find('.attr-selector:checked').each(function () {
            var key = stripPrefix($(this).attr('name'));

            if (!ans.hasOwnProperty(key)) {
                ans[key] = [];
            }
            ans[key].push($(this).val());
        });
        return ans;
    };


    /**
     * Handles state of tables wrapping listed values of individual attributes.
     *
     * @param {jQuery} attrFieldsetWrapper
     * @param {SelectionSteps} selectionSteps
     * @constructor
     */
    function StructTables(attrFieldsetWrapper, selectionSteps) {
        this.attrFieldsetWrapper = attrFieldsetWrapper;
        this.selectionSteps = selectionSteps;
    }

    /**
     *
     */
    StructTables.prototype.update = function () {
        var self = this;

        $.each(this.selectionSteps.usedAttributes(), function (i, v) {
            self.attrFieldsetWrapper.find('table[data-attr="' + v + '"]').each(function () {
                $(this).addClass('locked');
                $(this).find('tr.last-line label').hide();
            });
        });
    };

    /**
     *
     */
    StructTables.prototype.reset = function () {
        this.attrFieldsetWrapper.find('table.envelope').each(function () {
            $(this).filter('.locked').find('tr.last-line label').show();
            $(this).removeClass('locked');
        });
    };

    /**
     *
     * @constructor
     */
    function AlignedCorpora() {}

    /**
     * Disables all the corpora not present in data.corpus_id
     *
     * @param data
     */
    AlignedCorpora.prototype.update = function (data) {
        var corpList = data.aligned || [];

        $('#add-searched-lang-widget select option').each(function () {
            if ($.inArray($(this).val(), corpList) >= 0) {
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
        $('#add-searched-lang-widget select option.dynamic').each(function () {
            $(this).removeClass('dynamic').attr('disabled', null);
        });
    };

    /**
     * Searches for currently selected aligned corpora
     *
     * @returns {Array}
     */
    AlignedCorpora.prototype.findSelected = function () {
        var ans = [];

        $('.parallel-corp-lang:visible input[name="sel_aligned"]').each(function () {
            var val = $(this).val();

            if (val) {
                ans.push(val);
            }
        });
        return ans;
    };

    /**
     * Handles displaying of the block diagram which depicts user's selection steps.
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
        }
        this.jqSteps.data('num-steps', v);
    };

    SelectionSteps.prototype.usedAttributes = function (v) {
        if (this.jqSteps.data('used-attrs') === undefined) {
            this.jqSteps.data('used-attrs', []);
        }

        if (v === undefined) {
            return this.jqSteps.data('used-attrs');
        }
        this.jqSteps.data('used-attrs', v);
    };

    /**
     *
     * @param data
     * @param selectedAttrs
     * @param {AlignedCorpora} alignedCorpora
     */
    SelectionSteps.prototype.update = function (data, selectedAttrs, alignedCorpora) {
        var table,
            alignedCorpnames = alignedCorpora.findSelected(),
            innerHTML;

        if (this.numSteps() === 0 && alignedCorpnames.length > 0) {
            innerHTML = '<strong>' + this.pluginApi.conf('corpname') + '</strong> <br />&amp; '
                + alignedCorpnames.join('<br />&amp;');
            this.jqSteps.append(this.rawCreateStepTable(0, innerHTML));
            this.numSteps(this.numSteps() + 1);
        }

        table = this.createStepTable(data, selectedAttrs);
        if (table) {
            this.numSteps(this.numSteps() + 1);

            if (this.numSteps() > 1) {
                this.jqSteps.append('<span class="arrow">&#10142;</span>');
            }

            this.jqSteps.append(table);
        }
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
     * @param numStep
     * @param innerHTML
     * @returns {string}
     */
    SelectionSteps.prototype.rawCreateStepTable = function (numStep, innerHTML) {
        return '<table class="step"><tr><td class="num">' + (numStep + 1) + '</td> '
            + '<td class="data">' + innerHTML + '</td></tr></table>';
    };

    /**
     *
     * @param jqSteps
     * @param data
     * @param selectedAttrs
     * @returns {string}
     */
    SelectionSteps.prototype.createStepTable = function (data, selectedAttrs) {
        var ansHtml = null,
            usedAttrs = this.usedAttributes(),
            positionInfo = '',
            self = this,
            newAttrs;

        function expandAttributes() {
            var p,
                ans = [],
                values,
                html;

            for (p in selectedAttrs) {
                if (selectedAttrs.hasOwnProperty(p) && $.inArray(p, usedAttrs) < 0) {
                    usedAttrs.push(p);
                    values = selectedAttrs[p];

                    if (values.length > 5) {
                        values = selectedAttrs[p].slice(0, 2);
                        values.push('...');
                        values = values.concat(selectedAttrs[p].slice(selectedAttrs[p].length - 3, selectedAttrs[p].length - 1));
                    }
                    html = '<strong>' + p + '</strong> &#8712; {' + values.join(', ') + '}';
                    if (self.numSteps() > 0) {
                        ans.push('... &amp; ' + html);

                    } else {
                        ans.push(html);
                    }

                }
            }
            return ans;
        }

        newAttrs = expandAttributes();
        if (newAttrs.length > 0) {
            if (data.poscount !== undefined) {
                positionInfo = this.pluginApi.translate('%s positions').replace('%s', data.poscount);
            }
            ansHtml = this.rawCreateStepTable(this.numSteps(), newAttrs + '<br />' + positionInfo);
        }
        return ansHtml;
    };

    /**
     * Loads valid attributes values according to the current selection.
     *
     * The following json response structure is expected:
     * {
     *   "poscount": "49 738 011", <- formatted number representing number of avail. positions in this selection
     *   "structure1.attribute1": ["a value", ...],
     *   "structure2.attribute1": ["a value", ...],
     *   ...
     *   "structureN.attributeM": {"length": 827} <- a structure with too many items to display reports only its size
     * }
     *
     * @param {AlignedCorpora} alignedCorpora
     * @param {Checkboxes} checkBoxes
     * @param {function} successAction
     * @param {{}} ajaxAnimation
     * @param {function} ajaxAnimation.start
     * @param {function} ajaxAnimation.stop
     */
    function loadData(alignedCorpora, checkBoxes, successAction, ajaxAnimation) {
        var requestURL,
            alignedCorpnames,
            selectedAttrs = checkBoxes.exportStatus();

        requestURL = 'filter_attributes?corpname=' + lib.pluginApi.conf('corpname');

        alignedCorpnames = alignedCorpora.findSelected();
        if (alignedCorpnames) {
            requestURL += '&aligned=' + JSON.stringify(alignedCorpnames);
        }

        ajaxAnimation.start();

        lib.pluginApi.ajax(requestURL, {
            type : 'POST',
            dataType : 'json',
            data : {attrs : JSON.stringify(selectedAttrs)},
            success : function (data) {
                successAction(data, selectedAttrs);
                ajaxAnimation.stop();
            },
            error : function (jqXHR, textStatus, errorThrown) {
                ajaxAnimation.stop();
                lib.pluginApi.showMessage('error', errorThrown);
            }
        });
    }

    /**
     *
     * @param {AlignedCorpora} alignedCorpora
     * @param {Checkboxes} checkBoxes
     * @param updateButton
     * @param successAction
     */
    function bindSelectionUpdateEvent(alignedCorpora, checkBoxes, updateButton, successAction) {
        updateButton.on('click', function () {
            var ajaxAnimation;

            ajaxAnimation = {
                animElm : null,
                start : function () {
                    this.animElm = lib.pluginApi.ajaxAnim();
                    $(this.animElm).css({
                        'position' : 'absolute',
                        'left' : ($(win).width() / 2 - $(this.animElm).width() / 2) +  'px',
                        'top' : ($(win).height() / 2) + 'px'
                    });
                    $('#content').append(this.animElm);
                },
                stop : function () {
                    $(this.animElm).remove();
                }
            };

            loadData(alignedCorpora, checkBoxes, successAction, ajaxAnimation);
        });
    }

    /**
     * This function loads bibliography entries into unmodified attribute list
     * fieldset (i.e. it is best run right after the page is loaded).
     * There is no need to perform any checks whether items can be loaded for
     * the current corpus because the function does the check by itself.
     *
     * @param {Checkboxes} checkBoxes
     * @param {AlignedCorpora} alignedCorpora
     * @param {function} updateAttrTables
     */
    function initializeSearchAttrFiledsets(alignedCorpora, checkBoxes, updateAttrTables) {
        var fieldset = $('#specify-query-metainformation'),
            ajaxAnimation,
            bibAttr = fieldset.find('.text-type-params').attr('data-bib-attr'),
            bibTable = null;


        if (bibAttr) {
            fieldset.find('table.envelope').each(function (i, table) {
                if ($(table).attr('data-attr') === bibAttr) {
                    bibTable = $(table);
                    return false;
                }
            });

            if (bibTable) {
                ajaxAnimation = {
                    animElm : null,
                    start : function () {
                        this.animElm = lib.pluginApi.ajaxAnimSmall();
                        this.animElm.css({
                            'display' : 'block',
                            'margin' : '0 auto'
                        });
                        bibTable.find('input.raw-selection').after(this.animElm);
                    },
                    stop : function () {
                        this.animElm.remove();
                    }
                };

                if (!fieldset.hasClass('inactive')) {
                    loadData(alignedCorpora, checkBoxes, updateAttrTables, ajaxAnimation);
                }
            }
        }
    }

    /**
     * This function initializes the plug-in. It must be run after all the page dependencies
     * are ready.
     *
     * @param {{}} pluginApi
     * @param {HTMLElement|jQuery|string} updateButton update button element
     * @param {HTMLElement|jQuery|string} resetButton reset button element
     * @param {HTMLElement|jQuery|string} attrFieldsetWrapper element containing attribute checkboxes
     */
    lib.init = function (pluginApi, updateButton, resetButton, attrFieldsetWrapper) {
        lib.pluginApi = pluginApi;
        attrFieldsetWrapper = $(attrFieldsetWrapper);
        resetButton = $(resetButton);

        (function () {
            var rawInputs = new LiveData(pluginApi, attrFieldsetWrapper),
                selectionSteps = new SelectionSteps(pluginApi),
                checkboxes = new Checkboxes(pluginApi, attrFieldsetWrapper),
                alignedCorpora = new AlignedCorpora(),
                structTables = new StructTables(attrFieldsetWrapper, selectionSteps),
                resetAll,
                updateAttrTables;

            attrFieldsetWrapper.find('.attr-selector').on('click', function () {
                if ($(this).is(':checked')) {
                    $(this).addClass('user-selected');

                } else {
                    $(this).removeClass('user-selected');
                }
            });

            updateAttrTables = function (data, selectedAttrs) {
                alignedCorpora.update(data);
                checkboxes.update(data);
                rawInputs.update(data);
                selectionSteps.update(data, selectedAttrs, alignedCorpora);
                structTables.update();
            };

            bindSelectionUpdateEvent(alignedCorpora, checkboxes, $(updateButton), updateAttrTables);

            resetAll = function () {
                checkboxes.reset();
                alignedCorpora.reset();
                rawInputs.reset();
                selectionSteps.reset();
                structTables.reset();
            };

            resetButton.on('click', resetAll);
            $(win).on('unload', resetAll);
            pluginApi.registerReset(resetAll);

            initializeSearchAttrFiledsets(alignedCorpora, checkboxes, updateAttrTables);
            lib.pluginApi.bindFieldsetToggleEvent(function (fieldset) {
                if (!fieldset.hasClass('inactive')) {
                    initializeSearchAttrFiledsets(alignedCorpora, checkboxes, updateAttrTables);
                }
            });
        }());
    };

    return lib;
});