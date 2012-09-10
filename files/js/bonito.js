(function (context) {

    var mlkfu = {

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

    var popupBox = {

        open : function (event, boxId, whereElementId, contents, options) {
            var newElem,
                pageWidth = document.viewport.getDimensions().width,
                horizPadding = 8,
                totalBoxWidth = 638,
                boxWidth = '620px',
                borderWidth = 1,
                boxHeight = '70px';

            if ($(boxId)) {
                $(boxId).remove();

            } else {

                if (options !== undefined) {
                    if (options.hasOwnProperty('height')) {
                        boxHeight = options.height;
                    }
                    if (options.hasOwnProperty('width')) {
                        boxWidth = options.width;
                    }
                }

                newElem = Element.extend(document.createElement('div'));
                newElem.writeAttribute('id', boxId);
                if (typeof(contents) === 'function') {
                    contents(newElem);

                } else {
                    newElem.update(contents);
                }
                newElem.setStyle({
                    padding : '5px ' + horizPadding + 'px',
                    position : 'absolute',
                    top : 0,
                    border : borderWidth + 'px solid #DDD',
                    color : '#333',
                    backgroundColor : '#FFF',
                    width : boxWidth,
                    height: boxHeight
                });
                if (pageWidth - totalBoxWidth > event.element().cumulativeOffset()[0]) {
                    newElem.setStyle({
                        left : event.element().cumulativeOffset()[0] + 'px'
                    });
                } else {
                    newElem.setStyle({
                        left : '100%',
                        marginLeft : '-' + (boxWidth + 2 * horizPadding + 2 * borderWidth) + 'px'
                    });
                }
                document.viewport.getDimensions();
                $(whereElementId).insert({ after : newElem });
            }
        }
    }

    context.multiLevelKwicFormUtil = mlkfu;
    context.popupBox = popupBox;

}(window));