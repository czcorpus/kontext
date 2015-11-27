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

/// <reference path="../../../ts/declarations/jquery.d.ts" />
/// <reference path="../../../ts/declarations/popupbox.d.ts" />
/// <reference path="../../../ts/declarations/common.d.ts" />

import popupBox = require('popupbox');
import $ = require('jquery');
import rangeSelector = require('./rangeSelector');

function stripPrefix(s: string): string {
    let x = /^sca_(.+)$/;
    let ans:RegExpExecArray;

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

    pluginApi:Kontext.PluginApi;

    attrFieldsetWrapper:JQuery;

    /**
     * @param pluginApi a plugin api object produced by document.js
     * @param attrFieldsetWrapper parent element of all the attribute selectors
     * @constructor
     */
    constructor(pluginApi:Kontext.PluginApi, attrFieldsetWrapper:HTMLElement) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = $(attrFieldsetWrapper);
    }

    /**
     *
     */
    private renderBibliography(data:Array<string>, rootElm:HTMLElement):void {
        let jqRootElm:JQuery = $(rootElm);

        for (let p in data) {
            if (data.hasOwnProperty(p) && data[p]) {
                jqRootElm.append('<strong>' + p + '</strong>: ' + data[p] + '<br />');
            }
        }
    }

    /**
     *
     */
    private createSelectAllBib():HTMLElement {
        let wrapper:HTMLElement = window.document.createElement('label');

        $(wrapper).append(' <input type="checkbox" /> ' + this.pluginApi.translate('global__select_all'))
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
        let table:HTMLElement = window.document.createElement('table');
        let rowIdentKey:string;   // specifies data key which uniquely identifies data rows
        let rowIdentValue:string; // specifies unique value which identifies respective data row
        let rowIdentTitle:string;

        $(table).addClass('dynamic');
        $.each(rows, function (i:number, row:any) {
            let checked = $.inArray(typeof row === 'object' ? row[1] : row, checkedItems) > -1;
            let bibLink;
            let itemLabel;
            let labelAttrName;

            if ($.isArray(row)) { // => value and label differ
                itemLabel = row[0];
                rowIdentValue = row[1];
                rowIdentTitle = row[2] ? row[2] : row[1];

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
                + itemLabel + '</label title="' + rowIdentTitle + '"></td><td>' + bibLink + '</td></tr>');

            } else {
                $(table).append('<tr><td><label title="' + rowIdentTitle + '"><input class="attr-selector" type="checkbox" name="sca_'
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
        let self = this;

        popupBox.bind(target,
            function (tooltipBox, finalizeCallback) {
                let ajaxAnimElm = self.pluginApi.ajaxAnim();

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

                self.pluginApi.ajax(self.pluginApi.createActionUrl('/corpora/bibliography?corpname=' + self.pluginApi.getConf('corpname')
                    + '&id=' + $(target).attr('data-bib-id')),
                    {
                        dataType: 'json',
                        success: function (data) {
                            let bibHtml = document.createElement('div');

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
        let self = this;

        self.attrFieldsetWrapper.find('.raw-selection').each(function () {
            let ident = stripPrefix($(this).attr('name'));
            let dataItem:AvailAttrValues = data[ident];
            let inputElm = this;
            let attrTable:JQuery = $(this).closest('table.envelope');
            let checkedItems = [];
            let selectAll:HTMLElement;
            let dataTable:HTMLElement;
            let msg = self.pluginApi.translate('ucnkLA__num_of_matching_items');
            let helpLink = window.document.createElement('a');

            attrTable.find('table.dynamic .attr-selector:checked').each(function () {
                checkedItems.push($(this).val());
            });


            attrTable.find('table.dynamic').remove();
            attrTable.find('.select-all').css('display', 'none');
            $(inputElm).show();

            if ($.isArray(dataItem)) {
                attrTable.find('tr.metadata td').empty();
                dataTable = self.createDataTable(dataItem, ident, self.pluginApi.getConf('bibConf'), checkedItems);

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
                attrTable.find('tr.metadata td').html(msg + ': <strong>' + dataItem.length + '</strong>');
                attrTable.find('tr.metadata td').append(helpLink);
                self.pluginApi.contextHelp(helpLink, self.pluginApi.translate('ucnkLA__bib_list_warning'));
            }
        });
    }

    /**
     * Resets the state back to its initial form (as loaded from server)
     */
    reset():void {
        this.attrFieldsetWrapper.find('table.dynamic').remove();
        this.attrFieldsetWrapper.find('tr.metadata td').empty();
        this.attrFieldsetWrapper.find('input.raw-selection').show();
        this.attrFieldsetWrapper.find('label.select-all.dynamic').hide().removeClass('dynamic');
    }
}


/**
 * Handles state of checkboxes for selecting specific attribute values (i.e. hides the ones
 * representing values leading to an empty selection).
 */
class Checkboxes {

    pluginApi:Kontext.PluginApi;

    attrFieldsetWrapper:JQuery;

    /**
     */
    constructor(pluginApi:Kontext.PluginApi, attrFieldsetWrapper:JQuery) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = attrFieldsetWrapper;
    }

    /**
     *
     * @param value
     * @param vals
     * @returns {any}
     */
    private getAttrVal<T>(value:T, vals:Array<T>):T {
        let ans:T;

        if (vals.length === 0) {
            ans = null;

        } else if (typeof vals[0] === 'string') {
            ans = null;
            $.each(vals, function (i, item) {
                if (item === value) {
                    ans = item;
                    return false;
                }
            });

        } else if (typeof vals[0] === 'object') {
            ans = null;
            $.each(vals, function (i, item) {
                // (0 = shortened, 1 = id, 2 = full title)
                if (String(item[1]) === String(value)) {
                    ans = item;
                    return false;
                }
            });
        }
        return ans;
    }

    private updateNumberOfPositions(trElm:JQuery, value:string) {
        trElm.find('td.num').text(value);
    }

    /**
     * Updates the checkboxes according to provided 'data' argument
     */
    update(data):void {
        let self = this;

        this.attrFieldsetWrapper.find('.attr-selector').each(function () {
            let id;
            let trElm = $(this).closest('tr');
            let labelElm = $(this).closest('label');
            let inputVal = $(this).val() !== self.pluginApi.getConf('emptyAttrValuePlaceholder') ? $(this).val() : '';


            if ($(this).attr('data-virt-name')) {
                id = $(this).attr('data-virt-name');

            } else {
                id = stripPrefix($(this).attr('name'));
            }

            let attrVal:Array<string> = self.getAttrVal(inputVal, data[id]);
            if (!attrVal) {
                trElm.addClass('excluded');
                labelElm.removeClass('locked');

            } else {
                trElm.removeClass('excluded');
                if ($(this).is(':checked')) {
                    labelElm.addClass('locked');
                    $(this).attr('disabled', 'disabled');
                    $(this).after('<input class="checkbox-substitute" type="hidden" '
                    + 'name="' + $(this).attr('name') + '" value="' + $(this).attr('value') + '" />');

                } else { // available checkbox
                    self.updateNumberOfPositions(trElm, attrVal[3]);
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
        let ans:AttributesMap = {};

        this.attrFieldsetWrapper.find('.attr-selector:checked').each(function () {
            let key:string = stripPrefix($(this).attr('name'));

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

    pluginApi:Kontext.PluginApi;

    jqSteps:JQuery;

    /**
     *
     * @param pluginApi
     */
    constructor(pluginApi:Kontext.PluginApi) {
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
            innerHTML = '<strong>' + this.pluginApi.getConf('corpname') + '</strong> <br />&amp; '
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
                positionInfo = this.pluginApi.translate('ucnkLA__num_positions', {num_pos: data.poscount.toString()});
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
class StructTables implements rangeSelector.CheckboxLists {

    pluginApi:Kontext.QueryPagePluginApi;

    attrFieldsetWrapper:JQuery;

    selectionSteps:SelectionSteps;

    checkboxes:Checkboxes;

    tables:{[attribute:string]:HTMLElement};

    onLockCallbacks:{[attribute:string]:()=>void};

    rangeWidgets:{[attribute:string]:rangeSelector.RangeSelector};

    numericFlags:{[attribute:string]:boolean};

    rangeFlags:{[attribute:string]:boolean};

    intervalChars:Array<string>;

    /**
     *
     * @param attrFieldsetWrapper
     * @param selectionSteps
     */
    constructor(pluginApi:Kontext.QueryPagePluginApi, attrFieldsetWrapper:JQuery,
            selectionSteps:SelectionSteps, checkboxes:Checkboxes, intervalChars:Array<string>) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = attrFieldsetWrapper;
        this.selectionSteps = selectionSteps;
        this.checkboxes = checkboxes;
        this.intervalChars = intervalChars;
        this.tables = {};
        this.onLockCallbacks = {};
        this.rangeWidgets = {};
        this.numericFlags = {};
        this.rangeFlags = {};
    }

    init():void {
        let self = this;
        this.attrFieldsetWrapper.find('table.envelope').each(function () {
            let attribName = $(this).attr('data-attr');
            self.tables[attribName] = this;
            self.numericFlags[attribName] = Boolean(parseInt($(this).attr('data-is-numeric')));
            self.rangeFlags[attribName] = Boolean(parseInt($(this).attr('data-is-range')));
            if (self.tableIsNumeric(attribName)) {
                self.createRangePanel(attribName);
            }
        });
    }

    getTable(name:string):HTMLElement {
        return this.tables[name];
    }

    private getTableHeadingRow(attribName:string):HTMLElement {
        if (this.tables.hasOwnProperty(attribName)) {
            return $(this.tables[attribName]).find('tr.attrib-name:nth-child(1)').get(0);
        }
        return undefined;
    }

    applyOnCheckboxes(attribName:string, callback:{(i:number, item:HTMLElement):void}):void {
        let tab = this.tables[attribName];

        if (tab) {
            $(tab).find('input.attr-selector').each(callback);

        } else {
            throw new Error('no such attribute table: ' + attribName);
        }
    }

    private createRangeWidget(attribName:string):HTMLElement {
        let actionLink:HTMLElement = window.document.createElement('a');
        let table = this.tables[attribName];
        let self = this;
        let rSel:rangeSelector.RangeSelector;

        $(actionLink)
            .addClass('util-button')
            .text(this.pluginApi.translate('ucnkLA__select_range'));

        rSel = rangeSelector.create(this.pluginApi, this, $(table).find('tr.data-rows').get(0), attribName,
                    this.intervalChars);
        rSel.init(
            actionLink,
            function () {
                $(table).find('label.select-all').hide();
            },
            function () {
                if (!$(table).hasClass('locked')) {
                    $(table).find('label.select-all').show();
                }
            }
        );

        this.onLockCallbacks[attribName] = () => {
             rSel.hide();
        }

        this.rangeWidgets[attribName] = rSel;

        return actionLink;
    }

    private createRangePanel(attribName:string) {
        let table = this.tables[attribName];
        if (table) {
            let lastRow = $(table).find('tr.last-line');
            let tr = window.document.createElement('tr');
            let td = window.document.createElement('td');
            lastRow.before(tr);
            $(tr)
                .addClass('define-range')
                .append(td);
            $(td).append(this.createRangeWidget(attribName));
        }
    }

    tableIsNumeric(attribName:string) {
        return this.numericFlags[attribName] || this.rangeFlags[attribName];
    }

    tableIsRange(attribName:string):boolean {
        return this.rangeFlags[attribName];
    }

    /**
     *
     */
    update():void {
        let self = this;

        $.each(this.selectionSteps.usedAttributes(), function (i, v) {
            self.attrFieldsetWrapper.find('table[data-attr="' + v + '"]').each(function () {
                $(this).addClass('locked');
                (self.onLockCallbacks[v] || (()=>undefined)).apply(self);
                $(this).find('tr.last-line label').hide();
                let widget = self.rangeWidgets[v];
                if (widget) {
                    widget.hide();
                    widget.lockSwitchLink();
                }
            });
        });
    }

    /**
     *
     */
    reset():void {
        let self = this;
        this.attrFieldsetWrapper.find('table.envelope').each(function () {
            let attribName = $(this).attr('data-attr');
            $(this).filter('.locked').find('tr.last-line label').show();
            $(this).removeClass('locked');
            let widget = self.rangeWidgets[attribName];
            if (widget) {
                widget.show();
                widget.unLockSwitchLink();
            }
        });
    }
}


/**
 * This class handles aligned corpora as a part of attribute value
 * selection process.
 */
class AlignedCorpora {

    pluginApi:Kontext.PluginApi;

    /**
     *
     * @param pluginApi
     */
    constructor(pluginApi:Kontext.PluginApi) {
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

    pluginApi:Kontext.QueryPagePluginApi;

    attrFieldsetWrapper:JQuery;

    updateButton:JQuery;

    resetButton:JQuery;

    rawInputs:LiveData;

    alignedCorpora:AlignedCorpora;

    checkboxes:Checkboxes;

    selectionSteps:SelectionSteps;

    structTables:StructTables;

    private intervalChars:Array<string>;

    /**
     *
     * @param pluginApi
     * @param attrFieldsetWrapper
     * @param updateButton
     * @param resetButton
     */
    constructor(pluginApi:Kontext.QueryPagePluginApi, pluginConf:{[key:string]:any},
                attrFieldsetWrapper:HTMLElement, updateButton:HTMLElement, resetButton:HTMLElement) {
        this.pluginApi = pluginApi;
        this.attrFieldsetWrapper = $(attrFieldsetWrapper);
        this.updateButton = $(updateButton);
        this.resetButton = $(resetButton);
        this.rawInputs = new LiveData(pluginApi, attrFieldsetWrapper);
        this.alignedCorpora = new AlignedCorpora(pluginApi);
        this.checkboxes = new Checkboxes(pluginApi, this.attrFieldsetWrapper);
        this.selectionSteps = new SelectionSteps(pluginApi);
        this.intervalChars = pluginConf['interval_chars'];
        this.structTables = new StructTables(this.pluginApi, this.attrFieldsetWrapper,
            this.selectionSteps, this.checkboxes, this.intervalChars);
    }

    resetAll = () => { // using lexical scope here
        this.checkboxes.reset();
        this.alignedCorpora.reset();
        this.rawInputs.reset();
        this.selectionSteps.reset();
        this.structTables.reset();
        this.initializeSearchAttrFiledsets();

    };

    /**
     * Ensures all the text type boxes are updated according to the
     * current selection and available data.
     *
     * @param data
     * @param selectedAttrs
     */
    updateAttrTables = (data, selectedAttrs) => {  // using lexical scope here
        this.alignedCorpora.update(data);
        this.checkboxes.update(data);
        this.rawInputs.update(data);
        this.selectionSteps.update(data, selectedAttrs, this.alignedCorpora);
        this.structTables.update();
    };

    /**
     * This just initializes text type boxes once the page is loaded.
     *
     * @param data
     * @param selectedAttrs
     */
    initAttrTables = (data, selectedAttrs) => {  // using lexical scope here
        this.rawInputs.update(data);
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
    loadData(successAction:(d, s) => void, ajaxAnimation:AjaxAnimation, selectedCheckboxes:AttributesMap) {
        let self = this;
        let requestURL:string;
        let alignedCorpnames;
        let ajaxProm;

        requestURL = self.pluginApi.createActionUrl('filter_attributes?corpname='
                        + this.pluginApi.getConf('corpname'));
        alignedCorpnames = this.alignedCorpora.findSelected();
        if (alignedCorpnames) {
            requestURL += '&aligned=' + JSON.stringify(alignedCorpnames);
        }

        ajaxAnimation.start();

        ajaxProm = $.ajax(requestURL, {
            type: 'POST',
            dataType: 'json',
            data: 'attrs=' + JSON.stringify(selectedCheckboxes),
        });

        ajaxProm.then(
            function (data) {
                if (!data.error) {
                    if (data.poscount == 0) {
                        self.pluginApi.showMessage('error',
                                self.pluginApi.translate('ucnkLA__no_matching_data'));

                    } else {
                        successAction(data, selectedCheckboxes);
                    }

                } else {
                    self.pluginApi.showMessage('error', data.error);
                }
                ajaxAnimation.stop();

            },
            function (jqXHR, textStatus, errorThrown) {
                ajaxAnimation.stop();
                self.pluginApi.showMessage('error', errorThrown);
            }
        );
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

            self.loadData(successAction, ajaxAnimation, self.checkboxes.exportStatus());
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
        let self = this;
        let fieldset = $('#specify-query-metainformation');
        let ajaxAnimation:AjaxAnimation;
        let bibAttr:string = fieldset.find('.text-type-params').attr('data-bib-attr');
        let bibTable:JQuery = null;

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
                    self.loadData(this.initAttrTables, ajaxAnimation, {});
                }
            }
        }
    }


    /**
     * This function initializes the plug-in. It must be run after all the page dependencies
     * are ready.
     */
    init(): void {
        let self = this;

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
        this.structTables.init();
    }
}

/**
 *
 * @param pluginApi
 * @param updateButton
 * @param resetButton
 * @param attrFieldsetWrapper
 */
export function init(pluginApi:Kontext.QueryPagePluginApi,
                     conf:{[key:string]:string},
                     updateButton:HTMLElement, resetButton:HTMLElement,
                     attrFieldsetWrapper:HTMLElement) {
    let pluginConf:{[key:string]:any} = conf['pluginData']['live_attributes'];
    if (!pluginConf) {
        throw new Error('Missing configuration for live_attributes');
    }
    let plugin = new Plugin(pluginApi, pluginConf, attrFieldsetWrapper, updateButton, resetButton);
    plugin.init();
}