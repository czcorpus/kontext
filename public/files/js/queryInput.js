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
define(['jquery', 'win', 'vendor/jquery.cookie', 'popupbox', 'conf', 'tagbuilder', 'util',
            'plugins/queryStorage/init', 'vendor/virtual-keyboard'], function ($, win, cookies, popupBox,
                                                                               conf, tagbuilder, util,
                                                                               queryStorage, virtKeyboard) {
    'use strict';

    var lib = {};

    function QueryFormTweaks(pluginApi, userSettings, formElm, pluginFactory) {
        this.pluginApi = pluginApi;
        this.userSettings = userSettings;
        this.formElm = formElm;
        this.pluginFactory = pluginFactory;
        this.maxEncodedParamsLength = 1500;
    }

    /**
     * @param {jQuery|HTMLElement|String} inputElm
     * @param {jQuery|HTMLElement|String} triggerElm
     */
    QueryFormTweaks.prototype.bindTagHelper = function (inputElm, triggerElm) {
        var self = this;

        tagbuilder.bindTextInputHelper(
            this.pluginApi,
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
                self.pluginApi.showMessage('error',
                    message || self.pluginApi.translate('global__failed_to_contact_server'));
            }
        );
    };

    /**
     * @param {jQuery} jqLinkElement
     */
    QueryFormTweaks.prototype.bindWithinHelper = function(jqLinkElement) {
        var jqInputElement = $('#' + jqLinkElement.data('bound-input')),
            clickAction,
            buttonEnterAction,
            self = this;

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
                    $('#within-insert-button').off('click')
                            .one('click', clickAction(box));
                    $(win.document).off('keypress.withinBoxEnter');
                    $(win.document).on('keypress.withinBoxEnter', buttonEnterAction(box));
                    finalize();

                } else {
                    loaderGIF = self.pluginApi.appendLoader(box.getRootElement());

                    self.pluginApi.ajax({
                        url: self.pluginApi.getConf('rootPath') + 'corpora/ajax_get_structs_details?corpname='
                                + self.pluginApi.getConf('corpname'),
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
                            self.pluginApi.showMessage('error',
                                self.pluginApi.translate('global__failed_to_contact_server'));
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
    };

    /**
     *
     */
    QueryFormTweaks.prototype.bindQueryHelpers = function () {
        var self = this;
        $('.query-area .cql-input').each(function () {
            var blockWrapper = $(this).closest('td');

            self.bindTagHelper($(this), blockWrapper.find('.insert-tag a'));
            self.bindWithinHelper(blockWrapper.find('li.within a'));
        });
        this.initVirtualKeyboard($(this.formElm).find('tr:visible .spec-chars'));
    };


    QueryFormTweaks.prototype.textareaSubmitOverride = function () {
        var jqMainForm = $(this.formElm),
            self = this;

        jqMainForm.find('.query-area textarea').each(function (i, area) {
            self.initCqlTextarea(area, jqMainForm);
        });
    };

    QueryFormTweaks.prototype.textareaHints = function () {
        this.pluginApi.renderReactComponent(this.pluginApi.getViews().QueryHints,
            $(this.formElm).find('.query-area .query-hints').get(0),
                {hintText: this.pluginApi.getStores().queryHintStore.getHint()});
    };


    /**
     * Switches between query modes (iquery, cql, lemma,...). If used within event handlers
     * then the 'source' argument must be the respective event (jQuery.Event). If used manually
     * (e.g. to init the form) then query type selection input (currently it is a SELECT element)
     * must be used.
     *
     * @param {HTMLElement, jQuery.Event} source
     * @param hints
     */
    QueryFormTweaks.prototype.cmdSwitchQuery = function (source, hints) {
        var jqQs,
            newidCom,
            newid,
            jqFocusElem,
            oldval,
            elementId,
            elementIdCom,
            jqOldElem,
            jqElem,
            jqQueryTypeHint,
            self = this;

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

        $('#conc-form-clear-button').unbind('click')
                .bind('click', function () {
            self.clearForm($(self.formElm));
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
            jqQueryTypeHint = $('<a href="#" class="context-help">'
                + '<img class="over-img" src="../files/img/question-mark.png" '
                + 'data-alt-img="../files/img/question-mark_s.png" /></a>');
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
                    self.pluginFactory('queryStorage').detach(this);
                }
            });
            self.pluginFactory('queryStorage').reset();
        }
        this.initVirtualKeyboard(jqFocusElem);
    };

    /**
     *
     * @param f
     */
    QueryFormTweaks.prototype.clearForm = function (f) {
        var jqQuerySel = $('#queryselector'),
            prevRowType = jqQuerySel.val(),
            jqErr = $('#error');

        if (jqErr.length === 0) {
            jqErr.css('display', 'none');
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
        jqQuerySel.val(prevRowType);
    };

    /**
     * @param elm
     */
    QueryFormTweaks.prototype.initVirtualKeyboard = function (elm) {
        var jqElm = $(elm);

        if (jqElm.length > 0) {
            win.VKI_close(jqElm.get(0));
            win.VKI_attach(jqElm.get(0), jqElm.closest('tr').find('.virtual-keyboard-trigger').get());
        }
    };


    /**
     * Disables (if state === true) or enables (if state === false)
     * all empty/unused form fields. This is used to reduce number of passed parameters,
     * especially in case of parallel corpora.
     *
     * @param formElm
     * @param state
     */
    function setAlignedCorporaFieldsDisabledState(formElm, state) {
        var stateStr = state.toString();

        $(formElm).find('input[name="sel_aligned"]').each(function () {
            var corpn = $(this).data('corpus'), // beware - corp may contain special characters colliding with jQuery
                queryType;

            // non empty value of 'sel_aligned' (hidden) input indicates that the respective corpus is active
            if (!$(this).val()) {
                $('select[name="pcq_pos_neg_' + corpn + '"]').attr('disabled', stateStr);
                $('select[name="queryselector_' + corpn + '"]').attr('disabled', stateStr);
                $('[id="qnode_' + corpn + '"]').find('input').attr('disabled', stateStr);
                $(this).attr('disabled', stateStr);

                $(this).parent().find('input[type="text"]').each(function () {
                    $(this).attr('disabled', stateStr);
                });

            } else {
                queryType = $(this).parent().find('[id="queryselector_' + corpn + '"]').val();
                queryType = queryType.substring(0, queryType.length - 3);
                $('[id="qnode_' + corpn + '"]').find('input[type="text"]').each(function () {
                    if (!$(this).hasClass(queryType + '-input')) {
                        $(this).attr('disabled', stateStr);
                    }
                });
            }
        });
        // now let's disable unused corpora completely
        $('.parallel-corp-lang').each(function () {
            if ($(this).css('display') === 'none') {
                $(this).find('input,select').attr('disabled', stateStr);
            }
        });
    }

    /**
     *
     */
    QueryFormTweaks.prototype.initQuerySwitching = function () {
        var queryTypeHints = this.pluginApi.getConf('queryTypesHints'),
            self = this;

        $('select.qselector').each(function () {
            $(this).on('change', function (event) {
                self.cmdSwitchQuery(event, queryTypeHints);
            });

            // we have to initialize inputs properly (unless it is the default (as loaded from server) state)
            if ($(this).val() !== 'iqueryrow') {
                self.cmdSwitchQuery($(this).get(0), queryTypeHints);
            }
        });
    };

    /**
     *
     */
    QueryFormTweaks.prototype.fixFormSubmit = function () {
        var self = this;
        // remove empty and unused parameters from URL before form submit
        $(this.formElm).submit(function () { // run before submit
            setAlignedCorporaFieldsDisabledState(self.formElm, true);
            $(win).on('unload', function () {
                setAlignedCorporaFieldsDisabledState(self.formElm, false);
            });
        });
    };

    /**
     *
     * @param area
     * @param parentForm
     */
    QueryFormTweaks.prototype.initCqlTextarea = function (area, parentForm) {
        $(area).on('keydown', function (evt) {
            if (!evt.shiftKey && evt.keyCode === 13) {
                evt.preventDefault();
                $(parentForm).submit();
            }
        });
    };

    /**
     */
    QueryFormTweaks.prototype.bindQueryFieldsetsEvents = function () {
        var self = this;

        $('a.form-extension-switch').on('click', function (event) {
            var jqTriggerLink = $(event.currentTarget),
                jqFieldset = jqTriggerLink.closest('fieldset');

            jqFieldset.toggleClass('inactive');
            if (jqFieldset.hasClass('inactive')) {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('.status').attr('src', '../files/img/expand.png')
                    .attr('data-alt-img', '../files/img/expand_s.png')
                    .attr('alt', self.pluginApi.translate('global__click_to_expand'));
                jqTriggerLink.attr('title', self.pluginApi.translate('global__click_to_expand'));
                jqFieldset.find('div.desc').show();
                self.userSettings.set(jqTriggerLink.data('box-id'), false);

            } else {
                jqFieldset.find('div.contents').show();
                jqFieldset.find('.status').attr('src', '../files/img/collapse.png')
                    .attr('data-alt-img', '../files/img/collapse_s.png')
                    .attr('alt', self.pluginApi.translate('global__click_to_hide'));
                jqTriggerLink.attr('title', self.pluginApi.translate('global__click_to_hide'));
                jqFieldset.find('div.desc').hide();
                self.userSettings.set(jqTriggerLink.data('box-id'), true);
            }
            $.each(self.pluginApi.queryFieldsetToggleEvents, function (i, fn) {
                fn(jqFieldset);
            });
        });
    };

    /**
     *
     * @returns {*}
     */
    QueryFormTweaks.prototype.updateToggleableFieldsets = function () {
        var jqLink = $('a.form-extension-switch'),
            jqFieldset,
            elmStatus,
            defer = $.Deferred(), // currently, this is synchronous
            self = this;

        jqLink.each(function () {
            jqFieldset = $(this).closest('fieldset');
            elmStatus = self.userSettings.get($(this).data('box-id'));

            if (elmStatus === true) {
                jqFieldset.removeClass('inactive');
                jqFieldset.find('div.contents').show();
                jqFieldset.find('div.desc').hide();
                jqFieldset.find('.status').attr('src', '../files/img/collapse.png')
                    .attr('data-alt-img', '../files/img/collapse_s.png')
                    .attr('alt', self.pluginApi.translate('global__click_to_hide'));
                jqLink.attr('title', self.pluginApi.translate('global__click_to_hide'));

            } else {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('div.desc').show();
                jqFieldset.find('.status').attr('src', '../files/img/expand.png')
                    .attr('data-alt-img', '../files/img/expand_s.png')
                    .attr('alt', self.pluginApi.translate('global__click_to_expand'));
                jqLink.attr('title', self.pluginApi.translate('global__click_to_expand'));
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
     * @param submitElm
     */
    QueryFormTweaks.prototype.bindBeforeSubmitActions = function (submitElm) {
        var self = this;

        $(this.formElm).find(submitElm).on('click', function (event) { // TODO
            var currQueryElm = $(self.formElm).find('.query-area .query:visible').get(0),
                queryTypeElm = $(self.formElm).find('select.qselector').get(0),
                data = $(self.formElm).serialize().split('&'),
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
                this.formElm.find('select.qselector').addClass('error-input');
                $('.query-area input.query:visible, .query-area textarea.query:visible')
                        .addClass('error-input');
                if (!win.confirm(self.pluginApi.translate('global__query_type_mismatch'))) {
                    event.stopPropagation();
                    event.preventDefault();
                    return false;
                }

            } else if (cleanData.length > self.maxEncodedParamsLength) {
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

    lib.QueryFormTweaks = QueryFormTweaks;

    return lib;
});