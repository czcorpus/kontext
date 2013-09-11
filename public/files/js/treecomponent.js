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


define(['jquery', 'win'], function ($, win) {
    'use strict';

    /**
     *
     */
    var lib = {};

    /**
     * This object parses <SELECT> and <OPTION> elements expecting additional path
     * information stored in OPTIONs' 'data-path' attributes. These values are then transformed into an
     * UL+LI tree.
     *
     * @constructor
     * @param {HTMLElement} button
     * @param {function} customCallback function with signature func(event, selectedItemValue);
     */
    function NestedTree(button, customCallback) {
        this.hiddenInput = null;
        this.button = button;
        this.customCallback = customCallback;
    }

    /**
     * @param {Array} pathItems
     * @param {string} itemTitle
     * @param {string} itemDesc
     * @param {HTMLElement} rootElm where to start the search
     */
    NestedTree.prototype.findUlPath = function (pathItems, itemTitle, itemDesc, rootElm) {
        var currPathItem = pathItems.shift(),
            foundElm = null,
            newLi,
            newUl,
            jqNewLink,
            self = this;

        $(rootElm).children().each(function () {
            if ($(this).data('path') === currPathItem) {
                foundElm = this;
                return;
            }
        });

        if (foundElm === null) {
            newLi = win.document.createElement('li');
            $(newLi).data('path', currPathItem);
            $(rootElm).append(newLi);

            if (pathItems.length > 0) {
                newUl = win.document.createElement('ul');
                $(newLi).append(currPathItem);
                $(newLi).append(newUl);
                this.findUlPath(pathItems, itemTitle, itemDesc, newUl);

            } else {
                jqNewLink = $(win.document.createElement('a'));
                jqNewLink.attr('href', '#');
                jqNewLink.data('id', currPathItem);
                if (itemDesc) {
                    jqNewLink.attr('title', itemDesc);
                }
                jqNewLink.append(itemTitle);
                jqNewLink.bind('click', function (event) {
                    $(self.hiddenInput).val(currPathItem);
                    $(self.button).empty().append(itemTitle);
                    self.button.click();
                    if (typeof self.customCallback === 'function') {
                        self.customCallback(event, currPathItem);
                    }
                    event.stopPropagation();
                });
                $(newLi).append(jqNewLink);
            }

        } else {
            this.findUlPath(pathItems, itemTitle, itemDesc, $(foundElm).children().get(0));
        }
    };

    /**
     *
     * @param {HTMLElement|jQuery|string} selectBox
     * @returns {HTMLElement} root UL element
     */
    NestedTree.prototype.buildFromSelectElm = function (selectBox) {
        var splitPath,
            rootUl = win.document.createElement('ul'),
            self = this;

        this.hiddenInput = win.document.createElement('input');
        $(this.hiddenInput).attr({
            'type': 'hidden',
            'name': $(selectBox).attr('name'),
            'value': $(selectBox).val()
        });

        $(selectBox).children().each(function () {
            var path = $(this).data('path');
            if (path.indexOf('/') === 0) {
                path = path.substring(1);
            }
            if (path.substr(path.length - 1, 1) === '/') {
                path = path.substr(0, path.length - 1);
            }
            splitPath = path.split('/');
            splitPath.push($(this).attr('value'));
            self.findUlPath(splitPath, $(this).text(), $(this).attr('title'), rootUl);
        });
        $(rootUl).attr('class', 'tree-component');
        return rootUl;
    };


    /**
     *
     * @constructor
     */
    function TreeComponent() {
        this.rootUl = null;
        this.jqWrapper = null;
        this.menuWidth = 200;
        this.nestedTree = null;
    }

    /**
     * Searches for an UL subtree starting with elm
     * @param elm the search starts from this element
     * @return {*} first found UL element or null
     */
    TreeComponent.prototype.findSubtree = function (elm) {
        var i,
            children = $(elm).children();

        for (i = 0; i < children.length; i += 1) {
            if (children.get(i).tagName === 'UL') {
                return children.get(i);
            }
        }
        return null;
    };

    /**
     * Switches visibility of already modified UL subtree plus it changes the state signalling triangle
     * from vertical to horizontal position.
     *
     * @param ulElement
     * @param expSymbolWrapper element where the state signalling symbol is
     */
    TreeComponent.prototype.switchSubtree = function (ulElement, expSymbolWrapper) {
        var jqUlElement = $(ulElement),
            style = jqUlElement.css('display');

        if (style === 'block') {
            jqUlElement.css('display', 'none');
            $(expSymbolWrapper).empty().append('&#x25BA;&nbsp;');

        } else {
            jqUlElement.css('display', 'block');
            $(expSymbolWrapper).empty().append('&#x25BC;&nbsp;');
        }
    };

    /**
     *
     * @param elm element to be switched
     * @param state one of {"show", "hide"}; if not provided then any state is changed to the other one
     */
    TreeComponent.prototype.switchComponentVisibility = function (state) {
        var leftPos = 0,
            jqElm = $(this.rootUl);

        if (jqElm.css('display') === 'block' || state === 'hide') {
            jqElm.css({ display: 'none', position: 'relative'});

        } else if (jqElm.css('display') === 'none' || state === 'show') {
            if (this.jqWrapper.css('position') !== 'absolute') {
                leftPos = this.jqWrapper.position().left;
            }
            if (this.jqWrapper.position().left + this.menuWidth > $(win.document).width()) {
                leftPos = this.jqWrapper.position().left + Math.min(0, $(win.document).width()
                    - this.jqWrapper.position().left - $(this.rootUl).width());
            }

            jqElm.css({
                display: 'block',
                position: 'absolute',
                'z-index': 1000000,
                left: leftPos + 'px',
                margin: '0',
                width: this.menuWidth + 'px',
                padding: '4px 5px 8px 5px',
                'text-align': 'left'
            });
        }
    };

    /**
     *
     */
    TreeComponent.prototype.attachLinks = function () {
        var jqRootUl = $(this.rootUl),
            self = this;

        this.switchComponentVisibility(jqRootUl);

        jqRootUl.css('list-style-type', 'none');
        jqRootUl.find('ul').css('list-style-type', 'none');
        jqRootUl.find('li').each(function () {
            var subtree = self.findSubtree(this),
                newSpan,
                jqNewLink;

            if (subtree !== null) {
                jqNewLink = $(win.document.createElement('a'));
                jqNewLink.attr({
                    'class': 'tree-expand',
                    'href': '#'
                });
                newSpan = win.document.createElement('span');
                $(newSpan).empty().append('&#x25BA;&nbsp;');
                jqNewLink.append(newSpan);
                $(this).prepend(jqNewLink.get(0));
                jqNewLink.css('text-decoration', 'none');
                jqNewLink.bind('click', function (event) {
                    if (subtree !== null) {
                        self.switchSubtree(subtree, newSpan);
                    }
                    event.stopPropagation();
                });
                self.switchSubtree(subtree, newSpan);
            }
        });
    };

    /**
     *
     * @param selectBoxElement
     * @returns {*}
     */
    TreeComponent.prototype.getTitleOfSelectedItem = function (selectBoxElement) {
        var descendants,
            currValue = null,
            i,
            jqSelectBoxElement = $(selectBoxElement);

        if (jqSelectBoxElement.val()) {
            currValue = jqSelectBoxElement.val();

        } else {
            currValue = jqSelectBoxElement.children().first().val();
        }
        descendants = jqSelectBoxElement.children();
        for (i = 0; i < descendants.length; i += 1) {
            if ($(descendants[i]).val() === currValue) {
                return $(descendants[i]).text();
            }
        }
        return null;
    };

    /**
     *
     * @param treeComponentInstance
     * @param currentValue
     * @param rootElm
     */
    TreeComponent.prototype.expandSelected = function (currentValue) {
        var rootDescendants = $(this.rootUl).find('li'),
            itemAncestors,
            srchItem = null,
            i,
            expandFunc,
            self = this;

        for (i = 0; i < rootDescendants.length; i += 1) {
            if (rootDescendants.get(i).nodeName === 'LI'
                    && $(rootDescendants.get(i)).data('path') === currentValue) {
                srchItem = rootDescendants.get(i);
                break;
            }
        }

        expandFunc = function (index, value) {
            if ($(value).attr('class') === 'tree-expand') {
                self.switchSubtree(self.findSubtree(value.parentElement), $(value).children().get(0));
            }
        };

        if (srchItem !== null) {
            itemAncestors = $(srchItem).parents();
            for (i = 0; i < itemAncestors.length; i += 1) {
                if (itemAncestors.get(i).nodeName === 'UL') {
                    $(itemAncestors.get(i)).siblings().each(expandFunc);
                    if ($(itemAncestors.get(i)).attr('class') === 'tree-component') {
                        break;
                    }
                }
            }
        }
    };

    /**
     *
     * @param title
     */
    TreeComponent.prototype.createActivationButton = function (title) {
        var button = $(win.document.createElement('button')).attr('type', 'button'),
            self = this;

        $(button).empty().append(title);
        $(button).bind('click', function (event) {
            self.switchComponentVisibility('show');
            event.stopPropagation();
        });

        return button;
    };

    /**
     *
     */
    TreeComponent.prototype.bindOutsideClick = function () {
        var self = this;

        $(win.document).bind('click', function (event) {
            var i,
                isWithinTreeComponent = false,
                ancestors = $(event.target).parents();

            for (i = 0; i < ancestors.length; i += 1) {
                if ($(ancestors[i]).attr('class') === 'tree-component') {
                    isWithinTreeComponent = true;
                    break;
                }
            }
            if (!isWithinTreeComponent) {
                self.switchComponentVisibility('hide');
            }
        });
    };

    /**
     * Builds actual tree component by transforming UL+LI (of arbitrary nesting) tree so that
     * it becomes a single level list expandable to the original multi-level list by mouse clicking.
     *
     * @param {HTMLElement} selectElm
     * @param {string} title
     * @param {function} customCallback
     */
    TreeComponent.prototype.build = function (selectElm, title, customCallback) {
        var button,
            wrapper,
            jqSelectBoxItem = $(selectElm),
            self = this;

        this.bindOutsideClick();

        wrapper = win.document.createElement('div');
        this.jqWrapper = $(wrapper);
        this.jqWrapper.css({
            position: jqSelectBoxItem.css('position'),
            left: jqSelectBoxItem.css('left'),
            top: jqSelectBoxItem.css('top'),
            display: jqSelectBoxItem.css('display'),
            'float': jqSelectBoxItem.css('float'),
            'font-size': jqSelectBoxItem.css('fontSize'),
            color: jqSelectBoxItem.css('color')
        });
        jqSelectBoxItem.replaceWith(wrapper);

        button = this.createActivationButton(title || this.getTitleOfSelectedItem(selectElm));
        this.jqWrapper.append(button);

        this.nestedTree = new NestedTree(button, customCallback);
        this.rootUl = this.nestedTree.buildFromSelectElm(selectElm);
        $(this.rootUl).attr('id', jqSelectBoxItem.attr('id'));
        this.jqWrapper.append(this.rootUl);

        this.attachLinks();

        $(this.rootUl.parentNode).append(this.nestedTree.hiddenInput);
        // following handler is present because of Firefox
        // which is caching form state and JS-added elements confuse it.
        $(win).on('unload', function () {
            $(self.nestedTree.hiddenInput).remove();
        });
        this.expandSelected($(this.nestedTree.hiddenInput).val());
    };


    lib.TreeComponent = TreeComponent;

    /**
     * Transforms form select box into a tree-rendered selector
     *
     * @param {jQuery} selResult HTML SELECT element to be transformed into an expandable tree
     * @param {string} title if provided then the initial text label will be equal to this value
     * @param {function} customCallback custom code to be executed when an item is selected.
     * The function is expected to have ignature func(event, selectedItemValue);
     */
    lib.createTreeComponent = function (selResult, title, customCallback) {
        selResult.each(function () {
            var component = new TreeComponent();
            component.build(this, title, customCallback);
        });
    };

    return lib;
});
