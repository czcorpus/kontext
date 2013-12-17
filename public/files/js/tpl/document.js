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
define(['win', 'jquery', 'hideelem', 'tagbuilder', 'popupbox', 'util', 'jquery.cookie',
    'simplemodal', 'jqueryui'], function (win, $, hideElem, tagbuilder, popupbox, util) {
    'use strict';

    var toggleSelectAllLabel,
        lib = {};

    /**
     * @param {HTMLElement} buttonElm
     * @param {String} [forceStatus]
     */
    toggleSelectAllLabel = function (buttonElm, forceStatus) {
        var tmpLabel,
            currValue,
            newValue;

        if (!$(buttonElm).attr('data-status')) {
            $(buttonElm).attr('data-status', '1');
        }
        currValue = $(buttonElm).attr('data-status');

        if (forceStatus) {
            newValue = forceStatus;

        } else if (currValue === '1') {
            newValue = '2';

        } else if (currValue === '2') {
            newValue = '1';
        }

        if (currValue !== newValue) {
            if ($(buttonElm).get(0).nodeName === 'INPUT') {
                tmpLabel = $(buttonElm).attr('value');
                $(buttonElm).attr('value', $(buttonElm).attr('data-alt-label'));
                $(buttonElm).attr('data-alt-label', tmpLabel);

            } else if ($(buttonElm).get(0).nodeName === 'BUTTON') {
                tmpLabel = $(buttonElm).button('option', 'label');
                $(buttonElm).button('option', 'label', $(buttonElm).attr('data-alt-label'));
                $(buttonElm).attr('data-alt-label', tmpLabel);
            }
            $(buttonElm).attr('data-status', newValue);
        }
    };

    lib.conf = {};

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
        origSucc = options.success;

        succWrapper = function (data, textStatus, jqXHR) {
            var error;

            if (data.hasOwnProperty('error')) {
                error = lib.unpackError(data.error);

                if (error.reset === true) {
                    win.location = lib.conf.rootURL + 'first_form';
                }

                $.modal.close(); // if a modal window is opened close it
                lib.showMessage('error', error.message || 'error');

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
                url: 'ajax_get_corp_details?corpname=' + lib.conf.corpname,
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
            parentElem,
            timeout,
            typeIconMap;

        typeIconMap = {
            info : '../files/img/info-icon.png',
            warning : '../files/img/warning-icon.png',
            error : '../files/img/error-icon.png'
        };

        innerHTML = '<img class="icon" alt="message" src="' + typeIconMap[type] + '">'
                  + '<span>' + message + '</span><a class="close-icon"><img src="../files/img/close-icon.png" /></a>';

        parentElem = win.document.createElement('div');
        $(parentElem).addClass('message').addClass(type);
        $(parentElem).html(innerHTML);
        $('#content').prepend(parentElem);

        $(parentElem).find('a.close-icon').bind('click', function () {
            $(parentElem).hide('slide', {}, 500);
        });

        if (lib.conf.messageAutoHideInterval) {
            timeout = win.setTimeout(function () {
                $(parentElem).hide('slide', {}, 500);
                win.clearTimeout(timeout);
            }, lib.conf.messageAutoHideInterval);
        }

        if (typeof callback === 'function') {
            callback(parentElem);
        }
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
        hideElem.targetedLinks();
        if (lib.conf.focus) {
            hideElem.focusEx(hideElem.focus);
        }

        $('.cql-toolbox').each(function () {
            var corpName,
                cqlInputId = $(this).closest('td').find("input.cql-input").attr('id');

            if (cqlInputId === 'cql') {
                corpName = lib.conf.corpname;

            } else {
                corpName = cqlInputId.substring(4);
            }
            tagbuilder.bindTextInputHelper(
                corpName,
                lib.conf.numTagPos,
                {
                    inputElement: $('#' + $($(this).find('li.insert-tag a').get(0)).data('bound-input')),
                    widgetElement: 'tag-widget',
                    modalWindowElement: 'tag-builder-modal',
                    insertTagButtonElement: 'insert-tag-button',
                    tagDisplayElement: 'tag-display',
                    resetButtonElement: 'reset-tag-button'
                },
                {
                    width: '556px',
                    useNamedCheckboxes: false,
                    allowMultipleOpenedBoxes: false,
                    padding: 0,
                    margin: 0
                },
                function (message) {
                    lib.showMessage('error', message || lib.conf.messages.failed_to_contact_server);
                }
            );

            lib.bindWithinHelper($(this).find('li.within a'), lib.conf.corpname, lib.conf.messages);
        });

        hideElem.loadHideElementStoreSimple();

        $('select.qselector').bind('change', function (event) {
            hideElem.cmdSwitchQuery(event.target, lib.conf.queryTypesHints, lib.userSettings);
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
                                timeout: null
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
            jqCheckboxes = jqContext.find('input[type="checkbox"]');

        } else {
            jqCheckboxes = jqContext;
        }

        updateButtonStatus = function () {
            var numChecked = jqCheckboxes.filter(':checked').length;

            if (jqCheckboxes.length > numChecked) {
                toggleSelectAllLabel(elm, '1');

            } else {
                toggleSelectAllLabel(elm, '2');
            }
        };

        jqCheckboxes.on('click', updateButtonStatus);
        updateButtonStatus();

        jqElm.bind('click', function (event) {
            if ($(event.target).attr('data-status') === '1') {
                jqCheckboxes.each(function () {
                    this.checked = true;
                });
                toggleSelectAllLabel(event.target);

            } else if ($(event.target).attr('data-status') === '2') {
                jqCheckboxes.each(function () {
                    this.checked = false;
                });
                toggleSelectAllLabel(event.target);
            }
        });
    };

    /**
     *
     */
    lib.bindStaticElements = function () {
        var citationHtml = $('#corpus-citation-box').html();

        popupbox.bind($('#positions-help-link'), lib.conf.messages.msg1);

        popupbox.bind('#corpus-desc-link', function (box, finalize) {
            lib.corpusInfoBox.createCorpusInfoBox(box, finalize);
        }, {width: 'auto', closeIcon: true});

        popupbox.bind('#corpus-citation-link a',
            function(box, finalizeCallback) {
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
                onClose: function () {
                    $('#corpus-citation-box').html(citationHtml);
                }
            });

        // 'Select all' buttons for structural attribute lists
        $('input[class="select-all"]').each(function () {
            lib.applySelectAll(this, $(this).closest('table.envelope'));
        });

        $('a#top-level-help-link').bind('click', function (event) {
            hideElem.cmdHelp('https://trac.sketchengine.co.uk/');
            event.stopPropagation();
            return false;
        });

        // Click which removes the 'error box'
        $('.message a.close-icon').bind('click', function (event) {
            var nextUrl,
                parentElm;

            parentElm = $(event.target).closest('.message').get(0);
            nextUrl = $(parentElm).data('next-url');

            $(parentElm).hide('slide', {}, 500, function () {
                if (nextUrl) {
                    win.location = nextUrl;
                }
            });
        });

        $('img.plus-minus').each(function () {
            $(this).bind('click', function () {
                hideElem.cmdHideElementStore($(this).data('elementid'), $(this).data('storeval'), $(this).data('path'),
                    lib.userSettings);
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
     * @param {jQuery} jqLinkElement
     * @param {string} corpusName
     * @param {object} translatMessages
     */
    lib.bindWithinHelper = function (jqLinkElement, corpusName, translatMessages) {
        var jqInputElement = $('#' + jqLinkElement.data('bound-input'));
        jqLinkElement.bind('click', function (event) {
            var caretPos = util.getCaretPosition(jqInputElement),
                clickAction,
                buttonEnterAction;

            clickAction = function () {
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
                onShow: function () {
                    $('#within-builder-modal .selection-container')
                        .append('<img src="../files/img/ajax-loader.gif" alt="loading" />');
                    $.ajax({
                        url: 'ajax_get_structs_details?corpname=' + corpusName,
                        data: {},
                        method: 'get',
                        dataType: 'json',
                        success: function (data) {
                            var prop,
                                html,
                                i;

                            if (data.hasOwnProperty('error')) {
                                $.modal.close();
                                lib.showMessage('error', data.error);

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
                                $('#within-builder-modal .selection-container').empty().append(html);
                                $('#within-insert-button').one('click', clickAction);
                                $(win.document).on('keypress', buttonEnterAction);
                            }
                        },
                        error: function () {
                            $.modal.close();
                            lib.showMessage('error', translatMessages.failed_to_contact_server);
                        }
                    });
                },

                onClose: function () {
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


            if (document.createStyleSheet) {
                document.createStyleSheet('../files/css/main-menu.css');

            } else {
                $(win.document.createElement('link')).attr({
                    rel: 'stylesheet',
                    type: 'text/css',
                    href: '../files/css/main-menu.css'
                }).appendTo('head');
            }

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

                $(this).on('mouseleave', function (event) {
                    var jqMenuLi = $(event.target).closest('li'),
                        jqSubmenu = self.jqMenuLevel2.find('ul');

                    if (jqSubmenu.length === 0 || self.getActiveSubmenuId() !== jqMenuLi.attr('id')) {
                        jqMenuLi.removeClass('active');
                    }
                });
            });

            this.jqMenuLevel2.on('mouseleave', function (event) {
                var jqMenuLi = $(event.target).closest('li'),
                    jqSubmenu = self.jqMenuLevel2.find('ul');

                if (jqSubmenu.length === 0 || self.getActiveSubmenuId() !== jqMenuLi.attr('id')) {
                    jqMenuLi.removeClass('active');
                }
            });

            $(win).on('resize', function () {
                self.closeSubmenu();
            });
        }
    };

    lib.timeoutMessages = function () {
        var timeout,
            jqMessage = $('.message');

        if (jqMessage.length > 0 && lib.conf.messageAutoHideInterval) {
            timeout = win.setTimeout(function () {
                jqMessage.hide('slide', {}, 500);
                win.clearTimeout(timeout);
                if (jqMessage.data('next-url')) {
                    win.location = jqMessage.data('next-url');
                }
            }, lib.conf.messageAutoHideInterval);
        }
    };

    lib.mouseOverImages = function (context) {
        if (!context) {
            context = win.document;
        }
        $(context).find('.over-img').each(function () {
            var tmp,
                wrappingLink,
                activeElm,
                img = this;

            wrappingLink = $(this).closest('a');
            if (wrappingLink.length > 0) {
                activeElm = wrappingLink.get(0);

            } else {
                activeElm = this;
            }
            if ($(this).data('alt-img')) {
                $(activeElm).on('mouseover', function () {
                    tmp = $(img).attr('src');
                    $(img).attr('src', $(img).data('alt-img'));
                });
                $(activeElm).on('mouseout', function () {
                    $(img).attr('src', tmp);
                });
            }
        });
    };

    /**
     *
     * @param {object} conf
     */
    lib.init = function (conf) {
        var settingsObj;

        try {
            settingsObj = JSON.parse($.cookie('ui_settings'));

        } catch (Error) {
            settingsObj = {};
        }

        lib.conf = conf;
        lib.userSettings = {
            data: settingsObj,

            cookieParams: {
                path: lib.conf.rootPath
            },

            get: function (key) {
                return lib.userSettings.data[key];
            },

            set: function (key, value) {
                lib.userSettings.data[key] = value;
                $.cookie('ui_settings', JSON.stringify(lib.userSettings.data), lib.userSettings.cookieParams);
            },

            del: function (key) {
                delete (lib.userSettings.data[key]);
                $.cookie('ui_settings', JSON.stringify(lib.userSettings.data), lib.userSettings.cookieParams);
            }
        };
        lib.misc();
        lib.bindStaticElements();
        lib.queryOverview();
        lib.mainMenu.init();
        lib.timeoutMessages();
        lib.mouseOverImages();

        $('button').button();
        $('input[type="submit"]').button();
        $('input[type="button"]').button();

        $('html').removeClass('_prepare-state');
    };

    return lib;

});