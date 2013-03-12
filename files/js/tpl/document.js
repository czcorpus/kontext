/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 * Copyright (c) 2003-2009  Pavel Rychly
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

/**
 * This module contains functionality related directly to the document.tmpl template
 *
 */
define(['win', 'jquery', 'hideelem', 'tagbuilder', 'popupbox', 'jquery.cookies', 'bonito',
        'simplemodal'], function (win, $, hideElem, tagbuilder, popupbox, cookies, bonito, simpleModalNone) {
    'use strict';

    var lib = {};

    /**
     * Tests whether the host environment is Internet Explorer "version (or less)"
     */
    lib.isInternetExplorerUpTo = function (version) {
        return $.browser.msie && parseInt($.browser.version, 10) <= version;
    };

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

        $('select.qselector').bind('change', function (event) {
            hideElem.cmdSwitchQuery(event.target, conf.queryTypesHints, lib.userSettings);
        });
        $('.menu_switch a').on('click', function () {
            console.log(lib.userSettings.get('menupos'));
            if (lib.userSettings.get('menupos') === 'top') {
                $('#sidebar').removeClass('horizontal');
                $('#in-sidebar').removeClass('horizontal');
                lib.userSettings.del('menupos');

            } else {
                $('#sidebar').toggleClass('horizontal');
                $('#in-sidebar').toggleClass('horizontal');
                lib.userSettings.set('menupos', 'top');
            }
        });

        // change to horizontal menu if setting is set to "top"
        if (lib.userSettings.get("menupos") === "top") {
            $('#sidebar').addClass('horizontal');
            $('#in-sidebar').addClass('horizontal');
        }

        // remove empty and unused parameters from URL before mainform submit
        $('form').submit(function () { // run before submit
            $('#mainform input[name="sel_aligned"]').each(function () {
                var corpn = $(this).data('corpus'),
                    queryType;

                if (!$(this).val()) {
                    $('select[name=pcq_pos_neg_' + corpn + ']').attr('disabled', true);
                    $('select[name=queryselector_' + corpn + ']').attr('disabled', true);
                    $('#qnode_' + corpn).find('input').attr('disabled', true);
                    $(this).attr('disabled', true);

                    $(this).parent().find('input[type="text"]').each(function () {
                        $(this).attr('disabled', true);
                    });

                } else {
                    queryType = $(this).parent().find('#queryselector_' + corpn).val();
                    queryType = queryType.substring(0, queryType.length - 3);
                    $('#qnode_' + corpn).find('input[type="text"]').each(function () {
                        if ($(this).attr('class') !== queryType + '-input') {
                            $(this).attr('disabled', true);
                        }
                    });
                }
            });
        });

        // show or hide elements according to settings cookies

        $.each(lib.userSettings.data, function (property, value) {
            var el = property.replace('_view', ''); // remove end '_view'
            if ($('#' + el).length !== 0) { // element exists
                if (lib.userSettings.get(value) === 'show') {
                    $('#' + el).show();

                } else {
                    $('#' + el).hide();
                }
            }
        });
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
                hideElem.cmdHideElementStore($(this).data('elementid'), $(this).data('storeval'), $(this).data('path'),
                        lib.userSettings);
            });
        });

        $('#switch-language-box a').each(function () {
            $(this).bind('click', function () {
                lib.userSettings.set('uilang', $(this).data('lang'));
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

        lib.userSettings = {
            data : cookies.get('user_settings'),

            cookieParams : {
                path: conf.rootPath
            },

            get : function (key) {
                return lib.userSettings.data[key];
            },

            set : function (key, value) {
                lib.userSettings.data[key] = value;
                $.cookies.set('user_settings', lib.userSettings.data, lib.userSettings.cookieParams);
            },

            del : function (key) {
                delete(lib.userSettings.data[key]);
                $.cookies.set('user_settings', lib.userSettings.data, lib.userSettings.cookieParams);
            }
        };

        lib.misc(conf);
        lib.bindClicks(conf);
    };

    return lib;

});