(function (context) {
    'use strict';

    var createTagLoader,
        attachTagLoader;


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
             * Encodes multi-select element-based form into a tag string (like 'NNT1h22' etc.)
             *
             * @param anyCharSymbol
             */
            encodeFormStatus : function (anyCharSymbol) {
                var data,
                    ans = '',
                    prop,
                    positionCode,
                    i;

                anyCharSymbol = anyCharSymbol || '-';
                data = data || tagLoader.multiSelectComponent.exportStatus();

                for (prop in data) {
                    positionCode = [];
                    if (data.hasOwnProperty(prop)) {
                        for (i = 0; i < data[prop].length; i += 1) {
                            if (data[prop][i] !== null) {
                                positionCode.push(data[prop][i]);
                            }
                        }
                    }
                    if (positionCode.length > 1) {
                        ans += '[' + positionCode.join('') + ']';

                    } else if (positionCode.length === 1) {
                        ans += positionCode[0];

                    } else {
                        ans += '-';
                    }
                }

                if (anyCharSymbol !== '-') {
                    ans = ans.replace(/-/g, anyCharSymbol);
                }
                if (anyCharSymbol === '.') {
                    ans = ans.replace(/([^.]?)(\.)+$/, '$1.*');
                }
                return ans;
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
                    iterStart,
                    prevSelects = selects || tagLoader.multiSelectComponent.exportStatus();

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

                tagLoader.history.push(prevSelects);
                tagLoader.activeBlockHistory.push(tagLoader.multiSelectComponent.activeBlockId);

                for (i = 0; i < getResponseLength(data); i += 1) {
                    blockId = 'position_' + i;

                    //if (tagLoader.multiSelectComponent.activeBlockId !== blockId) {
                    if (tagLoader.activeBlockHistory.indexOf(blockId) === -1) {

                        if (!tagLoader.multiSelectComponent.containsBlock(blockId)) {
                            tagLoader.multiSelectComponent.addBlock(blockId, 'position ' + (i + 1));

                        } else {
                            tagLoader.multiSelectComponent.clearBlock(blockId);
                        }
                        if (data[i].length > 0) {
                            if (data[i][0][0] === '-') {
                                tagLoader.multiSelectComponent.setDefaultValue(blockId, data[i][0][0]);
                                iterStart = 1;

                            } else {
                                iterStart = 0;
                            }

                            // we start from 1 here because 0 contains default value

                            for (j = iterStart; j < data[i].length; j += 1) {
                                tagLoader.multiSelectComponent.addItem(blockId, data[i][j][0], data[i][j][1], function (event) {
                                    var pattern = tagLoader.encodeFormStatus();

                                    tagLoader.loadPatternVariants(pattern, function (data) {
                                        tagLoader.updateMultiSelectValues(data, null, function (blockId) {
                                            if (tagLoader.multiSelectComponent.getNumSelected(blockId) > 0
                                                    && tagLoader.multiSelectComponent.activeBlockId !== blockId) {
                                                tagLoader.multiSelectComponent.blocks[blockId].select('input[type="checkbox"]').each(function (item) {
                                                   item.writeAttribute('disabled', 'disabled');
                                                });
                                            }
                                        });
                                    });
                                    // TODO optional
                                    tagLoader.hiddenElm.writeAttribute('value', tagLoader.encodeFormStatus('.'));
                                    tagLoader.tagDisplay.update(tagLoader.encodeFormStatus('.'));

                                });
                                if (prevSelects.hasOwnProperty(blockId) && prevSelects[blockId].indexOf(data[i][j][0]) > -1) {
                                    tagLoader.multiSelectComponent.checkItem(blockId, data[i][j][0]);

                                } else {
                                    tagLoader.multiSelectComponent.uncheckItem(blockId, data[i][j][0]);
                                }
                            }
                            tagLoader.multiSelectComponent.updateBlockStatusText(blockId, '[ ' + (data[i].length - iterStart) + ' ]');

                        } else {
                            tagLoader.multiSelectComponent.updateBlockStatusText(blockId, '[ 0 ]');
                        }

                    }

                    if (typeof callback === 'function') {
                        callback(blockId, prevSelects);
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
             * @todo rewrite
             * @param event
             */
            resetButtonClick : function (event) {
                tagLoader.history = [];
                tagLoader.activeBlockHistory = [];
                tagLoader.multiSelectComponent.uncheckAll();
                tagLoader.multiSelectComponent.collapseAll();
                tagLoader.loadInitialVariants(function (data) {
                    tagLoader.updateMultiSelectValues(data);
                });
                tagLoader.hiddenElm.writeAttribute('value', tagLoader.encodeFormStatus('.'));
            },

            /**
             * @todo rewrite
             * @param event
             */
            backButtonClick : function (event) {
                var prevSelection,
                    prevActiveBlock,
                    objectIsEmpty,
                    updateActiveBlock;

                objectIsEmpty = function (obj) {
                    var prop;
                    for (prop in obj) {
                        if (obj.hasOwnProperty(prop)) {
                            return false;
                        }
                    }
                    return true;
                };

                updateActiveBlock = function (blockId, prevSelects) {
                    if (tagLoader.multiSelectComponent.activeBlockId === blockId) {
                        tagLoader.multiSelectComponent.blocks[blockId].select('input[type="checkbox"]').each(function (item) {
                            if (prevSelects.hasOwnProperty(blockId) && prevSelects[blockId].indexOf(item.getValue()) === -1) {
                                item.checked = false;
                            }
                            item.disabled = false;
                        });
                        if (tagLoader.multiSelectComponent.getNumSelected(blockId) === 0) {
                            tagLoader.multiSelectComponent.blockSwitchLinks[blockId].setStyle({ fontWeight : 'normal'});
                        }
                        tagLoader.hiddenElm.writeAttribute('value', tagLoader.encodeFormStatus('.'));
                        tagLoader.tagDisplay.update(tagLoader.encodeFormStatus('.'));
                    }
                };

                tagLoader.history.pop(); // remove current status which has been already pushed
                tagLoader.activeBlockHistory.pop();
                prevSelection = tagLoader.history.pop(); // and use the previous one
                prevActiveBlock = tagLoader.activeBlockHistory.pop();

                if (!objectIsEmpty(prevSelection)) {
                    tagLoader.loadPatternVariants(tagLoader.encodeFormStatus('-', prevSelection), function (data) {
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
    context.attachTagLoader = function (corpusName, numOfPos, multiSelectComponent, opt) {
        var tagLoader,
            selList,
            hiddenElm,
            tagDisplay,
            updateConcordanceQuery;

        if (typeof (opt.tagDisplay) === 'string') {
            opt.tagDisplay = $(opt.tagDisplay);
        }

        updateConcordanceQuery = function () {
            var pattern = tagLoader.encodeFormStatus('.');
            if (opt.tagDisplay) {
                opt.tagDisplay.update(pattern);
            }
            tagLoader.lastPattern = pattern;
            if (tagLoader.hiddenElm) {
                tagLoader.hiddenElm.setValue(pattern);
            }
        };
        numOfPos = numOfPos || 4; // TODO

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


}(window));