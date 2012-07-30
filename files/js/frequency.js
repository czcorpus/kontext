(function (context) {

    var freqFormTools = {

        /**
         *
         * @param element a Prototype Element object
         * @return {String}
         */
        getColumnId : function (element) {
            return element.readAttribute('name').substr(element.readAttribute('name').length - 1, 1);
        },

        /**
         * Initializes "KWIC alignment" select-box event handlers and sets form values according to the state
         * of these select-boxes.
         */
        init : function () {
            $('kwic-alignment-box').setStyle({ display : 'table-row' });
            $$('select.kwic-alignment').each(function (item) {
                freqFormTools.switchAlignment(item.value, freqFormTools.getColumnId(item));
            });

            $$('select.kwic-alignment').each( function (item) {
                item.observe('change', function (event) {
                    freqFormTools.switchAlignment(event.target.value, freqFormTools.getColumnId(item));
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
    }

    context.freqFormTools = freqFormTools;

}(window));