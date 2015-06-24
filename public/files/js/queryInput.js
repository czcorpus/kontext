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
define(['jquery', 'win', 'vendor/jquery.cookie', 'popupbox', 'conf', 'tagbuilder', 'util', 'plugins/queryStorage'], function ($,
        win, cookies, popupBox, conf, tagbuilder, util, queryStorage) {
    'use strict';

    var lib = {};

    /**
     * @param {jQuery|HTMLElement|String} inputElm
     * @param {jQuery|HTMLElement|String} triggerElm
     * @param {pluginApi} pluginApi
     */
    function bindTagHelper(inputElm, triggerElm, pluginApi) {
        tagbuilder.bindTextInputHelper(
            pluginApi,
            triggerElm,
            {
                inputElement: $(inputElm),
                widgetElement: 'tag-widget',
                modalWindowElement: 'tag-builder-modal',
                insertTagButtonElement: 'insert-tag-button',
                tagDisplayElement: 'tag-display',
                resetButtonElement: 'reset-tag-button'
            },
            {
                width: '556px',
                useNamedCheckboxes: false,
                allowMultipleOpenedBoxes: false
            },
            function (message) {
                pluginApi.showMessage('error', message || conf.messages.failed_to_contact_server);
            }
        );
    }

    /**
     *
     * @param {jQuery} jqLinkElement
     * @param {pluginApi} pluginApi
     */
    function bindWithinHelper(jqLinkElement, pluginApi) {
        var jqInputElement = $('#' + jqLinkElement.data('bound-input')),
            clickAction,
            buttonEnterAction;

        clickAction = function (box) {
            return function () {
                var structAttr,
                    within,
                    bef,
                    aft,
                    caretPos = util.getCaretPosition(jqInputElement);

                structAttr = $('#within-structattr').val().split('.');
                within = 'within <' + structAttr[0] + ' ' + structAttr[1] + '="' + $('#within-value').val() + '" />';
                bef = jqInputElement.val().substring(0, caretPos);
                aft = jqInputElement.val().substring(caretPos);

                jqInputElement.val(bef + within + aft);
                jqInputElement.focus();
                $(win.document).off('keypress.withinBoxEnter', buttonEnterAction);
                box.close();
            };
        };

        buttonEnterAction = function (box) {
            return function (event) {
                if (event.which === 13) {
                    clickAction(box)(event);
                    event.stopPropagation();
                    event.preventDefault();
                }
            };
        };

        popupBox.bind(jqLinkElement,
            function (box, finalize) {
                var loaderGIF,
                    jqWithinModal = $('#within-builder-modal');

                if ($('#within-structattr').length > 0) {
                    jqWithinModal.css('display', 'block');
                    box.importElement(jqWithinModal);
                    $('#within-insert-button').off('click');
                    $('#within-insert-button').one('click', clickAction(box));
                    $(win.document).off('keypress.withinBoxEnter');
                    $(win.document).on('keypress.withinBoxEnter', buttonEnterAction(box));
                    finalize();

                } else {
                    loaderGIF = pluginApi.appendLoader(box.getRootElement());

                    pluginApi.ajax({
                        url: pluginApi.getConf('rootPath') + 'corpora/ajax_get_structs_details?corpname='
                                + pluginApi.getConf('corpname'),
                        data: {},
                        method: 'get',
                        dataType: 'json',
                        success: function (data) {
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
                            loaderGIF.remove();

                            box.importElement(jqWithinModal);
                            jqWithinModal.find('.inputs').prepend(html);
                            jqWithinModal.css('display', 'block');

                            $('#within-insert-button').one('click', clickAction(box));
                            $(win.document).on('keypress.withinBoxEnter', buttonEnterAction(box));

                            finalize();
                        },
                        error: function () {
                            box.close();
                            pluginApi.showMessage('error', conf.failed_to_contact_server);
                            finalize();
                        }
                    });
                }
            },
            {
                closeIcon : true,
                type : 'plain',
                timeout : null,
                onClose : function () {
                    $(win.document).off('keypress.withinBoxEnter');
                }
            });
    }

    /**
     *
     */
    lib.bindQueryHelpers = function (pluginApi) {
        $('.query-area .cql-input').each(function () {
            var blockWrapper = $(this).closest('td');

            bindTagHelper($(this), blockWrapper.find('.insert-tag a'), pluginApi);
            bindWithinHelper(blockWrapper.find('li.within a'), pluginApi);
        });

        lib.initVirtualKeyboard($('#mainform table.form tr:visible td > .spec-chars'));
    };


    /**
     * Switches between query modes (iquery, cql, lemma,...). If used within event handlers
     * then the 'source' argument must be the respective event (jQuery.Event). If used manually
     * (e.g. to init the form) then query type selection input (currently it is a SELECT element)
     * must be used.
     *
     * @param layoutModel
     * @param {HTMLElement, jQuery.Event} source
     * @param hints
     */
    lib.cmdSwitchQuery = function (layoutModel, source, hints) {
        var jqQs,
            newidCom,
            newid,
            jqFocusElem,
            oldval,
            elementId,
            elementIdCom,
            jqOldElem,
            jqElem,
            jqQueryTypeHint;

        if (source.hasOwnProperty('currentTarget')) {
            jqQs = $(source.currentTarget);

        } else { // called 'manually'
            jqQs = $(source);
        }

        hints = hints || {};
        newidCom = jqQs.val();
        newid = jqQs.val() + jqQs.data('parallel-corp');
        jqFocusElem = $('#' + newidCom.substring(0, newidCom.length - 3) + jqQs.data('parallel-corp'));
        oldval = jqFocusElem.val();

        $('#conc-form-clear-button').unbind('click');
        $('#conc-form-clear-button').bind('click', function () {
            lib.clearForm($('#mainform'));
        });

        jqQs.find('option').each(function () {
            elementId = $(this).val() + jqQs.data('parallel-corp');
            elementIdCom = $(this).val().substring(0, $(this).val().length - 3);
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
                    'top': 'attached-bottom',
                    'fontSize': '10pt',
                    width: '30%'
                });

        } else {
            $('#queryselector').parent().find('.context-help').remove();
        }
        jqFocusElem.focus();

        if (source.hasOwnProperty('currentTarget')) { // reset plug-in only if this is called as part of some event handler
            $('.query-area input.history, .query-area textarea.history').each(function () {
                if (typeof $(this).data('plugin') === 'object') {
                    layoutModel.getPlugin('queryStorage').detach(this);
                }
            });
            layoutModel.getPlugin('queryStorage').reset();
        }
        lib.initVirtualKeyboard(jqFocusElem);
    };

    /**
     *
     * @param f
     */
    lib.clearForm = function (f) {
        var prevRowType = $('#queryselector').val();

        if ($('#error').length === 0) {
            $('#error').css('display', 'none');
        }
        $(f).find('input,select,textarea').each(function () {
            if ($(this).data('ignore-reset') !== '1') {
                if ($(this).attr('type') === 'text') {
                    $(this).val('');
                }
                if ($(this).prop('tagName').toLowerCase() === 'textarea') {
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
    };

    /**
     * @param {HTMLElement|string|jQuery} input element the VirtualKeyboard binds to
     */
    lib.initVirtualKeyboard = function (elm) {
        var jqElm = $(elm);

        if (jqElm.length > 0) {
            win.VKI_close(jqElm.get(0));
            win.VKI_attach(jqElm.get(0), jqElm.closest('tr').find('.virtual-keyboard-trigger').get());
        }
    };

    /**
     *
     * @param area
     * @param parentForm
     */
    lib.initCqlTextarea = function (area, parentForm) {
        $(area).on('keyup', function (evt) {
            if (!evt.shiftKey && evt.keyCode === 13) {
                evt.preventDefault();
                $(parentForm).submit();
            }
        });
    };

    /**
     * @param {{}} pluginApi
     * @param {{}} userSettings
     */
    lib.bindQueryFieldsetsEvents = function (pluginApi, userSettings) {
        $('a.form-extension-switch').on('click', function (event) {
            var jqTriggerLink = $(event.currentTarget),
                jqFieldset = jqTriggerLink.closest('fieldset');

            jqFieldset.toggleClass('inactive');
            if (jqFieldset.hasClass('inactive')) {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('.status').attr('src', '../files/img/expand.png')
                    .attr('data-alt-img', '../files/img/expand_s.png')
                    .attr('alt', pluginApi.translate('click_to_expand'));
                jqTriggerLink.attr('title', pluginApi.translate('click_to_expand'));
                jqFieldset.find('div.desc').show();
                userSettings.set(jqTriggerLink.data('box-id'), false);

            } else {
                jqFieldset.find('div.contents').show();
                jqFieldset.find('.status').attr('src', '../files/img/collapse.png')
                    .attr('data-alt-img', '../files/img/collapse_s.png')
                    .attr('alt', pluginApi.translate('click_to_hide'));
                jqTriggerLink.attr('title', pluginApi.translate('click_to_hide'));
                jqFieldset.find('div.desc').hide();
                userSettings.set(jqTriggerLink.data('box-id'), true);
            }
            $.each(pluginApi.queryFieldsetToggleEvents, function (i, fn) {
                fn(jqFieldset);
            });
        });
    };

    /**
     *
     * @returns {*}
     */
    lib.updateToggleableFieldsets = function (pluginApi, userSettings) {
        var jqLink = $('a.form-extension-switch'),
            jqFieldset,
            elmStatus,
            defer = $.Deferred(); // currently, this is synchronous

        jqLink.each(function () {
            jqFieldset = $(this).closest('fieldset');
            elmStatus = userSettings.get($(this).data('box-id'));

            if (elmStatus === true) {
                jqFieldset.removeClass('inactive');
                jqFieldset.find('div.contents').show();
                jqFieldset.find('div.desc').hide();
                jqFieldset.find('.status').attr('src', '../files/img/collapse.png')
                    .attr('data-alt-img', '../files/img/collapse_s.png')
                    .attr('alt', pluginApi.translate('click_to_hide'));
                jqLink.attr('title', pluginApi.translate('click_to_hide'));

            } else {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('div.desc').show();
                jqFieldset.find('.status').attr('src', '../files/img/expand.png')
                    .attr('data-alt-img', '../files/img/expand_s.png')
                    .attr('alt', pluginApi.translate('click_to_expand'));
                jqLink.attr('title', pluginApi.translate('click_to_expand'));
            }
        });
        defer.resolve();
        return defer.promise();
    };

    function isPossibleQueryTypeMismatch(inputElm, queryTypeElm) {
        var query = $(inputElm).val(),
            queryType = $(queryTypeElm).find('option:selected').data('type');

        return queryType !== 'cql' && (/^(\s*"[^\"]+")+$/.exec(query) || /\[[^\]]*\]/.exec(query))
            || queryType === 'cql' && (!/^(\s*"[^\"]+")+$/.exec(query) && !/\[[^\]]*\]/.exec(query));
    }

    /**
     *
     * @param submitElm
     * @param layoutModel
     */
    lib.bindBeforeSubmitActions = function (submitElm, layoutModel) {
        $(submitElm).on('click', function (event) {
            var currQueryElm = $('#mainform .query-area .query:visible').get(0),
                queryTypeElm = $('#mainform select.qselector').get(0),
                currQuery = $(currQueryElm).val(),
                data = $('#mainform').serialize().split('&'),
                cleanData = '',
                unusedLangs = {};

            $('.parallel-corp-lang').each(function () {
                if ($(this).css('display') === 'none') {
                    unusedLangs[$(this).attr('id').substr(6)] = true;
                }
            });

            function belongsToUnusedLanguage(paramName) {
                var p;

                for (p in unusedLangs) {
                    if (unusedLangs.hasOwnProperty(p)) {
                        if (paramName.indexOf(p) > -1) {
                            return true;
                        }
                    }
                }
                return false;
            }

            $.each(data, function (i, val) {
                var items = val.split('=', 2);
                if (items.length === 2 && items[1] && !belongsToUnusedLanguage(items[0])) {
                    cleanData += '&' + items[0] + '=' + items[1];
                }
            });

            if (isPossibleQueryTypeMismatch(currQueryElm, queryTypeElm)) {
                $('#mainform select.qselector').addClass('error-input');
                $('.query-area input.query:visible, .query-area textarea.query:visible')
                        .addClass('error-input');
                if (!win.confirm(layoutModel.translate('query_type_mismatch'))) {
                    event.stopPropagation();
                    event.preventDefault();
                    return false;
                }

            } else if (cleanData.length > lib.maxEncodedParamsLength) {
                $('#mainform').attr('method', 'POST');
            }
        });
    };

    /**
     * Generates PluginApi extended by bindFieldsetToggleEvent() method
     * required in 'first_form' and 'filter_form' actions
     *
     * @param pluginApi
     */
    lib.extendedApi = function (pluginApi) {
        var ExtendedApi = function () {
            this.queryFieldsetToggleEvents = [];
        };

        ExtendedApi.prototype = pluginApi;

        ExtendedApi.prototype.bindFieldsetToggleEvent = function (fn) {
            this.queryFieldsetToggleEvents.push(fn);
        };

        return new ExtendedApi();
    };

    return lib;
});