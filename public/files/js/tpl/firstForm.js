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
 * This module contains functionality related directly to the first_form.tmpl template
 *
 */
define(['win', 'jquery', 'treecomponent', 'tpl/document', 'hideelem', 'simplemodal'], function (win, $, treeComponent,
                                                                                                layoutModel, hideElem,
                                                                                                _sm) {
    'use strict';

    var lib = {},
        addActiveParallelCorpus,
        removeActiveParallelCorpus,
        getActiveParallelCorpora,
        callOnParallelCorporaList,
        createAddLanguageClickHandler,
        activeParallelCorporaSettingKey = 'active_parallel_corpora';

    lib.maxEncodedParamsLength = 1500;

    /**
     *
     * @param {function} callback
     * @return returns what callback returns
     */
    callOnParallelCorporaList = function (callback) {
        var itemList = layoutModel.userSettings.get(activeParallelCorporaSettingKey) || [];

        if (typeof itemList !== 'object') {
            itemList = itemList.split(',');
        }
        return callback(itemList);
    };

    /**
     *
     */
    getActiveParallelCorpora = function () {
        return callOnParallelCorporaList(function (itemList) {
            return itemList;
        });
    };

    /**
     * @param {string} corpusName
     */
    addActiveParallelCorpus = function (corpusName) {
        callOnParallelCorporaList(function (itemList) {
            if (corpusName && $.inArray(corpusName, itemList) === -1) {
                itemList.push(corpusName);
            }
            layoutModel.userSettings.set(activeParallelCorporaSettingKey, itemList.join(','));
            if ($('div.parallel-corp-lang:visible').length > 0) {
                $('#default-view-mode').remove();
                $('#mainform').append('<input id="default-view-mode" type="hidden" name="viewmode" value="align" />');
            }
        });
    };

    /**
     * @param {string} corpusName
     */
    removeActiveParallelCorpus = function (corpusName) {
        callOnParallelCorporaList(function (itemList) {
            if ($.inArray(corpusName, itemList) >= 0) {
                itemList.splice($.inArray(corpusName, itemList), 1);
            }
            layoutModel.userSettings.set(activeParallelCorporaSettingKey, itemList.join(','));
            if ($('div.parallel-corp-lang:visible').length === 0) {
                $('#default-view-mode').remove();
            }
        });
    };

    /**
     * Creates function (i.e. you must call it first to be able to use it)
     * to handle the "add language" action.
     *
     * @param {string} forcedCorpusId optional parameter to force corpus to be added (otherwise
     * it is chosen based on "#add-searched-lang-widget select" select box value). It is useful
     * in case you want to call the handler manually.
     * @return {function} handler function
     */
    createAddLanguageClickHandler = function (forcedCorpusId) {
        return function () {
            var corpusId,
                jqHiddenStatus;

            corpusId = forcedCorpusId || $('#add-searched-lang-widget select').val();

            if (corpusId) {
                jqHiddenStatus = $('[id="qnode_' + corpusId + '"] input[name="sel_aligned"]');

                $('[id="qnode_' + corpusId + '"]').show();
                addActiveParallelCorpus(corpusId);
                $('#add-searched-lang-widget select option[value="' + corpusId + '"]').attr('disabled', true);


                jqHiddenStatus.val(jqHiddenStatus.data('corpus'));
                $('[id="qnode_' + corpusId + '"] a.close-button').on('click', function () {
                    $('[id="qnode_' + corpusId + '"]').hide();
                    jqHiddenStatus.val('');
                    removeActiveParallelCorpus(corpusId);
                    $('#add-searched-lang-widget select option[value="' + corpusId + '"]').removeAttr('disabled');

                });
                if (!$.support.cssFloat) {
                    // refresh content in IE < 9
                    $('#content').css('overflow', 'visible').css('overflow', 'auto');
                }
            }
        };
    };

    /**
     *
     */
    lib.misc = function () {
        // let's override the focus
        layoutModel.conf.focus = function () {
            var target = null;
            $('#mainform tr input[type="text"]').each(function () {
                if ($(this).css('display') !== 'none') {
                    target = $(this);
                    return false;
                }
            });
            return target;
        };

        treeComponent.createTreeComponent($('form[action="first"] select[name="corpname"]'),
            {clickableText: true}, layoutModel.updForm);
        // initial query selector setting (just like when user changes it manually)
        hideElem.cmdSwitchQuery($('#queryselector').get(0), layoutModel.conf.queryTypesHints, layoutModel.userSettings);

        // open currently used languages for parallel corpora
        $.each(getActiveParallelCorpora(), function (i, item) {
            createAddLanguageClickHandler(item)();
        });
    };

    lib.updateFieldsets = function () {
        var jqLink = $('a.form-extension-switch'),
            jqFieldset,
            elmStatus;

        jqLink.each(function () {
            jqFieldset = $(this).closest('fieldset');
            elmStatus = layoutModel.userSettings.get($(this).data('box-id'));

            if (elmStatus === true) {
                jqFieldset.removeClass('inactive');
                jqFieldset.find('div.contents').show();
                jqFieldset.find('.status').empty().html('&#8593;');
                jqLink.attr('title', layoutModel.conf.messages.click_to_hide);

            } else {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('.status').empty().html('&#8595;');
                jqLink.attr('title', layoutModel.conf.messages.click_to_expand);

            }
        });
    };

    /**
     *
     */
    lib.bindStaticElements = function () {
        $('a.form-extension-switch').on('click', function (event) {
            var jqTriggerLink = $(event.target),
                jqFieldset = jqTriggerLink.closest('fieldset');

            jqFieldset.toggleClass('inactive');
            if (jqFieldset.hasClass('inactive')) {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('.status').empty().html('&#8595;');
                jqTriggerLink.attr('title', layoutModel.conf.messages.click_to_expand);
                layoutModel.userSettings.set(jqTriggerLink.data('box-id'), false);

            } else {
                jqFieldset.find('div.contents').show();
                jqFieldset.find('.status').empty().html('&#8593;');
                jqTriggerLink.attr('title', layoutModel.conf.messages.click_to_hide);
                layoutModel.userSettings.set(jqTriggerLink.data('box-id'), true);
            }
        });

        // context-switch TODO

        $('#switch_err_stand').on('click', function () {
            if ($(this).text() === layoutModel.conf.labelStdQuery) {
                $('#qnode').show();
                $('#cup_err_menu').hide();
                $(this).text(layoutModel.conf.labelErrorQuery);
                layoutModel.userSettings.set("errstdq", "std");

            } else {
                $('#qnode').hide();
                $('#cup_err_menu').show();
                $(this).text(layoutModel.conf.labelStdQuery);
                layoutModel.userSettings.set("errstdq", "err");
            }
        });

        $('#make-concordance-button').on('click', function (event) {
            var data = $('#mainform').serialize().split('&'),
                cleanData = '',
                unusedLangs = {},
                belongsToUnusedLanguage;

            $('.parallel-corp-lang').each(function () {
                if ($(this).css('display') === 'none') {
                    unusedLangs[$(this).attr('id').substr(6)] = true;
                }
            });

            belongsToUnusedLanguage = function (paramName) {
                var p;

                for (p in unusedLangs) {
                    if (unusedLangs.hasOwnProperty(p)) {
                        if (paramName.indexOf(p) > -1) {
                            return true;
                        }
                    }
                }
                return false;
            };

            $.each(data, function (i, val) {
                var items = val.split('=', 2);
                if (items.length === 2 && items[1] && !belongsToUnusedLanguage(items[0])) {
                    cleanData += '&' + items[0] + '=' + items[1];
                }
            });

            if (cleanData.length > lib.maxEncodedParamsLength) {
                $('#make-concordance-button').parent().append('<div id="alt-form"><p>'
                    + layoutModel.conf.messages.too_long_condition + '</p>'
                    + '<button id="alt-form-open-subcorp-form" type="submit">'
                    + layoutModel.conf.messages.open_the_subcorpus_form + '</button>'
                    + '<button id="alt-form-cancel" type="button">' + layoutModel.conf.messages.cancel + '</button></div>');

                $('#alt-form-open-subcorp-form').on('click', function () {
                    $('#alt-form').remove();
                    $(win).unload(function () {
                        $.modal.close();
                        $('#mainform').attr('method', 'GET').action('first');
                    });
                    $('#mainform').attr('method', 'POST').attr('action', 'subcorp_form').submit();
                });

                $('#alt-form-cancel').on('click', function () {
                    $.modal.close();
                });

                $('#alt-form').modal({
                    onClose : function () {
                        $.modal.close();
                        $('#alt-form').remove();
                    },
                    minHeight : 120
                });

                event.stopPropagation();
                return false;
            }
        });
    };

    /**
     *
     */
    lib.bindParallelCorporaCheckBoxes = function () {

        $('#add-searched-lang-widget button[type="button"]').each(function () {
            $(this).on('click', createAddLanguageClickHandler());
        });
        $('input[name="sel_aligned"]').each(function () {
            if ($(this).val()) {
                $('select[name="pcq_pos_neg_' + $(this).data('corpus') + '"],[id="qtable_' + $(this).data('corpus') + '"]').show();
            }
        });
    };

    /**
     *
     */
    lib.showCupMenu = function () {
        if (layoutModel.userSettings.get('errstdq') === 'std') {
            $('#cup_err_menu').hide();
            $('#switch_err_stand').text(layoutModel.conf.messages.labelErrorQuery);

        } else {
            $('#qnode').hide();
        }
    };

    /**
     *
     * @param {object} conf
     */
    lib.init = function (conf) {
        layoutModel.init(conf);
        lib.misc();
        lib.bindStaticElements();
        lib.bindParallelCorporaCheckBoxes();
        lib.updateFieldsets();
    };

    return lib;
});