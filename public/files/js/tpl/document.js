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
define(['win', 'jquery', 'jqueryui', 'hideelem', 'tagbuilder', 'popupbox', 'jquery.cookies', 'bonito',
        'simplemodal'], function (win, $, ui, hideElem, tagbuilder, popupbox, cookies, bonito, _sm) {
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

    lib.conf = {};

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
                lib.showErrorMessage(error.message || 'error');

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
        appendAttribList : function (attribListData, jqAttribList) {
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
            $.each(structListData, function (i, item) {
                var newRow;
                if (!item.error) {
                    newRow = jqStructList.find('.item').clone();
                    newRow.removeClass('item');
                    newRow.addClass('dynamic');
                    newRow.find('th').text('<' + item.name + '>');
                    newRow.find('td').text(item.size);

                } else {
                    newRow = jqStructList.append('<tr class="dynamic"><td colspan="2">' + item.error + '</td></tr>');
                }
                jqStructList.append(newRow);
            });
        },

        /**
         *
         */
        resetCorpusInfoBox : function () {
            $('#corpus-details-box .attrib-list tr.dynamic').remove();
            if ($('#corpus-details-box .loader-animation').length === 0) {
                $('#corpus-details-box').append('<img class="loader-animation" src="../files/img/ajax-loader.gif" />');
            }
        },

        /**
         *
         * @param okCallback
         * @param failCallback
         */
        createCorpusInfoBox : function (okCallback, failCallback) {
            lib.corpusInfoBox.resetCorpusInfoBox();

            lib.ajax({
                url : 'ajax_get_corp_details?corpname=' + lib.conf.corpname,
                dataType : 'json',
                method : 'get',
                success : function (data) {
                    var jqInfoBox = $('#corpus-details-box'),
                        jqAttribList = $('#corpus-details-box .attrib-list'),
                        jqStructList = $('#corpus-details-box .struct-list');

                    $('#corpus-details-box .loader-animation').remove();

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

                    if (typeof okCallback === 'function') {
                        okCallback();
                    }

                },
                error : function () {
                    this.corpusInfoBox.resetCorpusInfoBox();
                    if (typeof failCallback === 'function') {
                        failCallback();
                    }
                    lib.showErrorMessage(lib.conf.messages.failed_to_load_corpus_info);
                }
            });
        }
    };

    /**
     * Displays 'standard' error message box
     *
     * @param {string} message a message to be displayed
     * @param {function} [callback] a function to be called after the message is displayed; a single parameter is passed
     * to the function - a DOM element of the error box
     */
    lib.showErrorMessage = function (message, callback) {
        var html = '<div id="error"><div class="frame">'
            + '<img class="icon" alt="Error" src="../files/img/error-icon.png">'
            + '<span>' + message + '</span><a class="close-icon"><img src="../files/img/close-icon.png" /></a>'
            + '</div></div>';

        $('#content #error').hide('slide', {}, 500);
        $('#content').prepend(html);
        $('#error a.close-icon').bind('click', function () {
            $('#error').remove();
        });
        if (typeof callback === 'function') {
            callback($('#error').get(0));
        }
    };

    /**
     *
     * @param message
     * @param callback
     */
    lib.showMessage = function (message, callback) {
        var html = '<div id="notification"><div class="frame">'
                + '<img class="icon" alt="Notification" src="../files/img/info-icon.png">'
                + '<span>' + message + '</span><a class="close-icon"><img src="../files/img/close-icon.png" /></a>'
                + '</div></div>',
            timeout;


        $('#content #notification').remove();
        $('#content').prepend(html);

        $('#notification a.close-icon').bind('click', function () {
            $('#notification').hide('slide', {}, 500);
        });

        if (lib.conf.messageAutoHideInterval) {
            timeout = win.setTimeout(function () {
                $('#notification').hide('slide', {}, 500);
                win.clearTimeout(timeout);
            }, lib.conf.messageAutoHideInterval);
        }

        if (typeof callback === 'function') {
            callback($('#error').get(0));
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
                    lib.showErrorMessage(message || lib.conf.messages.failed_to_contact_server);
                }
            );

            lib.bindWithinHelper($(this).find('li.within a'), lib.conf.corpname, lib.conf.messages);
        });

        hideElem.loadHideElementStoreSimple();

        // update checkboxes in subcorp form to make (select all)/(deselect all) updated according to user's selection
        lib.autoUpdateSelectAll($('table.envelope'));

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
     *
     */
    lib.bindClicks = function () {

        popupbox.bind($('#positions-help-link'), lib.conf.messages.msg1);

        $('#corpus-desc-link').bind('click', function () {
            $('#corpus-details-box').modal({
                minHeight: 400,
                onShow : function () {
                    lib.corpusInfoBox.createCorpusInfoBox(null, function () { $.modal.close(); });
                },

                onClose : function () {
                    $.modal.close();
                }
            });
        });

        $('#corpus-citation-link a').on('click', function () {
            $('#corpus-citation-box').modal({
                minHeight: 400,
                onClose : function () {
                    $.modal.close();
                }
            });
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
        $('#error a.close-icon').bind('click', function () {
            $('#error').hide('slide', {}, 500);
        });

        // Removes the 'notification box'
        $('#notification a.close-icon').bind('click', function () {
            $('#notification').hide('slide', {}, 500);
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
            var caretPos = bonito.getCaretPosition(jqInputElement),
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
                onShow : function () {
                    $('#within-builder-modal .selection-container')
                        .append('<img src="../files/img/ajax-loader.gif" alt="loading" />');
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
                                $('#within-builder-modal .selection-container').empty().append(html);
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
     * @type {{jqMenuBar: (*|HTMLElement), jqMenuLevel2: (*|HTMLElement), getActiveSubmenuId: Function, setActiveSubmenuId: Function, closeSubmenu: Function, getHiddenSubmenu: Function, openSubmenu: Function, init: Function}}
     */
    lib.mainMenu = {

        /**
         * Wrapping element for whole main-menu
         */
        jqMenuBar : $('#menu-bar'),

        /**
         * Wrapper where sub-menu is rendered
         */
        jqMenuLevel2 : $('#menu-level-2'),

        /**
         *
         * @returns {*}
         */
        getActiveSubmenuId : function () {
            return this.jqMenuLevel2.attr('data-current-menu');
        },

        /**
         *
         * @param {string} id
         */
        setActiveSubmenuId : function (id) {
            this.jqMenuLevel2.attr('data-current-menu', id);
        },

        /**
         * @param {string} [menuId]
         */
        closeSubmenu : function (menuId) {
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
        getHiddenSubmenu : function (li) {
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
        init : function () {
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

    /**
     *
     */
    lib.loadSharedBar = function () {
        $.ajax({
            url : lib.conf.common_app_bar_url + cookies.get(lib.conf.session_cookie_name),
            data : {},
            method : 'get',
            dataType : 'html',
            success : function (data) {
                $('#common-bar').empty().append(data);
            },
            error : function () {
                // err params: jqXHR, textStatus, errorThrown
                $('#common-bar').empty().append(lib.conf.messages.error_loading_application_bar);
            }
        });
    };

    lib.updateNotifications = function () {
        var timeout;

        if ($('#notification').length > 0 && lib.conf.messageAutoHideInterval) {
            timeout = win.setTimeout(function () {
                $('#notification').hide('slide', {}, 500);
                win.clearTimeout(timeout);
            }, lib.conf.messageAutoHideInterval);
        }
    };

    /**
     *
     * @param {object} conf
     */
    lib.init = function (conf) {
        lib.conf = conf;
        lib.userSettings = {
            data : cookies.get('ui_settings'),

            cookieParams : {
                path: lib.conf.rootPath
            },

            get : function (key) {
                return lib.userSettings.data[key];
            },

            set : function (key, value) {
                lib.userSettings.data[key] = value;
                $.cookies.set('ui_settings', lib.userSettings.data, lib.userSettings.cookieParams);
            },

            del : function (key) {
                delete (lib.userSettings.data[key]);
                $.cookies.set('ui_settings', lib.userSettings.data, lib.userSettings.cookieParams);
            }
        };

        lib.misc();
        lib.bindClicks();
        lib.mainMenu.init();
        lib.updateNotifications();

        if (lib.conf.common_app_bar_url) {
            lib.loadSharedBar();
        }

        $('button').button();
        $('input[type="submit"]').button();
        $('input[type="button"]').button();
    };

    return lib;

});