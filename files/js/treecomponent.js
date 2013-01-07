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


define(['jquery'], function ($) {
    'use strict';

    /**
     *
     */
    function getElementText(element) {
        return element.textContent || element.innerText;
    }

    /**
     * Creates object which transforms any UL+LI tree so that it becomes a single level list
     * expandable to the original multi-level list by mouse clicking.
     *
     * @return treeComponent object
     */
    function createTreeComponentInstance() {
        var treeComponent =  {

            /**
             * Searches for an UL subtree starting with elm
             * @param elm the search starts from this element
             * @return {*} first found UL element or null
             */
            findSubtree : function (elm) {
                var i,
                    children = $(elm).children();

                for (i = 0; i < children.length; i += 1) {
                    if (children.get(i).tagName === 'UL') {
                        return children.get(i);
                    }
                }
                return null;
            },

            /**
             * Switches visibility of already modified UL subtree plus it changes the state signalling triangle
             * from vertical to horizontal position.
             *
             * @param ulElement
             * @param expSymbolWrapper element where the state signalling symbol is
             */
            switchSubtree : function (ulElement, expSymbolWrapper) {
                var jqUlElement = $(ulElement),
                    style = jqUlElement.css('display');

                if (style === 'block') {
                    jqUlElement.css('display', 'none');
                    $(expSymbolWrapper).empty().append('&#x25BA;&nbsp;');

                } else {
                    jqUlElement.css('display', 'block');
                    $(expSymbolWrapper).empty().append('&#x25BC;&nbsp;');
                }
            },

            /**
             * Modifies any UL tree into the shrinked, expandable version.
             *
             * @param rootUl root UL element. It could be either a prototype.js element or an ID
             */
            init : function (rootUl) {
                var jqRootUl = $(rootUl);
                jqRootUl.css('list-style-type', 'none');
                jqRootUl.find('ul').css('list-style-type', 'none');
                jqRootUl.find('li').each(function () {
                    var subtree = treeComponent.findSubtree(this),
                        newSpan,
                        jqNewLink;

                    if (subtree !== null) {
                        jqNewLink = $(document.createElement('a'));
                        jqNewLink.attr({
                            'class' : 'tree-expand',
                            'href' : '#'
                        });
                        newSpan = document.createElement('span');
                        $(newSpan).empty().append('&#x25BA;&nbsp;');
                        jqNewLink.append(newSpan);
                        $(this).prepend(jqNewLink.get(0));
                        jqNewLink.css('text-decoration', 'none');
                        jqNewLink.bind('click', function (event) {
                            if (subtree !== null) {
                                treeComponent.switchSubtree(subtree, newSpan);
                            }
                            event.stopPropagation();
                        });
                        treeComponent.switchSubtree(subtree, newSpan);
                    }
                });
            }
        };
        return treeComponent;
    }

    /**
     * This function creates object which parses "/option/select" elements with additional path
     * information stored in their 'data-path' attributes. These values are then transformed into an
     * UL+LI tree.
     *
     * @return selectParser object
     */
    function createSelectParserInstance() {
        var selectParser = {

            hiddenInput : null,

            findUlPath : function (pathItems, itemTitle, itemDesc, rootElm, button, customCallback) {
                var currPathItem = pathItems.shift(),
                    foundElm,
                    newLi,
                    newUl,
                    jqNewLink;

                $(rootElm).children().each(function () {
                    if ($(this).attr('data-path') === currPathItem) {
                        foundElm = this;
                        return;
                    }
                });
                if (foundElm === undefined) {
                    newLi = document.createElement('li');
                    $(newLi).attr('data-path', currPathItem);
                    $(rootElm).append(newLi);

                    if (pathItems.length > 0) {
                        newUl = document.createElement('ul');
                        $(newLi).append(currPathItem);
                        $(newLi).append(newUl);
                        selectParser.findUlPath(pathItems, itemTitle, itemDesc, newUl, button, customCallback);

                    } else {
                        jqNewLink = $(document.createElement('a'));
                        jqNewLink.attr('href', '#');
                        jqNewLink.attr('data-id', currPathItem);
                        if (itemDesc) {
                            jqNewLink.attr('title', itemDesc);
                        }
                        jqNewLink.append(itemTitle);
                        jqNewLink.bind('click', function (event) {
                            $(selectParser.hiddenInput).val(currPathItem);
                            $(button).empty().append(itemTitle);
                            button.click();
                            if (customCallback !== undefined) {
                                customCallback(event);
                            }
                            event.stopPropagation();
                        });
                        $(newLi).append(jqNewLink);
                    }

                } else {
                    selectParser.findUlPath(pathItems, itemTitle, itemDesc, $(foundElm).children().get(0), button, customCallback);
                }
            },

            parseSelectOptions : function (selectBoxId, button, customCallback) {
                var splitPath,
                    rootUl = document.createElement('ul');

                $(selectBoxId).children().each(function () {
                    var path = $(this).attr('data-path');
                    if (path.indexOf('/') === 0) {
                        path = path.substring(1);
                    }
                    if (path.substr(path.length - 1, 1) === '/') {
                        path = path.substr(0, path.length - 1);
                    }
                    splitPath = path.split('/');
                    splitPath.push($(this).attr('value'));
                    selectParser.findUlPath(splitPath, getElementText(this), $(this).attr('title'), rootUl, button, customCallback);
                });
                $(rootUl).attr('class', 'tree-component');
                return rootUl;
            }
        };
        return selectParser;
    }

    /**
     * Transforms form select box into a tree-rendered selector
     *
     * @param selResult HTML SELECT element to be transformed into an expandable tree
     * @param title if provided then the initial text label will be equal to this value
     * @param customCallback custom code to be executed when an item is selected (an event
     * object related to the "item click" action is passed to this function)
     */
    function createTreeComponent(selResult, title, customCallback) {
        var selectParser = createSelectParserInstance();
        function getTitleOfSelectedItem(selectBoxElement) {
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
                    return getElementText(descendants[i]);
                }
            }
            return null;
        }

        function expandSelected(treeComponentInstance, currentValue, rootElm) {
            var rootDescendants = $(rootElm).find('li'),
                itemAncestors,
                srchItem = null,
                i,
                expandFunc;

            for (i = 0; i < rootDescendants.length; i += 1) {
                if (rootDescendants.get(i).nodeName === 'LI'
                        && $(rootDescendants.get(i)).attr('data-path') === currentValue) {
                    srchItem = rootDescendants.get(i);
                    break;
                }
            }

            /**
             * Expects currently iterated element as 'this'
             */
            expandFunc = function () {
                if ($(this).attr('class') === 'tree-expand') {
                    treeComponentInstance.switchSubtree(treeComponentInstance.findSubtree(this.parentElement),
                        $(this).children().get(0));
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
        }

        selResult.each(function () {
            var inputName = $(this).attr('name'),
                menuWidth = 200,
                rootUl,
                button,
                wrapper,
                jqWrapper,
                switchComponentVisibility,
                titleOfSelectedItem,
                treeComponentInstance,
                jqSelectBoxItem = $(this);

            selectParser.hiddenInput = document.createElement('input');
            $(selectParser.hiddenInput).attr({
                'type' : 'hidden',
                'name' : inputName,
                'value' : jqSelectBoxItem.val()
            });

            button = $(document.createElement('button')).attr('type', 'button');
            if (title) {
                titleOfSelectedItem = title;

            } else {
                titleOfSelectedItem = getTitleOfSelectedItem(this);
            }
            $(button)
                .empty()
                .append(titleOfSelectedItem);
            $(button).bind('click', function (event) {
                switchComponentVisibility(rootUl);
                event.stopPropagation();
            });
            $(document).bind('click', function (event) {
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
                    switchComponentVisibility(rootUl, 'hide');
                }
            });
            rootUl = selectParser.parseSelectOptions(this, button, customCallback);

            wrapper = document.createElement('div');
            jqWrapper = $(wrapper);
            jqWrapper.css({
                position : jqSelectBoxItem.css('position'),
                left : jqSelectBoxItem.css('left'),
                top : jqSelectBoxItem.css('top'),
                display : jqSelectBoxItem.css('display'),
                'float' : jqSelectBoxItem.css('float'),
                'font-size' : jqSelectBoxItem.css('fontSize'),
                color : jqSelectBoxItem.css('color')
            });
            jqSelectBoxItem.replaceWith(wrapper);
            $(rootUl).attr('id', jqSelectBoxItem.attr('id'));
            jqWrapper.append(button);
            jqWrapper.append(rootUl);

            /**
             *
             * @param elm element to be switched
             * @param state one of {"show", "hide"}; if not provided then any state is changed to the other one
             */
            switchComponentVisibility = function (elm, state) {
                var leftPos = 0,
                    jqElm = $(elm);

                if (jqElm.css('display') === 'block' || state === 'hide') {
                    jqElm.css({ display : 'none', position: 'relative'});

                } else if (jqElm.css('display') === 'none' || state === 'show') {
                    if (jqWrapper.css('position') !== 'absolute') {
                        leftPos = jqWrapper.position().left;
                    }
                    if (jqWrapper.position().left + menuWidth > $(document).width()) {
                        leftPos = jqWrapper.position().left + Math.min(0, $(document).width()
                            - jqWrapper.position().left - $(rootUl).width());
                    }

                    jqElm.css({
                        display : 'block',
                        position: 'absolute',
                        'z-index' : 1000000,
                        left : leftPos + 'px',
                        border : '1px solid #CCC',
                        'background-color': '#eee',
                        margin : '0',
                        width : menuWidth + 'px',
                        padding: '3px 5px',
                        'moz-border-radius' : '3px',
                        'webkit-border-radius': '3px',
                        'khtml-border-radius': '3px',
                        'border-radius': '3px',
                        'text-align': 'left'
                    });
                }
            };
            switchComponentVisibility(rootUl);
            treeComponentInstance = createTreeComponentInstance();
            treeComponentInstance.init(rootUl);
            $(rootUl.parentNode).prepend(selectParser.hiddenInput);
            expandSelected(treeComponentInstance, $(selectParser.hiddenInput).val(), rootUl);

        });
    }

    return {
        createTreeComponent : createTreeComponent,

        makeListExpandable : function (rootId) {
            createTreeComponentInstance().init(rootId);
        }
    };

});
