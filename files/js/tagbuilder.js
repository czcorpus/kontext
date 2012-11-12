(function (context) {
    'use strict';

    var createTagLoader,
        attachTagLoader;


    /**
     * @param selector
     * @param status boolean
     */
    function switchSelectorStatus(selector, status) {
        var siblings = selector.parentNode.siblings(),
            tableCell = null;

        if (siblings.length === 1 && siblings[0].readAttribute('class') === 'num') {
            tableCell = siblings[0];
        }

        if (status === true) {
            selector.writeAttribute('disabled', null);
            siblings[0].setStyle({ color : '#000' });

        } else if (status === false) {
            selector.writeAttribute('disabled', 'disabled');
            siblings[0].setStyle({ color : '#AAA' });
        }
    }

    /**
     * Creates new AJAX tag hint loader for selected corpus
     *
     * @param corpusName corpus identifier
     * @param numTagPos
     * @param hiddenElm ID or element itself
     * @param multiSelectComponent
     * @return {Object}
     */
    createTagLoader = function (corpusName, numTagPos, hiddenElm, multiSelectComponent) {

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
                data = tagLoader.multiSelectComponent.exportStatus();

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
                        ans += '(' + positionCode.join('|') + ')';

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
             * @param activeNode active SELECT element
             * @param data data to be used to update form (array (each SELECT one item) of arrays (each OPTION one possible
             * tag position value) of arrays (0 - value, 1 - label))
             */
            updateMultiSelectValues : function (activeNode, data) {
                var i,
                    j,
                    currValue,
                    newOption,
                    blockId,
                    getResponseLength,
                    iterStart,
                    prevSelects = tagLoader.multiSelectComponent.exportStatus();

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

                for (i = 0; i < getResponseLength(data); i += 1) {
                    blockId = 'position_' + i;

                    if (tagLoader.multiSelectComponent.activeBlockId !== blockId) {

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
                                        tagLoader.updateMultiSelectValues(null, data);
                                    });
                                });

                                if (prevSelects.hasOwnProperty(blockId)
                                        && prevSelects[blockId].indexOf(data[i][j][0]) > -1) {
                                    tagLoader.multiSelectComponent.checkItem(blockId, data[i][j][0]);
                                }
                            }
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
             * @todo rewrite
             * @param event
             */
            resetButtonClick : function (event) {
                tagLoader.history = [];
                tagLoader.multiSelectComponent.uncheckAll();
                tagLoader.multiSelectComponent.collapseAll();
                tagLoader.loadInitialVariants(function (data) {
                    tagLoader.updateMultiSelectValues(null, data);
                });
            },

            /**
             * @todo rewrite
             * @param event
             */
            backButtonClick : function (event) {
                var prevPattern;

                tagLoader.history.pop(); // remove current value
                prevPattern = tagLoader.history[tagLoader.history.length - 1];

                if (prevPattern) {
                    tagLoader.loadPatternVariants(prevPattern, function (data) {
                        tagLoader.updateMultiSelectValues(null, data);
                        updateConcordanceQuery();
                    });

                } else { // empty => load initial values
                    tagLoader.loadInitialVariants(function (data) {
                        var a;

                        tagLoader.updateMultiSelectValues(null, data);
                        for (a in tagLoader.selectedValues) {
                            if (tagLoader.selectedValues.hasOwnProperty(a)) {
                                tagLoader.selectedValues[a] = '-';
                            }
                        }
                        tagLoader.lastPattern = null;
                        selList.each(function (item, idx) {
                            item.selectedIndex = 0;
                        });
                        updateConcordanceQuery();
                    });
                }
            }
        };


        tagLoader.corpusName = corpusName;
        tagLoader.hiddenElm = hiddenElm;
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
        }
        tagLoader = createTagLoader(corpusName, numOfPos, hiddenElm, multiSelectComponent);
        tagLoader.loadInitialVariants(function (data) {
            tagLoader.updateMultiSelectValues(null, data);
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