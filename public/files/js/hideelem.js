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
 *
 */
define(['jquery', 'win', 'jquery.cookie', 'popupbox'], function ($, win, cookies, popupBox) {
    'use strict';

    var hideElem;

    hideElem = {

        /**
         * @param querySelector
         * @param hints
         */
        cmdSwitchQuery : function (querySelector, hints) {
            var jqQs = $(querySelector),
                newidCom,
                newid,
                jqFocusElem,
                oldval,
                elementId,
                elementIdCom,
                jqOldElem,
                jqElem,
                jqQueryTypeHint;

            hints = hints || {};
            newidCom = jqQs.val();
            newid = jqQs.val() + jqQs.data('parallel-corp');
            jqFocusElem = $('#' + newidCom.substring(0, newidCom.length - 3) + jqQs.data('parallel-corp'));
            oldval = jqFocusElem.val();

            $('#conc-form-clear-button').unbind('click');
            $('#conc-form-clear-button').bind('click', function () {
                hideElem.clearForm($('#mainform'));
            });

            jqQs.find('option').each(function () {
                elementId = $(this).val() + jqQs.data('parallel-corp');
                elementIdCom  = $(this).val().substring(0,  $(this).val().length - 3);
                jqElem = $('#' + elementId);

                if (elementId === newid) {
                    jqElem.removeClass('hidden').addClass('visible');

                } else if (jqElem.hasClass('visible')) {
                    jqOldElem = $('#' + elementIdCom + jqQs.data('parallel-corp'));
                    oldval = jqOldElem.val();
                    jqOldElem.val('');
                    jqElem.removeClass('visible').addClass('hidden');
                }
            });
            jqFocusElem.val(oldval);
            if (newid === 'iqueryrow') {
                jqQueryTypeHint = $('<a href="#" class="context-help"><img class="over-img" src="../files/img/question-mark.png" data-alt-img="../files/img/question-mark_s.png" /></a>');
                $('#queryselector').after(jqQueryTypeHint);
                popupBox.bind(jqQueryTypeHint,
                    hints['iqueryrow'],
                    {
                        'top' : 'attached-bottom',
                        'fontSize' : '10pt',
                        width: '30%'
                    });

            } else {
                $('#queryselector').parent().find('.context-help').remove();
            }
            jqFocusElem.focus();
            hideElem.initVirtualKeyboard(jqFocusElem);
        },

        /**
         *
         * @param f
         */
        clearForm : function (f) {
            var prevRowType = $('#queryselector').val();

            if ($('#error').length === 0) {
                $('#error').css('display', 'none');
            }
            $(f).find('input,select').each(function () {
                if ($(this).data('ignore-reset') !== '1') {
                    if ($(this).attr('type') === 'text') {
                        $(this).val('');
                    }
                    if ($(this).attr('name') === 'default_attr') {
                        $(this).val('');
                    }
                    if ($(this).attr('name') === 'lpos' || $(this).attr('name') === 'wpos') {
                        $(this).val('');
                    }
                }
            });
            $('#queryselector').val(prevRowType);
        },

        /**
         * @param {HTMLElement|string|jQuery} input element the VirtualKeyboard binds to
         */
        initVirtualKeyboard: function (elm) {
            var jqElm = $(elm);

            if (jqElm.length > 0) {
                win.VKI_close(jqElm.get(0));
                win.VKI_attach(jqElm.get(0), jqElm.closest('tr').find('.virtual-keyboard-trigger').get());
            }
        }
    };

    return hideElem;
});