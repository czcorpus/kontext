(function (context) {
    'use strict';

    var treeComponent = {

        findSubtree : function (elm) {
            var i;
            var children = elm.childElements();
            for (i = 0; i < children.length; i += 1) {
                if (children[i].tagName == 'UL') {
                    return children[i];
                }
            }
            return null;
        },

        switchSubtree : function (ulElement, expSymbolId) {
            var style = ulElement.getStyle('display');
            if (style == 'block') {
                ulElement.setStyle({ display : 'none' });
                $(expSymbolId).update('&#9654;&nbsp;');

            } else {
                ulElement.setStyle({ display : 'block' });
                $(expSymbolId).update('&#9660;&nbsp;');
            }
        },

        init : function (rootUlId) {
            $(rootUlId).setStyle({
                listStyleType : 'none'
            });
            $$('#' + rootUlId + ' ul').each(function (item) {
                item.setStyle({
                    listStyleType : 'none'
                });
            });
            $$('#' + rootUlId + ' li').each(function (item, idx) {
                var subtree = treeComponent.findSubtree(item);
                if (subtree !== null) {
                    var expSymbolId = 'exp-symbol-' + idx;
                    var newLink = Element.extend(document.createElement('a'));
                    newLink.writeAttribute('class', 'tree-expand');
                    newLink.writeAttribute('href', '#');
                    newLink.insert('<span id="' + expSymbolId + '">&#9654;&nbsp;</span>');
                    item.insert({ top : newLink });
                    newLink.setStyle({
                        textDecoration : 'none'
                    });
                    newLink.observe('click', function (event) {
                        if (subtree !== null) {
                            treeComponent.switchSubtree(subtree, expSymbolId);
                        }
                    });
                    treeComponent.switchSubtree(subtree, expSymbolId);
                }
            });
        }
    };

    var selectParser = {

        hiddenInput : null,

        findUlPath : function (items, rootElm) {
            var srch = items.shift();
            var foundElm, newLi, newUl, newLink;

            rootElm.childElements().each(function (item) {
                if (item.readAttribute('class') == srch) {
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
                    selectParser.findUlPath(items, newUl);

                } else {
                    newLink = Element.extend(document.createElement('a'));
                    newLink.writeAttribute('href', '#');
                    newLink.insert(srch);
                    newLink.observe('click', function (event) {
                        selectParser.hiddenInput.setValue(srch);
                    });
                    newLi.insert(newLink);
                }

            } else {
                selectParser.findUlPath(items, foundElm.firstDescendant());
            }
        },

        parseSelectOptions : function (selectBoxId) {
            var i, j, splitPath;
            var rootUl = Element.extend(document.createElement('ul'));
            $(selectBoxId).childElements('option').each(function (item) {
                var path = item.readAttribute('value');
                if (path.indexOf('/') === 0) {
                    path = path.substring(1);
                }
                splitPath = path.split('/');
                selectParser.findUlPath(splitPath, rootUl);
            });
            return rootUl;
        }
    };


    var createTreeComponent = function (selectBoxId) {

        var inputName = $(selectBoxId).readAttribute('name');
        var rootUl;
        selectParser.hiddenInput = Element.extend(document.createElement('input'));
        selectParser.hiddenInput.writeAttribute('type', 'hidden');
        selectParser.hiddenInput.writeAttribute('name', inputName);
        rootUl = selectParser.parseSelectOptions(selectBoxId);


        Element.replace($(selectBoxId), rootUl);
        rootUl.writeAttribute('id', selectBoxId);

        treeComponent.init(selectBoxId);
        rootUl.getOffsetParent().insert({ before : selectParser.hiddenInput });
        return treeComponent;
    };


    context.createTreeComponent = createTreeComponent;

    context.makeListExpandlable = function (rootId) {
        treeComponent.init(rootId);
    }

}(window));