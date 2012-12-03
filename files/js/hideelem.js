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
         * @param resetButtonActions
         */
        cmdSwitchQuery : function (resetButtonActions) {

            var qs = $('queryselector'),
                newid = qs.options[qs.selectedIndex].value,
                FocusElem = $(newid.substring(0, newid.length - 3)),
                oldval = FocusElem.value,
                i,
                elementId,
                oldelem,
                elem,
                date;

            $('conc-form-clear-button').stopObserving('click');
            if (resetButtonActions[qs.getValue()]) {
                $('conc-form-clear-button').observe('click', resetButtonActions[qs.getValue()]);

            } else {
                $('conc-form-clear-button').observe('click', function () {
                    hideElem.clearForm($('mainform'));
                });
            }

            for (i = 0; i < qs.options.length; i += 1) {
                elementId = qs.options[i].value;
                elem = $(elementId);

                if (elementId === newid) {
                    elem.className = elem.className.replace('hidden', 'visible');

                } else {
                    oldelem = $(elementId.substring(0, elementId.length - 3));
                    if (elem.className.search('visible') > -1 && !oldval) {
                        oldval = oldelem.value;
                    }
                    oldelem.value = '';
                    elem.className = elem.className.replace('visible', 'hidden');
                }
            }
            // Keep the value of the last query
            if (newid === 'cqlrow' && oldelem.name === 'tag') {
                if (oldval && oldval !== '.*' && oldval.indexOf('[tag') !== 0) {
                    FocusElem.value = '[tag="' + oldval + '"]';

                } else {
                    FocusElem.value = '';
                }

            } else if (newid === 'tagrow') {
                FocusElem.value = '';

            } else {
                FocusElem.value = oldval;
            }

            FocusElem.select();
            date = new Date();
            date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
            document.cookie = 'query_type=' + newid
                    + '; expires=' + date.toGMTString();
        },

        /**
         *
         * @param f
         */
        clearForm : function (f) {
            var i,
                e,
                qs,
                prevRowType;

            qs = $('queryselector');
            prevRowType = qs.getValue();

            if (document.getElementById('error') !== null) {
                document.getElementById('error').style.display = 'none';
            }
            f.reset();
            for (i = 0; i < f.elements.length; i += 1) {
                e = f.elements[i];
                if (e.type === 'text') {
                    e.value = '';
                }
                if (e.name === 'default_attr') {
                    e.value = '';
                }
                if (e.name === 'lpos' || e.name === 'wpos') {
                    e.value = '';
                }
            }
            qs.setValue(prevRowType);
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
                ancestors = initiator.ancestors(),
                chkStatus,
                tmp;

            for (i = 0; i < ancestors.length; i += 1) {
                if (ancestors[i].nodeName === 'FORM') {
                    form = ancestors[i];
                    break;
                }
            }
            if (initiator.readAttribute('data-action-type') === '1') {
                chkStatus = true;
                initiator.writeAttribute('data-action-type', 2);
                tmp = initiator.readAttribute('value');
                initiator.writeAttribute('value', initiator.readAttribute('data-alt-value'));
                initiator.writeAttribute('data-alt-value', tmp);

            } else if (initiator.readAttribute('data-action-type') === '2') {
                chkStatus = false;
                initiator.writeAttribute('data-action-type', 1);
                tmp = initiator.readAttribute('value');
                initiator.writeAttribute('value', initiator.readAttribute('data-alt-value'));
                initiator.writeAttribute('data-alt-value', tmp);
            }
            if (form !== undefined) {
                form.select('input[type="checkbox"][name="' + name + '"]').each(function (item) {
                    item.checked = chkStatus;
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
         * @param focus
         */
        focusEx : function (focus) {
            var elem = $(focus);
            if (elem && elem.select) {
                elem.select();
            }
        }
    };
}(window));