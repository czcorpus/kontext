(function (context) {
    'use strict';

    var treeComponent,
        selectParser,
        createTreeComponent;

    treeComponent = {

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

        switchSubtree : function (ulElement, expSymbolId) {
            var style = ulElement.getStyle('display');
            if (style === 'block') {
                ulElement.setStyle({ display : 'none' });
                $(expSymbolId).update('&#9654;&nbsp;');

            } else {
                ulElement.setStyle({ display : 'block' });
                $(expSymbolId).update('&#9660;&nbsp;');
            }
        },

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
            rootUl.select('li').each(function (item, idx) {
                var subtree = treeComponent.findSubtree(item),
                    expSymbolId,
                    newLink;

                if (subtree !== null) {
                    expSymbolId = 'exp-symbol-' + idx;
                    newLink = Element.extend(document.createElement('a'));
                    newLink.writeAttribute('class', 'tree-expand');
                    newLink.writeAttribute('href', '#');
                    newLink.insert('<span id="' + expSymbolId + '">&#9654;&nbsp;</span>');
                    item.insert({ top : newLink });
                    newLink.setStyle({
                        textDecoration : 'none'
                    });
                    newLink.observe('click', function () {
                        if (subtree !== null) {
                            treeComponent.switchSubtree(subtree, expSymbolId);
                        }
                    });
                    treeComponent.switchSubtree(subtree, expSymbolId);
                }
            });
        }
    };

    selectParser = {

        hiddenInput : null,

        findUlPath : function (items, rootElm, button) {
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
                    selectParser.findUlPath(items, newUl, button);

                } else {
                    newLink = Element.extend(document.createElement('a'));
                    newLink.writeAttribute('href', '#');
                    newLink.insert(srch);
                    newLink.observe('click', function () {
                        selectParser.hiddenInput.setValue(srch);
                        button.update(srch);
                        button.click();
                    });
                    newLi.insert(newLink);
                }

            } else {
                selectParser.findUlPath(items, foundElm.firstDescendant(), button);
            }
        },

        parseSelectOptions : function (selectBoxId, button) {
            var splitPath,
                rootUl = Element.extend(document.createElement('ul'));
            $(selectBoxId).childElements().each(function (item) {
                var path = item.readAttribute('value');
                if (path.indexOf('/') === 0) {
                    path = path.substring(1);
                }
                splitPath = path.split('/');
                selectParser.findUlPath(splitPath, rootUl, button);
            });
            return rootUl;
        }
    };


    createTreeComponent = function (selResult, title, customCallback) {
        selResult.each(function (selectBoxItem) {
            var inputName = selectBoxItem.readAttribute('name'),
                menuWidth = 200,
                rootUl,
                button,
                wrapper,
                switchComponentVisibility,
                firstItemValue;

            selectParser.hiddenInput = Element.extend(document.createElement('input'));
            selectParser.hiddenInput.writeAttribute('type', 'hidden');
            selectParser.hiddenInput.writeAttribute('name', inputName);

            button = Element.extend(document.createElement('button'));
            rootUl = selectParser.parseSelectOptions(selectBoxItem, button);

            wrapper = Element.extend(document.createElement('div'));
            wrapper.setStyle({
                position : selectBoxItem.getStyle('position'),
                left : selectBoxItem.getStyle('left'),
                top : selectBoxItem.getStyle('top'),
                display : selectBoxItem.getStyle('display'),
                float : selectBoxItem.getStyle('float'),
                fontSize : selectBoxItem.getStyle('fontSize'),
                color : selectBoxItem.getStyle('color'),
                width : selectBoxItem.getStyle('width')
            });
            Element.replace(selectBoxItem, wrapper);
            rootUl.writeAttribute('id', selectBoxItem.readAttribute('id'));
            wrapper.insert(button);
            wrapper.insert(rootUl);

            switchComponentVisibility = function (elm) {
                var leftPos = 0;
                if (elm.getStyle('display') === 'block') {
                    elm.setStyle({ display : 'none'});

                } else {
                    if (wrapper.getStyle('position') !== 'absolute') {
                        leftPos = wrapper.cumulativeOffset()[0];
                    }
                    if (wrapper.cumulativeOffset()[0] + menuWidth > document.viewport.getDimensions().width) {
                        leftPos = leftPos - menuWidth;
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
                        borderRadius: '3px'
                    });
                }
            };
            firstItemValue =  selectBoxItem.firstDescendant().readAttribute('value');
            button.insert(title !== undefined ? title : firstItemValue);
            button.observe('click', function (event) {
                switchComponentVisibility(rootUl);
                if (customCallback !== undefined) {
                    customCallback();
                }
                event.stop();
            });
            switchComponentVisibility(rootUl);
            treeComponent.init(rootUl);
            rootUl.getOffsetParent().insert({ before : selectParser.hiddenInput });
        });
    };

    context.createTreeComponent = createTreeComponent;
    context.makeListExpandlable = function (rootId) {
        treeComponent.init(rootId);
    };

}(window));