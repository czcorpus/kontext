// Copyright (c) 2012 Institute of the Czech National Corpus
//
// This library depends on Prototype.js version 1.7+.

/**
 * This library provides a replacement for standard SELECT element with 'multiple' option enabled.
 */
(function (context) {
    'use strict';

    var buildSkeleton,
        buildSkeletonFromJson;

    /**
     *
     * @param wrapperElem
     * @param opt configuration options
     *   useNamedCheckboxes
     * @param json
     * @return {Object}
     */
    context.createMultiselectComponent = function (wrapperElem, opt, json) {
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
             * @param wrapperElem multi-select component will be inserted into this element
             */
            init : function (wrapperElem) {
                var marginStyle,
                    paddingStyle,
                    widthStyle;

                multiSelect.useNamedCheckboxes = opt.hasOwnProperty('useNamedCheckboxes') ? opt.useNamedCheckboxes : true;
                multiSelect.allowMultipleOpenedBoxes = opt.allowMultipleOpenedBoxes;
                if (typeof (wrapperElem) === 'string') {
                    wrapperElem = context.$(wrapperElem);
                }
                marginStyle = opt.hasOwnProperty('margin') ? opt.margin : '5px';
                paddingStyle = opt.hasOwnProperty('padding') ? opt.padding : '5px';
                widthStyle = opt.hasOwnProperty('width') ? opt.width : '200px';


                wrapperElem.setStyle({
                    width : widthStyle,
                    margin : marginStyle,
                    padding : paddingStyle
                });
                multiSelect.ulElement = Element.extend(document.createElement('UL'));
                multiSelect.ulElement.writeAttribute('class', 'multiselect');
                wrapperElem.update(multiSelect.ulElement);
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


                if ((tbodyElm.parentNode.getStyle('display') === 'none' && status !== 'none') || status === 'table') {
                    if (!multiSelect.allowMultipleOpenedBoxes) {
                        for (prop in multiSelect.blocks) {
                            if (multiSelect.blocks.hasOwnProperty(prop)) {
                                multiSelect.blocks[prop].parentNode.setStyle({ display : 'none'});
                                if (multiSelect.getNumSelected(prop) === 0) {
                                    multiSelect.blockSwitchLinks[prop].writeAttribute('class', 'switch-link');

                                } else {
                                    multiSelect.blockSwitchLinks[prop].writeAttribute('class', 'switch-link used');
                                }
                            }
                        }
                    }
                    tbodyElm.parentNode.setStyle({ display : 'table'});
                    switchLink.writeAttribute('class', 'switch-link active');

                } else if ((tbodyElm.parentNode.getStyle('display') === 'table' && status !== 'table') || status === 'none') {
                    tbodyElm.parentNode.setStyle({ display : 'none'});
                    if (multiSelect.getNumSelected(blockId) === 0) {
                        switchLink.writeAttribute('class', 'switch-link');

                    } else {
                        switchLink.writeAttribute('class', 'switch-link used');
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

                liElement = Element.extend(document.createElement('LI'));
                liElement.setStyle({
                    margin : 0,
                    overflow : 'hidden',
                    clear : 'both'
                });
                liElement.writeAttribute('data-block-id', blockId);
                multiSelect.ulElement.insert(liElement);
                switchLink = Element.extend(document.createElement('A'));
                switchLink.writeAttribute('class', 'switch-link');
                switchLink.update(blockLabel);
                multiSelect.blockSwitchLinks[blockId] = switchLink;
                liElement.insert(switchLink);

                statusText = Element.extend(document.createElement('SPAN'));
                statusText.writeAttribute('class', 'status-text');
                statusText.update('[ 0 ]');
                //liElement.insert(statusText);
                switchLink.insert(statusText);

                itemTable = Element.extend(document.createElement('TABLE'));
                liElement.insert(itemTable);
                itemTable.writeAttribute('class', 'checkbox-list');
                itemTbody = Element.extend(document.createElement('TBODY'));
                itemTbody.writeAttribute('class', 'item-' + blockId);
                itemTable.insert(itemTbody);
                multiSelect.blocks[blockId] = itemTbody;
                switchLink.observe('click', function () {
                    multiSelect.activeBlockId = blockId;
                    multiSelect.flipBlockVisibility(blockId);
                });
                itemTbody.parentNode.setStyle({ display : 'none'});
                multiSelect.addDefaultValue(blockId, liElement, defaultValue || ''); // 'default default' value

                eventCallbacks = eventCallbacks || {};
                for (prop in eventCallbacks) {
                    if (eventCallbacks.hasOwnProperty(prop) && typeof (eventCallbacks[prop]) === 'function') {
                        switchLink.observe(prop, eventCallbacks[prop]);
                    }
                }
                return multiSelect;
            },

            /**
             * Returns TBODY block identified by its order (starting from zero)
             *
             * @param idx
             * @return {Object} object representing found TBODY element or null
             * if nothing found or if invalid index is provided
             */
            getBlockByIndex : function (idx) {
                var items = multiSelect.ulElement.select('tbody');
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
                    items = multiSelect.ulElement.select('tbody');

                for (i = 0; i < items.length; i += 1) {
                    if (items[i] === multiSelect.blocks[blockId]) {
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
                multiSelect.blocks[blockId].update();
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
                multiSelect.blockSwitchLinks[blockId].parentNode.select('span[class="status-text"]').each(function (item) {
                    item.update(text);
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
                    inputElm;

                if (!multiSelect.blocks.hasOwnProperty(blockId)) {
                    throw new Error('Cannot add item to the block ' + blockId + '. Block does not exist.');
                }
                trElm = Element.extend(document.createElement('TR'));
                multiSelect.blocks[blockId].insert(trElm);
                tdElm = Element.extend(document.createElement('TD'));
                trElm.insert(tdElm);
                inputElm = Element.extend(document.createElement('INPUT'));
                inputElm.writeAttribute('type', 'checkbox');
                if (multiSelect.useNamedCheckboxes) {
                    inputElm.writeAttribute('name', blockId);
                }
                inputElm.writeAttribute('value', value);
                tdElm.insert(inputElm);

                tdElm = Element.extend(document.createElement('TD'));
                tdElm.update(label);
                trElm.insert(tdElm);

                inputElm.observe('click', function () {
                    multiSelect.activeBlockId = blockId;
                    if (multiSelect.getNumSelected(blockId) === 0) {
                        multiSelect.defaultValues[blockId].writeAttribute('value',
                            multiSelect.defaultValues[blockId].readAttribute('data-orig-value'));
                        multiSelect.blockSwitchLinks[blockId].writeAttribute('class', 'switch-link');

                    } else {
                        multiSelect.defaultValues[blockId].writeAttribute('value', '');
                        multiSelect.blockSwitchLinks[blockId].writeAttribute('class', 'switch-link used');
                    }
                });
                if (typeof (clickCallback) === 'function') {
                    inputElm.observe('click', clickCallback);
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

                inputElm = Element.extend(document.createElement('INPUT'));
                inputElm.writeAttribute('type', 'hidden');
                inputElm.writeAttribute('data-orig-value', value);
                inputElm.writeAttribute('value', value);
                inputElm.writeAttribute('name', blockId);
                parentElement.insert(inputElm);
                multiSelect.defaultValues[blockId] = inputElm;
            },

            /**
             *
             * @param blockId {String}
             * @param value {String}
             */
            setDefaultValue : function (blockId, value) {
                multiSelect.defaultValues[blockId].writeAttribute('data-orig-value', value);
                if (multiSelect.defaultValues[blockId].readAttribute('value')) {
                    multiSelect.defaultValues[blockId].writeAttribute('value', value);
                }
            },

            /**
             *
             * @param blockId
             * @param value
             */
            checkItem : function (blockId, value) {
                var items = multiSelect.blocks[blockId].select('input[type="checkbox"][value="' + value + '"]');
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
                var items = multiSelect.blocks[blockId].select('input[type="checkbox"][value="' + value + '"]');
                if (items.length === 1) {
                    items[0].checked = false;
                }
            },

            /**
             *
             */
            uncheckAll : function () {
                var prop;

                multiSelect.activeBlockId = null;
                multiSelect.ulElement.select('input[type="checkbox"]').each(function (item) {
                    item.checked = false;
                });

                for (prop in multiSelect.blockSwitchLinks) {
                    if (multiSelect.blockSwitchLinks.hasOwnProperty(prop)) {
                        multiSelect.blockSwitchLinks[prop].setStyle({ fontWeight : 'normal'});
                    }
                }
            },

            /**
             *
             */
            collapseAll : function () {
                var prop;

                for (prop in multiSelect.blocks) {
                    if (multiSelect.blocks.hasOwnProperty(prop)) {
                        multiSelect.flipBlockVisibility(prop, 'none');
                    }
                }
            },

            /**
             *
             */
            disableBlock : function (blockId) {
                multiSelect.blocks[blockId].select('input[type="checkbox"]').each(function (item) {
                    item.writeAttribute('disabled', 'disabled');
                });
            },

            /**
             *
             * @return {Object}
             */
            exportStatus : function () {
                var prop,
                    ans = {},
                    setStatus;

                setStatus = function (item) {
                    ans[prop].push(item.getValue());
                };

                for (prop in multiSelect.blocks) {
                    if (multiSelect.blocks.hasOwnProperty(prop)) {
                        ans[prop] = [];
                        multiSelect.blocks[prop].select('input[type="checkbox"]').each(setStatus);
                    }
                }
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
                    return multiSelect.blocks[blockId].select('input[type="checkbox"]:checked').length;
                }
                return multiSelect.ulElement.select('input[type="checkbox"]:checked').length;
            }
        };
        multiSelect.init(wrapperElem);
        return multiSelect;
    };

}(window));
