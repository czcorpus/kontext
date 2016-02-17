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
    'plugins/liveAttributes/init', 'conclines'], function (win, $, corplistComponent, layoutModule, queryInput,
                                                                                      queryStorage, liveAttributes,
                                                                                      conclines) {
    'use strict';

    var lib = {},
        activeParallelCorporaSettingKey = 'active_parallel_corpora',
        clStorage = conclines.openStorage();

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

    lib.translate = function (msg, values) {
        return lib.layoutModel.translate(msg, values);
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
     * @param {QueryFormTweaks} queryFormTweaks
     * @param {string} [forcedCorpusId] optional parameter to force corpus to be added (otherwise
     * it is chosen based on "#add-searched-lang-widget select" select box value). It is useful
     * in case you want to call the handler manually.
     * @return {function} handler function
     */
    function createAddLanguageClickHandler(queryFormTweaks, forcedCorpusId) {
        return function () {
            var corpusId,
                jqSelect,
                jqHiddenStatus,
                jqNewLangNode,
                searchedLangWidgetOpt,
                jqAddLangWidget = $('#add-searched-lang-widget');

            jqSelect = jqAddLangWidget.find('select');
            corpusId = forcedCorpusId || jqSelect.val();

            if (corpusId) {
                searchedLangWidgetOpt = jqAddLangWidget.find('select option[value="' + corpusId + '"]');
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

                    queryFormTweaks.initVirtualKeyboard(jqNewLangNode.find('table.form .query-area .spec-chars').get(0));

                    if (!$.support.cssFloat) {
                        // refresh content in IE < 9
                        $('#content').css('overflow', 'visible').css('overflow', 'auto');
                    }
                }
               lib.layoutModel.resetPlugins();
               jqSelect.prop('selectedIndex', 0);
            }
        };
    }

    /**
     * @todo rename/refactor this stuff
     */
    lib.misc = function (queryFormTweaks) {
        lib.corplistComponent = corplistComponent.create(
            $('form[action="first"] select[name="corpname"]').get(0),
            lib,
            {formTarget: 'first_form', submitMethod: 'GET'}
        );
        // initial query selector setting (just like when user changes it manually)
        queryFormTweaks.cmdSwitchQuery($('#queryselector').get(0), lib.layoutModel.conf.queryTypesHints);

        // open currently used languages for parallel corpora
        $.each(getActiveParallelCorpora(), function (i, item) {
            createAddLanguageClickHandler(queryFormTweaks, item)();
        });
    };

    /**
     *
     */
    lib.bindParallelCorporaCheckBoxes = function (queryFormTweaks) {
        $('#add-searched-lang-widget').find('select')
            .prepend('<option value="" disabled="disabled">-- ' + lib.layoutModel.translate('global__add_aligned_corpus')
                + ' --</option>')
            .prop('selectedIndex', 0)
            .on('change', createAddLanguageClickHandler(queryFormTweaks));

        $('input[name="sel_aligned"]').each(function () {
            if ($(this).val()) {
                $('select[name="pcq_pos_neg_' + $(this).data('corpus') + '"],[id="qtable_' + $(this).data('corpus') + '"]').show();
            }
        });
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

            urlArgs = lib.layoutModel.getConf('currentArgs'); // TODO possible mutability issues
            urlArgs['corpname'] = newPrimary;
            urlArgs['sel_aligned'] = lib.alignedCorpora;

            window.location.href = lib.layoutModel.createActionUrl(
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

    /**
     *
     * @param {object} conf
     * @return {{}} a simple object containing promises returned
     * by some of
     */
    lib.init = function (conf) {
        var promises,
            queryFormTweaks,
            extendedApi;

        clStorage.clear();

        lib.layoutModel = new layoutModule.PageModel(conf);
        extendedApi = queryInput.extendedApi(lib.layoutModel);
        lib.alignedCorpora = conf.alignedCorpora.slice();
        queryFormTweaks = queryInput.init(lib.layoutModel, lib.layoutModel.userSettings,
                $('#mainform').get(0));
        promises = lib.layoutModel.init(conf).add({
            misc : lib.misc(queryFormTweaks),
            bindBeforeSubmitActions : queryFormTweaks.bindBeforeSubmitActions($('#make-concordance-button')),
            bindQueryFieldsetsEvents : queryFormTweaks.bindQueryFieldsetsEvents(),
            bindParallelCorporaCheckBoxes : lib.bindParallelCorporaCheckBoxes(queryFormTweaks),
            makePrimaryButtons : lib.makePrimaryButtons(),
            queryStorage : queryStorage.createInstance(lib.layoutModel.pluginApi()),
            liveAttributesInit : liveAttributes.init(extendedApi, conf, '#live-attrs-update',
                    '#live-attrs-reset', '.text-type-params'),
            registerSubcorpChange : lib.registerSubcorpChange(),
            textareaSubmitOverride : queryFormTweaks.textareaSubmitOverride(),
            textareaHints : queryFormTweaks.textareaHints(),
            initQuerySwitching : queryFormTweaks.initQuerySwitching(),
            fixFormSubmit : queryFormTweaks.fixFormSubmit(),
            bindQueryHelpers: queryFormTweaks.bindQueryHelpers()
        });
        promises.doAfter('liveAttributesInit', function () {
            queryFormTweaks.updateToggleableFieldsets();
        });
        lib.layoutModel.registerPlugin('queryStorage', promises.get('queryStorage'));
        lib.layoutModel.mouseOverImages();
        return promises;
    };

    return lib;
});