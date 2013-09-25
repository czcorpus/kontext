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
define(['jquery', 'win', 'jquery.cookies', 'popupbox'], function ($, win, cookies, popupBox) {
    'use strict';

    var hideElem;

    hideElem = {

        /**
         *
         * @param elementid
         * @param storeval
         * @param path
         * @param {object} userSettings an object providing get/set methods to retrieve/store user configuration
         */
        cmdHideElementStore : function (elementid, storeval, path, userSettings) {
            var elem = $('#' + elementid),
                img = $('#' + elementid + 'img'),
                cookieval = userSettings.get('showhidden');

            if (!cookieval) {
                cookieval = '';
            }
            cookieval = cookieval.replace(new RegExp("\\." + elementid + "\\.", "g"), ".");
            if (elem.className.match("hidden")) {
                elem.className = elem.className.replace("hidden", "visible");
                img.src = path + "/img/minus.png";
                cookieval += elementid + ".";

            } else {
                elem.className = elem.className.replace("visible", "hidden");
                img.src = path + "/img/plus.png";
            }
            if (storeval) {
                userSettings.set('showhidden', cookieval, userSettings);
            }
        },

        /**
         *
         * @param path
         * @param {object} userSettings an object providing get/set methods to retrieve/store user settings
         * @todo this is untested
         */
        loadHideElementStore : function (path, userSettings) {
            var cookie = {},
                ids = userSettings.get('showhidden') || '',
                i,
                id,
                elem,
                img,
                onclick,
                all_elements;

            ids = ids.split('.');
            for (i = 0; i < ids.length; i += 1) {
                cookie[ids[i]] = 1;
            }
            all_elements = document.getElementsByTagName("img");
            for (i = 0; i < all_elements.length; i += 1) {
                onclick = all_elements[i].onclick;
                if ((typeof onclick === 'function') &&
                        (onclick.toString().match('cmdHideElementStore\\('))) {
                    id = onclick.toString().replace('"', "'").replace('"', "'").split("'")[1];
                    elem = document.getElementById(id);
                    img = document.getElementById(id + 'img');
                    if (elem) {
                        if (cookie[id] === 1) {
                            elem.className = elem.className.replace("hidden", "visible");
                            img.src = path + "/img/minus.png";

                        } else {
                            elem.className = elem.className.replace("visible", "hidden");
                            img.src = path + "/img/plus.png";
                        }
                    }
                }
            }
        },

        /**
         *
         */
        loadHideElementStoreSimple : function () {
            var cookie = {},
                i,
                all_elements,
                onclick,
                id,
                elem;

            all_elements = document.getElementsByTagName("a");
            for (i = 0; i < all_elements.length; i += 1) {
                onclick = all_elements[i].onclick;
                if ((typeof onclick === 'function') &&
                        (onclick.toString().match('cmdHideElementStoreSimple'))) {
                    id = onclick.toString().replace('"', "'").replace('"', "'").split("'")[1];
                    elem = document.getElementById(id);
                    if (elem) {
                        if (cookie[id] === 1) {
                            elem.className = elem.className.replace("hidden", "visible");

                        } else {
                            elem.className = elem.className.replace("visible", "hidden");
                        }
                    }
                }
            }
        },

        /**
         * @param querySelector
         * @param hints
         * @param {object} userSettings
         */
        cmdSwitchQuery : function (querySelector, hints, userSettings) {
            var jqQs = $(querySelector),
                newidCom,
                newid,
                jqFocusElem,
                oldval,
                elementId,
                elementIdCom,
                jqOldElem,
                jqElem;

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
                $('#queryselector').after('<sup id="query-type-hint"><a href="#">?</a></sup>');
                popupBox.bind($('#query-type-hint'), hints['iqueryrow'], {'top' : 'attached-bottom', 'fontSize' : '10pt' });

            } else {
                $('#query-type-hint').remove();
            }
            jqFocusElem.focus();
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
         *
         * @param form
         * @param save_function
         */
        redirectToSave : function (form, save_function) {
            form.action = save_function;
            form.submit();
        },

        /**
         *
         * @param generic
         */
        cmdHelp : function (generic) {
            var lookfor = document.getElementById('searchhelp').value;

            if (lookfor) {
                win.open('http://www.google.com/#q=site%3Atrac.sketchengine.co.uk+' +
                                                    lookfor.replace(/ /g, '+'));
            } else {
                win.open(generic);
            }
        },

        /**
         *
         */
        targetedLinks : function () {
            var anchors,
                anchor,
                i;

            if (!document.getElementsByTagName) {
                return;
            }
            anchors = document.getElementsByTagName("a");
            for (i = 0; i < anchors.length; i += 1) {
                anchor = anchors[i];
                if (anchor.getAttribute("href") && anchor.getAttribute("rel") !== null) {
                    anchor.target = anchor.getAttribute("rel");
                }
            }
        },

        /**
         *
         * @param element
         */
        elementIsFocusableFormInput : function (element) {
            var jqElement = $(element),
                elementName = jqElement.prop('nodeName');

            return ((elementName === 'INPUT' && jqElement.attr('type') !== 'hidden')
                    || elementName === 'SELECT'
                    || elementName === 'TEXTAREA'
                    || elementName === 'BUTTON');
        },

        /**
         * Makes focus on the 'target' element if it is one of input|select|button|textarea
         *
         * @param {function|jquery|string|element} target
         */
        focusEx : function (target) {
            var jqTargetElem;

            if (typeof target === 'function') {
                jqTargetElem = $(target());

            } else {
                jqTargetElem = $(target);
            }
            if (jqTargetElem.length > 0 && hideElem.elementIsFocusableFormInput(jqTargetElem)) {
                jqTargetElem.focus();
            }
        }
    };

    return hideElem;
});