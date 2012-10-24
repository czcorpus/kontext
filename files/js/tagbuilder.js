(function (context) {
    'use strict';

    var createTagLoader,
        attachTagLoader;



    /**
     *
     * @param element
     */
    function normalizeSelectEventSource(element) {
        var ans = null;
        if (element.nodeName === 'OPTION') {
            ans = element.parentNode;

        } else if (element.nodeName === 'SELECT') {
            ans =  element;
        }
        return ans;
    }


    /**
     * Creates new AJAX tag hint loader for selected corpus
     *
     * @param corpusName corpus identifier
     * @param numTagPos
     * @param hiddenElm ID or element itself
     * @return {Object}
     */
    createTagLoader = function (corpusName, numTagPos, hiddenElm) {

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
            corpusName : '',

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
             *
             */
            hiddenElm : null,

            /**
             *
             */
            history : [],

            /**
             * Encodes SELECT element-based form into a tag string (like 'NNT1h22' etc.)
             *
             * @param elmList list of SELECT elements to be used
             */
            encodeFormStatus : function (elmList) {
                var i,
                    ans = '';

                for (i = 0; i < elmList.length; i += 1) {
                    ans += elmList[i].getValue() || '.';
                }

                if (tagLoader.hiddenElm) { // TODO this is quite debatable
                    tagLoader.hiddenElm.setValue(ans);
                }

                return ans;
            },

            /**
             * Returns number of SELECT elements from a provided list with values other than empty or '.'
             *
             * @param elmList list of SELECT elements
             * @return number
             */
            getNumberOfSelectedItems : function (elmList) {
                var i,
                    ans = 0;

                for (i = 0; i < elmList.length; i += 1) {
                    if (elmList[i].getValue() && elmList[i].getValue() !== '.') {
                        ans += 1;
                    }
                }
                return ans;
            },


            /**
             * Updates all SELECT element-based form items with provided data
             *
             * @param elmList
             * @param activeNode active SELECT element
             * @param data data to be used to update form (array (each SELECT one item) of arrays (each OPTION one possible
             * tag position value) of arrays (0 - value, 1 - label))
             */
            updateFormValues : function (elmList, activeNode, data) {
                var i,
                    j,
                    currValue,
                    newOption;

                for (i = 0; i < elmList.length; i += 1) {
                    if (!activeNode || activeNode.parentNode !== elmList[i]) {
                        currValue = elmList[i].getValue();
                        // TODO simplify if-elseif
                        if (data[i].length === 1) {
                            elmList[i].update();
                            elmList[i].writeAttribute('disabled', 'disabled');
                            newOption = Element.extend(document.createElement('option'));
                            newOption.writeAttribute('value', data[i][0][0]);
                            newOption.insert(data[i][0][1]);
                            elmList[i].insert(newOption);
                            if (currValue === data[i][0][0]) {
                                elmList[i].selectedIndex = 0;
                            }

                        } else if (data[i].length > 1) {
                            elmList[i].writeAttribute('disabled', null);
                            elmList[i].update('<option value="."></option>');
                            for (j = 0; j < data[i].length; j += 1) {
                                newOption = Element.extend(document.createElement('option'));
                                newOption.writeAttribute('value', data[i][j][0]);
                                newOption.insert(data[i][j][1]);
                                elmList[i].insert(newOption);
                                if (currValue === data[i][j][0]) {
                                    elmList[i].selectedIndex = j + 1;
                                }
                            }

                        } else {
                            elmList[i].writeAttribute('disabled', 'disabled');
                        }

                    } else {
                        activeNode.writeAttribute('selected', 'selected');
                    }
                }
            },

            /**
             * Updates options of a single SELECT element by provided data
             *
             * @param selectElement
             * @param data
             */
            updateSelectOptions : function (selectElement, data) {
                var i,
                    newElement;

                selectElement.update('<option value="."></option>');
                for (i = 0; i < data.length; i += 1) {
                    newElement = Element.extend(document.createElement('option'));
                    newElement.writeAttribute('value', data[i][0]);
                    newElement.insert(data[i][1]);
                    selectElement.insert(newElement);
                }
                selectElement.selectedIndex = 0;
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
            }

        };
        tagLoader.corpusName = corpusName;
        tagLoader.hiddenElm = hiddenElm;
        for (i = 0; i < numTagPos; i += 1) {
            tagLoader.selectedValues[i] = '.';
        }
        return tagLoader;
    };

    /**
     * A helper method that does whole 'create a tag loader for me' job.
     *
     * @param opt a dictionary with following keys:
     *  tagPosSelector : a selector to obtain list of SELECT elements
     *  corpusName : identifier of a corpus to be used along with this tag loader
     *  resetButton : ID or element itself for the "reset" button
     *  backButton : ID or element itself for the "back" button
     *  tagDisplay : ID or element itself for the "tag display" box
     *  hiddenElm : ID or element itself
     * @return {tagLoader}
     */
    attachTagLoader = function (opt) {
        var tagLoader,
            selList,
            backButton,
            resetButton,
            tagDisplay,
            hiddenElm;

        selList = $$(opt.tagPosSelector);
        if (typeof (opt.hiddenElm) === 'string') {
            hiddenElm = $(opt.hiddenElm);
        }
        tagLoader = createTagLoader(opt.corpusName, selList.length, hiddenElm);
        tagLoader.loadInitialVariants(function (data) {
            tagLoader.updateFormValues(selList, null, data);
        });
        if (typeof (opt.resetButton) === 'string') {
            resetButton = $(opt.resetButton);
        }
        resetButton.observe('click', function (event) {
            tagLoader.history = [];
            tagLoader.loadInitialVariants(function (data) {
                var a;

                tagLoader.updateFormValues(selList, null, data);
                for (a in tagLoader.selectedValues) {
                    tagLoader.selectedValues[a] = '.';
                }
                tagLoader.lastPattern = null;
                selList.each(function (item, idx) {
                    item.selectedIndex = 0;
                });
                tagDisplay.update(tagLoader.encodeFormStatus(selList));
            });
        });
        if (typeof (opt.backButton) === 'string') {
            backButton = $(opt.backButton);
        }
        backButton.observe('click', function (event) {
            var lastSel = tagLoader.history.pop(),
                newPattern;

            if (lastSel) {
                lastSel.selectedIndex = 0;
                lastSel.writeAttribute('disabled', null);
                newPattern = tagLoader.encodeFormStatus(selList);
                if (newPattern !== tagLoader.lastPattern) {
                    tagLoader.loadPatternVariants(newPattern, function (data) {
                        tagLoader.updateFormValues(selList, null, data);
                        tagLoader.lastPattern = newPattern;
                        tagDisplay.update(tagLoader.encodeFormStatus(selList));
                    });
                }
            }
        });

        if (typeof (opt.tagDisplay) === 'string') {
            tagDisplay = $(opt.tagDisplay);
        }

        selList.each(function (item, idx) {
            $('position-sel-' + idx).observe('click', function (event) {
                var currPattern,
                    eventSrcElement = normalizeSelectEventSource(event.element());

                if (eventSrcElement.getValue() !== tagLoader.selectedValues[idx]) {
                    tagLoader.history.push(eventSrcElement);
                    tagLoader.selectedValues[idx] = eventSrcElement.getValue();

                    if (tagLoader.getNumberOfSelectedItems(selList) > 0) {
                        currPattern = tagLoader.encodeFormStatus(selList);
                        if (currPattern !== tagLoader.lastPattern) {
                            tagLoader.loadPatternVariants(currPattern, function (data) {
                                tagLoader.updateFormValues(selList, event.element(), data);
                                tagLoader.lastPattern = currPattern;
                                tagDisplay.update(tagLoader.encodeFormStatus(selList));
                            });
                        }
                        tagDisplay.update(tagLoader.encodeFormStatus(selList));

                    } else {
                        // different browsers here pass different nodes as an event source
                        tagLoader.loadInitialVariants(function (data) {
                            tagLoader.updateSelectOptions(eventSrcElement, data[idx]);
                        });
                    }

                } else {
                    // TODO is this necessary?
                    tagDisplay.update(tagLoader.encodeFormStatus(selList));
                }
            });
        });
        tagDisplay.update(tagLoader.encodeFormStatus(selList));
        return tagLoader;
    };

    context.createTagLoader = createTagLoader;
    context.attachTagLoader = attachTagLoader;

}(window));