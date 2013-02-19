/**
 * This module contains functionality related directly to the first_form.tmpl template
 */
define(['jquery', 'treecomponent', 'bonito', 'tpl/document' ,'jquery.cookies', 'hideelem'],
            function ($, treeComponent, bonito, mainPage, cookies, hideElem) {
    var lib = {};

    lib.misc = function (conf) {

        // let's override the focus
        conf.focus = function () {
            var target = null;
            $('#mainform tr input[type="text"]').each(function () {
                if ($(this).css('display') !== 'none') {
                    target = $(this);
                    return false;
                }
            });
            return target;
        };

        // init 'parent page scripts'
        mainPage.init(conf);

        treeComponent.createTreeComponent($('form[action="first"] select[name="corpname"]'), null, mainPage.updForm);

        // initial query selector setting (just like when user changes it manually)
        hideElem.cmdSwitchQuery($('#queryselector').get(0), conf.queryTypesHints);
    };

    lib.bindClicks = function (conf) {
        $('ul.submenu a.toggle-submenu-item').each(function () {
            $(this).bind('click', function () {
                bonito.toggleViewStore($(this).data('id-to-set'));
            });
        });

        $('#switch_err_stand').bind('click', function () {
            if ($(this).text() == conf.labelStdQuery) {
            $('#qnode').show();
                  $('#cup_err_menu').hide();
                  $(this).text(conf.labelErrorQuery);
                  cookies.set("errstdq", "std");

            } else {
                $('#qnode').hide();
                $('#cup_err_menu').show();
                $(this).text(conf.labelStdQuery);
                cookies.set("errstdq", "err");
            }
        });

    };

    lib.init = function (conf) {
        lib.misc(conf);
        lib.bindClicks(conf);
    };


    return lib;
});