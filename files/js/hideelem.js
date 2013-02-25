/**
 *
 */
define(['jquery', 'win', 'bonito', 'jquery.cookies'], function ($, win, bonito, cookies) {
    'use strict';

    var hideElem;

    hideElem = {

        /**
         *
         * @param elementid
         * @param storeval
         * @param path
         */
        cmdHideElementStore : function (elementid, storeval, path) {
            var elem = $('#' + elementid),
                img = $('#' + elementid + 'img'),
                cookieval = cookies.get('showhidden');

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
                var date = new Date();
                date.setDate(date.getDate() + 30);
                var opts = { domain: '', path: '/', expiresAt: date, secure: false};
                cookies.set('showhidden', cookieval, opts);
            }
        },

        /**
         *
         * @param path
         */
        loadHideElementStore : function (path) {
            var cookie = {},
                ids = bonito.getCookieValue('showhidden').split('.'),
                i,
                id,
                elem,
                img,
                onclick,
                all_elements;

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
         * @param elementid
         * @param storeval
         */
        cmdHideElementStoreSimple : function (elementid, storeval) {
            var elem = win.document.getElementById(elementid),
                cookieval = bonito.getCookieValue('showhidsim'),
                date;

            cookieval = cookieval.replace(new RegExp("\\." + elementid + "\\.", "g"), ".");
            if (elem.className.match("hidden")) {
                elem.className = elem.className.replace("hidden", "visible");
                cookieval += elementid + ".";
            } else {
                elem.className = elem.className.replace("visible", "hidden");
            }
            if (storeval) {
                date = new Date();
                date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
                document.cookie = "showhidsim=" + cookieval
                        + "; expires=" + date.toGMTString();
            }
        },

        /**
         *
         */
        loadHideElementStoreSimple : function () {
            var cookie = {},
                ids = bonito.getCookieValue("showhidsim").split('.'),
                i,
                all_elements,
                onclick,
                id,
                elem;

            for (i = 0; i < ids.length; i += 1) {
                cookie[ids[i]] = 1;
            }
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
         *
         * @return {String}
         */
        cmdGetFocusedId : function () {
            var oldid = bonito.getCookieValue("query_type"),
                id = oldid.substring(0, oldid.length - 3);

            if (win.document.getElementById(id)) {
                return oldid.substring(0, oldid.length - 3);
            }
            return 'iquery';
        },

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
                date;

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
                $('#query-type-hint').bind('click', function (event) {
                    require(['popupbox'], function (ppbox) {
                        ppbox.createPopupBox(event, 'query-type-hint-box', $('#query-type-hint'), hints['iqueryrow'],
                            { 'top' : 'attached-bottom', 'fontSize' : '10pt' });
                    });
                    event.stopPropagation();
                });

            } else {
                $('#query-type-hint').remove();
            }

            date = new Date();
            date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
            win.document.cookie = 'query_type=' + newid
                    + '; expires=' + date.toGMTString();

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
         * @param initiator
         * @param name
         */
        selectAllCheckBoxes : function (initiator, name) {
            var i,
                form,
                ancestors = $(initiator).parents(),
                chkStatus,
                tmp;

            for (i = 0; i < ancestors.length; i += 1) {
                if (ancestors[i].nodeName === 'FORM') {
                    form = ancestors[i];
                    break;
                }
            }
            if ($(initiator).data('action-type') === '1') {
                chkStatus = true;
                $(initiator).data('action-type', 2);
                tmp = $(initiator).attr('value');
                $(initiator).attr('value', $(initiator).data('alt-value'));
                $(initiator).data('alt-value', tmp);

            } else if ($(initiator).data('action-type') === '2') {
                chkStatus = false;
                $(initiator).data('action-type', 1);
                tmp = $(initiator).attr('value');
                $(initiator).attr('value', $(initiator).data('alt-value'));
                $(initiator).data('alt-value', tmp);
            }
            if (form !== undefined) {
                $(form).find('input[type="checkbox"][name="' + name + '"]').each(function () {
                    $(this).attr('checked', chkStatus);
                });
            }
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