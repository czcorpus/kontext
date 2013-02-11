/**
 * This module contains functionality related directly to the document.tmpl template
 */
define(['win', 'jquery', 'hideelem', 'multiselect', 'tagbuilder', 'popupbox', 'jquery.cookies'],
        function (win, $, hideElem, multiselect, tagbuilder, popupbox, cookies) {
   'use strict';

    var lib = {};

    lib.misc = function (conf) {
        var msComponent,
            tagBuilderComponent,
            concFormResetButtonActions,
            widgetMap,
            queryTypesHints;


        hideElem.targetedLinks();
        if (conf.focus) {
            hideElem.focusEx(hideElem.focus);
        }

        $('input.cql-input').each(function () {
            if ($(this).parent().find('li.insert-tag').length > 0) {
                tagbuilder.bindTextInputHelper(
                    conf.corpname,
                    conf.numTagPos,
                    {
                        inputElement : $(this),
                        widgetElement : 'tag-widget',
                        modalWindowElement : 'tag-builder-modal',
                        insertTagButtonElement : 'insert-tag-button',
                        tagDisplayElement : 'tag-display'
                    },
                    {
                        width : '556px',
                        useNamedCheckboxes : false,
                        allowMultipleOpenedBoxes : false,
                        padding : 0,
                        margin : 0
                    }

                );
            }
        });

        hideElem.loadHideElementStoreSimple();
        hideElem.loadHideElementStore('${files_path}');

        $('select.qselector').bind('change', function () {
            hideElem.cmdSwitchQuery(widgetMap, concFormResetButtonActions, queryTypesHints);
        });

        // disable submit button after submiting
        $("form").submit(function() {
            $('input[type=submit]', this).attr('disabled', 'disabled');
        });

        // enable button on unload (tweak for bfcache in FF)
        $(window).unload(function () {
            $('input[type=submit]').removeAttr('disabled');
        });

        // enable disabled buttons again after ESC
        $(win.document).keyup(function(e) {
            if (e.keyCode == 27) {
                $('input[type=submit]').removeAttr('disabled');
            }
        });

        // switch between horiz | vert (implicit) menu, change cookies
        $('.menu_switch a').bind('click', function () {
            if (cookies.get('menupos') === 'top') {
                $('#sidebar').removeClass('horizontal');
                $('#in-sidebar').removeClass('horizontal');
                cookies.del('menupos');
            }
            else {
                $('#sidebar').toggleClass('horizontal');
                $('#in-sidebar').toggleClass('horizontal');
                cookies.set('menupos', 'top');
            }
        });

        // change to horizontal menu if cookie is set to "top"
        if (cookies.get("menupos") === "top") {
            $('#sidebar').addClass('horizontal');
            $('#in-sidebar').addClass('horizontal');
        }

        // remove empty and unused parameters from URL before mainform submit
        $('form').submit(function () { // run before submit
            $('#mainform input[name="sel_aligned"]').each(function () { // iterate over names of aligned corpora
                if ($(this).is(':not(:checked)')) { // for those not checked for querying
                    var corpn = $(this).val(); // get corpus name
                    $('select[name=pcq_pos_neg_' + corpn + ']').attr('disabled', true); // disable -> remove from URL
                    $('select[name=queryselector_' + corpn + ']').attr('disabled', true); // dtto
                    $('#qtable_' + corpn).find('input').attr('disabled', true); // dtto
                }
            });
            // disable all empty inputs
            $('input').each(function () {
                if ($(this).val() == '')
                    $(this).attr('disabled', true);
            });
        });

        // show or hide elements according to cookies
        (function () {
            var key,
                el;
            for (key in jQuery.cookies.get()) { // for all cookies
                el = key.replace('_view', ''); // remove end '_view'
                if ($('#' + el).length != 0) { // element exists
                    if ($.cookies.get(key) == 'show') {
                        $('#' + el).show();
                    }
                    else { $('#' + el).hide(); }
                }
            }
        }());

    };


    lib.bindClicks = function () {
        var msg2;

        msg2 = function (updatedElement) {
            $.ajax({
                url : 'ajax_get_corp_details?corpname=' + conf.corpname,
                success : function (data) {
                    $(updatedElement).empty().append(data);
                },
                error : function () {
                    $(updatedElement).empty().append(conf.messages['failed_to_load_corpus_info']);
                }
            });
        };

        $('#positions-help-link').bind('click', function (event) {
            popupbox.createPopupBox(event, 'positions-help', $('#toolbar-info'), conf.messages['msg1']);
            event.stopPropagation();
        });

        $('#corpus-desc-link').bind('click', function (event) {
            popupbox.createPopupBox(event, 'corpus-details-box', $('#corpus-desc-link'), msg2, {
                'height' : 'auto',
                'width' : 'auto'
            });
            event.stopPropagation();
        });

        $('input[class="select-all"]').bind('click', function (event) {
                hideElem.selectAllCheckBoxes(event.target, $(event.target).data('item-name'));
        });

        $('a#top-level-help-link').bind('click', function (event) {
            hideElem.cmdHelp('https://trac.sketchengine.co.uk/');
            event.stopPropagation();
            return false;
        });

        $('#error button').bind('click', function (event) {
            win.history.back(1);
        });

        $('img.plus-minus').each(function () {
            $(this).bind('click', function (event) {
                hideElem.cmdHideElementStore($(this).data('elementid'), $(this).data('storeval'), $(this).data('path'));
            });
        });
    }

    lib.init = function (conf) {
        lib.misc(conf);
        lib.bindClicks();
    };

    return lib;

});