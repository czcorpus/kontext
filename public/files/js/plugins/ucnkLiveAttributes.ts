/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/document.d.ts" />
/// <reference path="../../ts/declarations/dynamic.d.ts" />
/// <reference path="../../ts/declarations/popupbox.d.ts" />

import popupBox = require("popupbox");

function stripPrefix(s: string): string {
    var x = /^sca_(.+)$/,
        ans: RegExpExecArray;

    ans = x.exec(s);
    if (ans) {
        return ans[1];
    }
    return null;
}


/**
 * Specifies a bibliography item
 */
interface BibConf {
    id_attr: string;
    label_attr: string;
}

/**
 * This is just a pre-1.4 way to specify either
 * an array (= list of attributes) or an object with length property
 * (= too long list replacement)
 */
interface AvailAttrValues {
    length: number;
    push?: (value:any) => void;
}

/**
 * Stores attributes and their respective values
 */
interface AttributesMap {
    poscount?: number;
    aligned?: Array<string>;
    contains_errors?: boolean;
    //[attr: string]: AvailAttrValues;
}

/**
 *
 */
interface AjaxAnimation {
    start(): void;
    stop(): void;
    animElm:HTMLElement;
}


/**
 * Handles transforming of raw input attribute value selectors (i.e. the ones with too long lists
 * to display) to lists of checkboxes and back.
 *
 */
class LiveData {

    pluginApi:model.PluginApi;

    attrFieldsetWrapper:JQuery;

    /**
     * @param pluginApi a plugin api object produced by document.js
     * @param attrFieldsetWrapper parent element of all the attribute selectors
     * @constructor
     */
    constructor(pluginApi:model.PluginApi, attrFieldsetWrapper:HTMLElement) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = $(attrFieldsetWrapper);
    }

    /**
     *
     */
    private renderBibliography(data:Array<string>, rootElm:HTMLElement):void {
        var jqRootElm:JQuery = $(rootElm);

        for (var p in data) {
            if (data.hasOwnProperty(p) && data[p]) {
                jqRootElm.append('<strong>' + p + '</strong>: ' + data[p] + '<br />');
            }
        }
    }

    /**
     *
     */
    private createSelectAllBib():HTMLElement {
        var wrapper:HTMLElement = window.document.createElement('label');

        $(wrapper).append(' <input type="checkbox" /> ' + this.pluginApi.translate('select_all'))
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
    private createDataTable(rows, defaultRowIdKey:string, bibConf:BibConf, checkedItems) {
        var table:HTMLElement = window.document.createElement('table'),
            rowIdentKey:string,   // specifies data key which uniquely identifies data rows
            rowIdentValue:string; // specifies unique value which identifies respective data row

        $(table).addClass('dynamic');
        $.each(rows, function (i:number, row:any) {
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
    private bindBibLink(target: HTMLElement) {
        var self = this;

        popupBox.bind(target,
            function (tooltipBox, finalizeCallback) {
                var ajaxAnimElm = self.pluginApi.ajaxAnim();

                $(ajaxAnimElm).css({
                    'position': 'absolute',
                    'left': ($(window).width() / 2 - $(ajaxAnimElm).width() / 2) + 'px',
                    'top': ($(window).height() / 2) + 'px'
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
                        dataType: 'json',
                        success: function (data) {
                            var bibHtml = document.createElement('div');

                            $(ajaxAnimElm).remove();
                            self.renderBibliography(data['bib_data'], bibHtml);
                            tooltipBox.importElement(bibHtml);
                            finalizeCallback();
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            $(ajaxAnimElm).remove();
                            self.pluginApi.showMessage("error", errorThrown);
                        }
                    });
            },
            {
                type: 'plain'
            }
        );
    }


    /**
     * Updates current state according to the 'data' argument
     */
    update(data:AttributesMap) {
        var self = this;

        self.attrFieldsetWrapper.find('.raw-selection').each(function () {
            var ident = stripPrefix($(this).attr('name')),
                dataItem:AvailAttrValues = data[ident],
                inputElm = this,
                attrTable:JQuery = $(this).closest('table.envelope'),
                checkedItems = [],
                selectAll:HTMLElement,
                dataTable:HTMLElement,
                msg = self.pluginApi.translate('number of matching items'),
                helpLink = window.document.createElement('a');

            attrTable.find('table.dynamic .attr-selector:checked').each(function () {
                checkedItems.push($(this).val());
            });


            attrTable.find('table.dynamic').remove();
            attrTable.find('.select-all').css('display', 'none');
            $(inputElm).show();

            if ($.isArray(dataItem)) {
                attrTable.find('.metadata').empty();
                dataTable = self.createDataTable(dataItem, ident, self.pluginApi.conf('bibConf'), checkedItems);

                $(inputElm).after(dataTable);
                $(dataTable).find('.bib-info').each(function () {
                    self.bindBibLink(this);
                });

                $(inputElm).hide();

                selectAll = self.createSelectAllBib();
                attrTable.find('.last-line td').append(selectAll);

                $(selectAll).addClass('dynamic').css('display', 'inherit');
                self.pluginApi.applySelectAll($(selectAll).find('input').get(0), attrTable.get(0));


            } else if (Object.prototype.toString.call(dataItem) === '[object Object]') {
                attrTable.find('.metadata').html(msg + ': <strong>' + dataItem.length + '</strong>');
                attrTable.find('.metadata').append(helpLink);
                self.pluginApi.contextHelp(helpLink, self.pluginApi.translate('bib_list_warning'));
            }
        });
    }

    /**
     * Resets the state back to its initial form (as loaded from server)
     */
    reset():void {
        this.attrFieldsetWrapper.find('table.dynamic').remove();
        this.attrFieldsetWrapper.find('.metadata').empty();
        this.attrFieldsetWrapper.find('input.raw-selection').show();
        this.attrFieldsetWrapper.find('label.select-all.dynamic').hide().removeClass('dynamic');
    }
}


/**
 * Handles state of checkboxes for selecting specific attribute values (i.e. hides the ones
 * representing values leading to an empty selection).
 */
class Checkboxes {

    pluginApi:model.PluginApi;

    attrFieldsetWrapper:JQuery;

    /**
     */
    constructor(pluginApi:model.PluginApi, attrFieldsetWrapper:JQuery) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = attrFieldsetWrapper;
    }

    /**
     *
     * @param value
     * @param vals
     * @returns {any}
     */
    private attrValsContain(value:string, vals:Array<any>):boolean {
        var ans:boolean;

        if (vals.length === 0) {
            ans = false;

        } else if (typeof vals[0] === 'string') {
            ans = $.inArray(value, vals) > -1;

        } else if (typeof vals[0] === 'object') {
            ans = false;
            $.each(vals, function (item) {
                if (item[1] === value) {
                    ans = true;
                    return false;
                }
            });
        }
        return ans;
    }

    /**
     * Updates the checkboxes according to provided 'data' argument
     */
    update(data):void {
        var self = this;

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

            if (!self.attrValsContain(inputVal, data[id])) {
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
    }

    /**
     *
     */
    reset():void {
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
    }

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
    exportStatus():AttributesMap {
        var ans:AttributesMap = {};

        this.attrFieldsetWrapper.find('.attr-selector:checked').each(function () {
            var key:string = stripPrefix($(this).attr('name'));

            if (!ans.hasOwnProperty(key)) {
                ans[key] = [];
            }
            ans[key].push($(this).val());
        });
        return ans;
    }
}


/**
 * Handles displaying of the block diagram which depicts user's selection steps.
 */
class SelectionSteps {

    pluginApi:model.PluginApi;

    jqSteps:JQuery;

    /**
     *
     * @param pluginApi
     */
    constructor(pluginApi:model.PluginApi) {
        this.pluginApi = pluginApi;
        this.jqSteps = $('.live-attributes div.steps');
    }

    /**
     *
     */
    numSteps(v?:any):any { // TODO types
        if (this.jqSteps.data('num-steps') === undefined) {
            this.jqSteps.data('num-steps', 0);
        }
        if (v === undefined) {
            return this.jqSteps.data('num-steps');
        }
        this.jqSteps.data('num-steps', v);
    }

    /**
     *
     */
    usedAttributes(v?:any):any { // TODO types
        if (this.jqSteps.data('used-attrs') === undefined) {
            this.jqSteps.data('used-attrs', []);
        }

        if (v === undefined) {
            return this.jqSteps.data('used-attrs');
        }
        this.jqSteps.data('used-attrs', v);
    }

    /**
     *
     * @param data
     * @param selectedAttrs
     * @param alignedCorpora
     */
    update(data, selectedAttrs, alignedCorpora) {
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
    }

    /**
     *
     */
    reset(): void {
        this.numSteps(0);
        this.usedAttributes([]);
        this.jqSteps.empty();
    }

    /**
     *
     * @param numStep
     * @param innerHTML
     * @returns {string}
     */
    rawCreateStepTable(numStep: number, innerHTML: string): string {
        return '<table class="step"><tr><td class="num">' + (numStep + 1) + '</td> '
            + '<td class="data">' + innerHTML + '</td></tr></table>';
    }

    /**
     *
     * @param selectedAttrs
     * @param usedAttrs a list of already clicked (and thus locked) attributes
     * @returns {Array}
     */
    private expandAttributes(selectedAttrs, usedAttrs:Array<string>):Array<string> {
        var ans:Array<string> = [],
            values:Array<string>,
            html:string;

        for (var p in selectedAttrs) {
            if (selectedAttrs.hasOwnProperty(p) && $.inArray(p, usedAttrs) < 0) {
                usedAttrs.push(p);
                values = selectedAttrs[p];

                if (values.length > 5) {
                    values = selectedAttrs[p].slice(0, 2);
                    values.push('...');
                    values = values.concat(selectedAttrs[p].slice(selectedAttrs[p].length - 3, selectedAttrs[p].length - 1));
                }
                html = '<strong>' + p + '</strong> &#8712; {' + values.join(', ') + '}';
                if (this.numSteps() > 0) {
                    ans.push('... &amp; ' + html);

                } else {
                    ans.push(html);
                }

            }
        }
        return ans;
    }

    /**
     * Generates a wrapper table for selection steps visualisation
     *
     * @param data
     * @param selectedAttrs
     * @returns {string}
     */
    private createStepTable(data:AttributesMap, selectedAttrs:AttributesMap) {
        var ansHtml: string = null,
            usedAttrs = this.usedAttributes(),
            positionInfo = '',
            newAttrs: Array<string>;

        newAttrs = this.expandAttributes(selectedAttrs, usedAttrs);
        if (newAttrs.length > 0) {
            if (data.poscount !== undefined) {
                positionInfo = this.pluginApi.translate('%s positions').replace(/%s/, data.poscount.toString());
            }
            ansHtml = this.rawCreateStepTable(this.numSteps(), newAttrs + '<br />' + positionInfo);
        }
        return ansHtml;
    }
}


/**
 * Handles state of tables wrapping listed values of individual attributes.
 *
 */
class StructTables {

    attrFieldsetWrapper:JQuery;

    selectionSteps:SelectionSteps;

    /**
     *
     * @param attrFieldsetWrapper
     * @param selectionSteps
     */
    constructor(attrFieldsetWrapper:JQuery, selectionSteps:SelectionSteps) {
        this.attrFieldsetWrapper = attrFieldsetWrapper;
        this.selectionSteps = selectionSteps;
    }

    /**
     *
     */
    update():void {
        var self = this;

        $.each(this.selectionSteps.usedAttributes(), function (i, v) {
            self.attrFieldsetWrapper.find('table[data-attr="' + v + '"]').each(function () {
                $(this).addClass('locked');
                $(this).find('tr.last-line label').hide();
            });
        });
    }

    /**
     *
     */
    reset():void {
        this.attrFieldsetWrapper.find('table.envelope').each(function () {
            $(this).filter('.locked').find('tr.last-line label').show();
            $(this).removeClass('locked');
        });
    }
}


/**
 * This class handles aligned corpora as a part of attribute value
 * selection process.
 */
class AlignedCorpora {

    pluginApi:model.PluginApi;

    /**
     *
     * @param pluginApi
     */
    constructor(pluginApi:model.PluginApi) {
        this.pluginApi = pluginApi;
    }

    /**
     * Disables all the corpora not present in data.corpus_id
     *
     * @param data
     */
    update(data) {
        var corpList = data.aligned || [];

        $('#add-searched-lang-widget select option').each(function () {
            if ($.inArray($(this).val(), corpList) >= 0) {
                $(this).addClass('dynamic');
                $(this).attr('disabled', 'disabled');

            } else if ($(this).hasClass('dynamic')) {
                $(this).attr('disabled', null);
            }
        });
    }

    /**
     *
     */
    reset():void {
        $('#add-searched-lang-widget select option.dynamic').each(function () {
            $(this).removeClass('dynamic').attr('disabled', null);
        });
    }

    /**
     * Searches for currently selected aligned corpora
     *
     */
    findSelected():Array<string> {
        var ans = [];

        $('.parallel-corp-lang:visible input[name="sel_aligned"]').each(function () {
            var val = $(this).val();

            if (val) {
                ans.push(val);
            }
        });
        return ans;
    }
}

/**
 * Plugin's main class
 */
class Plugin {

    pluginApi:model.QueryPagePluginApi;

    attrFieldsetWrapper:JQuery;

    updateButton:JQuery;

    resetButton:JQuery;

    rawInputs:LiveData;

    alignedCorpora:AlignedCorpora;

    checkboxes:Checkboxes;

    selectionSteps:SelectionSteps;

    structTables:StructTables;

    /**
     *
     * @param pluginApi
     * @param attrFieldsetWrapper
     * @param updateButton
     * @param resetButton
     */
    constructor(pluginApi:model.QueryPagePluginApi, attrFieldsetWrapper:HTMLElement,
                updateButton:HTMLElement, resetButton:HTMLElement) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = $(attrFieldsetWrapper);
        this.updateButton = $(updateButton);
        this.resetButton = $(resetButton);
        this.rawInputs = new LiveData(pluginApi, attrFieldsetWrapper);
        this.alignedCorpora = new AlignedCorpora(pluginApi);
        this.checkboxes = new Checkboxes(pluginApi, this.attrFieldsetWrapper);
        this.selectionSteps = new SelectionSteps(pluginApi);
        this.structTables = new StructTables(this.attrFieldsetWrapper,
            this.selectionSteps);
    }

    resetAll = () => { // using lexical scope here
        this.checkboxes.reset();
        this.alignedCorpora.reset();
        this.rawInputs.reset();
        this.selectionSteps.reset();
        this.structTables.reset();
    };

    updateAttrTables = (data, selectedAttrs) => {  // using lexical scope here
        this.alignedCorpora.update(data);
        this.checkboxes.update(data);
        this.rawInputs.update(data);
        this.selectionSteps.update(data, selectedAttrs, this.alignedCorpora);
        this.structTables.update();
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
     */
    loadData(successAction:(d, s) => void, ajaxAnimation:AjaxAnimation) {
        var self = this,
            requestURL:string,
            alignedCorpnames,
            selectedAttrs = this.checkboxes.exportStatus();

        requestURL = 'filter_attributes?corpname=' + this.pluginApi.conf('corpname');

        alignedCorpnames = this.alignedCorpora.findSelected();
        if (alignedCorpnames) {
            requestURL += '&aligned=' + JSON.stringify(alignedCorpnames);
        }

        ajaxAnimation.start();

        this.pluginApi.ajax(requestURL, {
            type: 'POST',
            dataType: 'json',
            data: 'attrs=' + JSON.stringify(selectedAttrs),
            success: function (data) {
                successAction(data, selectedAttrs);
                ajaxAnimation.stop();
            },
            error: function (jqXHR, textStatus, errorThrown) {
                ajaxAnimation.stop();
                self.pluginApi.showMessage('error', errorThrown);
            }
        });
    }

    /**
     *
     */
    bindSelectionUpdateEvent(successAction:(data, attrs) => void) { // TODO types
        var self = this;

        this.updateButton.on('click', function () {
            var ajaxAnimation:AjaxAnimation;

            ajaxAnimation = {
                animElm: null,
                start: function () {
                    this.animElm = self.pluginApi.ajaxAnim();
                    $(this.animElm).css({
                        'position': 'absolute',
                        'left': ($(window).width() / 2 - $(this.animElm).width() / 2) + 'px',
                        'top': ($(window).height() / 2) + 'px'
                    });
                    $('#content').append(this.animElm);
                },
                stop: function () {
                    $(this.animElm).remove();
                }
            };

            self.loadData(successAction, ajaxAnimation);
        });
    }

    /**
     * This function loads bibliography entries into unmodified attribute list
     * fieldset (i.e. it is best run right after the page is loaded).
     * There is no need to perform any checks whether items can be loaded for
     * the current corpus because the function does the check by itself.
     *
     */
    initializeSearchAttrFiledsets(): void {
        var self = this,
            fieldset = $('#specify-query-metainformation'),
            ajaxAnimation:AjaxAnimation,
            bibAttr:string = fieldset.find('.text-type-params').attr('data-bib-attr'),
            bibTable:JQuery = null;


        if (bibAttr) {
            fieldset.find('table.envelope').each(function (i, table) {
                if ($(table).attr('data-attr') === bibAttr) {
                    bibTable = $(table);
                    return false;
                }
            });

            if (bibTable) {
                ajaxAnimation = {
                    animElm: null,
                    start: function () {
                        this.animElm = self.pluginApi.ajaxAnimSmall();
                        this.animElm.css({
                            'display': 'block',
                            'margin': '0 auto'
                        });
                        bibTable.find('input.raw-selection').after(this.animElm);
                    },
                    stop: function () {
                        this.animElm.remove();
                    }
                };

                if (!fieldset.hasClass('inactive')) {
                    self.loadData(this.updateAttrTables, ajaxAnimation);
                }
            }
        }
    }


    /**
     * This function initializes the plug-in. It must be run after all the page dependencies
     * are ready.
     */
    init(): void {
        var self = this;

        this.attrFieldsetWrapper.find('.attr-selector').on('click', function () {
            if ($(this).is(':checked')) {
                $(this).addClass('user-selected');

            } else {
                $(this).removeClass('user-selected');
            }
        });

        this.bindSelectionUpdateEvent(this.updateAttrTables);

        this.resetButton.on('click', this.resetAll);
        $(window).on('unload', this.resetAll);
        this.pluginApi.registerReset(this.resetAll);
        this.initializeSearchAttrFiledsets();
        this.pluginApi.bindFieldsetToggleEvent(function (fieldset) {
            if (!$(fieldset).hasClass('inactive')) {
                self.initializeSearchAttrFiledsets();
            }
        });
    }
}

/**
 *
 * @param pluginApi
 * @param updateButton
 * @param resetButton
 * @param attrFieldsetWrapper
 */
export function init(pluginApi:model.QueryPagePluginApi,
                     updateButton:HTMLElement, resetButton:HTMLElement,
                     attrFieldsetWrapper:HTMLElement) {
    var plugin = new Plugin(pluginApi, attrFieldsetWrapper, updateButton, resetButton);
    plugin.init();
}