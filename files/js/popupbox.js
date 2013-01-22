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

define(['win', 'jquery'], function (context, $) {
    'use strict';

    context.bonitoBoxes = context.bonitoBoxes || {};

    /**
     * Creates simple absolute positioned DIV as a child of whereElement.
     *
     * @param event event which triggered this request
     * @param {string} boxId attribute ID for new box
     * @param {jQuery|string} whereElement element to be used as a parent
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
                    $(event.target).unbind('click', popupBox.close);
                }
                if (popupBox.newElem) {
                    $(popupBox.newElem).remove();
                    popupBox.newElem = null;
                    if (popupBox.timer) {
                        clearInterval(popupBox.timer);
                    }
                    $(document).unbind('click', popupBox.close);
                }
                delete context.bonitoBoxes[boxId];
            },

            open : function (event, boxId, whereElement, contents, options) {
                var pageWidth = $(document).width(),
                    horizPadding = 8,
                    boxWidth = '620px',
                    borderWidth = 1,
                    boxHeight = '70px',
                    boxIntWidth,
                    boxTop = 0,
                    jqWhereElement = $(whereElement),
                    fontSize;

                options = options || {};

                if (options.hasOwnProperty('height')) {
                    boxHeight = options.height;
                }

                if (options.hasOwnProperty('width')) {
                    boxWidth = options.width;
                }

                fontSize = options.hasOwnProperty('fontSize') ? options.fontSize : 'inherit';

                popupBox.newElem = document.createElement('div');
                jqWhereElement.append(popupBox.newElem);
                $(popupBox.newElem).attr('id', boxId);
                if (typeof contents === 'function') {
                    contents(popupBox.newElem);

                } else {
                    $(popupBox.newElem).empty().append(contents);
                }
                $(popupBox.newElem).css({
                    padding : '5px ' + horizPadding + 'px',
                    position : 'absolute',
                    border : borderWidth + 'px solid #DDD',
                    color : '#333',
                    'background-color' : '#FFF',
                    width : boxWidth,
                    height: boxHeight,
                    'box-shadow': '2px 2px 1px #444',
                    'font-size' : fontSize
                });

                if (options.hasOwnProperty('top')) {
                    if (options.top === 'attached-top') {
                        boxTop = $(event.target).position().top + 'px';

                    } else if (options.top === 'attached-bottom') {
                        boxTop = ($(event.target).position().top - $(popupBox.newElem).outerHeight(true) - 2) + 'px';

                    } else {
                        boxTop = options.top;
                    }
                }
                $(popupBox.newElem).css('top', boxTop);

                boxIntWidth = $(popupBox.newElem).outerWidth(true);
                if (pageWidth - boxIntWidth > $(event.target).position().left) {
                    $(popupBox.newElem).css('left', $(event.target).position().left + 'px');

                } else {
                    $(popupBox.newElem).css({
                        left : '100%',
                        'margin-left' : '-' + (boxIntWidth + 2 * horizPadding + 2 * borderWidth) + 'px'
                    });
                }

                $(document).bind('click', popupBox.close);
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