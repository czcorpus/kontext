(function (context) {

    var freqFormTools = {

        init : function () {
            $('kwic-alignment-box').setStyle({
                display : 'block'
            });
            $('kwic-alignment').observe('change', function (event) {
                freqFormTools.switchAlignment(event.target.value);
            });
        },

        switchAlignment : function (state) {
            var i, select, search, replace;

            if (state == 'left') {
                search = '>';
                replace = '<';

            } else if (state == 'right') {
                search = '<';
                replace = '>';
            }
            for (i = 1; i <= 3; i++ ) {
                select = $$("select[name='ml" + i + "ctx']");
                if (select.length == 1) {
                    select[0].childElements().each(function (item) {
                        item.value = item.value.replace(search, replace);
                    });
                }
            }
        }
    }

    context.freqFormTools = freqFormTools;

}(window));