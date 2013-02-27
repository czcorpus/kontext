/**
 * This module contains functionality related directly to the document.tmpl template
 */
define(['win', 'jquery', 'hideelem', 'tagbuilder', 'popupbox', 'jquery.cookies', 'bonito',
        'simplemodal'], function (win, $, hideElem, tagbuilder, popupbox, cookies, bonito, simpleModalNone) {
    'use strict';

    var lib = {};

    /**
     *
     * @param {Event} event
     */
    lib.updForm = function (event) {
        var jqActiveElm = $(event.target);

        $('input[name="reload"]').val('1');
        if (jqActiveElm.closest('form').attr('usesubcorp')) {
            jqActiveElm.closest('form').attr('usesubcorp', '');
        }
        jqActiveElm.closest('form').submit();
    };

    /**
     *
     * @param {object} conf
     */
    lib.misc = function (conf) {
        hideElem.targetedLinks();
        if (conf.focus) {
            hideElem.focusEx(hideElem.focus);
        }

        $('.cql-toolbox').each(function () {
            var corpName,
                cqlInputId = $(this).closest('td').find("input.cql-input").attr('id');

            if (cqlInputId === 'cql') {
                corpName = conf.corpname;

            } else {
                corpName = cqlInputId.substring(4);
            }
            tagbuilder.bindTextInputHelper(
                corpName,
                conf.numTagPos,
                {
                    inputElement : $('#' + $($(this).find('li.insert-tag a').get(0)).data('bound-input')),
                    widgetElement : 'tag-widget',
                    modalWindowElement : 'tag-builder-modal',
                    insertTagButtonElement : 'insert-tag-button',
                    tagDisplayElement : 'tag-display',
                    resetButtonElement : 'reset-tag-button'
                },
                {
                    width : '556px',
                    useNamedCheckboxes : false,
                    allowMultipleOpenedBoxes : false,
                    padding : 0,
                    margin : 0
                }
            );

            lib.bindWithinHelper($(this).find('li.within a'), conf.corpname);
        });

        hideElem.loadHideElementStoreSimple();
        hideElem.loadHideElementStore('${files_path}');

        $('select.qselector').bind('change', function (event) {
            hideElem.cmdSwitchQuery(event.target, conf.queryTypesHints);
        });

        // switch between horiz | vert (implicit) menu, change cookies
        $('.menu_switch a').bind('click', function () {
            if (cookies.get('menupos') === 'top') {
                $('#sidebar').removeClass('horizontal');
                $('#in-sidebar').removeClass('horizontal');
                cookies.del('menupos');

            } else {
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
            $('#mainform input[name="sel_aligned"]').each(function () {
                var corpn;

                if ($(this).is(':not(:checked)')) {
                    corpn = $(this).val();
                    $('select[name=pcq_pos_neg_' + corpn + ']').attr('disabled', true); // disable -> remove from URL
                    $('select[name=queryselector_' + corpn + ']').attr('disabled', true); // dtto
                    $('#qtable_' + corpn).find('input').attr('disabled', true); // dtto
                }
            });
        });

        // show or hide elements according to cookies
        (function () {
            var key,
                el;
            for (key in cookies.get()) { // for all cookies
                if (cookies.get().hasOwnProperty(key)) {
                    el = key.replace('_view', ''); // remove end '_view'
                    if ($('#' + el).length !== 0) { // element exists
                        if ($.cookies.get(key) === 'show') {
                            $('#' + el).show();
                        } else {
                            $('#' + el).hide();
                        }
                    }
                }
            }
        }());

    };

    /**
     *
     * @param {object} conf
     */
    lib.bindClicks = function (conf) {
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

        $('#error a.close-icon').bind('click', function (event) {
            $('#error').remove();
        });

        $('#notification a.close-icon').bind('click', function (event) {
            $('#notification').remove();
        });

        $('img.plus-minus').each(function () {
            $(this).bind('click', function (event) {
                hideElem.cmdHideElementStore($(this).data('elementid'), $(this).data('storeval'), $(this).data('path'));
            });
        });

        $('#switch-language-box a').each(function () {
            $(this).bind('click', function () {
                var expirationDate = new Date();
                expirationDate.setTime(expirationDate.getTime() + 3600 * 1000 * 24 * 365);
                cookies.set('uilang', $(this).data('lang'), {
                    expiresAt: expirationDate
                });
                win.location.reload();
            });
        });
    };

    /**
     *
     * @param {jQuery} jqLinkElement
     * @param {string} corpusName
     */
    lib.bindWithinHelper = function (jqLinkElement, corpusName) {
        var jqInputElement = $('#' + jqLinkElement.data('bound-input'));
        jqLinkElement.bind('click', function (event) {
            var caretPos = bonito.getCaretPosition(jqInputElement),
                clickAction,
                buttonEnterAction;

            clickAction = function (event) {
                var structattr,
                    wthn,
                    bef,
                    aft;

                structattr = $('#within-structattr').val().split('.');
                wthn = 'within <' + structattr[0] + ' ' + structattr[1] + '="' + $('#within-value').val() + '" />';
                bef = jqInputElement.val().substring(0, caretPos);
                aft = jqInputElement.val().substring(caretPos);

                jqInputElement.val(bef + wthn + aft);
                jqInputElement.focus();
                $.modal.close();
                $(document).off('keypress', buttonEnterAction);
            };

            buttonEnterAction = function (event) {
                if (event.which === 13) {
                    clickAction(event);
                }
            };

            $('#within-builder-modal').modal({
                onShow : function () {
                    $.get('ajax_get_structs_details?corpname=' + corpusName, {}, function (data) {
                        var prop,
                            html,
                            i;

                        html = '<select id="within-structattr">';
                        for (prop in data) {
                            if (data.hasOwnProperty(prop)) {
                                for (i = 0; i < data[prop].length; i += 1) {
                                    html += '<option>' + prop + '.' + data[prop][i] + '</option>';
                                }
                            }
                        }
                        html += '</select>';
                        $('#within-builder-modal .selection-container').append(html);
                        $('#within-insert-button').one('click', clickAction);
                        $(document).on('keypress', buttonEnterAction);
                    });
                }
            });
            event.stopPropagation();
            return false;
        });
    };

    /**
     *
     * @param {object} conf
     */
    lib.init = function (conf) {
        lib.misc(conf);
        lib.bindClicks(conf);
    };

    return lib;

});