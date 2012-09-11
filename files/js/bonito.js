(function (context) {

    var mlkfu,
        createPopupBox;

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
            $$('select.kwic-alignment').each( function (item) {
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
            var srch, repl;

            if (state == 'left') {
                srch = '>';
                repl = '<';

            } else {
                srch = '<';
                repl = '>';
            }
            select = $$("select[name='ml" + columnIdx + "ctx']");
            if (select.length == 1) {
                select[0].childElements().each(function (item) {
                    if (item.value == '0~0>0') {
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

    createPopupBox = function (event, boxId, whereElementId, contents, options) {

        if (context.bonitoBoxes[boxId]) {
            context.bonitoBoxes[boxId].close();
            return;
        }

        var popupBox = {

            timer : null,

            newElem : null,

            timeout : 25000,

            extractIntFromSize : function (size) {
                var ans = /([0-9]+)[a-z]*/.exec(size);
                if (ans !== null) {
                    return new Number(ans[1]);
                }
                return null;
            },

            close : function () {
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

            open : function (event, boxId, whereElementId, contents, options) {
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
                if (typeof(contents) === 'function') {
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
                $(whereElementId).insert({ after : popupBox.newElem });

                Event.observe(document, 'click', popupBox.close);

                popupBox.timer = setInterval(popupBox.close, popupBox.timeout);

            }
        }
        context.bonitoBoxes[boxId] = popupBox;
        popupBox.open(event, boxId, whereElementId, contents, options);
        return popupBox;
    };

    context.multiLevelKwicFormUtil = mlkfu;
    context.createPopupBox = createPopupBox;

}(window));