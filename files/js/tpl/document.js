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
        'simplemodal'], function (win, $, hideElem, tagbuilder, popupbox, cookies, bonito, _sm) {
    'use strict';

    var toggleSelectAllLabel,
        lib = {};

    /**
     *
     */
    toggleSelectAllLabel = function (buttonElm) {
        var tmpLabel = $(buttonElm).attr('value'),
            currValue = $(buttonElm).data('status');

        $(buttonElm).attr('value', $(buttonElm).data('alt-label'));
        $(buttonElm).data('alt-label', tmpLabel);
        if (currValue === 1) {
            $(buttonElm).data('status', 2);

        } else {
            $(buttonElm).data('status', 1);
        }
    };

    /**
     * Displays 'standard' error message box
     *
     * @param {string} message a message to be displayed
     */
    lib.showErrorMessage = function (message) {
        var html = '<div id="error"><div class="frame">'
            + '<img class="icon" alt="Error" src="../files/img/error-icon.png">'
            + '<span>' + message + '</span><a class="close-icon"><img src="../files/img/close-icon.png" /></a>'
            + '</div></div>';

        $('#content #error').remove();
        $('#content').prepend(html);
        $('#error a.close-icon').bind('click', function (event) {
            $('#error').remove();
        });
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
     * @param jqParents where to search for input checkboxes
     */
    lib.autoUpdateSelectAll = function (jqParents) {
        jqParents.each(function () {
            var button = $(this).find('input[type="button"]'),
                parent = this;
            $(this).find('input[type="checkbox"]').on('click', function () {
                var jqCheckboxes = $(parent).find('input[type="checkbox"]'),
                    jqChecked = $(parent).find('input[type="checkbox"]:checked');

                if (jqChecked.length === jqCheckboxes.length) {
                    toggleSelectAllLabel(button);

                } else if (jqChecked.length < jqCheckboxes.length) {
                    if ($(button).data('status') === 2) {
                        toggleSelectAllLabel(button);
                    }
                }
            });
        });
    };

    /**
     * Disables (if state === true) or enables (if state === false)
     * all empty/unused form fields. This is used to reduce number of passed parameters,
     * especially in case of parallel corpora.
     *
     * @param state {boolean}
     */
    lib.setAlignedCorporaFieldsDisabledState = function (state) {
        $('#mainform input[name="sel_aligned"]').each(function () {
            var corpn = $(this).data('corpus'),
                queryType;

            // non empty value of 'sel_aligned' (hidden) input indicates that the respective corpus is active
            if (!$(this).val()) {
                $('select[name=pcq_pos_neg_' + corpn + ']').attr('disabled', state);
                $('select[name=queryselector_' + corpn + ']').attr('disabled', state);
                $('#qnode_' + corpn).find('input').attr('disabled', state);
                $(this).attr('disabled', state);

                $(this).parent().find('input[type="text"]').each(function () {
                    $(this).attr('disabled', state);
                });

            } else {
                queryType = $(this).parent().find('#queryselector_' + corpn).val();
                queryType = queryType.substring(0, queryType.length - 3);
                $('#qnode_' + corpn).find('input[type="text"]').each(function () {
                    if (!$(this).hasClass(queryType + '-input')) {
                        $(this).attr('disabled', state);
                    }
                });
            }
        });
        // now let's disable unused corpora completely
        $('.parallel-corp-lang').each(function () {
            if ($(this).css('display') === 'none') {
                $(this).find('input,select').attr('disabled', state);
            }
        });
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
                },
                function (message) {
                    lib.showErrorMessage(message || conf.messages.failed_to_contact_server);
                }
            );

            lib.bindWithinHelper($(this).find('li.within a'), conf.corpname, conf.messages);
        });

        hideElem.loadHideElementStoreSimple();

        // update checkboxes in subcorp form to make (select all)/(deselect all) updated according to user's selection
        lib.autoUpdateSelectAll($('table.envelope'));

        $('select.qselector').bind('change', function (event) {
            hideElem.cmdSwitchQuery(event.target, conf.queryTypesHints, lib.userSettings);
        });
        $('.menu_switch a').on('click', function () {
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
            lib.setAlignedCorporaFieldsDisabledState(true);
            $(win).on('unload', function () {
                lib.setAlignedCorporaFieldsDisabledState(false);
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
                    $(updatedElement).empty().append(conf.messages.failed_to_load_corpus_info);
                }
            });
        };

        $('#positions-help-link').bind('click', function (event) {
            popupbox.createPopupBox(event, 'positions-help', $('#toolbar-info'), conf.messages.msg1);
            event.stopPropagation();
        });

        // Activates pop-up box with basic corpus information
        $('#corpus-desc-link').bind('click', function (event) {
            popupbox.createPopupBox(event, 'corpus-details-box', $('#corpus-desc-link'), msg2, {
                'height' : 'auto',
                'width' : 'auto'
            });
            event.stopPropagation();
        });

        // 'Select all' buttons for structural attribute lists
        $('input[class="select-all"]').bind('click', function (event) {
            var parent = $(event.target).closest('table.envelope'),
                jqCheckboxes = parent.find('input[type="checkbox"]');

            if ($(event.target).data('status') === 1) {
                jqCheckboxes.prop('checked', true);
                toggleSelectAllLabel(event.target);

            } else if ($(event.target).data('status') === 2) {
                jqCheckboxes.removeProp('checked');
                toggleSelectAllLabel(event.target);
            }
        });

        $('a#top-level-help-link').bind('click', function (event) {
            hideElem.cmdHelp('https://trac.sketchengine.co.uk/');
            event.stopPropagation();
            return false;
        });

        // Removes the 'error box'
        $('#error a.close-icon').bind('click', function (event) {
            $('#error').remove();
        });

        // Removes the 'notification box'
        $('#notification a.close-icon').bind('click', function (event) {
            $('#notification').remove();
        });

        $('img.plus-minus').each(function () {
            $(this).bind('click', function (event) {
                hideElem.cmdHideElementStore($(this).data('elementid'), $(this).data('storeval'), $(this).data('path'),
                        lib.userSettings);
            });
        });

        // Footer's language switch
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
     * @param {object} translatMessages
     */
    lib.bindWithinHelper = function (jqLinkElement, corpusName, translatMessages) {
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
                $(win.document).off('keypress', buttonEnterAction);
            };

            buttonEnterAction = function (event) {
                if (event.which === 13) {
                    clickAction(event);
                }
            };

            $('#within-builder-modal').modal({
                onShow : function () {
                    $.ajax({
                        url : 'ajax_get_structs_details?corpname=' + corpusName,
                        data : {},
                        method : 'get',
                        dataType : 'json',
                        success : function (data) {
                            var prop,
                                html,
                                i;

                            if (data.hasOwnProperty('error')) {
                                $.modal.close();
                                lib.showErrorMessage(data.error);

                            } else {
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
                                $(win.document).on('keypress', buttonEnterAction);
                            }
                        },
                        error : function () {
                            $.modal.close();
                            lib.showErrorMessage(translatMessages.failed_to_contact_server);
                        }
                    });
                },

                onClose : function () {
                    $(win.document).off('keypress', buttonEnterAction);
                    $.modal.close();
                    jqInputElement.focus();
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
                delete (lib.userSettings.data[key]);
                $.cookies.set('user_settings', lib.userSettings.data, lib.userSettings.cookieParams);
            }
        };

        lib.misc(conf);
        lib.bindClicks(conf);
    };

    return lib;

});