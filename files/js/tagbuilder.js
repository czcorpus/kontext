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
 * The library depends on Prototype.js version 1.7+ and multiselect.js
 */
define(function () {
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
         * @type {Object}
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
                tagLoader.tagDisplay.select('a.backlink').each(function (item) {
                    item.observe('click', function () {
                        var liElms = tagLoader.multiSelectComponent.ulElement.select('li:nth-child('
                                + (parseInt(item.readAttribute('data-block-idx'), 10) + 1) + ')');
                        if (liElms.length === 1) {
                            tagLoader.multiSelectComponent.flipBlockVisibility(liElms[0].readAttribute('data-block-id'));
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
                        var blockId = event.element().parentNode.readAttribute('data-block-id'),
                            items;

                        items = tagLoader.tagDisplay.select('*');
                        if (items[tagLoader.multiSelectComponent.getBlockOrder(blockId)] !== undefined) {
                            items[tagLoader.multiSelectComponent.getBlockOrder(blockId)].writeAttribute('class', 'backlink called');
                        }
                    },
                    mouseout : function (event) {
                        var blockId = event.element().parentNode.readAttribute('data-block-id'),
                            items;

                        items = tagLoader.tagDisplay.select('*');
                        if (items[tagLoader.multiSelectComponent.getBlockOrder(blockId)] !== undefined) {
                            items[tagLoader.multiSelectComponent.getBlockOrder(blockId)].writeAttribute('class', 'backlink');
                        }
                    }
                };

                lockPreviousItems = function (data) {
                    tagLoader.updateMultiSelectValues(data, null, function (blockId) {
                        if (tagLoader.multiSelectComponent.getNumSelected(blockId) > 0
                                && tagLoader.multiSelectComponent.activeBlockId !== blockId) {
                            tagLoader.multiSelectComponent.blockSwitchLinks[blockId].setStyle({ opacity : 0.4 });
                            tagLoader.multiSelectComponent.blocks[blockId].select('input[type="checkbox"]').each(function (item) {
                                item.writeAttribute('disabled', 'disabled');
                            });
                        }
                    });
                };

                itemClickCallback = function () {
                    var pattern = tagLoader.formStatusToPlainText();

                    tagLoader.loadPatternVariants(pattern, lockPreviousItems);
                    tagLoader.hiddenElm.writeAttribute('value', tagLoader.formStatusToPlainText('.'));
                    tagLoader.tagDisplay.update(tagLoader.formStatusToHTML());
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
                    errorBox.writeAttribute('class', 'error-box');
                    errorBox.update(data.error);
                    tagLoader.multiSelectComponent.ulElement.insert(errorBox);

                } else {
                    for (i = 0; i < getResponseLength(data.tags); i += 1) {
                        blockId = 'position_' + i;

                        if (tagLoader.activeBlockHistory.indexOf(blockId) === -1) {

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
                                        if (prevSelects.hasOwnProperty(blockId) && prevSelects[blockId].indexOf(data.tags[i][j][0]) > -1) {
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
                    params = {},
                    ajax;

                if (tagLoader.initialValues === null) {
                    ajax = new Ajax.Request(url, {
                        parameters : params,
                        method : 'get',
                        // requestHeaders: {Accept: 'application/json'},
                        onComplete : function (data) {
                            tagLoader.initialValues = data.responseText.evalJSON();
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
                    params = {},
                    ajax;

                ajax = new Ajax.Request(url, {
                    parameters : params,
                    method : 'get',
                    // requestHeaders: {Accept: 'application/json'},
                    onComplete : function (data) {
                        callback(data.responseText.evalJSON());
                    }
                });
            },

            /**
             *
             */
            resetButtonClick : function () {
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
                        tagLoader.multiSelectComponent.blockSwitchLinks[prop].setStyle({ opacity : 1 });
                    }
                }
                tagLoader.tagDisplay.update('.*');
                tagLoader.hiddenElm.writeAttribute('value', tagLoader.formStatusToPlainText('.'));
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
                        tagLoader.multiSelectComponent.blocks[blockId].select('input[type="checkbox"]').each(function (item) {
                            if (prevSelects.hasOwnProperty(blockId)) {
                                item.checked = (prevSelects[blockId].indexOf(item.readAttribute('value')) === -1);

                            }
                            item.disabled = false;
                        });
                        if (tagLoader.multiSelectComponent.getNumSelected(blockId) === 0) {
                            tagLoader.multiSelectComponent.blockSwitchLinks[blockId].setStyle({ fontWeight : 'normal'});
                        }
                        tagLoader.hiddenElm.writeAttribute('value', tagLoader.formStatusToPlainText('.'));
                        tagLoader.tagDisplay.update(tagLoader.formStatusToHTML());
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
        tagLoader.tagDisplay.writeAttribute('class', 'tag-display-box');
        tagLoader.tagDisplay.update('.*');

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
                opt.tagDisplay.update(pattern);
            }
            tagLoader.lastPattern = pattern;
            if (tagLoader.hiddenElm) {
                tagLoader.hiddenElm.setValue(pattern);
            }
        };

        if (typeof (opt.hiddenElm) === 'string') {
            hiddenElm = $(opt.hiddenElm);

        } else {
            hiddenElm = opt.hiddenElm;
        }
        if (typeof (opt.tagDisplay) === 'string') {
            tagDisplay = $(opt.tagDisplay);

        } else {
            tagDisplay = opt.tagDisplay;
        }

        tagLoader = createTagLoader(corpusName, numOfPos, hiddenElm, tagDisplay, multiSelectComponent);
        tagLoader.loadInitialVariants(function (data) {
            tagLoader.updateMultiSelectValues(data);
        });
        if (typeof (opt.resetButton) === 'string') {
            opt.resetButton = $(opt.resetButton);
        }
        if (opt.resetButton) {
            opt.resetButton.observe('click', tagLoader.resetButtonClick);
        }
        if (typeof (opt.backButton) === 'string') {
            opt.backButton = $(opt.backButton);
        }
        if (opt.backButton) {
            opt.backButton.observe('click', tagLoader.backButtonClick);
        }

        updateConcordanceQuery();
        return tagLoader;
    };

    return {
        attachTagLoader : attachTagLoader
    };

});