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

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/plugins/abstract.d.ts" />
/// <reference path="../types/plugins/corparch.ts" />
/// <reference path="../../ts/declarations/modernizr.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <amd-dependency path="../views/textTypes" name="ttViews" />
/// <amd-dependency path="../views/query/context" name="contextViews" />

import win = require('win');
import $ = require('jquery');
import corplistComponent = require('plugins/corparch/init');
import layoutModule = require('./document');
import queryInput = require('../queryInput');
import queryStorage = require('plugins/queryStorage/init');
import liveAttributes = require('plugins/liveAttributes/init');
import conclines = require('../conclines');
import Immutable = require('vendor/immutable');
import userSettings = require('../userSettings');
import initActions = require('../initActions');
import textTypesStore = require('../stores/textTypes');
import RSVP = require('vendor/rsvp');
import util = require('../util');

declare var ttViews:any;
declare var contextViews:any;

declare var Modernizr:Modernizr.ModernizrStatic;


export class FirstFormPage implements Kontext.CorpusSetupHandler {

    private clStorage:conclines.ConcLinesStorage;

    private corplistComponent:CorpusArchive.Widget;

    private layoutModel:layoutModule.PageModel;

    private extendedApi:Kontext.QueryPagePluginApi;

    private onAddParallelCorpActions:Array<(corpname:string)=>void>;

    private onRemoveParallelCorpActions:Array<(corpname:string)=>void>;

    private onBeforeRemoveParallelCorpActions:Array<(corpname:string)=>void>;

    private onSubcorpChangeActions:Array<(corpname:string)=>void>;

    private alignedCorpora:Array<string>;

    private textTypesStore:textTypesStore.TextTypesStore;

    constructor(layoutModel:layoutModule.PageModel, clStorage:conclines.ConcLinesStorage) {
        this.layoutModel = layoutModel;
        this.onAddParallelCorpActions = [];
        this.onRemoveParallelCorpActions = [];
        this.onBeforeRemoveParallelCorpActions = [];
        this.onSubcorpChangeActions = [];
        this.alignedCorpora = [];
        this.extendedApi = queryInput.extendedApi(this.layoutModel, this);
    }

    getConf<T>(name:string):T {
        return this.layoutModel.getConf<T>(name);
    }

    translate(msg:string, values?:{[k:string]:string}):string {
        return this.layoutModel.translate(msg, values);
    }

    /**
     * Registers a callback which is invoked after an aligned
     * corpus is added to the query page (i.e. firstForm's
     * internal actions are performed first then the list of
     * registered callbacks).
     *
     * @param fn:(corpname:string)=>void
     */
    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {
        this.onAddParallelCorpActions.push(fn);
    }

    /**
     * Registers a callback which is invoked AFTER an aligned
     * corpus is removed from the query page (i.e. firstForm's
     * internal actions are performed first then the list of
     * registered callbacks).
     *
     * @param fn:(corpname:string)=>void
     */
    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {
        this.onRemoveParallelCorpActions.push(fn);
    }

    /**
     * Registers a callback which is invoked BEFORE an aligned
     * corpus is removed from the query page (i.e. firstForm's
     * internal actions are performed this actions).
     *
     * @param fn
     */
    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {
        this.onBeforeRemoveParallelCorpActions.push(fn);
    }

    /**
     * Registers a callback which is invoked after the subcorpus
     * selection element is changed. It guarantees that all the
     * firstForm's internal actions are performed before this
     * externally registered ones.
     *
     * @param fn:(subcname:string)=>void
     */
    registerOnSubcorpChangeAction(fn:(corpname:string)=>void):void {
        this.onSubcorpChangeActions.push(fn);
    }

    /**
     *
     */
    getActiveParallelCorpora():Array<string> {
        return this.alignedCorpora;
    }

    /**
     * @param {string} corpusName
     */
    addActiveParallelCorpus(corpusName):void {
        if (corpusName && $.inArray(corpusName, this.alignedCorpora) === -1) {
            this.alignedCorpora.push(corpusName);
        }
        if ($('div.parallel-corp-lang:visible').length > 0) {
            $('#default-view-mode').remove();
            $('#mainform').append('<input id="default-view-mode" type="hidden" name="viewmode" value="align" />');
        }
        this.onAddParallelCorpActions.forEach((fn) => {
            fn.call(this, corpusName);
        });
    }

    /**
     * @param {string} corpusName
     */
    removeActiveParallelCorpus(corpusName):void {
        this.onBeforeRemoveParallelCorpActions.forEach((fn) => {
            fn.call(this, corpusName);
        });
        if ($.inArray(corpusName, this.alignedCorpora) >= 0) {
                this.alignedCorpora.splice($.inArray(corpusName, this.alignedCorpora), 1);
        }
        if ($('div.parallel-corp-lang:visible').length === 0) {
            $('#default-view-mode').remove();
        }
        this.onRemoveParallelCorpActions.forEach((fn) => {
            fn.call(this, corpusName);
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
    createAddLanguageClickHandler(queryFormTweaks:queryInput.QueryFormTweaks,
            forcedCorpusId?:string):()=>void {
        let self = this;

        return function () {
            let jqAddLangWidget = $('#add-searched-lang-widget');
            let jqSelect = jqAddLangWidget.find('select');
            let corpusId = forcedCorpusId || jqSelect.val();

            if (corpusId) {
                let searchedLangWidgetOpt = jqAddLangWidget.find('select option[value="' + corpusId + '"]');
                let jqHiddenStatus = $('[id="qnode_' + corpusId + '"] input[name="sel_aligned"]');
                let jqNewLangNode = $('[id="qnode_' + corpusId + '"]');

                if (jqNewLangNode.length > 0) {
                    jqNewLangNode.show();
                    self.addActiveParallelCorpus(corpusId);
                    searchedLangWidgetOpt.prop('disabled', true); // TODO attr changed to prop - check this out


                    jqHiddenStatus.val(jqHiddenStatus.data('corpus'));
                    jqNewLangNode.find('a.close-button').on('click', function () {
                        $('[id="qnode_' + corpusId + '"]').hide();
                        jqHiddenStatus.val('');
                        self.removeActiveParallelCorpus(corpusId);
                        searchedLangWidgetOpt.removeAttr('disabled');
                        self.layoutModel.resetPlugins();
                    });

                    queryFormTweaks.initVirtualKeyboard(jqNewLangNode.find('table.form .query-area .spec-chars').get(0));

                    if (!$.support.cssFloat) {
                        // refresh content in IE < 9
                        $('#content').css('overflow', 'visible').css('overflow', 'auto');
                    }
                }
               self.layoutModel.resetPlugins();
               jqSelect.prop('selectedIndex', 0);
            }
        };
    }

    private initCorplistComponent():void {
        this.corplistComponent = corplistComponent.create(
            $('form[action="first"] select[name="corpname"]').get(0),
            this.extendedApi,
            {formTarget: 'first_form', submitMethod: 'GET'}
        );
    }

    private initQuerySelector(queryFormTweaks):void {
        // initial query selector setting (just like when user changes it manually)
        queryFormTweaks.cmdSwitchQuery($('#queryselector').get(0), this.layoutModel.getConf('queryTypesHints'));
    }

    /**
     *
     */
    private bindParallelCorporaCheckBoxes(queryFormTweaks):void {
        $('#add-searched-lang-widget').find('select')
            .prepend('<option value="" disabled="disabled">-- ' +
                this.layoutModel.translate('global__add_aligned_corpus') +
                ' --</option>')
            .prop('selectedIndex', 0)
            .on('change', this.createAddLanguageClickHandler(queryFormTweaks));

        $('input[name="sel_aligned"]').each(function () {
            if ($(this).val()) {
                $('select[name="pcq_pos_neg_' + $(this).data('corpus') + '"],[id="qtable_' + $(this).data('corpus') + '"]').show();
            }
        });
    }

    private makePrimaryButtons():void {
        let self = this;
        let queryForm = $('#mainform');

        queryForm.find('.make-primary').on('click', function (evt) {
            let linkElm = evt.currentTarget;
            let jqCurrPrimaryCorpInput = queryForm.find('input[type="hidden"][name="corpname"]');
            let newPrimary = $(linkElm).attr('data-corpus-id');
            let urlArgs;

            self.removeActiveParallelCorpus(newPrimary);
            self.addActiveParallelCorpus(jqCurrPrimaryCorpInput.attr('value'));

            urlArgs = self.layoutModel.getConf('currentArgs'); // TODO possible mutability issues
            urlArgs['corpname'] = newPrimary;

            let currAligned = self.layoutModel.userSettings.get<Array<string>>(userSettings.UserSettings.ALIGNED_CORPORA_KEY) || [];
            let idxActive = currAligned.indexOf(newPrimary);
            if (idxActive > -1) {
                currAligned[idxActive] = self.layoutModel.getConf<string>('corpname');
                self.layoutModel.userSettings.set(
                        userSettings.UserSettings.ALIGNED_CORPORA_KEY, currAligned);
            }
            window.location.href = self.layoutModel.createActionUrl(
                    'first_form?' + self.layoutModel.encodeURLParameters(urlArgs));
        });
    }

    /**
     *
     */
    private registerSubcorpChange():void {
        let self = this;
        $('#subcorp-selector').on('change', function (e) {
            // following code must be always the last action performed on the event
            self.onSubcorpChangeActions.forEach((fn) => {
                fn.call(self, $(e.currentTarget).val());
            });
        });
    }

    private registerAlignedCorpChange():void {
        function findActiveAlignedCorpora() {
            let ans = [];
            $('#mainform').find('fieldset.parallel .parallel-corp-lang:visible').each((i, elm) => {
                ans.push($(elm).attr('data-corpus-id'));
            });
            return ans;
        }
        let key = userSettings.UserSettings.ALIGNED_CORPORA_KEY;

        this.registerOnAddParallelCorpAction((corpname:string) => {
            this.layoutModel.userSettings.set(key, findActiveAlignedCorpora());
        });

        this.registerOnRemoveParallelCorpAction((corpname:string) => {
            this.layoutModel.userSettings.set(key, findActiveAlignedCorpora());
        });
    }

    private updateStateOnError():void {
        let notifications:Array<any> = this.layoutModel.getConf<Array<any>>('notifications') || [];
        if (Modernizr.history && notifications.length > 0) {
            let args:string = Immutable.Map({
                corpname: this.layoutModel.getConf<string>('corpname'),
                usesubcorp: this.layoutModel.getConf<string>('subcorpname'),
                sel_aligned: this.layoutModel.getConf<Array<string>>('alignedCorpora'),
            })
            .filter((v:any, k) => typeof v === 'string'
                    || v !== null && ('length' in v) && v.length > 0)
            .map((v, k) => {
                if (typeof v === 'object') {
                    return Immutable.List(v).map(v2 => k + '=' + v2).join('&');

                } else {
                    return k + '=' + v;
                }
            }).join('&');
            window.history.replaceState(
                {},
                window.document.title,
                this.layoutModel.createActionUrl('first_form') + '?' + args
            );
            window.onunload = () => {
                $('#mainform').find('input[type="text"], textarea').val('');
            };
        }
    }

    private restoreAlignedCorpora(queryFormTweaks:queryInput.QueryFormTweaks):void {
        let localAlignedCorpora = this.layoutModel.userSettings.get<Array<string>>(
                userSettings.UserSettings.ALIGNED_CORPORA_KEY);

        if (localAlignedCorpora !== undefined) {
            this.alignedCorpora = localAlignedCorpora;

        } else {
            this.alignedCorpora = this.layoutModel.getConf<Array<string>>('alignedCorpora').slice();
            this.layoutModel.userSettings.set(userSettings.UserSettings.ALIGNED_CORPORA_KEY, this.alignedCorpora);
        }
        this.alignedCorpora.forEach((item) => {
            this.createAddLanguageClickHandler(queryFormTweaks, item)();
        });
    }

    createTTViews(conf:Kontext.Conf):RSVP.Promise<any> {
        let textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesStore = new textTypesStore.TextTypesStore(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData,
                this.layoutModel.getConf<TextTypes.ServerCheckedValues>('CheckedSca')
        );
        let ttViewComponents = ttViews.init(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.textTypesStore
        );

        let liveAttrsProm;
        let ttTextInputCallback;
        if (this.layoutModel.hasPlugin('live_attributes')) {
            liveAttrsProm = liveAttributes.create(this.extendedApi, this.textTypesStore, textTypesData['bib_attr']);

        } else {
            liveAttrsProm = new RSVP.Promise((fulfill:(v)=>void, reject:(err)=>void) => {
                fulfill(null);
            });
        }
        let ttProm = liveAttrsProm.then(
            (liveAttrsStore:LiveAttributesInit.AttrValueTextInputListener) => {
                if (liveAttrsStore) {
                    this.textTypesStore.setTextInputChangeCallback(liveAttrsStore.getListenerCallback());
                }
                let liveAttrsViews = liveAttributes.getViews(this.layoutModel.dispatcher,
                        this.layoutModel.exportMixins(), this.textTypesStore, liveAttrsStore);
                this.layoutModel.renderReactComponent(
                    ttViewComponents.TextTypesPanel,
                    $('#specify-query-metainformation div.contents').get(0),
                    {
                        liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                        liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                        attributes: this.textTypesStore.getAttributes()
                    }
                );
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
        return ttProm.then(
            (v) => {
                let contextViewComponents = contextViews.init(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins()
                );
                this.layoutModel.renderReactComponent(
                    contextViewComponents.SpecifyKontextForm,
                    $('#specify-context div.contents').get(0),
                    {
                        lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                        posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                        hasLemmaAttr: this.layoutModel.getConf<boolean>('hasLemmaAttr'),
                        wPoSList: this.layoutModel.getConf<any>('Wposlist')
                    }
                );
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    init(conf:Kontext.Conf):initActions.InitActions {
        let queryFormTweaks = queryInput.init(this.layoutModel, this, this.layoutModel.userSettings,
                $('#mainform').get(0));
        let promises = this.layoutModel.init().add({
            initQuerySelector : this.initQuerySelector(queryFormTweaks),
            bindBeforeSubmitActions : queryFormTweaks.bindBeforeSubmitActions($('#make-concordance-button')),
            bindQueryFieldsetsEvents : queryFormTweaks.bindQueryFieldsetsEvents(),
            bindParallelCorporaCheckBoxes : this.bindParallelCorporaCheckBoxes(queryFormTweaks),
            restoreAlignedCorpora: this.restoreAlignedCorpora(queryFormTweaks),
            initCorplistComponent: this.initCorplistComponent(),
            makePrimaryButtons : this.makePrimaryButtons(),
            registerSubcorpChange : this.registerSubcorpChange(),
            registerAlignedCorpChange: this.registerAlignedCorpChange(),
            textareaSubmitOverride : queryFormTweaks.textareaSubmitOverride(),
            textareaHints : queryFormTweaks.textareaHints(),
            initQuerySwitching : queryFormTweaks.initQuerySwitching(),
            fixFormSubmit : queryFormTweaks.fixFormSubmit(),
            bindQueryHelpers: queryFormTweaks.bindQueryHelpers(),
            queryStorageInit : queryStorage.create(this.layoutModel.pluginApi()),
            updateStateOnError: this.updateStateOnError(),
            queryFormTweaks: queryFormTweaks.updateToggleableFieldsets()
        });
        promises.doAfter('queryFormTweaks', () => {
            this.createTTViews(conf);
        });
        return promises;
    }
}


export function init(conf:Kontext.Conf):FirstFormPage {
    let layoutModel = new layoutModule.PageModel(conf);
    let clStorage:conclines.ConcLinesStorage = conclines.openStorage((err) => {
        layoutModel.showMessage('error', err);
    });
    clStorage.clear();
    let pageModel = new FirstFormPage(layoutModel, clStorage);
    let promises:initActions.InitActions = pageModel.init(conf);

    layoutModel.registerPlugin('queryStorage', promises.get('queryStorageInit'));
    layoutModel.mouseOverImages();
    return pageModel;
}