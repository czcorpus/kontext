define(['win'], function (context) {
    'use strict';

    context.bonitoBoxes = context.bonitoBoxes || {};

    /**
     * Creates simple absolute positioned DIV as a child of whereElement.
     *
     * @param event event which lead to this request
     * @param boxId attribute ID for new box
     * @param whereElement element to be used as a parent
     * @param contents text/HTML content of the box
     * @param options object with options "width", "height", "top" (just like in CSS but also with additional
     * values "attached-top" and "attached-bottom")
     * @return {*}
     */
    var createPopupBox = function (event, boxId, whereElement, contents, options) {
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
                if (event) {
                    event.element().stopObserving('click', popupBox.close);
                }
                if (popupBox.newElem) {
                    popupBox.newElem.remove();
                    popupBox.newElem = null;
                    if (popupBox.timer) {
                        clearInterval(popupBox.timer);
                    }
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
                whereElement.insert(popupBox.newElem);
                Event.observe(document, 'click', popupBox.close);
                popupBox.timer = setInterval(popupBox.close, popupBox.timeout);
            }
        };
        context.bonitoBoxes[boxId] = popupBox;
        popupBox.open(event, boxId, whereElement, contents, options);
        return popupBox;
    };

    return {
        createPopupBox : createPopupBox
    };
});