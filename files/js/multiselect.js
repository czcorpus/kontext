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
     * @param json
     * @return {Object}
     */
    context.createMultiselectComponent = function (wrapperElem, opt, json) {
        if (json !== undefined) {
            return buildSkeletonFromJson(wrapperElem, opt, json);
        }
        return buildSkeleton(wrapperElem, opt);
    },

    buildSkeletonFromJson = function (wrapperElem, opt, jsonData) {
        var prop,
            skeleton,
            item,
            i;

        skeleton = buildSkeleton(wrapperElem, opt);

        for (prop in jsonData) {
            if (jsonData.hasOwnProperty(prop)) {
                item = jsonData[prop];
                skeleton.addBlock(prop, item.label);
                for (i = 0; i < item.items.length; i += 1) {
                    skeleton.addItem(prop, item.items[i].value, item.items[i].label);
                }
            }
        }

        return skeleton;
    },


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

            blocks : {},

            /**
             *
             * @param wrapperElem multi-select component will be inserted into this element
             */
            init : function (wrapperElem) {
                var i,
                    borderStyle,
                    marginStyle,
                    paddingStyle,
                    widthStyle;

                if (typeof (wrapperElem) === 'string') {
                    wrapperElem = $(wrapperElem);
                }
                borderStyle = opt.hasOwnProperty('border') ? opt.border : '1px solid #aaa';
                marginStyle = opt.hasOwnProperty('margin') ? opt.margin : '5px';
                paddingStyle = opt.hasOwnProperty('padding') ? opt.padding : '5px';
                widthStyle = opt.hasOwnProperty('width') ? opt.width : '200px';

                wrapperElem.setStyle({
                    width : widthStyle,
                    border : borderStyle,
                    margin : marginStyle,
                    padding : paddingStyle
                });
                multiSelect.ulElement = Element.extend(document.createElement('UL'));
                multiSelect.ulElement.setStyle({
                    listStyleType : 'none',
                    margin: 0,
                    padding : 0
                });
                wrapperElem.update(multiSelect.ulElement);
            },

            /**
             * Adds checkbox list box
             *
             * @param blockId
             * @param blockLabel
             * @return {Object}
             */
            addBlock : function (blockId, blockLabel) {
                var liElement,
                    switchLink,
                    itemTable,
                    itemTbody,
                    flagElement;

                blockLabel = blockLabel || blockId;

                liElement = Element.extend(document.createElement('LI'));
                liElement.setStyle({
                    margin : 0
                });
                multiSelect.ulElement.insert(liElement);
                switchLink = Element.extend(document.createElement('A'));
                switchLink.update(blockLabel);
                liElement.insert(switchLink);
                flagElement = Element.extend(document.createElement('SPAN'));
                flagElement.writeAttribute('class', 'flag');
                flagElement.update('&#x25BA;&nbsp;');
                flagElement.setStyle({
                    paddingLeft : '5px'
                });
                switchLink.insert({ after : flagElement });
                itemTable = Element.extend(document.createElement('TABLE'));
                liElement.insert(itemTable);
                itemTable.writeAttribute('class', 'checkbox-list');
                itemTbody = Element.extend(document.createElement('TBODY'));
                itemTbody.writeAttribute('class', 'item-' + blockId);
                itemTable.insert(itemTbody);
                multiSelect.blocks[blockId] = itemTbody;
                switchLink.observe('click', function (event) {
                    if (itemTbody.parentNode.getStyle('display') === 'none') {
                        itemTbody.parentNode.setStyle({ display : 'table'});
                        switchLink.nextSiblings()[0].update('&#x25BC;&nbsp;');

                    } else {
                        itemTbody.parentNode.setStyle({ display : 'none'});
                        switchLink.nextSiblings()[0].update('&#x25BA;&nbsp;');
                    }
                });
                itemTbody.parentNode.setStyle({ display : 'none'});
                return multiSelect;
            },

            /**
             *
             * @param blockId
             * @param value
             * @param label
             * @param callback
             * @return {Object}
             */
            addItem : function (blockId, value, label, callback) {
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
                inputElm.writeAttribute('name', blockId);
                inputElm.writeAttribute('value', value);
                tdElm.insert(inputElm);

                tdElm = Element.extend(document.createElement('TD'));
                tdElm.update(label);
                trElm.insert(tdElm);

                if (typeof (callback) === 'function') {
                    inputElm.observe('click', callback);
                }

                return multiSelect;
            },

            /**
             *
             * @return {Object}
             */
            exportStatus : function () {
                var prop,
                    ans = {},
                    blockTable,
                    checkBoxList;

                for (prop in multiSelect.blocks) {
                    if (multiSelect.blocks.hasOwnProperty(prop)) {
                        ans[prop] = [];
                        multiSelect.blocks[prop].select('input[type="checkbox"]').each(function (item) {
                            ans[prop].push(item.getValue());
                        });
                    }
                }
                return ans;
            }
        };
        multiSelect.init(wrapperElem);
        return multiSelect;
    };

}(window));
