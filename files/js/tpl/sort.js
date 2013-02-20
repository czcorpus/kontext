define(['popupbox', 'jquery', 'bonito'], function (popupbox, $, bonito) {

    var lib = {};

    lib.init = function (conf) {
        bonito.multiLevelKwicFormUtil.init();
        $('a.kwic-alignment-help').each(function () {
            $(this).bind('click', function (event) {
                popupbox.createPopupBox(event, 'kwic-alignment-help-box', $('#toolbar-info'), conf.messages['msg'], {
                    'top' : 'attached-bottom',
                    'width' : 'auto',
                    'height' : 'auto'
                });
                event.stopPropagation();
            });
        });
    };

    return lib;
});