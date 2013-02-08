/*
 * Copyright (c) 2012 Czech National Corpus
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
define(['jquery'], function ($) {
    'use strict';

    var buildSkeleton,
        buildSkeletonFromJson,
        createMultiselectComponent;

    /**
     *
     * @param wrapperElem
     * @param opt configuration options
     *   useNamedCheckboxes
     * @param json
     * @return {Object}
     */
    createMultiselectComponent = function (wrapperElem, opt, json) {
        if (json !== undefined) {
            return buildSkeletonFromJson(wrapperElem, opt, json);
        }
        return buildSkeleton(wrapperElem, opt);
    };

    buildSkeletonFromJson = function (wrapperElem, opt, jsonData) {
        var prop,
            skeleton,
            item,
            i;

        skeleton = buildSkeleton(wrapperElem, opt);

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
    buildSkeleton = function (wrapperElem, opt) {

        opt = opt || {};

        /**
         *
         * @type {Object}
         */
        var multiSelect = {

            ulElement : null,

            /**
             * Contains TBODY elements of each block
             */
            blocks : {},

            /**
             * Contains references to hidden inputs which are
             * activated whenever there is no checked checkbox in a block
             */
            defaultValues : {},

            /**
             *
             */
            blockSwitchLinks : {},

            /**
             *
             */
            activeBlockId : null,

            /**
             *
             */
            useNamedCheckboxes : null,

            /**
             *
             */
            allowMultipleOpenedBoxes : false,

            /**
             *
             */
            itemIdCounter : 0,

            /**
             *
             * @param wrapperElem multi-select component will be inserted into this element
             */
            init : function (wrapperElem) {
                var marginStyle,
                    paddingStyle,
                    widthStyle;

                multiSelect.useNamedCheckboxes = opt.hasOwnProperty('useNamedCheckboxes') ? opt.useNamedCheckboxes : true;
                multiSelect.allowMultipleOpenedBoxes = opt.allowMultipleOpenedBoxes;
                if (typeof wrapperElem === 'string') {
                    wrapperElem = $('#' + wrapperElem).get(0);
                }
                marginStyle = opt.hasOwnProperty('margin') ? opt.margin : '5px';
                paddingStyle = opt.hasOwnProperty('padding') ? opt.padding : '5px';
                widthStyle = opt.hasOwnProperty('width') ? opt.width : '200px';


                $(wrapperElem).css({
                    width : widthStyle,
                    margin : marginStyle,
                    padding : paddingStyle
                });
                multiSelect.ulElement = document.createElement('UL');
                $(multiSelect.ulElement).attr('class', 'multiselect');
                $(wrapperElem).empty().append(multiSelect.ulElement);
            },

            /**
             * Shows/hides multi-select block. If no status is provided then visibility is changed
             * (visible->hidden, hidden->visible).
             *
             * @param blockId {String}
             * @param status {optional String}
             */
            flipBlockVisibility : function (blockId, status) {
                var prop,
                    switchLink = multiSelect.blockSwitchLinks[blockId],
                    tbodyElm = multiSelect.blocks[blockId];


                if (($(tbodyElm).parent().css('display') === 'none' && status !== 'none') || status === 'table') {
                    if (!multiSelect.allowMultipleOpenedBoxes) {
                        multiSelect.eachBlock(function (block, blockId) {
                            $(multiSelect.blocks[blockId]).parent().css('display', 'none');
                            if (multiSelect.getNumSelected(blockId) === 0) {
                                $(multiSelect.blockSwitchLinks[blockId]).attr('class', 'switch-link');

                            } else {
                                $(multiSelect.blockSwitchLinks[blockId]).attr('class', 'switch-link used');
                            }
                        });
                    }
                    $(tbodyElm).parent().css('display', 'table');
                    $(switchLink).attr('class', 'switch-link active');

                } else if (($(tbodyElm).parent().css('display') === 'table' && status !== 'table') || status === 'none') {
                    $(tbodyElm).parent().css('display', 'none');
                    if (multiSelect.getNumSelected(blockId) === 0) {
                        $(switchLink).attr('class', 'switch-link');

                    } else {
                        $(switchLink).attr('class', 'switch-link used');
                    }
                }
            },

            /**
             * Adds checkbox list box
             *
             * @param blockId {String}
             * @param blockLabel {String}
             * @param defaultValue {optional String} value used if no checkbox is selected
             * @param eventCallbacks {optional Object} map 'event' -> callback
             * @return {Object}
             */
            addBlock : function (blockId, blockLabel, defaultValue, eventCallbacks) {
                var liElement,
                    switchLink,
                    statusText,
                    itemTable,
                    itemTbody,
                    prop;

                blockLabel = blockLabel || blockId;

                liElement = document.createElement('LI');
                $(liElement).css({
                    margin : 0,
                    overflow : 'hidden',
                    clear : 'both'
                });
                $(liElement).attr('data-block-id', blockId);
                $(multiSelect.ulElement).append(liElement);
                switchLink = document.createElement('A');
                $(switchLink).attr('class', 'switch-link');
                $(switchLink).empty().append(blockLabel);
                multiSelect.blockSwitchLinks[blockId] = switchLink;
                $(liElement).append(switchLink);

                statusText = document.createElement('SPAN');
                $(statusText).attr('class', 'status-text');
                $(statusText).empty().append('[ 0 ]');
                //liElement.insert(statusText);
                $(switchLink).append(statusText);

                itemTable = document.createElement('TABLE');
                $(liElement).append(itemTable);
                $(itemTable).attr('class', 'checkbox-list');
                itemTbody = document.createElement('TBODY');
                $(itemTbody).attr('class', 'item-' + blockId);
                $(itemTable).append(itemTbody);
                multiSelect.blocks[blockId] = itemTbody;
                $(switchLink).bind('click', function () {
                    multiSelect.activeBlockId = blockId;
                    multiSelect.flipBlockVisibility(blockId);
                });
                $(itemTbody).parent().css({ display : 'none'});
                multiSelect.addDefaultValue(blockId, liElement, defaultValue || ''); // 'default default' value

                eventCallbacks = eventCallbacks || {};
                for (prop in eventCallbacks) {
                    if (eventCallbacks.hasOwnProperty(prop) && typeof (eventCallbacks[prop]) === 'function') {
                        $(switchLink).bind(prop, eventCallbacks[prop]);
                    }
                }
                return multiSelect;
            },

            /**
             * Iterates over all multi-select blocks.
             * Callback can have following three parameters:
             * 1) block - block object itself
             * 2) blockId - identifier of the block
             * 3) i - index of the block
             */
            eachBlock : function (callback) {
                var prop,
                    i = 0;
                for (prop in multiSelect.blocks) {
                    if (multiSelect.blocks.hasOwnProperty(prop)) {
                        callback(multiSelect.blocks[prop], prop, i);
                        i += 1;
                    }
                }
            },

            /**
             * Returns TBODY block identified by its order (starting from zero)
             *
             * @param idx
             * @return {Object} object representing found TBODY element or null
             * if nothing found or if invalid index is provided
             */
            getBlockByIndex : function (idx) {
                var items = $(multiSelect.ulElement).find('tbody');
                if (idx >= 0 && idx < items.length) {
                    return items[idx];
                }
                return null;
            },

            /**
             * Returns order (in the related list of DOM elements, starting from zero)
             * of the block specified by blockId.
             *
             * @param blockId
             */
            getBlockOrder : function (blockId) {
                var i,
                    ans = null,
                    items = $(multiSelect.ulElement).find('tbody');

                for (i = 0; i < items.length; i += 1) {
                    if (items.get(i) === multiSelect.blocks[blockId]) {
                        ans = i;
                        break;
                    }
                }
                return ans;
            },

            /**
             * @param blockId {String}
             */
            clearBlock : function (blockId) {
                $(multiSelect.blocks[blockId]).empty();
            },

            /**
             * @param blockId {String}
             */
            containsBlock : function (blockId) {
                return multiSelect.blocks.hasOwnProperty(blockId);
            },

            /**
             *
             */
            updateBlockStatusText : function (blockId, text) {
                $(multiSelect.blockSwitchLinks[blockId]).parent().find('span[class="status-text"]').each(function () {
                    $(this).empty().append(text);
                });
            },

            /**
             *
             * @param blockId
             * @param value
             * @param label
             * @param clickCallback {optional Function}
             * @return {Object}
             */
            addItem : function (blockId, value, label, clickCallback) {
                var trElm,
                    tdElm,
                    labelElm,
                    inputElm,
                    inputElmId;

                if (!multiSelect.blocks.hasOwnProperty(blockId)) {
                    throw new Error('Cannot add item to the block ' + blockId + '. Block does not exist.');
                }
                trElm = document.createElement('TR');
                $(multiSelect.blocks[blockId]).append(trElm);
                tdElm = document.createElement('TD');
                $(tdElm).attr('class', 'checkbox-cell');
                $(trElm).append(tdElm);
                inputElm = document.createElement('INPUT');
                $(inputElm).attr('type', 'checkbox');
                if (multiSelect.useNamedCheckboxes) {
                    $(inputElm).attr('name', blockId);
                }
                inputElmId = 'c_' + blockId + '_' + multiSelect.itemIdCounter;
                $(inputElm).attr('id', inputElmId);
                multiSelect.itemIdCounter += 1;
                $(inputElm).attr('value', value);
                $(tdElm).append(inputElm);

                tdElm = document.createElement('TD');
                $(trElm).append(tdElm);

                labelElm = document.createElement('LABEL');
                $(labelElm).attr('for', inputElmId);
                $(tdElm).append(labelElm);
                $(labelElm).empty().append(label);

                $(inputElm).bind('click', function () {
                    multiSelect.activeBlockId = blockId;
                    if (multiSelect.getNumSelected(blockId) === 0) {
                        $(multiSelect.defaultValues[blockId]).attr('value',
                            $(multiSelect.defaultValues[blockId]).attr('data-orig-value'));
                        $(multiSelect.blockSwitchLinks[blockId]).attr('class', 'switch-link');

                    } else {
                        $(multiSelect.defaultValues[blockId]).attr('value', '');
                        $(multiSelect.blockSwitchLinks[blockId]).attr('class', 'switch-link used');
                    }
                });
                if (typeof clickCallback === 'function') {
                    $(inputElm).bind('click', clickCallback);
                }
                return multiSelect;
            },

            /**
             * @param blockId
             * @param parentElement
             * @param value
             * @return {Object}
             */
            addDefaultValue : function (blockId, parentElement, value) {
                var inputElm;

                inputElm = document.createElement('INPUT');
                $(inputElm).attr({
                    'type' : 'hidden',
                    'data-orig-value' : value,
                    'value' : value,
                    'name' : blockId
                });
                $(parentElement).append(inputElm);
                multiSelect.defaultValues[blockId] = inputElm;
            },

            /**
             *
             * @param blockId {String}
             * @param value {String}
             */
            setDefaultValue : function (blockId, value) {
                $(multiSelect.defaultValues[blockId]).attr('data-orig-value', value);
                if ($(multiSelect.defaultValues[blockId]).attr('value')) {
                    $(multiSelect.defaultValues[blockId]).attr('value', value);
                }
            },

            /**
             *
             * @param blockId
             * @param value
             */
            checkItem : function (blockId, value) {
                var items = $(multiSelect.blocks[blockId]).find('input[type="checkbox"][value="' + value + '"]');
                if (items.length === 1) {
                    items[0].checked = true;
                }
            },

            /**
             *
             * @param blockId
             * @param value
             */
            uncheckItem : function (blockId, value) {
                var items = $(multiSelect.blocks[blockId]).find('input[type="checkbox"][value="' + value + '"]');
                if (items.length === 1) {
                    items[0].checked = false;
                }
            },

            /**
             *
             */
            uncheckAll : function () {
                multiSelect.activeBlockId = null;
                $(multiSelect.ulElement).find('input[type="checkbox"]').attr('checked', false);
            },

            /**
             *
             */
            collapseAll : function () {
                multiSelect.eachBlock(function (block, blockId) {
                    multiSelect.flipBlockVisibility(blockId, 'none');
                });
            },

            /**
             *
             */
            disableBlock : function (blockId) {
                $(multiSelect.blocks[blockId]).find('input[type="checkbox"]').attr('disabled', 'disabled');
            },

            /**
             *
             * @return {Object}
             */
            exportStatus : function () {
                var ans = {},
                    setStatus;

                setStatus = function (prop) {
                    if ($(this).is(':checked')) {
                        ans[prop].push($(this).val());
                    }
                };

                multiSelect.eachBlock(function (block, blockId) {
                    ans[blockId] = [];
                    $(multiSelect.blocks[blockId]).find('input[type="checkbox"]').each(setStatus, [blockId]);
                });
                return ans;
            },

            /**
             * Returns number of checkboxes (total or within a block
             * if blockId is defined) checked.
             *
             * @param blockId {optional String}
             * @return Number
             */
            getNumSelected : function (blockId) {
                if (blockId !== undefined) {
                    return $(multiSelect.blocks[blockId]).find('input[type="checkbox"]:checked').length;
                }
                return $(multiSelect.ulElement).find('input[type="checkbox"]:checked').length;
            }
        };
        multiSelect.init(wrapperElem);
        return multiSelect;
    };

    return {
        createMultiselectComponent : createMultiselectComponent
    };

});
