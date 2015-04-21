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
define(['win', 'jquery', 'queryInput', 'popupbox', 'plugins/applicationBar', 'vendor/Dispatcher',
        'vendor/jquery.cookie'], function (win, $, queryInput, popupbox, applicationBar, Dispatcher) {
    'use strict';

    var lib = {};

    lib.conf = {};

    lib.dispatcher = new Dispatcher();
    lib.plugins = {
        applicationBar : applicationBar
    };
    lib.pluginResets = [];
    lib.initCallbacks = [];

    /**
     * @param {HTMLElement} selectAllElm
     * @param {String} [forceStatus]
     */
    function toggleSelectAllTrigger(selectAllElm, forceStatus) {
        var currValue,
            newValue;

        if (!$(selectAllElm).attr('data-status')) {
            $(selectAllElm).attr('data-status', '1');
        }
        currValue = $(selectAllElm).attr('data-status');
        if (forceStatus) {
            newValue = forceStatus;

        } else if (currValue === '1') {
            newValue = '2';

        } else if (currValue === '2') {
            newValue = '1';
        }

        if (currValue !== newValue) {
            $(selectAllElm).attr('data-status', newValue);
            if (newValue === '1') {
                selectAllElm.checked = false;
            }
        }
    }

    /**
     * Adds a plug-in to the model. In general, it is not
     * required to do this on a page using some plug-in but
     * in that case it will not be possible to use plug-in
     * related methods of document.js model.
     *
     * @param name
     * @param plugin
     */
    lib.registerPlugin = function (name, plugin) {
        lib.plugins[name] = plugin;
    };

    /**
     *
     * @param name
     * @returns {*}
     */
    lib.getPlugin = function (name) {
        return lib.plugins[name];
    };

    /**
     * Calls a function on a registered plug-in with some additional
     * testing of target's callability.
     *
     * @param {string} name
     * @param {string} fn
     * @param {string} [args]
     * @return the same value as called plug-in method
     */
    lib.callPlugin = function (name, fn, args) {
        if (typeof lib.plugins[name] === 'object'
                && typeof lib.plugins[name][fn] === 'function') {
            return lib.plugins[name][fn].apply(lib.plugins[name][fn], args);

        } else {
            throw new Error("Failed to call method " + fn + " on plug-in " + name);
        }
    };

    /**
     * Registers a callback called during model initialization.
     * It can be either a function or an object specifying plug-in's function
     * ({plugin : 'name', 'method' : 'method name', 'args' : [optional array of arguments]})
     * @param {function|object} fn
     */
    lib.registerInitCallback = function (fn) {
        if (typeof fn === 'function') {
            this.initCallbacks.push(fn);

        } else if (typeof fn === 'object' && fn['plugin'] && fn['method']) {
            this.initCallbacks.push(function () {
                lib.callPlugin(fn['plugin'], fn['method'], fn['args']);
            });

        } else {
            throw new Error('Registered invalid callback');
        }
    };

    /**
     * Escapes general string containing HTML elements and entities
     *
     * @param {String} html
     * @returns {string}
     */
    lib.escapeHTML = function (html) {
        var elm = document.createElement('div');
        elm.appendChild(document.createTextNode(html));
        return elm.innerHTML;
    };

    /**
     *
     * @param s
     */
    lib.shortenText = function (s, length) {
        var ans = s.substr(0, length),
            items;

        if (ans.length > length && !/\s.|.\s/.exec(s.substr(length - 1, 2))) {
            items = ans.split(/\s+/);
            ans = items.slice(0, items.length - 1).join(' ');
        }
        if (ans.length < s.length) {
            ans += '...';
        }
        return ans;
    };

    /**
     * Normalizes error representation (sometimes it is a string,
     * sometimes it is an object) into an object with well defined
     * properties.
     *
     * @param {object|string} obj
     * @return {{}}
     */
    lib.unpackError = function (obj) {
        var ans = {};

        if (typeof obj === 'object') {
            ans.message = obj.message;
            ans.error = obj.error;
            ans.reset = obj.reset || false;

        } else {
            ans.message = obj;
            ans.error = null;
            ans.reset = false;
        }
        return ans;
    };

    /**
     * @param {HTMLElement|string|jQuery} elm
     * @param {{*}} [options]
     * @return
     */
    lib.appendLoader = function (elm, options) {
        var jImage = $('<img />');

        options = options || {};
        jImage.attr('src', '../files/img/ajax-loader.gif');
        if (options.domId) {
            jImage.addClass(options.domId);
        }
        if (options.htmlClass) {
            jImage.addClass(options.htmlClass);
        }
        $(elm).append(jImage);
        return jImage;
    };

    /**
     *
     * @param url
     * @param options
     * @return {JQueryXHR}
     */
    lib.ajax2 = function (url, options) {

    };

    /**
     * Wrapper for jQuery's $.ajax function which is able
     * to handle error states using client's capabilities
     * (error messages, page reload etc.).
     *
     * @param url
     * @param options
     */
    lib.ajax = function (url, options) {
        var succWrapper,
            origSucc;

        if (arguments.length === 1) {
            options = url;
        }

        if (!options.error) {
            options.error = function (jqXHR, textStatus, errorThrown) {
                lib.showMessage('error', errorThrown);
            };
        }

        origSucc = options.success;
        succWrapper = function (data, textStatus, jqXHR) {
            var error;

            if (data.hasOwnProperty('error')) {
                error = lib.unpackError(data.error);

                if (error.reset === true) {
                    win.location = lib.conf.rootURL + 'first_form';

                } else {
                    options.error(null, null, error.message || 'error');
                }

            } else {
                origSucc(data, textStatus, jqXHR);
            }
        };
        options.success = succWrapper;

        if (arguments.length === 1) {
            $.ajax(options);

        } else {
            $.ajax(url, options);
        }
    };

    /**
     *
     * @param {HTMLElement|string|jQuery} element
     */
    lib.selectText = function (element) {
        var elm = $(element),
            range;

        if (elm.length === 1) {
            if (win.document.body.createTextRange) {
                range = win.document.body.createTextRange();
                range.moveToElementText(elm.get(0));
                range.select();

            } else if (win.getSelection) {
                elm.focus().get(0).select();
            }
        }
    };

    /**
     * Handles modal box displaying information about current corpus.
     *
     * @type {{}}
     */
    lib.corpusInfoBox = {

        /**
         *
         * @param attribListData
         * @param jqAttribList
         */
        appendAttribList: function (attribListData, jqAttribList) {
            $.each(attribListData, function (i, item) {
                var newRow;

                if (!item.error) {
                    newRow = jqAttribList.find('.item').clone();
                    newRow.removeClass('item');
                    newRow.addClass('dynamic');
                    newRow.find('th').text(item.name);
                    newRow.find('td').text(item.size);

                } else {
                    newRow = jqAttribList.append('<tr class="dynamic"><td colspan="2">' + item.error + '</td></tr>');
                }
                jqAttribList.append(newRow);
            });
        },

        /**
         *
         * @param structListData
         * @param jqStructList
         */
        appendStructList: function (structListData, jqStructList) {
            var numCol,
                i,
                repeatStr,
                updateRow;

            repeatStr = function (str, num) {
                var k,
                    ans = '';

                for (k = 0; k < num; k += 1) {
                    ans += str;
                }
                return ans;
            };

            updateRow = function (data, idx, rootElm) {
                var newRow = rootElm.find('.item').clone();

                newRow.removeClass('item');
                newRow.addClass('dynamic');
                newRow.find('th').each(function (j) {
                    var value = data[idx + j];

                    if (value) {
                        $(this).text('<' + value.name + '>');
                    }
                });
                newRow.find('td').each(function (j) {
                    var value = data[idx + j];

                    if (value) {
                        $(this).text(value.size);
                    }
                });
                rootElm.append(newRow);
            };

            numCol = Math.min(4, Math.ceil(structListData.length / 10));
            jqStructList.find('.item').empty().html(repeatStr('<th></th><td class="numeric"></td>', numCol));
            jqStructList.find('.attrib-heading').attr('colspan', 2 * numCol);

            for (i = 0; i < structListData.length; i += numCol) {
                updateRow(structListData, i, jqStructList);
            }
        },

        /**
         * @param {TooltipBox} tooltipBox
         * @param {Function} doneCallback called when all is loaded and set
         */
        createCorpusInfoBox: function (tooltipBox, doneCallback) {
            var rootElm = tooltipBox.getRootElement();

            lib.ajax({
                url: lib.conf.rootPath + 'corpora/ajax_get_corp_details?corpname=' + lib.conf.corpname,
                dataType: 'json',
                method: 'get',
                success: function (data) {
                    var jqInfoBox = $(rootElm),
                        jqAttribList,
                        jqStructList;

                    jqInfoBox.html(data.template);
                    jqAttribList = $('#corpus-details-box .attrib-list');
                    jqStructList = $('#corpus-details-box .struct-list');

                    jqInfoBox.find('.corpus-name').text(data.corpname);
                    jqInfoBox.find('.corpus-description').text(data.description);
                    jqInfoBox.find('.size').text(data.size);
                    if (data.web_url) {
                        jqInfoBox.find('span.web_url').html('<a href="' + data.web_url + '">' + data.web_url + '</a>');

                    } else {
                        jqInfoBox.find('.web_url').remove();
                    }

                    lib.corpusInfoBox.appendAttribList(data.attrlist, jqAttribList);
                    lib.corpusInfoBox.appendStructList(data.structlist, jqStructList);
                    doneCallback();
                },
                error: function () {
                    if (typeof tooltipBox.onError === 'function') {
                        tooltipBox.onError();
                    }
                    tooltipBox.close();
                    lib.showMessage('error', lib.conf.messages.failed_to_load_corpus_info);
                }
            });
        }
    };

    /**
     * @param {String} type one of 'info', 'warning', 'error'
     * @param {String} message text of the message
     * @param {Function} [callback] do something after message is rendered
     */
    lib.showMessage = function (type, message, callback) {
        var innerHTML,
            messageListElm,
            messageElm,
            timeout,
            typeIconMap;

        typeIconMap = {
            info : '../files/img/info-icon.png',
            warning : '../files/img/warning-icon.png',
            error : '../files/img/error-icon.png'
        };

        if (typeof message === 'object' && type === 'error') {
            message = message['message'];
        }

        innerHTML = '<img class="icon" alt="message" src="' + typeIconMap[type] + '">'
            + '<span>' + message + '</span><a class="close-icon"><img src="../files/img/close-icon.png" /></a>';

        if ($('#content .messages').length === 0) {
            messageListElm = win.document.createElement('div');
            $(messageListElm).addClass('messages');
            $('#content').prepend(messageListElm);

        } else {
            messageListElm = $('#content .messages').get(0);
        }
        messageElm = win.document.createElement('div');
        $(messageElm).addClass('message').addClass(type);
        $(messageElm).html(innerHTML);
        $(messageListElm).append(messageElm);


        $(messageElm).find('a.close-icon').bind('click', function () {
            $(messageElm).hide(200);
        });

        if (lib.conf.messageAutoHideInterval) {
            timeout = win.setTimeout(function () {
                $(messageElm).hide(200);
                win.clearTimeout(timeout);
            }, lib.conf.messageAutoHideInterval);
        }

        if (typeof callback === 'function') {
            callback(messageElm);
        }
    };

    /**
     * Transforms an existing element into a context help link with bound pop-up message.
     *
     * @param {HTMLElement} triggerElm an element to be transformed into a context help link
     * @param text text of the help
     */
    lib.contextHelp = function(triggerElm, text) {
        var image = win.document.createElement('img');

        $(triggerElm).addClass('context-help');
        $(image).attr('data-alt-img', '../files/img/question-mark_s.png')
            .attr('src', '../files/img/question-mark.png')
            .addClass('over-img');
        $(triggerElm).append(image);
        popupbox.bind(triggerElm, text, { width: 'nice' });
    };

    /**
     * Modifies form (actually, it is always the #mainform)
     * in a way that only current corpus is changed. Under
     * normal circumstances, the form submits to the concordance
     * view page via POST method.
     *
     * @param {Event} event
     */
    lib.formChangeCorpus = function (event) {
        var jqFormElm = $(event.target).closest('form'),
            subcorpSelect = $('#subcorp-selector');

        jqFormElm.attr('action', 'first_form');
        jqFormElm.attr('method', 'GET');
        if (subcorpSelect.val()) {
            subcorpSelect.val(null);
        }
        jqFormElm.submit();
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
            var corpn = $(this).data('corpus'), // beware - corp may contain special characters colliding with jQuery
                queryType;

            // non empty value of 'sel_aligned' (hidden) input indicates that the respective corpus is active
            if (!$(this).val()) {
                $('select[name="pcq_pos_neg_' + corpn + '"]').attr('disabled', state);
                $('select[name="queryselector_' + corpn + '"]').attr('disabled', state);
                $('[id="qnode_' + corpn + '"]').find('input').attr('disabled', state);
                $(this).attr('disabled', state);

                $(this).parent().find('input[type="text"]').each(function () {
                    $(this).attr('disabled', state);
                });

            } else {
                queryType = $(this).parent().find('[id="queryselector_' + corpn + '"]').val();
                queryType = queryType.substring(0, queryType.length - 3);
                $('[id="qnode_' + corpn + '"]').find('input[type="text"]').each(function () {
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
     * @param number {number|string}
     * @param {string} groupSepar separator character for thousands groups
     * @param {string} radixSepar separator character for integer and fractional parts
     * @returns {string}
     */
    lib.formatNum = function (number, groupSepar, radixSepar) {
        var i,
            offset = 0,
            len,
            numParts,
            s;

        numParts = number.toString().split('.');
        s = numParts[0].split('').reverse();
        len = s.length;
        for (i = 3; i < len; i += 3) {
            s.splice(i + offset, 0, groupSepar);
            offset += 1;
        }
        s = s.reverse().join('');
        if (numParts[1] !== undefined) {
            s += radixSepar + numParts[1];
        }
        return s;
    };

    /**
     *
     */
    lib.misc = function () {
        $('select.qselector').each(function () {
            $(this).on('change', function (event) {
                queryInput.cmdSwitchQuery(lib, event, lib.conf.queryTypesHints);
            });

            // we have to initialize inputs properly (unless it is the default (as loaded from server) state)
            if ($(this).val() !== 'iqueryrow') {
                queryInput.cmdSwitchQuery(lib, $(this).get(0), lib.conf.queryTypesHints);
            }
        });

        // remove empty and unused parameters from URL before mainform submit
        $('form').submit(function () { // run before submit
            lib.setAlignedCorporaFieldsDisabledState(true);
            $(win).on('unload', function () {
                lib.setAlignedCorporaFieldsDisabledState(false);
            });
        });
    };

    /**
     * Renders a query overview within tooltipBox
     * instance based on provided data
     *
     * @param data
     * @param {TooltipBox} tooltipBox
     */
    lib.renderOverview = function (data, tooltipBox) {
        var url,
            html = '<h3>' + lib.conf.messages.query_overview + '</h3><table border="1">',
            parentElm = tooltipBox.getRootElement();

        html += '<tr><th>' + lib.conf.messages.operation + '</th>';
        html += '<th>' + lib.conf.messages.parameters + '</th>';
        html += '<th>' + lib.conf.messages.num_of_hits + '</th><th></th></tr>';

        $.each(data.Desc, function (i, item) {
            html += '<tr><td>' + lib.escapeHTML(item.op) + '</td>';
            html += '<td>' + lib.escapeHTML(item.arg) + '</td>';
            html += '<td>' + lib.escapeHTML(item.size) + '</td>';
            html += '<td>';
            if (item.tourl) {
                url = 'view?' + item.tourl;
                html += '<a href="' + url + '">' + lib.conf.messages.view_result + '</a>';
            }
            html += '</td>';
            html += '</tr>';
        });
        html += '</table>';
        $(parentElm).html(html);
    };

    /**
     *
     */
    lib.queryOverview = function () {
        var escKeyEventHandlerFunc;

        escKeyEventHandlerFunc = function (boxInstance) {
            return function (event) {
                if (event.keyCode === 27) {
                    $('#conclines tr.active').removeClass('active');
                    if (boxInstance) {
                        boxInstance.close();
                    }
                    $(document).off('keyup.query_overview');
                }
            };
        };

        // query overview
        $('#query-overview-trigger').on('click', function (event) {
            var reqUrl = $(event.target).data('json-href');

            $.ajax(reqUrl, {
                dataType: 'json',
                success: function (data) {
                    var box,
                        leftPos;

                    if (data.Desc) {
                        box = popupbox.open(
                            function (box2, finalize) {
                                lib.renderOverview(data, box2);
                                finalize();
                            },
                            null,
                            {
                                type: 'plain',
                                domId: 'query-overview',
                                htmlClass: 'query-overview',
                                closeIcon: true,
                                calculatePosition: false,
                                timeout: null,
                                messages: lib.conf.messages
                            }
                        );
                        leftPos = $(window).width() / 2 - box.getPosition().width / 2;
                        box.setCss('left', leftPos + 'px');

                        $(win.document).on('keyup.query_overview', escKeyEventHandlerFunc(box));

                    } else {
                        lib.showMessage('error', lib.conf.messages.failed_to_load_query_overview);
                    }
                },
                error: function () {
                    lib.showMessage('error', lib.conf.messages.failed_to_load_query_overview);
                }
            });
            event.preventDefault();
            event.stopPropagation();
            return false;
        });
    };

    /**
     * @param {HTMLElement|String|jQuery} elm
     * @param {String|jQuery} context checkbox context selector (parent element or list of checkboxes)
     */
    lib.applySelectAll = function (elm, context) {
        var jqElm = $(elm),
            jqContext = $(context),
            jqCheckboxes,
            updateButtonStatus;

        if (jqContext.length === 1 && jqContext.get(0).nodeName !== 'INPUT') {
            jqCheckboxes = jqContext.find('input[type="checkbox"]:not(.select-all)');

        } else {
            jqCheckboxes = jqContext;
        }

        updateButtonStatus = function () {
            var numChecked = jqCheckboxes.filter(':checked').length;

            if (jqCheckboxes.length > numChecked) {
                toggleSelectAllTrigger(elm, '1');

            } else {
                toggleSelectAllTrigger(elm, '2');
            }
        };

        jqCheckboxes.on('click', updateButtonStatus);
        updateButtonStatus();

        jqElm.off('click');
        jqElm.on('click', function (event) {
            var evtTarget = event.target;

            if ($(evtTarget).attr('data-status') === '1') {
                jqCheckboxes.each(function () {
                    this.checked = true;
                });
                toggleSelectAllTrigger(evtTarget);

            } else if ($(evtTarget).attr('data-status') === '2') {
                jqCheckboxes.each(function () {
                    this.checked = false;
                });
                toggleSelectAllTrigger(evtTarget);
            }
        });
    };

    /**
     * @returns {$.Deferred.Promise}
     */
    lib.bindCorpusDescAction = function () {
        var jqDescLink = $('#corpus-desc-link'),
            defer = $.Deferred();

        popupbox.bind(jqDescLink,
            function (box, finalize) {
                lib.corpusInfoBox.createCorpusInfoBox(box, finalize);
            },
            {
                width: 'auto',
                closeIcon: true,
                messages: lib.conf.messages,
                beforeOpen: function () {
                    var ajaxLoader = lib.createAjaxLoader();

                    $(win.document.body).append(ajaxLoader);
                    ajaxLoader.css({
                        'left': (jqDescLink.offset().left - 20) + 'px',
                        'top': (jqDescLink.offset().top + 30) + 'px'
                    });
                    return ajaxLoader;
                },
                onShow: function (loader) {
                    loader.remove();
                    defer.resolve();
                },
                onError: function (loader) {
                    loader.remove();
                    defer.resolve();
                }
            });

        return defer.promise();
    };

    /**
     *
     */
    lib.bindStaticElements = function () {
        var citationHtml = $('#corpus-citation-box').html();

        popupbox.bind($('#positions-help-link'), lib.conf.messages.msg1,
            {messages: lib.conf.messages, width: '30%'});

        popupbox.bind('#corpus-citation-link a',
            function (box, finalizeCallback) {
                $(box.getRootElement()).html(citationHtml).find('a').attr('target', '_blank');
                $('#corpus-citation-box').empty();
                finalizeCallback();
            },
            {
                type: 'plain',
                domId: 'citation-information',
                closeIcon: true,
                calculatePosition: true,
                timeout: null,
                messages: lib.conf.messages,
                width: '40%',
                onClose: function () {
                    $('#corpus-citation-box').html(citationHtml);
                }
            });

        // 'Select all' buttons for structural attribute lists
        $('table.envelope input[class="select-all"]').each(function () {
            lib.applySelectAll(this, $(this).closest('table.envelope'));
        });

        // Click which removes the 'error box'
        $('.message a.close-icon').bind('click', function (event) {
            var nextUrl,
                parentElm;

            parentElm = $(event.target).closest('.message').get(0);
            nextUrl = $(parentElm).data('next-url');

            $(parentElm).hide(200, function () {
                if (nextUrl) {
                    win.location = nextUrl;
                }
            });
        });

        // Footer's language switch
        $('#switch-language-box a').each(function () {
            $(this).bind('click', function () {
                lib.userSettings.set('set_uilang', $(this).data('lang'));
                win.location.reload();
            });
        });
    };

    /**
     *
     * @type {{jqMenuBar: (*|HTMLElement), jqMenuLevel2: (*|HTMLElement), getActiveSubmenuId: Function, setActiveSubmenuId: Function, closeSubmenu: Function, getHiddenSubmenu: Function, openSubmenu: Function, init: Function}}
     */
    lib.mainMenu = {

        /**
         * Wrapping element for whole main-menu
         */
        jqMenuBar: $('#menu-bar'),

        /**
         * Wrapper where sub-menu is rendered
         */
        jqMenuLevel2: $('#menu-level-2'),

        /**
         *
         * @returns {*}
         */
        getActiveSubmenuId: function () {
            return this.jqMenuLevel2.attr('data-current-menu');
        },

        /**
         *
         * @param {string} id
         */
        setActiveSubmenuId: function (id) {
            this.jqMenuLevel2.attr('data-current-menu', id);
        },

        /**
         * @param {string} [menuId]
         */
        closeSubmenu: function (menuId) {
            var jqPrevMenuUl = this.jqMenuLevel2.find('ul');

            if (!menuId) {
                menuId = this.getActiveSubmenuId();
            }

            if (menuId) {
                $('#' + menuId).removeClass('active').append(jqPrevMenuUl);
                jqPrevMenuUl.css('display', 'none');
                this.setActiveSubmenuId(null);
            }
        },

        /**
         *
         * @param li
         * @returns {*}
         */
        getHiddenSubmenu: function (li) {
            return $(li).find('ul');
        },

        /**
         *
         * @param {jQuery|HTMLElement} activeLi active main menu item LI
         */
        openSubmenu: function (activeLi) {
            var menuLeftPos,
                jqSubMenuUl,
                jqActiveLi = $(activeLi);

            jqSubMenuUl = this.getHiddenSubmenu(jqActiveLi);
            if (jqSubMenuUl.length > 0) {
                jqActiveLi.addClass('active');
                jqSubMenuUl.css('display', 'block');
                this.jqMenuLevel2.addClass('active').empty().append(jqSubMenuUl);
                menuLeftPos = jqActiveLi.offset().left + jqActiveLi.width() / 2 - jqSubMenuUl.width() / 2;
                if (menuLeftPos < this.jqMenuBar.offset().left) {
                    menuLeftPos = this.jqMenuBar.offset().left;

                } else if (menuLeftPos + jqSubMenuUl.width() > this.jqMenuBar.offset().left + this.jqMenuBar.width()) {
                    menuLeftPos = this.jqMenuBar.offset().left + this.jqMenuBar.width() - jqSubMenuUl.width();
                }
                jqSubMenuUl.css('left', menuLeftPos);

            } else {
                this.jqMenuLevel2.removeClass('active');
            }
        },

        /**
         * Initializes main menu logic
         */
        init: function () {
            var self = this;

            $('#menu-level-1 li.disabled a').each(function () {
                $(this).attr('href', '#');
            });

            $('#menu-level-1 a.trigger').each(function () {
                $(this).on('mouseover', function (event) {
                    var jqMenuLi = $(event.target).closest('li'),
                        prevMenuId,
                        newMenuId = jqMenuLi.attr('id');

                    prevMenuId = self.getActiveSubmenuId();
                    if (prevMenuId !== newMenuId) {
                        self.closeSubmenu(prevMenuId);

                        if (!jqMenuLi.hasClass('disabled')) {
                            self.setActiveSubmenuId(jqMenuLi.attr('id'));
                            self.openSubmenu(jqMenuLi);
                        }
                    }
                });
            });

            self.jqMenuBar.on('mouseleave', function (event) {
                self.closeSubmenu(self.getActiveSubmenuId());
            });

            $(win).on('resize', function () {
                self.closeSubmenu();
            });

            popupbox.abbr();
        }
    };

    lib.timeoutMessages = function () {
        var timeout,
            jqMessage = $('.message');

        if (jqMessage.length > 0 && lib.conf.messageAutoHideInterval) {
            timeout = win.setTimeout(function () {
                jqMessage.hide(200);
                win.clearTimeout(timeout);
                if (jqMessage.data('next-url')) {
                    win.location = jqMessage.data('next-url');
                }
            }, lib.conf.messageAutoHideInterval);
        }
    };

    lib.mouseOverImages = function (context) {
        context = context || win.document;

        $(context).find('.over-img').each(function () {
            var tmp,
                wrappingLink,
                activeElm,
                img = this;

            wrappingLink = $(img).closest('a');
            if (wrappingLink.length > 0) {
                activeElm = wrappingLink.get(0);

            } else {
                activeElm = img;
            }
            if ($(img).attr('data-alt-img')) {
                $(activeElm).off('mouseover.overimg');
                $(activeElm).on('mouseover.overimg', function () {
                    tmp = $(img).attr('src');
                    $(img).attr('src', $(img).attr('data-alt-img'));
                });
                $(activeElm).off('mouseout.overimg');
                $(activeElm).on('mouseout.overimg', function () {
                    $(img).attr('src', tmp);
                });
            }
        });
    };

    /**
     * @todo this is currently a Czech National Corpus specific solution
     */
    lib.enhanceMessages = function () {
        $('.message .sign-in').each(function () {
            var text = $(this).text(),
                findSignInUrl;

            findSignInUrl = function () {
                return $('#cnc-toolbar-user a:nth-child(1)').attr('href');
            };

            $(this).replaceWith('<a href="' + findSignInUrl() + '">' + text + '</a>');
        });
    };

    /**
     *
     */
    lib.externalHelpLinks = function () {
        $('a.external-help').each(function () {
            var href = $(this).attr('href'),
                message = lib.conf.messages.more_information_at + ' <a href="' + href + '" target="_blank">' + href + '</a>';
            popupbox.bind(this, message, {});
        });
    };

    /**
     *
     */
    lib.reload = function () {
        win.document.location.reload();
    };

    /**
     * Creates unbound HTML tree containing message 'loading...'
     *
     * @returns {jQuery}
     */
    lib.createAjaxLoader = function () {
        return $('<div class="ajax-loading-msg"><span>' + lib.conf.messages.loading + '</span></div>');
    };

    /**
     *
     * @returns {*|HTMLElement}
     */
    lib.createSmallAjaxLoader = function () {
        return $('<img src="../files/img/ajax-loader.gif" '
            + 'alt="' + lib.conf.messages.loading + '" '
            + 'title="' + lib.conf.messages.loading + '" '
            + 'style="width: 24px; height: 24px" />');
    };

    /**
     *
     */
    lib.resetPlugins = function () {
        var i;

        for (i = 0; i < this.pluginResets.length; i += 1) {
            this.pluginResets[i]();
        }
    };

    /**
     *
     * @param msg
     * @returns {*}
     */
    lib.translate = function (msg) {
        msg = msg || '';
        return lib.conf.messages[msg] ? lib.conf.messages[msg] : msg;
    };

    /**
     * @typedef {Object} pluginApi
     * @property {function} conf
     * @property {function} ajax
     * @property {function} ajaxAnim
     * @property {function} ajaxAnimSmall
     * @property {function} showMessage
     * @property {function} translate
     * @property {function} applySelectAll
     * @property {function} registerReset
     */

    /**
     * Generates an API object which provides essential functionality for client-side plugin code.
     *
     * @return {pluginApi}
     */
    lib.pluginApi = function () {
        var self = this;

        return {
            conf : function (key) {
                if (self.conf.hasOwnProperty(key)) {
                    return self.conf[key];

                } else {
                    throw new Error('Unknown configuration key requested: ' + key);
                }
            },

            createStaticUrl : function (path) {
                var staticPath = self.conf.staticUrl;

                if (path.indexOf('/') === 0) {
                    path = path.substr(1);
                }
                return staticPath + path;
            },

            createActionUrl : function (path) {
                var staticPath = self.conf.rootPath;

                if (path.indexOf('/') === 0) {
                    path = path.substr(1);
                }
                return staticPath + path;
            },

            ajax : function () {
                return self.ajax.apply(self, arguments);
            },

            ajaxAnim : function () {
                return self.createAjaxLoader.apply(self, arguments);
            },

            ajaxAnimSmall : function () {
                return self.createSmallAjaxLoader.apply(self, arguments);
            },

            appendLoader : function () {
                return self.appendLoader.apply(self, arguments);
            },

            showMessage : function () {
                return self.showMessage.apply(self, arguments);
            },

            translate : function (msg) {
                return self.translate(msg);
            },

            applySelectAll : function (elm, context) {
                return self.applySelectAll(elm, context);
            },

            registerReset : function (fn) {
                self.pluginResets.push(fn);
            },

            resetToHomepage : function (params) {
                var p,
                    ans = [];

                for(p in params) {
                    if (params.hasOwnProperty(p)) {
                        ans.push(encodeURIComponent(p) + "=" + encodeURIComponent(params[p]));
                    }
                }
                win.location = self.conf.rootURL + 'first_form?' + ans.join('&');
            },

            userIsAnonymous : function () {
                return self.conf.anonymousUser;
            },

            contextHelp : function (triggerElm, text) {
                return self.contextHelp(triggerElm, text);
            },

            formChangeCorpus : function (event) {
                return self.formChangeCorpus(event);
            },

            shortenText : function (s, length) {
                return self.shortenText(s, length);
            },

            dispatcher : function () {
                return lib.dispatcher;
            }
        };
    };

    /**
     * A key-value storage with some convenient functions.
     * @constructor
     */
    function Promises() {
        this.prom = {};
    }

    /**
     * Adds one (.add(key, promise)) or multiple (.add({...})) promises to the collection.
     * Returns self.
     *
     * @param arg0
     * @param [arg1]
     * @returns {Promises} the called object
     */
    Promises.prototype.add = function (arg0, arg1) {
        var prop;

        if (typeof arg0 === 'object' && arg1 === undefined) {
            for (prop in arg0) {
                if (arg0.hasOwnProperty(prop)) {
                    this.add(prop, arg0[prop]);
                }
            }

        } else if (typeof arg0 === 'string' && arg1) {
            if (this.prom.hasOwnProperty(arg0)) {
                throw new Error('promise ' + arg0 + ' already present');
            }
            this.prom[arg0] = arg1;
        }
        return this;
    };

    /**
     * Tests whether there is a promise with the 'key'
     *
     * @param key
     * @returns {boolean}
     */
    Promises.prototype.contains = function (key) {
        return this.prom.hasOwnProperty(key);
    };

    /**
     * Gets a promise of the specified name. In case
     * no such promise exists, error is thrown.
     *
     * @param key
     * @returns {*}
     */
    Promises.prototype.get = function (key) {
        if (this.prom[key]) {
            return this.prom[key];

        } else {
            throw new Error('No such promise: ' + key);
        }
    };

    /**
     * Binds a function to be run after the promise
     * identified by 'promiseId' is fulfilled. In case
     * there is no promise under the 'promiseId' key then
     * ad-hoc one is created and immediately resolved.
     *
     * @param {string} promiseId an identifier of the promise as defined in
     * the init() function
     * @param {function} fn a function to be run after the promise is resolved;
     * the signature is: function (value)
     */
    Promises.prototype.doAfter = function (promiseId, fn) {
        var prom2;

        promiseId = this.get(promiseId);

        if (!promiseId) {
            promiseId = $.Deferred();
            prom2 = promiseId.then(fn);
            promiseId.resolve();

        } else {
            prom2 = promiseId.then(fn);
        }
        return prom2;
    };

    /**
     *
     * @param {{}} conf
     * @return {Promises}
     */
    lib.init = function (conf) {
        var storageProvider,
            promises = new Promises();

        if (typeof win.localStorage === 'object') {
            storageProvider = win.localStorage;

        } else {
            storageProvider = {
                key : function (idx) {},
                getItem : function (key) {},
                setItem : function (key, value) {},
                removeItem : function (key) {},
                length : 0
            };
        }

        lib.promises = {};
        lib.conf = conf;

        lib.userSettings = {
            storage : storageProvider,

            storageKey : 'kontext_ui',

            timestampKey : '__timestamp__',

            data: {},

            getTimstamp : function () {
                return new Date().getTime() / 1000;
            },

            dataIsRecent : function (data) {
                return !data[this.timestampKey] || data[this.timestampKey]
                    && ( (new Date().getTime() / 1000 - data[this.timestampKey]) < lib.conf.uiStateTTL);
            },

            dumpToStorage : function () {
                this.data[this.timestampKey] = this.getTimstamp();
                this.storage.setItem(this.storageKey, JSON.stringify(this.data));
            },

            get: function (key) {
                return this.data[key];
            },

            set: function (key, value) {
                this.data[key] = value;
                this.dumpToStorage();
            },

            init: function () {
                var tmp;
                if (this.storage.getItem(this.storageKey)) {
                    tmp = JSON.parse(this.storage.getItem(this.storageKey));
                    if (this.dataIsRecent(tmp)) {
                        this.data = tmp;
                    }

                } else {
                    this.data[this.timestampKey] = this.getTimstamp();
                }
            }
        };
        lib.userSettings.init();

        promises.add({
            misc : lib.misc(),
            bindQueryHelpers : queryInput.bindQueryHelpers(lib.pluginApi()),
            bindStaticElements : lib.bindStaticElements(),
            bindCorpusDescAction : lib.bindCorpusDescAction(),
            queryOverview : lib.queryOverview(),
            mainMenuInit : lib.mainMenu.init(),
            timeoutMessages : lib.timeoutMessages(),
            mouseOverImages : lib.mouseOverImages(),
            enhanceMessages : lib.enhanceMessages(),
            externalHelpLinks : lib.externalHelpLinks(),
            applicationBar : applicationBar.createInstance(lib.pluginApi())
        });

        // init plug-ins
        lib.registerPlugin('applicationBar', promises.get('applicationBar'));

        $.each(this.initCallbacks, function (i, fn) {
            fn();
        });

        return promises;
    };

    return lib;

});