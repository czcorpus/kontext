/**
 *
 */
(function (context) {
    'use strict';


    context.hideElem = {

        /**
         *
         * @param elementid
         * @param storeval
         * @param path
         */
        cmdHideElementStore : function (elementid, storeval, path) {
            var elem = window.document.getElementById(elementid),
                img = window.document.getElementById(elementid + 'img'),
                cookieval = context.getCookieValue('showhidden'),
                date;

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
                date = new Date();
                date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
                document.cookie = "showhidden=" + cookieval
                        + "; expires=" + date.toGMTString();
            }
        },

        /**
         *
         * @param path
         */
        loadHideElementStore : function (path) {
            var cookie = {},
                ids = context.getCookieValue('showhidden').split('.'),
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
            var elem = window.document.getElementById(elementid),
                cookieval = context.getCookieValue('showhidsim'),
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
                ids = context.getCookieValue("showhidsim").split('.'),
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
            var oldid = context.getCookieValue("query_type"),
                id = oldid.substring(0, oldid.length - 3);

            if (window.document.getElementById(id)) {
                return oldid.substring(0, oldid.length - 3);
            }
            return 'iquery';
        },

        /**
         * @param widgets
         * @param resetButtonActions
         * @param hints
         */
        cmdSwitchQuery : function (widgets, resetButtonActions, hints) {
            var jqQs = $('#queryselector'),
                newid,
                jqFocusElem,
                oldval,
                i,
                elementId,
                jqOldElem,
                jqElem,
                date;

            widgets = widgets || {};
            resetButtonActions = resetButtonActions || {};
            hints = hints || {};
            newid = jqQs.val();
            jqFocusElem = $('#' + newid.substring(0, newid.length - 3));
            oldval = jqFocusElem.val();

            $('#conc-form-clear-button').unbind('click');
            if (resetButtonActions[jqQs.val()]) {
                $('#conc-form-clear-button').bind('click', resetButtonActions[jqQs.val()]);
                context.hideElem.clearForm($('#mainform'));

            } else {
                $('#conc-form-clear-button').bind('click', function () {
                    context.hideElem.clearForm($('#mainform'));
                });
            }

            jqQs.find('option').each(function () {
                elementId = $(this).val();
                jqElem = $('#' + elementId);
                if (elementId === newid) {
                    jqElem.removeClass('hidden').addClass('visible');

                } else {
                    if (jqElem.hasClass('visible')) {
                        jqOldElem = $('#' + elementId.substring(0, elementId.length - 3));
                        oldval = jqOldElem.val();
                        jqOldElem.val('');
                        if (widgets.hasOwnProperty(newid)) {
                            widgets[newid].resetWidget();
                        }
                        jqElem.removeClass('visible').addClass('hidden');
                    }
                }
            });
            // Keep the value of the last query
            if (jqOldElem && jqOldElem.attr('name') === 'tag') {
                if (oldval && oldval !== '.*' && oldval.indexOf('[tag') !== 0) {
                    jqFocusElem.val('[tag="' + oldval + '"]');

                } else {
                    jqFocusElem.val(oldval);
                }

            } else if (newid === 'tagrow') {
                jqFocusElem.val('');

            } else {
                jqFocusElem.val(oldval);
            }

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
            document.cookie = 'query_type=' + newid
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
                if ($(this).attr('data-ignore-reset') !== '1') {
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
         * @param path
         */
        cmdSwitchMenu : function (path) {
            var styleSheets = document.styleSheets,
                horizontal_style = null,
                i,
                position,
                v_css,
                date;

            for (i = 0; i < styleSheets.length; i += 1) {
                if (styleSheets[i].href.search('horizontal.css') > -1) {
                    horizontal_style = styleSheets[i];
                }
            }
            if (horizontal_style === null) {
                position = 'top';
                v_css  = document.createElement('link');
                v_css.rel = 'stylesheet';
                v_css.type = 'text/css';
                v_css.href = path + '/css/horizontal.css';
                document.getElementsByTagName('head')[0].appendChild(v_css);

            } else if (horizontal_style.disabled) {
                position = 'top';
                horizontal_style.disabled = false;

            } else {
                position = 'left';
                horizontal_style.disabled = true;
            }

            date = new Date();
            date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
            document.cookie = "menupositi=" + position
                            + "; expires=" + date.toGMTString();
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
            if ($(initiator).attr('data-action-type') === '1') {
                chkStatus = true;
                $(initiator).attr('data-action-type', 2);
                tmp = $(initiator).attr('value');
                $(initiator).attr('value', $(initiator).attr('data-alt-value'));
                $(initiator).attr('data-alt-value', tmp);

            } else if ($(initiator).attr('data-action-type') === '2') {
                chkStatus = false;
                $(initiator).attr('data-action-type', 1);
                tmp = $(initiator).attr('value');
                $(initiator).attr('value', $(initiator).attr('data-alt-value'));
                $(initiator).attr('data-alt-value', tmp);
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
                window.open('http://www.google.com/#q=site%3Atrac.sketchengine.co.uk+' +
                                                    lookfor.replace(/ /g, '+'));
            } else {
                window.open(generic);
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
            if (jqTargetElem.length > 0 && context.hideElem.elementIsFocusableFormInput(jqTargetElem)) {
                jqTargetElem.focus();
            }
        }
    };
}(window));