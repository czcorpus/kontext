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


/// <reference path="../ts/declarations/jquery.d.ts" />
/// <reference path="../ts/declarations/popupbox.d.ts" />
/// <reference path="../ts/declarations/tagbuilder.d.ts" />
/// <reference path="../ts/declarations/virtual-keyboard.d.ts" />
/// <reference path="../ts/declarations/cookies.d.ts" />
/// <reference path="../ts/declarations/common.d.ts" />
/// <reference path="../ts/declarations/rsvp.d.ts" />
/// <reference path="../ts/declarations/abstract-plugins.d.ts" />

import $ = require('jquery');
import win = require('win');
import cookies = require('vendor/cookies');
import popupBox = require('popupbox');
import tagbuilder = require('plugins/taghelper/init');
import util = require('util');
import virtKeyboard = require('vendor/virtual-keyboard');
import RSVP = require('vendor/rsvp');
import layoutModel = require('tpl/document');


class CustomApi extends layoutModel.PluginApi implements Kontext.QueryPagePluginApi {

    pluginApi:Kontext.PluginApi;

    queryFieldsetToggleEvents:Array<(elm:HTMLElement)=>void>;

    queryFieldsetReadyEvents:Array<(elm:HTMLElement)=>void>;

    corpusSetupHandler:Kontext.CorpusSetupHandler;

    constructor(model:layoutModel.PageModel, corpusSetupHandler:Kontext.CorpusSetupHandler) {
        super(model);
        this.corpusSetupHandler = corpusSetupHandler;
        this.queryFieldsetToggleEvents = [];
        this.queryFieldsetReadyEvents = [];
    }

    bindFieldsetToggleEvent(fn:(elm:HTMLElement)=>void) {
        this.queryFieldsetToggleEvents.push(fn);
    }

    bindFieldsetReadyEvent(fn:(elm:HTMLElement)=>void) {
        this.queryFieldsetReadyEvents.push(fn);
    }

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void) {
        this.corpusSetupHandler.registerOnSubcorpChangeAction(fn);
    }

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void) {
        this.corpusSetupHandler.registerOnAddParallelCorpAction(fn);
    }

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void) {
        this.corpusSetupHandler.registerOnBeforeRemoveParallelCorpAction(fn);
    }

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void) {
        this.corpusSetupHandler.registerOnRemoveParallelCorpAction(fn);
    }

    applyOnQueryFieldsetToggleEvents(elm:HTMLElement) {
        this.queryFieldsetReadyEvents.forEach((fn)=>fn(elm));
    }

    applyOnQueryFieldsetReadyEvents(elm:HTMLElement) {
        this.queryFieldsetReadyEvents.forEach((fn)=>fn(elm));
    }
}


export class QueryFormTweaks {

    private pluginApi:Kontext.QueryPagePluginApi;

    private userSettings:layoutModel.UserSettings;

    private formElm:HTMLElement;

    private maxEncodedParamsLength:number;

    constructor(pluginApi:Kontext.QueryPagePluginApi, userSettings:layoutModel.UserSettings, formElm:HTMLElement) {
        this.pluginApi = pluginApi;
        this.userSettings = userSettings;
        this.formElm = formElm;
        this.maxEncodedParamsLength = 1500;
    }

    /**
     * @param {jQuery|HTMLElement|String} inputElm
     * @param {jQuery|HTMLElement|String} triggerElm
     */
    bindTagHelper(inputElm:HTMLElement, triggerElm:HTMLElement):void {
        let self = this;
        popupBox.bind(
            triggerElm,
            tagbuilder.getPopupBoxRenderer(self.pluginApi),
            {
                type: 'plain',
                closeIcon: true,
                timeout: null,
                onClose: function () {
                    self.pluginApi.unmountReactComponent(this.getRootElement());
                }
            }
        );

        /*
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
            (message:string) => {
                self.pluginApi.showMessage('error',
                    message || self.pluginApi.translate('global__failed_to_contact_server'));
            }
        );
        */
    }

    /**
     * @param {jQuery} jqLinkElement
     */
    bindWithinHelper(jqLinkElement:HTMLElement) {
        let jqInputElement = $('#' + $(jqLinkElement).data('bound-input'));
        let clickAction;
        let buttonEnterAction;
        let self = this;

        clickAction = function (box) {
            return function () {
                let caretPos = util.getCaretPosition(jqInputElement);
                let structAttr = $('#within-structattr').val().split('.');
                let within = 'within <' + structAttr[0] + ' ' + structAttr[1] + '="' + $('#within-value').val() + '" />';
                let bef = jqInputElement.val().substring(0, caretPos);
                let aft = jqInputElement.val().substring(caretPos);

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
            function (box:popupBox.TooltipBox, finalize:()=>void) {
                let loaderGIF;
                let jqWithinModal:JQuery = $('#within-builder-modal');

                if ($('#within-structattr').length > 0) {
                    jqWithinModal.css('display', 'block');
                    box.importElement(jqWithinModal.get(0));
                    $('#within-insert-button').off('click')
                            .one('click', clickAction(box));
                    $(win.document).off('keypress.withinBoxEnter');
                    $(win.document).on('keypress.withinBoxEnter', buttonEnterAction(box));
                    finalize();

                } else {
                    loaderGIF = self.pluginApi.appendLoader(box.getRootElement());

                    let prom:RSVP.Promise<any> = self.pluginApi.ajax(
                        'GET',
                        self.pluginApi.createActionUrl('corpora/ajax_get_structs_details'),
                        {
                            corpname: self.pluginApi.getConf('corpname')
                        },
                        {contentType : 'application/x-www-form-urlencoded'}
                    );
                    prom.then(
                        function (data) {
                            let html = '<select id="within-structattr">';
                            for (let prop in data) {
                                if (data.hasOwnProperty(prop)) {
                                    for (let i = 0; i < data[prop].length; i += 1) {
                                        html += '<option>' + prop + '.' + data[prop][i] + '</option>';
                                    }
                                }
                            }
                            html += '</select>';
                            loaderGIF.remove();

                            box.importElement(jqWithinModal.get(0));
                            jqWithinModal.find('.inputs').prepend(html);
                            jqWithinModal.css('display', 'block');

                            $('#within-insert-button').one('click', clickAction(box));
                            $(win.document).on('keypress.withinBoxEnter', buttonEnterAction(box));

                            finalize();
                        },
                        function () {
                            box.close();
                            self.pluginApi.showMessage('error',
                                self.pluginApi.translate('global__failed_to_contact_server'));
                            finalize();
                        }
                    );
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
    bindQueryHelpers():void {
        let self = this;
        $('.query-area .cql-input').each(function () {
            let blockWrapper = $(this).closest('td');

            self.bindTagHelper(this, blockWrapper.find('.insert-tag a').get(0));
            self.bindWithinHelper(blockWrapper.find('li.within a').get(0));
        });
        this.initVirtualKeyboard($(this.formElm).find('tr:visible .spec-chars'));
    }


    textareaSubmitOverride():void {
        let jqMainForm = $(this.formElm);
        let self = this;

        jqMainForm.find('.query-area textarea').each((i, area) => {
            self.initCqlTextarea(area, jqMainForm);
        });
    }

    textareaHints():void {
        this.pluginApi.renderReactComponent(this.pluginApi.getViews().QueryHints,
            $(this.formElm).find('.query-area .query-hints').get(0),
                {hintText: this.pluginApi.getStores().queryHintStore.getHint()});
    }


    /**
     * Switches between query modes (iquery, cql, lemma,...). If used within event handlers
     * then the 'source' argument must be the respective event (jQuery.Event). If used manually
     * (e.g. to init the form) then query type selection input (currently it is a SELECT element)
     * must be used.
     *
     * @param {HTMLElement, jQuery.Event} source
     * @param hints
     */
    cmdSwitchQuery(source:JQueryEventObject|HTMLElement, hints:{[key:string]:string}) {
        let jqQs;
        let self = this;

        if (source.hasOwnProperty('currentTarget')) {
            jqQs = $(source['currentTarget']);

        } else { // called 'manually'
            jqQs = $(source);
        }

        hints = hints || {};
        let newidCom = jqQs.val();
        let newid = jqQs.val() + jqQs.data('parallel-corp');
        let jqFocusElem = $('#' + newidCom.substring(0, newidCom.length - 3) + jqQs.data('parallel-corp'));
        let oldval = jqFocusElem.val();

        $('#conc-form-clear-button').unbind('click')
                .bind('click', function () {
            self.clearForm($(self.formElm));
        });

        jqQs.find('option').each(function () {
            let elementId = $(this).val() + jqQs.data('parallel-corp');
            let elementIdCom = $(this).val().substring(0, $(this).val().length - 3);
            let jqElem = $('#' + elementId);
            let jqOldElem;

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
            let jqQueryTypeHint = $('<a href="#" class="context-help">'
                + '<img class="over-img" src="../files/img/question-mark.svg" '
                + 'data-alt-img="../files/img/question-mark_s.svg" /></a>');
            $('#queryselector').after(jqQueryTypeHint);
            popupBox.bind(jqQueryTypeHint,
                hints['iqueryrow'],
                {
                    top: 'attached-bottom',
                    fontSize: '10pt',
                    width: '30%'
                });

        } else {
            $('#queryselector').parent().find('.context-help').remove();
        }
        jqFocusElem.focus();

        if (source.hasOwnProperty('currentTarget')) { // reset plug-in only if this is called as part of some event handler
            $('.query-area input.history, .query-area textarea.history').each(function () {
                if (typeof $(this).data('plugin') === 'object') {
                    self.pluginApi.getPlugin<Plugins.IQueryStorage>('queryStorage').detach(this);
                }
            });
            self.pluginApi.getPlugin<Plugins.IQueryStorage>('queryStorage').reset();
        }
        this.initVirtualKeyboard(jqFocusElem);
    }

    /**
     *
     * @param f
     */
    clearForm(f):void {
        let jqQuerySel = $('#queryselector');
        let prevRowType = jqQuerySel.val();
        let jqErr = $('#error');

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
    }

    /**
     * @param elm
     */
    initVirtualKeyboard(elm):void {
        let jqElm = $(elm);

        if (jqElm.length > 0) {
            virtKeyboard.VKI_close(jqElm.get(0));
            virtKeyboard.VKI_attach(jqElm.get(0),
                                    jqElm.closest('tr').find('.virtual-keyboard-trigger').get(0));
        }
    }


    /**
     * Disables (if state === true) or enables (if state === false)
     * all empty/unused form fields. This is used to reduce number of passed parameters,
     * especially in case of parallel corpora.
     *
     * @param formElm
     * @param state
     */
    setAlignedCorporaFieldsDisabledState(formElm, state):void {
        let stateStr = state.toString();

        $(formElm).find('input[name="sel_aligned"]').each(function () {
            let corpn = $(this).data('corpus'); // beware - corp may contain special characters colliding with jQuery
            let queryType;

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
    initQuerySwitching():void {
        let queryTypeHints = this.pluginApi.getConf<{[k:string]:string}>('queryTypesHints');
        let self = this;

        $('select.qselector').each(function () {
            $(this).on('change', function (event) {
                self.cmdSwitchQuery(event, queryTypeHints);
            });

            // we have to initialize inputs properly (unless it is the default (as loaded from server) state)
            if ($(this).val() !== 'iqueryrow') {
                self.cmdSwitchQuery($(this).get(0), queryTypeHints);
            }
        });
    }

    /**
     *
     */
    fixFormSubmit():void {
        let self = this;
        // remove empty and unused parameters from URL before form submit
        $(this.formElm).submit(() => { // run before submit
            this.setAlignedCorporaFieldsDisabledState(self.formElm, true);
            $(win).on('unload', () => {
                this.setAlignedCorporaFieldsDisabledState(self.formElm, false);
            });
        });
    }

    /**
     *
     * @param area
     * @param parentForm
     */
    initCqlTextarea(area, parentForm):void {
        $(area).on('keydown', function (evt) {
            if (!evt.shiftKey && evt.keyCode === 13) {
                evt.preventDefault();
                $(parentForm).submit();
            }
        });
    };

    /**
     */
    bindQueryFieldsetsEvents():void {
        let self = this;

        $('a.form-extension-switch').on('click', function (event) {
            let jqTriggerLink = $(event.currentTarget);
            let jqFieldset = jqTriggerLink.closest('fieldset');

            jqFieldset.toggleClass('inactive');
            if (jqFieldset.hasClass('inactive')) {
                jqFieldset.find('div.contents').hide();
                jqTriggerLink.attr('title', self.pluginApi.translate('global__click_to_expand'))
                        .removeClass('collapse').addClass('expand');
                jqFieldset.find('div.desc').show();
                self.userSettings.set(jqTriggerLink.data('box-id'), false);

            } else {
                jqFieldset.find('div.contents').show();
                jqTriggerLink.attr('title', self.pluginApi.translate('global__click_to_hide'))
                        .removeClass('expand').addClass('collapse');
                jqFieldset.find('div.desc').hide();
                self.userSettings.set(jqTriggerLink.data('box-id'), true);
            }
            self.pluginApi.applyOnQueryFieldsetToggleEvents(jqFieldset.get(0));
        });
    }

    /**
     *
     * @returns {*}
     */
    updateToggleableFieldsets():RSVP.Promise<any> { // TODO
        let jqLink = $('a.form-extension-switch');
        let jqFieldset;
        let jqSwitchLink;
        let elmStatus;
        let defer = new RSVP.Promise((resolve:(v:any)=>void, reject:(err:any)=>void) => {
            resolve(null);
        });
        let self = this;

        jqLink.each(function () {
            jqFieldset = $(this).closest('fieldset');
            elmStatus = self.userSettings.get($(this).data('box-id'));
            jqSwitchLink = jqFieldset.find('a.form-extension-switch');

            if (elmStatus === true) {
                jqFieldset.removeClass('inactive');
                jqFieldset.find('div.contents').show();
                jqFieldset.find('div.desc').hide();
                jqLink.attr('title', self.pluginApi.translate('global__click_to_hide'));
                jqSwitchLink.removeClass('expand').addClass('collapse');

            } else {
                jqFieldset.find('div.contents').hide();
                jqFieldset.find('div.desc').show();
                jqLink.attr('title', self.pluginApi.translate('global__click_to_expand'));
                jqSwitchLink.removeClass('collapse').addClass('expand');
            }

            self.pluginApi.applyOnQueryFieldsetReadyEvents($(jqFieldset).get(0));

        });
        return defer;
    }

    isPossibleQueryTypeMismatch(inputElm, queryTypeElm):boolean {
        let query = $(inputElm).val();
        let queryType = $(queryTypeElm).find('option:selected').data('type');

        return Boolean(queryType !== 'cql' && (/^(\s*"[^\"]+")+$/.exec(query) || /\[[^\]]*\]/.exec(query))
            || queryType === 'cql' && (!/^(\s*"[^\"]+")+$/.exec(query) && !/\[[^\]]*\]/.exec(query)));
    }

    /**
     * @param submitElm
     */
    bindBeforeSubmitActions(submitElm):void {
        let self = this;

        $(this.formElm).find(submitElm).on('click', function (event) { // TODO
            let currQueryElm = $(self.formElm).find('.query-area .query:visible').get(0);
            let queryTypeElm = $(self.formElm).find('select.qselector').get(0);
            let data = $(self.formElm).serialize().split('&');
            let cleanData = '';
            let unusedLangs = {};

            $('.parallel-corp-lang').each(function () {
                if ($(this).css('display') === 'none') {
                    unusedLangs[$(this).attr('id').substr(6)] = true;
                }
            });

            function belongsToUnusedLanguage(paramName) {
                for (let p in unusedLangs) {
                    if (unusedLangs.hasOwnProperty(p)) {
                        if (paramName.indexOf(p) > -1) {
                            return true;
                        }
                    }
                }
                return false;
            }

            $.each(data, function (i, val) {
                let items = val.split('=', 2);
                if (items.length === 2 && items[1] && !belongsToUnusedLanguage(items[0])) {
                    cleanData += '&' + items[0] + '=' + items[1];
                }
            });

            if (self.isPossibleQueryTypeMismatch(currQueryElm, queryTypeElm)) {
                $(self.formElm).find('select.qselector').addClass('error-input');
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
    }
}


export function extendedApi(model:layoutModel.PageModel,
        corpusSetupHandler:Kontext.CorpusSetupHandler):Kontext.QueryPagePluginApi {
    return new CustomApi(model, corpusSetupHandler);
}


/**
 * Generates PluginApi extended by bindFieldsetToggleEvent() method
 * required in 'first_form' and 'filter_form' actions
 *
 * @param pluginApi
 */
export function init(model:layoutModel.PageModel, corpusSetupHandler:Kontext.CorpusSetupHandler,
        settings:layoutModel.UserSettings, formElm:HTMLElement):QueryFormTweaks {
    let customApi = new CustomApi(model, corpusSetupHandler);
    return new QueryFormTweaks(customApi, settings, formElm);
}

