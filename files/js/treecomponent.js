// Copyright (c) 2012 Institute of the Czech National Corpus

// This library depends on Prototype.js version 1.7+.

(function (context) {
    'use strict';

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
                    children = elm.childElements();
                for (i = 0; i < children.length; i += 1) {
                    if (children[i].tagName === 'UL') {
                        return children[i];
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
                var style = ulElement.getStyle('display');
                if (style === 'block') {
                    ulElement.setStyle({ display : 'none' });
                    expSymbolWrapper.update('&#9654;&nbsp;');

                } else {
                    ulElement.setStyle({ display : 'block' });
                    expSymbolWrapper.update('&#9660;&nbsp;');
                }
            },

            /**
             * Modifies any UL tree into the shrinked, expandable version.
             *
             * @param rootUl root UL element. It could be either a prototype.js element or an ID
             */
            init : function (rootUl) {
                if (typeof (rootUl) === 'string') { // assuming rootUl is ID
                    rootUl = $(rootUl);
                }
                rootUl.setStyle({
                    listStyleType : 'none'
                });
                rootUl.select('ul').each(function (item) {
                    item.setStyle({
                        listStyleType : 'none'
                    });
                });
                rootUl.select('li').each(function (item) {
                    var subtree = treeComponent.findSubtree(item),
                        newSpan,
                        newLink;

                    if (subtree !== null) {
                        newLink = Element.extend(document.createElement('a'));
                        newLink.writeAttribute('class', 'tree-expand');
                        newLink.writeAttribute('href', '#');
                        newSpan = Element.extend(document.createElement('span'));
                        newSpan.update('&#9654;&nbsp;');
                        newLink.insert(newSpan);
                        item.insert({ top : newLink });
                        newLink.setStyle({
                            textDecoration : 'none'
                        });
                        newLink.observe('click', function (event) {
                            if (subtree !== null) {
                                treeComponent.switchSubtree(subtree, newSpan);
                            }
                            event.stop();
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
     * information stored in their 'class' attributes. These values are then transformed into an
     * UL+LI tree.
     *
     * @return selectParser object
     */
    function createSelectParserInstance() {
        var selectParser = {

            hiddenInput : null,

            findUlPath : function (items, rootElm, button, customCallback) {
                var srch = items.shift(),
                    foundElm,
                    newLi,
                    newUl,
                    newLink;

                rootElm.childElements().each(function (item) {
                    if (item.readAttribute('class') === srch) {
                        foundElm = item;
                        return;
                    }
                });
                if (foundElm === undefined) {
                    newLi = Element.extend(document.createElement('li'));
                    newLi.writeAttribute('class', srch);
                    rootElm.insert(newLi);

                    if (items.length > 0) {
                        newUl = Element.extend(document.createElement('ul'));
                        newLi.insert(srch);
                        newLi.insert(newUl);
                        selectParser.findUlPath(items, newUl, button, customCallback);

                    } else {
                        newLink = Element.extend(document.createElement('a'));
                        newLink.writeAttribute('href', '#');
                        newLink.insert(srch);
                        newLink.observe('click', function (event) {
                            selectParser.hiddenInput.setValue(srch);
                            button.update(srch);
                            button.click();
                            if (customCallback !== undefined) {
                                customCallback(event);
                            }
                            event.stop();
                        });
                        newLi.insert(newLink);
                    }

                } else {
                    selectParser.findUlPath(items, foundElm.firstDescendant(), button, customCallback);
                }
            },

            parseSelectOptions : function (selectBoxId, button, customCallback) {
                var splitPath,
                    rootUl = Element.extend(document.createElement('ul'));
                $(selectBoxId).childElements().each(function (item) {
                    var path = item.readAttribute('class');
                    if (path.indexOf('/') === 0) {
                        path = path.substring(1);
                    }
                    if (path.substr(path.length - 1, 1) !== '/') {
                        path += '/';
                    }
                    path += item.readAttribute('value');
                    splitPath = path.split('/');
                    selectParser.findUlPath(splitPath, rootUl, button, customCallback);
                });
                rootUl.writeAttribute('class', 'tree-component');
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

        selResult.each(function (selectBoxItem) {
            var inputName = selectBoxItem.readAttribute('name'),
                menuWidth = 200,
                rootUl,
                button,
                wrapper,
                switchComponentVisibility,
                selectBoxCurrValue;

            selectParser.hiddenInput = Element.extend(document.createElement('input'));
            selectParser.hiddenInput.writeAttribute('type', 'hidden');
            selectParser.hiddenInput.writeAttribute('name', inputName);
            selectParser.hiddenInput.writeAttribute('value', selectBoxItem.getValue());

            button = Element.extend(document.createElement('button'));
            if (title) {
                selectBoxCurrValue = title;

            } else if (selectBoxItem.getValue()) {
                selectBoxCurrValue = selectBoxItem.getValue();

            } else {
                selectBoxCurrValue =  selectBoxItem.firstDescendant().readAttribute('value');
            }
            button.update(selectBoxCurrValue);
            button.writeAttribute('type', 'button');
            button.observe('click', function (event) {
                switchComponentVisibility(rootUl);
                event.stop();
            });
            Event.observe(document, 'click', function (event) {
                var i,
                    isWithinTreeComponent = false,
                    ancestors = event.target.ancestors();

                for (i = 0; i < ancestors.length; i += 1) {
                    if (ancestors[i].readAttribute('class') === 'tree-component') {
                        isWithinTreeComponent = true;
                        break;
                    }
                }
                if (!isWithinTreeComponent) {
                    switchComponentVisibility(rootUl, 'hide');
                }
            });

            rootUl = selectParser.parseSelectOptions(selectBoxItem, button, customCallback);

            wrapper = Element.extend(document.createElement('div'));
            wrapper.setStyle({
                position : selectBoxItem.getStyle('position'),
                left : selectBoxItem.getStyle('left'),
                top : selectBoxItem.getStyle('top'),
                display : selectBoxItem.getStyle('display'),
                'float' : selectBoxItem.getStyle('float'),
                fontSize : selectBoxItem.getStyle('fontSize'),
                color : selectBoxItem.getStyle('color'),
                width : selectBoxItem.getStyle('width')
            });
            Element.replace(selectBoxItem, wrapper);
            rootUl.writeAttribute('id', selectBoxItem.readAttribute('id'));
            wrapper.insert(button);
            wrapper.insert(rootUl);

            /**
             *
             * @param elm element to be switched
             * @param state one of {"show", "hide"}; if not provided then any state is changed to the other one
             */
            switchComponentVisibility = function (elm, state) {
                var leftPos = 0;

                if (elm.getStyle('display') === 'block' || state === 'hide') {
                    elm.setStyle({ display : 'none', position: 'relative'});

                } else if (elm.getStyle('display') === 'none' || state === 'show') {
                    if (wrapper.getStyle('position') !== 'absolute') {
                        leftPos = wrapper.cumulativeOffset()[0];
                    }
                    if (wrapper.cumulativeOffset()[0] + menuWidth > document.viewport.getDimensions().width) {
                        leftPos = 2 * document.viewport.getDimensions().width - wrapper.cumulativeOffset()[0] - menuWidth;
                    }
                    elm.setStyle({
                        display : 'block',
                        position: 'absolute',
                        left : leftPos + 'px',
                        border : '1px solid #CCC',
                        backgroundColor: '#eee',
                        margin : '0',
                        width : menuWidth + 'px',
                        padding: '3px 5px',
                        mozBorderRadius : '3px',
                        webkitBorderRadius: '3px',
                        khtmlborderRadius: '3px',
                        borderRadius: '3px',
                        textAlign: 'left'
                    });
                }
            };
            switchComponentVisibility(rootUl);
            createTreeComponentInstance().init(rootUl);
            rootUl.parentNode.insert({ before : selectParser.hiddenInput });

        });
    }

    context.createTreeComponent = createTreeComponent;
    context.makeListExpandable = function (rootId) {
        createTreeComponentInstance().init(rootId);
    };

}(window));
