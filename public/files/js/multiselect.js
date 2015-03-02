/*
 * Copyright (c) 2012 Institute of the Czech National Corpus
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
 * This library provides a replacement for standard SELECT element with 'multiple' option enabled.
 */
define(['jquery', 'win'], function ($, win) {
    'use strict';

    var lib = {};

    /**
     *
     * @param opt {object} options
     * @constructor
     */
    function MultiSelect(opt) {

        /**
         *
         * @type {object}
         */
        this.opt = opt;

        /**
         *
         * @type {null}
         */
        this.ulElement = null;

        /**
         * Contains TBODY elements of each block
         */
        this.blocks = {};

        /**
         * Contains references to hidden inputs which are
         * activated whenever there is no checked checkbox in a block
         */
        this.defaultValues = {};

        /**
         *
         */
        this.blockSwitchLinks = {};

        /**
         *
         */
        this.activeBlockId = null;

        /**
         *
         */
        this.useNamedCheckboxes = null;

        /**
         *
         */
        this.allowMultipleOpenedBoxes = false;

        /**
         *
         */
        this.itemIdCounter = 0;
    }

    /**
     *
     * @param wrapperElem multi-select component will be inserted into this element
     */
    MultiSelect.prototype.init = function (wrapperElem) {
        var style = {};

        this.useNamedCheckboxes = this.opt.hasOwnProperty('useNamedCheckboxes') ? this.opt.useNamedCheckboxes : true;
        this.allowMultipleOpenedBoxes = this.opt.allowMultipleOpenedBoxes;
        if (typeof wrapperElem === 'string' && wrapperElem.indexOf('#') !== 0) {
            wrapperElem = $('#' + wrapperElem).get(0);
        }
        if (this.opt.hasOwnProperty('margin')) {
            style.margin = this.opt.margin;
        }
        if (this.opt.hasOwnProperty('padding')) {
            style.padding = this.opt.padding;
        }
        if (this.opt.hasOwnProperty('width')) {
            style.width = this.opt.width;
        }
        $(wrapperElem).css(style);

        this.ulElement = win.document.createElement('UL');
        $(this.ulElement).attr('class', 'multiselect');
        $(wrapperElem).empty().append(this.ulElement);
    };


    /**
     * Shows/hides multi-select block. If no status is provided then visibility is changed
     * (visible->hidden, hidden->visible).
     *
     * @param {string} blockId
     * @param {string} [status]
     */
    MultiSelect.prototype.flipBlockVisibility = function (blockId, status) {
        var switchLink = this.blockSwitchLinks[blockId],
            tbodyElm = this.blocks[blockId],
            self = this;


        if (($(tbodyElm).parent().css('display') === 'none' && status !== 'none') || status === 'table') {
            if (!this.allowMultipleOpenedBoxes) {
                this.eachBlock(function (block, blockId) {
                    $(self.blocks[blockId]).parent().css('display', 'none');
                    if (self.getNumSelected(blockId) === 0) {
                        $(self.blockSwitchLinks[blockId]).attr('class', 'switch-link');

                    } else {
                        $(self.blockSwitchLinks[blockId]).attr('class', 'switch-link used');
                    }
                });
            }
            $(tbodyElm).parent().css('display', 'table');
            $(switchLink).attr('class', 'switch-link active');

        } else if (($(tbodyElm).parent().css('display') === 'table' && status !== 'table') || status === 'none') {
            $(tbodyElm).parent().css('display', 'none');
            if (this.getNumSelected(blockId) === 0) {
                $(switchLink).attr('class', 'switch-link');

            } else {
                $(switchLink).attr('class', 'switch-link used');
            }
        }
    };

    /**
     * Adds checkbox list box
     *
     * @param blockId {String}
     * @param blockLabel {String}
     * @param {string} [defaultValue] value used if no checkbox is selected
     * @param {object} [eventCallbacks] object mapping events to callbacks
     * @return {object}
     */
    MultiSelect.prototype.addBlock = function (blockId, blockLabel, defaultValue, eventCallbacks) {
        var liElement,
            switchLink,
            statusText,
            itemTable,
            itemTbody,
            prop,
            self = this;

        blockLabel = blockLabel || blockId;

        liElement = win.document.createElement('LI');
        $(liElement).css({
            margin: 0,
            overflow: 'hidden',
            clear: 'both'
        });
        $(liElement).data('block-id', blockId);
        $(this.ulElement).append(liElement);
        switchLink = win.document.createElement('A');
        $(switchLink).attr('class', 'switch-link');
        $(switchLink).empty().append(blockLabel);
        this.blockSwitchLinks[blockId] = switchLink;
        $(liElement).append(switchLink);

        statusText = win.document.createElement('SPAN');
        $(statusText).attr('class', 'status-text');
        $(statusText).empty().append('[ 0 ]');
        //liElement.insert(statusText);
        $(switchLink).append(statusText);

        itemTable = win.document.createElement('TABLE');
        $(liElement).append(itemTable);
        $(itemTable).attr('class', 'checkbox-list');
        itemTbody = win.document.createElement('TBODY');
        $(itemTbody).attr('class', 'item-' + blockId);
        $(itemTable).append(itemTbody);
        this.blocks[blockId] = itemTbody;
        $(switchLink).bind('click', function () {
            self.activeBlockId = blockId;
            self.flipBlockVisibility(blockId);
        });
        $(itemTbody).parent().css({ display: 'none'});
        this.addDefaultValue(blockId, liElement, defaultValue || ''); // 'default default' value

        eventCallbacks = eventCallbacks || {};
        for (prop in eventCallbacks) {
            if (eventCallbacks.hasOwnProperty(prop) && typeof (eventCallbacks[prop]) === 'function') {
                $(switchLink).bind(prop, eventCallbacks[prop]);
            }
        }
        return this;
    };


    /**
     * Iterates over all multi-select blocks.
     * Callback can have following three parameters:
     * 1) block - block object itself
     * 2) blockId - identifier of the block
     * 3) i - index of the block
     */
    MultiSelect.prototype.eachBlock = function (callback) {
        var prop,
            i = 0;
        for (prop in this.blocks) {
            if (this.blocks.hasOwnProperty(prop)) {
                callback(this.blocks[prop], prop, i);
                i += 1;
            }
        }
    };

    /**
     * Returns TBODY block identified by its order (starting from zero)
     *
     * @param idx
     * @return {Object} object representing found TBODY element or null
     * if nothing found or if invalid index is provided
     */
    MultiSelect.prototype.getBlockByIndex = function (idx) {
        var items = $(this.ulElement).find('tbody');
        if (idx >= 0 && idx < items.length) {
            return items[idx];
        }
        return null;
    };

    /**
     * Returns order (in the related list of DOM elements, starting from zero)
     * of the block specified by blockId.
     *
     * @param blockId
     */
    MultiSelect.prototype.getBlockOrder = function (blockId) {
        var i,
            ans = null,
            items = $(this.ulElement).find('tbody');

        for (i = 0; i < items.length; i += 1) {
            if (items.get(i) === this.blocks[blockId]) {
                ans = i;
                break;
            }
        }
        return ans;
    };

    /**
     * @param blockId {String}
     */
    MultiSelect.prototype.clearBlock = function (blockId) {
        $(this.blocks[blockId]).empty();
    };

    /**
     * @param blockId {String}
     */
    MultiSelect.prototype.containsBlock = function (blockId) {
        return this.blocks.hasOwnProperty(blockId);
    };

    /**
     *
     */
    MultiSelect.prototype.updateBlockStatusText = function (blockId, text) {
        $(this.blockSwitchLinks[blockId]).parent().find('span[class="status-text"]').each(function () {
            $(this).empty().append(text);
        });
    };

    /**
     *
     * @param blockId
     * @param value
     * @param label
     * @param {function} [clickCallback]
     * @return {object}
     */
    MultiSelect.prototype.addItem = function (blockId, value, label, clickCallback) {
        var trElm,
            tdElm,
            labelElm,
            inputElm,
            inputElmId,
            self = this;

        if (!this.blocks.hasOwnProperty(blockId)) {
            throw new Error('Cannot add item to the block ' + blockId + '. Block does not exist.');
        }
        trElm = win.document.createElement('TR');
        $(this.blocks[blockId]).append(trElm);
        tdElm = win.document.createElement('TD');
        $(tdElm).attr('class', 'checkbox-cell');
        $(trElm).append(tdElm);
        inputElm = win.document.createElement('INPUT');
        $(inputElm).attr('type', 'checkbox');
        if (this.useNamedCheckboxes) {
            $(inputElm).attr('name', blockId);
        }
        inputElmId = 'c_' + blockId + '_' + this.itemIdCounter;
        $(inputElm).attr('id', inputElmId);
        this.itemIdCounter += 1;
        $(inputElm).attr('value', value);
        $(tdElm).append(inputElm);

        tdElm = win.document.createElement('TD');
        $(trElm).append(tdElm);

        labelElm = win.document.createElement('LABEL');
        $(labelElm).attr('for', inputElmId);
        $(tdElm).append(labelElm);
        $(labelElm).empty().append(label);

        $(inputElm).bind('click', function () {
            self.activeBlockId = blockId;
            if (self.getNumSelected(blockId) === 0) {
                $(self.defaultValues[blockId]).attr('value',
                    $(self.defaultValues[blockId]).data('orig-value'));
                $(self.blockSwitchLinks[blockId]).attr('class', 'switch-link');

            } else {
                $(self.defaultValues[blockId]).attr('value', '');
                $(self.blockSwitchLinks[blockId]).attr('class', 'switch-link used');
            }
        });
        if (typeof clickCallback === 'function') {
            $(inputElm).bind('click', clickCallback);
        }
        return this;
    };

    /**
     * @param blockId
     * @param parentElement
     * @param value
     */
    MultiSelect.prototype.addDefaultValue = function (blockId, parentElement, value) {
        var inputElm;

        inputElm = win.document.createElement('INPUT');
        $(inputElm).attr({
            'type': 'hidden',
            'data-orig-value': value,
            'value': value,
            'name': blockId
        });
        $(parentElement).append(inputElm);
        this.defaultValues[blockId] = inputElm;
    };

    /**
     *
     * @param blockId {String}
     * @param value {String}
     */
    MultiSelect.prototype.setDefaultValue = function (blockId, value) {
        $(this.defaultValues[blockId]).data('orig-value', value);
        if ($(this.defaultValues[blockId]).attr('value')) {
            $(this.defaultValues[blockId]).attr('value', value);
        }
    };

    /**
     *
     * @param blockId
     * @param value
     */
    MultiSelect.prototype.checkItem = function (blockId, value) {
        var items = $(this.blocks[blockId]).find('input[type="checkbox"][value="' + value + '"]');
        if (items.length === 1) {
            items[0].checked = true;
        }
    };

    /**
     *
     * @param blockId
     * @param value
     */
    MultiSelect.prototype.uncheckItem = function (blockId, value) {
        var items = $(this.blocks[blockId]).find('input[type="checkbox"][value="' + value + '"]');
        if (items.length === 1) {
            items[0].checked = false;
        }
    };

    /**
     *
     */
    MultiSelect.prototype.uncheckAll = function () {
        this.activeBlockId = null;
        $(this.ulElement).find('input[type="checkbox"]').attr('checked', false);
    };

    /**
     *
     */
    MultiSelect.prototype.collapseAll = function () {
        var self = this;

        this.eachBlock(function (block, blockId) {
            self.flipBlockVisibility(blockId, 'none');
        });
    };

    /**
     * @param {string} blockId block to be disabled
     */
    MultiSelect.prototype.disableBlock = function (blockId) {
        $(this.blocks[blockId]).find('input[type="checkbox"]').attr('disabled', 'disabled');
    };

    /**
     *
     * @return {Object}
     */
    MultiSelect.prototype.exportStatus = function () {
        var ans = {},
            setStatus,
            self = this;

        setStatus = function (prop) {
            if ($(this).is(':checked')) {
                ans[prop].push($(this).val());
            }
        };

        this.eachBlock(function (block, blockId) {
            ans[blockId] = [];
            $(self.blocks[blockId]).find('input[type="checkbox"]').each(setStatus, [blockId]);
        });
        return ans;
    };

    /**
     * Returns number of checkboxes (total or within a block
     * if blockId is defined) checked.
     *
     * @param {string} [blockId]
     * @return {number}
     */
    MultiSelect.prototype.getNumSelected = function (blockId) {
        if (blockId !== undefined) {
            return $(this.blocks[blockId]).find('input[type="checkbox"]:checked').length;
        }
        return $(this.ulElement).find('input[type="checkbox"]:checked').length;
    };

    /**
     *
     * @param {HTMLElement} wrapperElem
     * @param opt {object} configuration options
     *   useNamedCheckboxes
     * @param {object} [json]
     * @return {object}
     */
    lib.createMultiselectComponent = function (wrapperElem, opt, json) {
        if (json !== undefined) {
            return lib.buildSkeletonFromJson(wrapperElem, opt, json);
        }
        return lib.buildSkeleton(wrapperElem, opt);
    };

    /**
     *
     * @param wrapperElem
     * @param opt
     * @param jsonData
     * @returns {*}
     */
    lib.buildSkeletonFromJson = function (wrapperElem, opt, jsonData) {
        var prop,
            skeleton,
            item,
            i;

        skeleton = lib.buildSkeleton(wrapperElem, opt);

        for (prop in jsonData) {
            if (jsonData.hasOwnProperty(prop)) {
                item = jsonData[prop];
                skeleton.addBlock(prop, item.label, item.defaultValue);
                for (i = 0; i < item.items.length; i += 1) {
                    skeleton.addItem(prop, item.items[i].value, item.items[i].label);
                }
            }
        }
        return skeleton;
    };


    /**
     *
     * @param wrapperElem
     * @param opt configuration options
     * @return {Object}
     */
    lib.buildSkeleton = function (wrapperElem, opt) {
        var multiSelect;

        multiSelect = new MultiSelect(opt || {});
        multiSelect.init(wrapperElem);
        return multiSelect;
    };

    return lib;
});
