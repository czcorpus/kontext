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
 * This library provides a clickable 'tag generator' widget.
 * The library depends on multiselect.js - TODO use require.js
 */
define(['jquery'], function ($) {
    'use strict';

    var createTagLoader,
        objectIsEmpty,
        attachTagLoader;

    /**
     *
     * @param obj
     * @return {Boolean}
     */
    objectIsEmpty = function (obj) {
        var prop;
        for (prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                return false;
            }
        }
        return true;
    };

    /**
     * Creates new AJAX tag hint loader for selected corpus
     *
     * @param corpusName corpus identifier
     * @param numTagPos
     * @param hiddenElm ID or element itself
     * @param tagDisplay
     * @param multiSelectComponent {Object}
     * @return {Object}
     */
    createTagLoader = function (corpusName, numTagPos, hiddenElm, tagDisplay, multiSelectComponent) {

        var tagLoader,
            i;

        /**
         * Tag data loading service object
         *
         */
        tagLoader = {

            /**
             * Holds a corpus name for which this object is configured.
             */
            corpusName : corpusName,

            /**
             *
             */
            numTagPos : numTagPos,

            /**
             *
             */
            hiddenElm : hiddenElm,

            /**
             *
             */
            multiSelectComponent : multiSelectComponent,

            /**
             * Latest tag pattern (e.g. PKM-4--2--------) used by this loader
             */
            lastPattern : '',

            /**
             * Initial values for all tag positions used by this tag loader (always the same for a specific corpus)
             */
            initialValues : null,

            /**
             *
             */
            selectedValues : [],

            /**
             * List of patterns user gradually created
             */
            history : [],

            /**
             *
             */
            activeBlockHistory : [],

            /**
             *
             */
            tagDisplay : null,

            /**
             * Encodes form status into a list of regular expressions (one for each position)
             */
            encodeFormStatusItems : function () {
                var data,
                    ans = [],
                    prop,
                    positionCode,
                    i;

                data = data || tagLoader.multiSelectComponent.exportStatus();
                for (prop in data) {
                    if (data.hasOwnProperty(prop)) {
                        positionCode = [];
                        if (data.hasOwnProperty(prop)) {
                            for (i = 0; i < data[prop].length; i += 1) {
                                if (data[prop][i] !== null) {
                                    positionCode.push(data[prop][i]);
                                }
                            }
                        }
                        if (positionCode.length > 1) {
                            ans.push('[' + positionCode.join('') + ']');

                        } else if (positionCode.length === 1) {
                            ans.push(positionCode[0]);

                        } else {
                            ans.push('-');
                        }
                    }
                }
                return ans;
            },

            /**
             *
             * @return {*}
             */
            getLatestActiveBlock : function () {
                if (tagLoader.activeBlockHistory.length > 0) {
                    return tagLoader.activeBlockHistory[tagLoader.activeBlockHistory.length - 1];
                }
                return null;
            },

            /**
             * Encodes multi-select element-based form into a tag string (like 'NNT1h22' etc.)
             *
             * @param anyCharSymbol
             */
            formStatusToPlainText : function (anyCharSymbol) {
                var ans,
                    items;

                items = tagLoader.encodeFormStatusItems();
                anyCharSymbol = anyCharSymbol || '-';
                ans = items.join('');

                if (anyCharSymbol !== '-') {
                    ans = ans.replace(/-/g, anyCharSymbol);
                }
                if (anyCharSymbol === '.') {
                    ans = ans.replace(/([^.]?)(\.)+$/, '$1.*');
                }
                if (ans.length === 0) {
                    ans = '.*';
                }
                return ans;
            },

            /**
             *
             * @return {String}
             */
            formStatusToHTML : function () {
                var ans = '',
                    items,
                    i,
                    lastNonDotPos;

                items = tagLoader.encodeFormStatusItems();
                lastNonDotPos = items.length - 1;
                while (lastNonDotPos >= 0 && items[lastNonDotPos] === '-') {
                    lastNonDotPos -= 1;
                }

                for (i = 0; i <= lastNonDotPos; i += 1) {
                    if (items[i] === '-') {
                        ans +=  '<span class="backlink" data-block-idx="' + i + '">' + items[i].replace('-', '.') + '</span>';

                    } else {
                        ans += '<a class="backlink" data-block-idx="' + i + '">' + items[i] + '</a>';
                    }
                }
                if (lastNonDotPos === items.length - 2) {
                    ans += '.';

                } else if (lastNonDotPos < items.length - 2) {
                    ans += '.*';
                }
                return ans;
            },

            /**
             *
             */
            updateBacklinks : function () {
                $(tagLoader.tagDisplay).find('a.backlink').each(function () {
                    $(this).bind('click', function () {
                        var liElms = $(tagLoader.multiSelectComponent.ulElement).find('li:nth-child('
                                + (parseInt($(this).attr('data-block-idx'), 10) + 1) + ')');
                        if (liElms.length === 1) {
                            tagLoader.multiSelectComponent.flipBlockVisibility($(liElms[0]).attr('data-block-id'));
                        }
                    });
                });
            },

            /**
             * Updates all SELECT element-based form items with provided data
             *
             * @param data data to be used to update form (array (each SELECT one item) of arrays (each OPTION one possible
             * tag position value) of arrays (0 - value, 1 - label))
             * @param selects {optional Object}
             * @param callback {optional Function} called with parameters blockId and prevSelects (see the function inside)
             */
            updateMultiSelectValues : function (data, selects, callback) {
                var i,
                    j,
                    blockId,
                    getResponseLength,
                    blockLength,
                    blockLabel,
                    prevSelects = selects || tagLoader.multiSelectComponent.exportStatus(),
                    blockSwitchEventHandlers,
                    lockPreviousItems,
                    itemClickCallback,
                    errorBox;

                getResponseLength = function (resp) {
                    var prop,
                        ans = 0;

                    if (resp.hasOwnProperty('length')) {
                        return resp.length;
                    }
                    for (prop in resp) {
                        if (resp.hasOwnProperty(prop)) {
                            ans += 1;
                        }
                    }
                    return ans;
                };

                blockSwitchEventHandlers = {
                    mouseover : function (event) {
                        var blockId = $(event.target.parentNode).attr('data-block-id'),
                            items;

                        items = $(tagLoader.tagDisplay).find('*');
                        if (items.get(tagLoader.multiSelectComponent.getBlockOrder(blockId)) !== undefined) {
                            $(items.get(tagLoader.multiSelectComponent.getBlockOrder(blockId))).attr('class', 'backlink called');
                        }
                    },
                    mouseout : function (event) {
                        var blockId = $(event.target.parentNode).attr('data-block-id'),
                            items;

                        items = $(tagLoader.tagDisplay).find('*');
                        if (items.get(tagLoader.multiSelectComponent.getBlockOrder(blockId)) !== undefined) {
                            $(items.get(tagLoader.multiSelectComponent.getBlockOrder(blockId))).attr('class', 'backlink');
                        }
                    }
                };

                lockPreviousItems = function (data) {
                    tagLoader.updateMultiSelectValues(data, null, function (blockId) {
                        if (tagLoader.multiSelectComponent.getNumSelected(blockId) > 0
                                && tagLoader.multiSelectComponent.activeBlockId !== blockId) {
                            $(tagLoader.multiSelectComponent.blockSwitchLinks[blockId]).css('opacity', 0.4);
                            $(tagLoader.multiSelectComponent.blocks[blockId]).find('input[type="checkbox"]')
                                    .attr('disabled', 'disabled');
                        }
                    });
                };

                itemClickCallback = function () {
                    var pattern = tagLoader.formStatusToPlainText();
                    tagLoader.loadPatternVariants(pattern, lockPreviousItems);
                    $(tagLoader.hiddenElm).attr('value', tagLoader.formStatusToPlainText('.'));
                    $(tagLoader.tagDisplay).empty().append(tagLoader.formStatusToHTML());
                    tagLoader.updateBacklinks();

                };
                if (prevSelects && !objectIsEmpty(prevSelects)) {
                    tagLoader.history.push(prevSelects);

                    if (tagLoader.getLatestActiveBlock() === tagLoader.multiSelectComponent.activeBlockId
                                && tagLoader.multiSelectComponent.activeBlockId) {
                        if (tagLoader.multiSelectComponent.getNumSelected(tagLoader.multiSelectComponent.activeBlockId) === 0) {
                            tagLoader.activeBlockHistory.pop();
                            tagLoader.history.pop();
                        }

                    } else {
                        tagLoader.activeBlockHistory.push(tagLoader.multiSelectComponent.activeBlockId);
                    }
                }

                if (data.hasOwnProperty('error')) {
                    errorBox = document.createElement('li');
                    $(errorBox).attr('class', 'error-box');
                    $(errorBox).empty().append(data.error);
                    $(tagLoader.multiSelectComponent.ulElement).append(errorBox);

                } else {
                    for (i = 0; i < getResponseLength(data.tags); i += 1) {
                        blockId = 'position_' + i;
                        if ($.inArray(blockId, tagLoader.activeBlockHistory) === -1) {

                            if (!tagLoader.multiSelectComponent.containsBlock(blockId)) {
                                if (data.labels[i] !== undefined && data.labels[i] !== null) {
                                    blockLabel = (i + 1) + ' - ' + data.labels[i];
                                } else {
                                    blockLabel = (i + 1);
                                }
                                tagLoader.multiSelectComponent.addBlock(blockId, blockLabel, null, blockSwitchEventHandlers);

                            } else {
                                tagLoader.multiSelectComponent.clearBlock(blockId);
                            }
                            if (data.tags[i].length > 0) {
                                blockLength = data.tags[i].length;
                                for (j = 0; j < data.tags[i].length; j += 1) {
                                    if (data.tags[i][j][0] !== '-') {
                                        tagLoader.multiSelectComponent.addItem(blockId, data.tags[i][j][0], data.tags[i][j][1], itemClickCallback);
                                        if (prevSelects.hasOwnProperty(blockId) && $.inArray(data.tags[i][j][0], prevSelects[blockId]) > -1) {
                                            tagLoader.multiSelectComponent.checkItem(blockId, data.tags[i][j][0]);

                                        } else {
                                            tagLoader.multiSelectComponent.uncheckItem(blockId, data.tags[i][j][0]);
                                        }

                                    } else {
                                        blockLength -= 1;
                                        tagLoader.multiSelectComponent.setDefaultValue(blockId, data.tags[i][j][0]);
                                    }
                                }
                                tagLoader.multiSelectComponent.updateBlockStatusText(blockId, '[ ' + blockLength + ' ]');

                            } else {
                                tagLoader.multiSelectComponent.updateBlockStatusText(blockId, '[ 0 ]');
                            }
                        }

                        if (typeof callback === 'function') {
                            callback(blockId, prevSelects);
                        }
                    }
                }
            },

            /**
             * @param callback function to be called when variants are loaded, JSON data is passed as a parameter
             */
            loadInitialVariants : function (callback) {
                var url = 'ajax_get_tag_variants?corpname=' + tagLoader.corpusName,
                    params = {};

                if (tagLoader.initialValues === null) {
                    $.ajax({
                        url : url,
                        data : params,
                        method : 'get',
                        // requestHeaders: {Accept: 'application/json'},
                        complete : function (data) {
                            tagLoader.initialValues = $.parseJSON(data.responseText);
                            callback(tagLoader.initialValues);
                        }
                    });

                } else {
                    callback(tagLoader.initialValues);
                }
            },

            /**
             *
             * @param pattern
             * @param callback
             */
            loadPatternVariants : function (pattern, callback) {
                var url = 'ajax_get_tag_variants?corpname=' + tagLoader.corpusName + '&pattern=' + pattern,
                    params = {};

                $.ajax({
                    url : url,
                    data : params,
                    method : 'get',
                    // requestHeaders: {Accept: 'application/json'},
                    complete : function (data) {
                        callback($.parseJSON(data.responseText));
                    }
                });
            },

            /**
             *
             */
            resetWidget : function () {
                var prop;
                tagLoader.history = [];
                tagLoader.activeBlockHistory = [];
                tagLoader.multiSelectComponent.uncheckAll();
                tagLoader.multiSelectComponent.collapseAll();
                tagLoader.loadInitialVariants(function (data) {
                    tagLoader.updateMultiSelectValues(data);
                });
                for (prop in tagLoader.multiSelectComponent.blockSwitchLinks) {
                    if (tagLoader.multiSelectComponent.blockSwitchLinks.hasOwnProperty(prop)) {
                        $(tagLoader.multiSelectComponent.blockSwitchLinks[prop]).css('opacity', 1);
                    }
                }
                $(tagLoader.tagDisplay).empty().append('.*');
                $(tagLoader.hiddenElm).attr('value', tagLoader.formStatusToPlainText('.'));
            },

            /**
             *
             */
            resetButtonClick : function () {
                tagLoader.resetWidget();
            },

            /**
             *
             */
            backButtonClick : function () {
                var prevSelection,
                    prevActiveBlock,
                    updateActiveBlock;

                updateActiveBlock = function (blockId, prevSelects) {
                    if (tagLoader.multiSelectComponent.activeBlockId === blockId) {
                        $(tagLoader.multiSelectComponent.blocks[blockId]).find('input[type="checkbox"]').each(function () {
                            if (prevSelects.hasOwnProperty(blockId)) {
                                $(this).attr('checked', ($.inArray($(this).attr('value'), prevSelects[blockId]) === -1));

                            }
                            $(this).attr('disabled', false);
                        });
                        if (tagLoader.multiSelectComponent.getNumSelected(blockId) === 0) {
                            $(tagLoader.multiSelectComponent.blockSwitchLinks[blockId]).css('font-weight', 'normal');
                        }
                        $(tagLoader.hiddenElm).attr('value', tagLoader.formStatusToPlainText('.'));
                        $(tagLoader.tagDisplay).empty().append(tagLoader.formStatusToHTML());
                        tagLoader.updateBacklinks();
                    }
                };

                tagLoader.history.pop(); // remove current status which has been already pushed
                tagLoader.activeBlockHistory.pop();
                prevSelection = tagLoader.history.pop(); // and use the previous one
                prevActiveBlock = tagLoader.activeBlockHistory.pop();

                if (!objectIsEmpty(prevSelection)) {
                    tagLoader.loadPatternVariants(tagLoader.formStatusToPlainText('-'), function (data) {
                        tagLoader.updateMultiSelectValues(data, prevSelection, updateActiveBlock);
                        tagLoader.multiSelectComponent.activeBlockId = prevActiveBlock;
                    });

                } else { // empty => load initial values
                    prevSelection = {};
                    prevSelection[tagLoader.multiSelectComponent.activeBlockId] = [];
                    tagLoader.loadInitialVariants(function (data) {
                        tagLoader.updateMultiSelectValues(data, prevSelection, updateActiveBlock);
                        tagLoader.multiSelectComponent.activeBlockId = prevActiveBlock;
                        tagLoader.multiSelectComponent.collapseAll();
                    });
                }
            }
        };

        tagLoader.corpusName = corpusName;
        tagLoader.hiddenElm = hiddenElm;
        tagLoader.tagDisplay = tagDisplay;
        $(tagLoader.tagDisplay).attr('class', 'tag-display-box');
        $(tagLoader.tagDisplay).empty().append('.*');

        for (i = 0; i < numTagPos; i += 1) {
            tagLoader.selectedValues[i] = '-';
        }
        return tagLoader;
    };

    /**
     * A helper method that does whole 'create a tag loader for me' job.
     *
     * @param corpusName identifier of a corpus to be used along with this tag loader
     * @param numOfPos number of positions in the tag string
     * @param multiSelectComponent
     * @param opt a dictionary with following keys:
     *     resetButton    : ID or element itself for the "reset" button
     *     backButton     : ID or element itself for the "back" button
     *     tagDisplay     : ID or element itself for the "tag display" box
     *     hiddenElm      : ID or element itself
     * @return {tagLoader}
     */
    attachTagLoader = function (corpusName, numOfPos, multiSelectComponent, opt) {
        var tagLoader,
            hiddenElm,
            tagDisplay,
            updateConcordanceQuery;

        if (typeof (opt.tagDisplay) === 'string') {
            opt.tagDisplay = $(opt.tagDisplay);
        }

        updateConcordanceQuery = function () {
            var pattern = tagLoader.formStatusToPlainText('.');
            if (opt.tagDisplay) {
                $(opt.tagDisplay).empty().append(pattern);
            }
            tagLoader.lastPattern = pattern;
            if (tagLoader.hiddenElm) {
                $(tagLoader.hiddenElm).val(pattern);
            }
        };

        hiddenElm = $(opt.hiddenElm).get(0);
        tagDisplay = $(opt.tagDisplay).get(0);

        tagLoader = createTagLoader(corpusName, numOfPos, hiddenElm, tagDisplay, multiSelectComponent);
        tagLoader.loadInitialVariants(function (data) {
            tagLoader.updateMultiSelectValues(data);
        });
        if (typeof (opt.resetButton) === 'string') {
            opt.resetButton = $(opt.resetButton);
        }
        if (opt.resetButton) {
            $(opt.resetButton).bind('click', tagLoader.resetButtonClick);
        }
        if (typeof (opt.backButton) === 'string') {
            opt.backButton = $(opt.backButton);
        }
        if (opt.backButton) {
            $(opt.backButton).bind('click', tagLoader.backButtonClick);
        }

        updateConcordanceQuery();
        return tagLoader;
    };

    return {
        attachTagLoader : attachTagLoader
    };

});