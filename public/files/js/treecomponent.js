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


define(['jquery', 'win', 'typeahead'], function ($, win) {
    'use strict';

    /**
     *
     */
    var lib = {};

    /**
     * Returns object's all own property names
     *
     * @param {{}} obj
     * @returns {Array}
     */
    function getObjectKeys(obj) {
        var ans = [],
            k;

        for (k in obj) {
            if (obj.hasOwnProperty(k)) {
                ans.push(k);
            }
        }
        return ans;
    }

    /**
     * This object parses <SELECT> and <OPTION> elements expecting additional path
     * information stored in OPTIONs' 'data-path' attributes. These values are then transformed into a
     * UL+LI tree.
     *
     * @constructor
     * @param {HTMLElement} button
     * @param {function(event, string)} [customCallback] a custom function called whenever user clicks a leaf node;
     * the second argument contains item's value
     */
    function NestedTree(button, customCallback) {
        this.hiddenInput = null;
        this.button = button;
        this.customCallback = customCallback;
        this.leafValues = {}; // leaf item value => leaf item link (A)
    }

    /**
     * Creates a subtree in passed tree (represented by the 'rootElm' argument)
     * according to the provided path (represented by the 'pathItems' argument).
     *
     * @param {array} pathItems
     * @param {string} itemTitle
     * @param {string} itemDesc
     * @param {HTMLElement} rootElm root element of an existing tree
     */
    NestedTree.prototype.findUlPath = function (pathItems, itemTitle, itemDesc, rootElm) {
        var currPathItem = pathItems.shift(),
            foundElm = null,
            newLi,
            newUl,
            jqNewLink,
            self = this;

        // is the currPathItem a child of rootElm?
        $(rootElm).children().each(function () {
            if ($(this).data('path') === currPathItem) {
                foundElm = this;
                return;
            }
        });

        if (foundElm === null) { // currPathItem not found in children => we have to create it
            newLi = win.document.createElement('li');
            $(newLi).data('path', currPathItem);
            $(rootElm).append(newLi);

            if (pathItems.length > 0) { // are there any path parts to be processed yet?
                newUl = win.document.createElement('ul');
                $(newLi).append(currPathItem);
                $(newLi).append(newUl);
                this.findUlPath(pathItems, itemTitle, itemDesc, newUl);

            } else { // whole path is ready => we will create a leaf node
                jqNewLink = $(win.document.createElement('a'));
                jqNewLink.attr('href', '#');
                jqNewLink.data('id', currPathItem);
                if (itemDesc) {
                    jqNewLink.attr('title', itemDesc);
                }
                jqNewLink.append(itemTitle);

                jqNewLink.on('click', function (event) {
                    $(self.hiddenInput).val(currPathItem);
                    $(self.button).empty().append(itemTitle);
                    self.button.click();
                    if (typeof self.customCallback === 'function') {
                        self.customCallback(event, currPathItem);
                    }
                    event.stopPropagation();
                });
                $(newLi).append(jqNewLink);

                self.leafValues[itemTitle] = jqNewLink.get(0);
            }

        } else { // currPathItem already present => let's search another path item
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
        return rootUl;
    };


    /**
     *
     * @constructor
     * @param {{}} [options]
     * @param {boolean} options.clickableText
     * @param {String} options.title
     * @param {boolean} options.searchable
     * @param {Function} options.onSwitchVisibility a callback function(status, treeComponent) called whenever
     * visibility status is changed. But only if triggered manually (via a clickable element), i.e. automatic
     * component initalization does NOT cause this callback to be called.
     * @param {*} [messages]
     */
    function TreeComponent(options, messages) {
        this.rootUl = null;
        this.treeWrapper = null;
        this.jqWrapper = null;
        this.nestedTree = null;
        this.button = null; // button for switching component on and off
        this.options = options || {};

        if (typeof messages === 'object') {
            this.messages = messages;

        } else {
            this.messages = {
                search_by_name : 'search by name...'
            };
        }
    }

    /**
     *
     * @returns {null|*}
     */
    TreeComponent.prototype.getSwitchButton = function () {
        return this.button;
    };

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
     *
     * @returns {number} real width of the widget in pixels
     */
    TreeComponent.prototype.widgetWidth = function () {
        return $(this.treeWrapper).width();
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
     * @param {string} state one of {"show", "hide"}; if not provided then any state is changed to the other one
     * @param {HTMLElement} [triggerElm] element which caused the change
     */
    TreeComponent.prototype.switchComponentVisibility = function (state, triggerElm) {
        var leftPos = 0,
            jqElm = $(this.treeWrapper);

        if (jqElm.css('display') === 'block' || state === 'hide') {
            jqElm.css({ display: 'none', position: 'relative'});

        } else if (jqElm.css('display') === 'none' || state === 'show') {
            jqElm.css({
                display: 'block',
                position: 'absolute',
                'z-index': 900000,
                margin: '0'
            });
            if (this.jqWrapper.css('position') !== 'absolute') {
                leftPos = this.jqWrapper.position().left;
            }
            if (this.jqWrapper.position().left + this.widgetWidth() > $(win.document).width()) {
                leftPos = this.jqWrapper.position().left + Math.min(0, $(win.document).width()
                    - this.jqWrapper.position().left - $(this.rootUl).width());
            }
            jqElm.css({
                left: leftPos + 'px'
            });
        }
        if (triggerElm && typeof this.options.onSwitchVisibility === 'function') {
            this.options.onSwitchVisibility(state, this);
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

                if (!self.options.clickableText) {
                    $(this).prepend(jqNewLink.get(0));

                } else {
                    (function (element) {
                        var originalTextNode,
                            originalText,
                            jqTextLink;

                        originalTextNode = $(element).contents().filter(function () {return this.nodeType === 3; });
                        originalText = $(originalTextNode).text();
                        originalTextNode.remove();
                        jqTextLink = $(win.document.createElement('a'));
                        jqTextLink.text(originalText);
                        jqTextLink.addClass('node-link');
                        $(element).prepend(jqTextLink);
                        $(element).prepend(jqNewLink.get(0));
                        jqTextLink.on('click', function (event) {
                            if (subtree !== null) {
                                self.switchSubtree(subtree, newSpan);
                            }
                            event.stopPropagation();
                        });
                    }(this));
                }
                jqNewLink.css('text-decoration', 'none');
                jqNewLink.on('click', function (event) {
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
     * @param currentValue
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
        $(button).on('click', function (event) {
            self.switchComponentVisibility('show', event.target);
            event.preventDefault();
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
     *
     */
    TreeComponent.prototype.attachSearchField = function () {
        var self = this,
            srchField,
            substringMatcher;

        srchField = win.document.createElement('input');
        $(srchField)
            .attr('type', 'text')
            .css('margin-right', '0')
            .addClass('srch-field')
            .addClass('initial')
            .on('focus.searchInit', function (event) {
                $(event.target).val('')
                    .off('focus.searchInit')
                    .removeClass('initial');
            })
            .val(self.messages.search_by_name);
        this.treeWrapper.append(srchField);

        substringMatcher = function (strs) {
            return function findMatches(q, cb) {
                var substrRegex,
                    matches = [];

                substrRegex = new RegExp(q, 'i');
                $.each(strs, function (i, str) {
                    if (substrRegex.test(str)) {
                        matches.push({ value: str });
                    }
                });
                cb(matches);
            };
        };

        $(srchField).typeahead(
            {
                hint: true,
                highlight: true,
                minLength: 2
            },
            {
                name: 'corplist',
                source: substringMatcher(getObjectKeys(self.nestedTree.leafValues))
            }
        );

        $(win).on('typeahead:opened', function () {
            $(self.rootUl).hide();
            $('.tt-dropdown-menu').css('display', 'inherit');
        });

        $(win).on('typeahead:closed', function () {
            $(self.rootUl).show();
            $(srchField).typeahead('val', '');
        });

        $(win).on('typeahead:selected', function (jQuery, suggestion) {
            $(self.nestedTree.leafValues[suggestion.value]).click();
        });
    };

    /**
     * Builds actual tree component by transforming UL+LI (of arbitrary nesting) tree so that
     * it becomes a single level list expandable to the original multi-level list by mouse clicking.
     *
     * @param {HTMLElement} selectElm
     * @param {function(HTMLElement, string)} leafNodeClickCallback
     */
    TreeComponent.prototype.build = function (selectElm, leafNodeClickCallback) {
        var wrapper,
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

        this.button = this.createActivationButton(this.options.title || this.getTitleOfSelectedItem(selectElm));
        this.jqWrapper.append(this.button);

        this.nestedTree = new NestedTree(this.button, leafNodeClickCallback);
        this.rootUl = this.nestedTree.buildFromSelectElm(selectElm);
        $(this.rootUl).addClass('root-list');
        this.treeWrapper = $(win.document.createElement('DIV'));
        this.treeWrapper.attr('class', 'tree-component');
        $(this.rootUl).attr('id', jqSelectBoxItem.attr('id'));
        this.jqWrapper.append(this.treeWrapper);
        if (this.options.searchable) {
            this.attachSearchField();
        }
        this.treeWrapper.append(this.rootUl);
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
     * @param {HTMLElement|jQuery|string} selResult HTML SELECT element to be transformed into an expandable tree
     * @param {*} messages translations for the library (if nothing is provided then english messages are used)
     * @param {{clickableText: Boolean, title: String}} [options]
     * @param {function(Event, string} [customCallback] custom code to be executed when an item is selected.
     * @return {Array} list of created components
     */
    lib.createTreeComponent = function (selResult, messages, options, customCallback) {
        var ans = [];

        $(selResult).each(function () {
            var component = new TreeComponent(options, messages);

            component.build(this, customCallback);
            ans.push(component);
        });
        return ans;
    };

    return lib;
});
