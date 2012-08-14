(function (context) {
    'use strict';

    var createTreeComponent = function (rootUlId, replaceId) {
        console.log('id: ' + replaceId);
        var treeComponent = {

            subtreeMap : {},

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
                console.log('foo: ' + expSymbolId);
                console.log('srch: ' + document.getElementById(expSymbolId));
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
        treeComponent.init(rootUlId);
        if (replaceId !== undefined) {
            Element.replace($(replaceId), $(rootUlId));
        }
        return treeComponent;
    };


    context.createTreeComponent = createTreeComponent;

}(window));