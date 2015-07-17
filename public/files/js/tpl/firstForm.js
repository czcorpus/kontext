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
define(['win', 'jquery', 'plugins/corparch/init', 'tpl/document', 'queryInput', 'plugins/queryStorage/init',
    'plugins/liveAttributes/init', 'conclines'], function (win, $, corplistComponent, layoutModule, queryInput, queryStorage,
                                                           liveAttributes, conclines) {
    'use strict';

    var lib = {},
        activeParallelCorporaSettingKey = 'active_parallel_corpora',
        clStorage = conclines.openStorage();

    lib.maxEncodedParamsLength = 1500;
    lib.corplistComponent = null;
    lib.starComponent = null;
    lib.layoutModel = null;
    lib.extendedApi = null;
    lib.onAddParallelCorpActions = [];
    lib.onRemoveParallelCorpActions = [];
    lib.onBeforeRemoveParallelCorpActions = [];
    lib.onSubcorpChangeActions = [];
    lib.alignedCorpora = [];

    lib.getConf = function (name) {
        return lib.layoutModel.getConf(name);
    };

    lib.translate = function (msg) {
        return lib.layoutModel.translate(msg);
    };

    lib.createActionUrl = function (path) {
        return lib.layoutModel.createActionUrl(path);
    };

    lib.createStaticUrl = function (path) {
        return lib.layoutModel.createStaticUrl(path);
    };

    lib.showMessage = function (type, message, callback) {
        return lib.layoutModel.showMessage(type, message, callback);
    };

    /**
     * Registers a callback which is invoked after an aligned
     * corpus is added to the query page (i.e. firstForm's
     * internal actions are performed first then the list of
     * registered callbacks).
     *
     * @param fn:(corpname:string)=>void
     */
    lib.registerOnAddParallelCorpAction = function (fn) {
        lib.onAddParallelCorpActions.push(fn);
    };

    /**
     * Registers a callback which is invoked AFTER an aligned
     * corpus is removed from the query page (i.e. firstForm's
     * internal actions are performed first then the list of
     * registered callbacks).
     *
     * @param fn:(corpname:string)=>void
     */
    lib.registerOnRemoveParallelCorpAction = function (fn) {
        lib.onRemoveParallelCorpActions.push(fn);
    };

    /**
     * Registers a callback which is invoked BEFORE an aligned
     * corpus is removed from the query page (i.e. firstForm's
     * internal actions are performed this actions).
     *
     * @param fn
     */
    lib.registerOnBeforeRemoveParallelCorpAction = function (fn) {
        lib.onBeforeRemoveParallelCorpActions.push(fn);
    };

    /**
     * Registers a callback which is invoked after the subcorpus
     * selection element is changed. It guarantees that all the
     * firstForm's internal actions are performed before this
     * externally registered ones.
     *
     * @param fn:(subcname:string)=>void
     */
    lib.registerOnSubcorpChangeAction = function (fn) {
        lib.onSubcorpChangeActions.push(fn);
    };

    lib.extendedApi = null;
    lib.layoutModel = null;

    /**
     *
     */
    function getActiveParallelCorpora() {
        return lib.alignedCorpora;
    }

    /**
     * @param {string} corpusName
     */
    function addActiveParallelCorpus(corpusName) {
        if (corpusName && $.inArray(corpusName, lib.alignedCorpora) === -1) {
            lib.alignedCorpora.push(corpusName);
        }
        if ($('div.parallel-corp-lang:visible').length > 0) {
            $('#default-view-mode').remove();
            $('#mainform').append('<input id="default-view-mode" type="hidden" name="viewmode" value="align" />');
        }
        $.each(lib.onAddParallelCorpActions, function (i, fn) {
            fn.call(lib, corpusName);
        });
    }

    /**
     * @param {string} corpusName
     */
    function removeActiveParallelCorpus(corpusName) {
        $.each(lib.onBeforeRemoveParallelCorpActions, function (i, fn) {
            fn.call(lib, corpusName);
        });
        if ($.inArray(corpusName, lib.alignedCorpora) >= 0) {
                lib.alignedCorpora.splice($.inArray(corpusName, lib.alignedCorpora), 1);
        }
        if ($('div.parallel-corp-lang:visible').length === 0) {
            $('#default-view-mode').remove();
        }
        $.each(lib.onRemoveParallelCorpActions, function (i, fn) {
            fn.call(lib, corpusName);
        });
    }

    /**
     * Creates function (i.e. you must call it first to be able to use it)
     * to handle the "add language" action.
     *
     * @param {string} [forcedCorpusId] optional parameter to force corpus to be added (otherwise
     * it is chosen based on "#add-searched-lang-widget select" select box value). It is useful
     * in case you want to call the handler manually.
     * @return {function} handler function
     */
    function createAddLanguageClickHandler(forcedCorpusId) {
        return function () {
            var corpusId,
                jqHiddenStatus,
                jqNewLangNode,
                searchedLangWidgetOpt;

            corpusId = forcedCorpusId || $('#add-searched-lang-widget select').val();

            if (corpusId) {
                searchedLangWidgetOpt = $('#add-searched-lang-widget').find('select option[value="' + corpusId + '"]');
                jqHiddenStatus = $('[id="qnode_' + corpusId + '"] input[name="sel_aligned"]');
                jqNewLangNode = $('[id="qnode_' + corpusId + '"]');

                if (jqNewLangNode.length > 0) {
                    jqNewLangNode.show();
                    addActiveParallelCorpus(corpusId);
                    searchedLangWidgetOpt.attr('disabled', true);


                    jqHiddenStatus.val(jqHiddenStatus.data('corpus'));
                    jqNewLangNode.find('a.close-button').on('click', function () {
                        $('[id="qnode_' + corpusId + '"]').hide();
                        jqHiddenStatus.val('');
                        removeActiveParallelCorpus(corpusId);
                        searchedLangWidgetOpt.removeAttr('disabled');
                       lib.layoutModel.resetPlugins();
                    });

                    queryInput.initVirtualKeyboard(jqNewLangNode.find('table.form .query-area .spec-chars').get(0));

                    if (!$.support.cssFloat) {
                        // refresh content in IE < 9
                        $('#content').css('overflow', 'visible').css('overflow', 'auto');
                    }
                }
               lib.layoutModel.resetPlugins();
            }
        };
    }

    /**
     * @todo rename/refactor this stuff
     */
    lib.misc = function () {
        lib.corplistComponent = corplistComponent.create(
            $('form[action="first"] select[name="corpname"]').get(0),
            lib,
            {formTarget: 'first_form'}
        );

        // initial query selector setting (just like when user changes it manually)
        queryInput.cmdSwitchQuery(lib.layoutModel, $('#queryselector').get(0), lib.layoutModel.conf.queryTypesHints);

        // open currently used languages for parallel corpora
        $.each(getActiveParallelCorpora(), function (i, item) {
            createAddLanguageClickHandler(item)();
        });
    };

    /**
     * Updates toggleable fieldsets to the state user set
     * last time he used the form.
     *
     * @returns {$.Deferred.Promise} a promise object
     */
    lib.updateToggleableFieldsets = function () {
        var jqLink = $('a.form-extension-switch'),
            jqFieldset,
            elmStatus,
            defer = $.Deferred(); // currently, this is synchronous

        jqLink.each(function () {
            jqFieldset = $(this).closest('fieldset');
            elmStatus = lib.layoutModel.userSettings.get($(this).data('box-id'));

            if (elmStatus === true) {
                jqFieldset.removeClass('inactive');
                jqFieldset.find('div.contents').show();
                jqFieldset.find('div.desc').hide();
                jqFieldset.find('.status').attr('src', '../files/img/collapse.png')
                    .attr('data-alt-img', '../files/img/collapse_s.png')
                    .attr('alt', lib.layoutModel.conf.messages.click_to_hide);
                jqLink.attr('title', lib.layoutModel.conf.messages.click_to_hide);

            } else {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('div.desc').show();
                jqFieldset.find('.status').attr('src', '../files/img/expand.png')
                    .attr('data-alt-img', '../files/img/expand_s.png')
                    .attr('alt', lib.layoutModel.conf.messages.click_to_expand);
                jqLink.attr('title', lib.layoutModel.conf.messages.click_to_expand);
            }
        });
        lib.layoutModel.mouseOverImages();
        defer.resolve();
        return defer.promise();
    };

    lib.bindStaticElements = function () {
        // context-switch TODO

        $('#switch_err_stand').on('click', function () {
            if ($(this).text() === lib.layoutModel.conf.labelStdQuery) {
                $('#qnode').show();
                $('#cup_err_menu').hide();
                $(this).text(lib.layoutModel.conf.labelErrorQuery);
                lib.layoutModel.userSettings.set("errstdq", "std");

            } else {
                $('#qnode').hide();
                $('#cup_err_menu').show();
                $(this).text(lib.layoutModel.conf.labelStdQuery);
                lib.layoutModel.userSettings.set("errstdq", "err");
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
        if (lib.layoutModel.userSettings.get('errstdq') === 'std') {
            $('#cup_err_menu').hide();
            $('#switch_err_stand').text(lib.layoutModel.conf.messages.labelErrorQuery);

        } else {
            $('#qnode').hide();
        }
    };

    lib.makePrimaryButtons = function () {
        var queryForm = $('#mainform');

        queryForm.find('.make-primary').on('click', function (evt) {
            var linkElm = evt.currentTarget,
                jqCurrPrimaryCorpInput = queryForm.find('input[type="hidden"][name="corpname"]'),
                newPrimary = $(linkElm).attr('data-corpus-id'),
                urlArgs;

            removeActiveParallelCorpus(newPrimary);
            addActiveParallelCorpus(jqCurrPrimaryCorpInput.attr('value'));

            urlArgs = lib.layoutModel.conf.currentArgs; // TODO possible mutability issues
            urlArgs['corpname'] = newPrimary;
            urlArgs['sel_aligned'] = lib.alignedCorpora;

            window.location = lib.layoutModel.createActionUrl(
                    'first_form?' + lib.layoutModel.encodeURLParameters(urlArgs));
        });
    };

    /**
     *
     */
    lib.registerSubcorpChange = function () {
        $('#subcorp-selector').on('change', function (e) {
            // following code must be always the last action performed on the event
            $.each(lib.onSubcorpChangeActions, function (i, fn) {
                fn.call(lib, $(e.currentTarget).val());
            });
        });
    };

    lib.textareaSubmitOverride = function () {
        var jqMainForm = $('#mainform');
        jqMainForm.find('.query-area textarea').each(function (i, area) {
            queryInput.initCqlTextarea(area, jqMainForm);
        });
    };

    lib.textareaHints = function () {
        var hint = this.layoutModel.getStores().queryHintStore.getHint();
        this.layoutModel.renderReactComponent(this.layoutModel.layoutViews.QueryHints,
            $('.query-area .query-hints').get(0), {hintText: hint});
    };

    /**
     *
     * @param {object} conf
     * @return {{}} a simple object containing promises returned
     * by some of
     */
    lib.init = function (conf) {
        var promises;

        clStorage.clear();

        lib.layoutModel = new layoutModule.PageModel(conf);
        lib.extendedApi = queryInput.extendedApi(lib.layoutModel.pluginApi());
        lib.alignedCorpora = conf.alignedCorpora.slice();

        promises = lib.layoutModel.init(conf).add({
            misc : lib.misc(),
            bindStaticElements : lib.bindStaticElements(),
            bindBeforeSubmitActions : queryInput.bindBeforeSubmitActions(
                $('#make-concordance-button'), lib.layoutModel),
            bindQueryFieldsetsEvents : queryInput.bindQueryFieldsetsEvents(
                lib.extendedApi,
                lib.layoutModel.userSettings),
            bindParallelCorporaCheckBoxes : lib.bindParallelCorporaCheckBoxes(),
            updateToggleableFieldsets : queryInput.updateToggleableFieldsets(
                lib.extendedApi,
                lib.layoutModel.userSettings),
            makePrimaryButtons : lib.makePrimaryButtons(),
            queryStorage : queryStorage.createInstance(lib.extendedApi),
            liveAttributesInit : liveAttributes.init(lib.extendedApi, '#live-attrs-update', '#live-attrs-reset',
                '.text-type-params'),
            registerSubcorpChange : lib.registerSubcorpChange(),
            textareaSubmitOverride : lib.textareaSubmitOverride(),
            textareaHints : lib.textareaHints()
        });

        lib.layoutModel.registerPlugin('queryStorage', promises.get('queryStorage'));
        lib.layoutModel.mouseOverImages();
        return promises;
    };

    return lib;
});