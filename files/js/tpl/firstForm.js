/**
 * This module contains functionality related directly to the first_form.tmpl template
 */
define(['jquery', 'treecomponent', 'bonito', 'tpl/document' ,'jquery.cookies'],
            function ($, treeComponent, bonito, mainPage, cookies) {
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

        var updForm = function (item) {
            var formAncestor,
                i,
                srch,
                ancestors = $(item.target).parents();

            for (i = 0; i < ancestors.length; i += 1) {
                if (ancestors[i].nodeName === 'FORM') {
                    formAncestor = ancestors[i];
                    break;
                }
            }
            if (formAncestor !== undefined) {
                srch = $(formAncestor).find('*[name="reload"]');
                if (srch.length > 0) {
                $(srch[0]).attr('value', '1');
                }
                srch = $(formAncestor).find('*[name="usesubcorp"]');
                if (srch.length > 0) {
                    $(srch[0]).attr('value', '');
                }
                formAncestor.submit();
            }
        }
        treeComponent.createTreeComponent($('form[action="first"] select[name="corpname"]'), null, updForm);
    };

    lib.bindClicks = function (conf) {
        $('ul.submenu a.toggle-submenu-item').each(function () {
            $(this).bind('click', function () {
                bonito.toggleViewStore($(this).attr('data-id-to-set'));
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