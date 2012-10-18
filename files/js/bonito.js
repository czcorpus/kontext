(function (context) {
    'use strict';


    var mlkfu,
        createPopupBox,
        createTagLoader;

    context.bonitoBoxes = context.bonitoBoxes || {};

    mlkfu = {

        /**
         *
         * @param element a Prototype Element object
         * @return {String}
         */
        getColumnId : function (element) {
            return element.readAttribute('id').substr(element.readAttribute('id').length - 1, 1);
        },

        /**
         * Initializes "KWIC alignment" select-box event handlers and sets form values according to the state
         * of these select-boxes.
         */
        init : function () {
            $('kwic-alignment-box').setStyle({ display : 'table-row' });
            $$('select.kwic-alignment').each(function (item) {
                mlkfu.switchAlignment(item.value, mlkfu.getColumnId(item));
            });
            $$('select.kwic-alignment').each(function (item) {
                item.observe('change', function (event) {
                    mlkfu.switchAlignment(event.target.value, mlkfu.getColumnId(item));
                });
            });
        },

        /**
         *
         * @param state one of {left, right}
         * @param columnIdx column to update (indexing from 1 to 3)
         */
        switchAlignment : function (state, columnIdx) {
            var srch, repl, select;

            if (state === 'left') {
                srch = '>';
                repl = '<';

            } else {
                srch = '<';
                repl = '>';
            }
            select = $$("select[name='ml" + columnIdx + "ctx']");
            if (select.length === 1) {
                select[0].childElements().each(function (item) {
                    if (item.value === '0~0>0') {
                        // This resets the default behaviour which just displays all the KWIC words.
                        // It should be executed only when the page is loaded.
                        item.value = '0<0';

                    } else {
                        item.value = item.value.replace(srch, repl);
                    }
                });
            }
        }
    };

    createPopupBox = function (event, boxId, whereElement, contents, options) {
        var popupBox;

        if (context.bonitoBoxes[boxId]) {
            context.bonitoBoxes[boxId].close();
            return;
        }

        popupBox = {

            timer : null,

            newElem : null,

            timeout : 25000,

            extractIntFromSize : function (size) {
                var ans = /([0-9]+)[a-z]*/.exec(size);
                if (ans !== null) {
                    return parseInt(ans[1], 10);
                }
                return null;
            },

            close : function (event) {
                if (popupBox.newElem) {
                    popupBox.newElem.remove();
                    popupBox.newElem = null;
                    if (popupBox.timer) {
                        clearInterval(popupBox.timer);
                    }
                    event.element().stopObserving('click', popupBox.close);
                    document.stopObserving('click', popupBox.close);
                }
                delete context.bonitoBoxes[boxId];
            },

            open : function (event, boxId, whereElement, contents, options) {
                var pageWidth = document.viewport.getDimensions().width,
                    horizPadding = 8,
                    totalBoxWidth = 638,
                    boxWidth = '620px',
                    borderWidth = 1,
                    boxHeight = '70px',
                    boxIntWidth,
                    boxIntHeight,
                    boxTop = 0;

                if (options !== undefined) {
                    if (options.hasOwnProperty('height')) {
                        boxHeight = options.height;
                    }
                    boxIntHeight = popupBox.extractIntFromSize(boxHeight);

                    if (options.hasOwnProperty('width')) {
                        boxWidth = options.width;
                    }
                    boxIntWidth = popupBox.extractIntFromSize(boxWidth);

                    if (options.hasOwnProperty('top')) {
                        if (options.top === 'attached-top') {
                            boxTop = event.element().cumulativeOffset()[1] + 'px';

                        } else if (options.top === 'attached-bottom') {
                            boxTop = (event.element().cumulativeOffset()[1] - boxIntHeight - 30) + 'px';

                        } else {
                            boxTop = options.top;
                        }
                    }

                } else {
                    boxIntHeight = popupBox.extractIntFromSize(boxHeight);
                    boxIntWidth = popupBox.extractIntFromSize(boxWidth);
                }

                popupBox.newElem = Element.extend(document.createElement('div'));
                popupBox.newElem.writeAttribute('id', boxId);
                if (typeof (contents) === 'function') {
                    contents(popupBox.newElem);

                } else {
                    popupBox.newElem.update(contents);
                }
                popupBox.newElem.setStyle({
                    padding : '5px ' + horizPadding + 'px',
                    position : 'absolute',
                    top : boxTop,
                    border : borderWidth + 'px solid #DDD',
                    color : '#333',
                    backgroundColor : '#FFF',
                    width : boxWidth,
                    height: boxHeight,
                    boxShadow: '2px 2px 1px #444'
                });
                if (pageWidth - boxIntWidth > event.element().cumulativeOffset()[0]) {
                    popupBox.newElem.setStyle({
                        left : event.element().cumulativeOffset()[0] + 'px'
                    });
                } else {
                    popupBox.newElem.setStyle({
                        left : '100%',
                        marginLeft : '-' + (boxIntWidth + 2 * horizPadding + 2 * borderWidth) + 'px'
                    });
                }
                document.viewport.getDimensions();
                if (typeof whereElement === 'string') {
                    whereElement = $(whereElement);
                }
                whereElement.insert({ after : popupBox.newElem });
                Event.observe(document, 'click', popupBox.close);
                popupBox.timer = setInterval(popupBox.close, popupBox.timeout);
            }
        };
        context.bonitoBoxes[boxId] = popupBox;
        popupBox.open(event, boxId, whereElement, contents, options);
        return popupBox;
    };

    context.multiLevelKwicFormUtil = mlkfu;
    context.createPopupBox = createPopupBox;

    createTagLoader = function (corpusName) {
        var tagLoader = {

            corpusName : '',

            lastPattern : '',

            /**
             *
             */
            encodeFormStatus : function (elmList) {
                var i,
                    ans = '';

                for (i = 0; i < elmList.length; i += 1) {
                    ans += elmList[i].getValue() || '-';
                }
                return ans;
            },

            /**
             *
             */
            getNumberOfSelectedItems : function (elmList) {
                var i,
                    ans = 0;

                for (i = 0; i < elmList.length; i += 1) {
                    if (elmList[i].getValue() && elmList[i].getValue() !== '-') {
                        ans += 1;
                    }
                }
                return ans;
            },


            /**
             *
             * @param elmList
             * @param activeNode
             * @param data
             */
            updateFormValues : function (elmList, activeNode, data) {
                var i,
                    j,
                    currValue,
                    newOption;

                for (i = 0; i < elmList.length; i += 1) {
                    if (activeNode.parentNode !== elmList[i]) {
                        currValue = elmList[i].getValue();
                        elmList[i].update('<option value="-">-</option>');
                        for (j = 0; j < data[i].length; j += 1) {
                            newOption = Element.extend(document.createElement('option'));
                            newOption.writeAttribute('value', data[i][j][0]);
                            newOption.insert(data[i][j][1]);
                            elmList[i].insert(newOption);

                            if (currValue === data[i][j]) {
                                elmList[i].selectedIndex = j + 1;
                            }
                        }

                    } else {
                        activeNode.writeAttribute('selected', 'selected');
                    }
                }
            },

            /**
             *
             */
            updateFormValue : function (element, data) {
                var i;
                element.update('<option>-</option>');
                for (i = 0; i < data.length; i += 1) {
                    element.insert('<option value="' + data[i][0] + '">' + data[i][1] + '</option>');
                }
            },

            /**
             *
             * @param position
             * @param callback
             */
            loadSinglePositionVariants : function (position, callback) {
                var url = 'ajax_get_tag_variants?corpname=' + tagLoader.corpusName + '&position=' + position,
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
        return tagLoader;
    };

    context.createTagLoader = createTagLoader;


}(window));