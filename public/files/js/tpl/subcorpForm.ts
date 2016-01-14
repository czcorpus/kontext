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

/// <reference path="../../ts/declarations/common.d.ts" />
/// <reference path="../../ts/declarations/popupbox.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../common/plugins/corparch.ts" />
/// <reference path="../common/plugins/subcmixer.ts" />
/// <reference path="../common/plugins/liveAttributes.ts" />
/// <reference path="../views/subcorpForm.d.ts" />

// -- dynamic loading of custom plug-in implementation
/// <amd-dependency path="plugins/corparch/init" name="corplistComponent" />
/// <amd-dependency path="plugins/liveAttributes/init" name="liveAttributes" />
/// <amd-dependency path="plugins/subcmixer/init" name="subcmixer" />

import $ = require('jquery');
import document = require('tpl/document');
import popupBox = require('popupbox');
import subcorpFormViews = require('views/subcorpForm');
import subcorpFormStoreModule = require('stores/subcorpForm');

// dynamic imports
declare var subcmixer:Subcmixer.Module;
declare var corplistComponent:CorpusArchive.Module;
declare var liveAttributes:LiveAttributes.Module;



export class TmpExtendedApi implements Kontext.QueryPagePluginApi, Kontext.FirstFormPage {

    private queryFieldsetToggleEvents:Array<(fieldset:HTMLElement) => void>;

    private pluginApi:Kontext.PluginApi;

    constructor(pluginApi:Kontext.PluginApi) {
        this.pluginApi = pluginApi;
        this.queryFieldsetToggleEvents = [];
    }

    bindFieldsetToggleEvent(callback:(fieldset:HTMLElement) => void) {
        this.queryFieldsetToggleEvents.push(callback);
    }

    bindFieldsetReadyEvent(callback:(fieldset:HTMLElement) => void) {
    }

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void) {}
    registerOnAddParallelCorpAction(fn:(corpname:string)=>void) {}
    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void) {}

    getConf(key:string):any { return this.pluginApi.getConf(key); }
    createStaticUrl(path:string):string { return this.pluginApi.createStaticUrl(path); }
    createActionUrl(path:string):string { return this.pluginApi.createActionUrl(path); }
    ajax<T>(method:string, url:string, args:any, options:Kontext.AjaxOptions):RSVP.Promise<T> {
        return this.pluginApi.ajax(method, url, args, options);
    }
    ajaxAnim(): JQuery { return this.pluginApi.ajaxAnim(); }
    ajaxAnimSmall() { return this.pluginApi.ajaxAnimSmall(); }
    appendLoader() { return this.pluginApi.appendLoader(); }
    showMessage(type:string, message:string) { return this.pluginApi.showMessage(type, message); }
    translate(text:string, values?:any):string { return this.pluginApi.translate(text, values); }
    formatNumber(v:number):string { return this.pluginApi.formatNumber(v); }
    formatDate(d:Date):string { return this.pluginApi.formatDate(d); }
    applySelectAll(elm:HTMLElement, context:HTMLElement) { return this.pluginApi.applySelectAll(elm, context); }
    registerReset(fn:Function) { return this.pluginApi.registerReset(fn); }
    registerInitCallback(fn:()=>void):void { return this.pluginApi.registerInitCallback(fn); }
    userIsAnonymous():boolean { return this.pluginApi.userIsAnonymous(); }
    contextHelp(triggerElm:HTMLElement, text:string) { return this.pluginApi.contextHelp(triggerElm, text); }
    shortenText(s:string, length:number) { return this.pluginApi.shortenText(s, length); }
    dispatcher():Dispatcher.Dispatcher<any> { return this.pluginApi.dispatcher(); }
    exportMixins(...mixins:any[]):any[] { return this.pluginApi.exportMixins(mixins); }
    renderReactComponent(reactObj:(mixins:Array<{}>)=>React.ReactClass,
                         target:HTMLElement, props?:React.Props):void {
        return this.pluginApi.renderReactComponent(reactObj, target, props);
    }
    unmountReactComponent(element:HTMLElement):boolean { return this.pluginApi.unmountReactComponent(element); }
    getStores():Kontext.LayoutStores { return this.pluginApi.getStores(); }
    getViews():Kontext.LayoutViews { return this.pluginApi.getViews(); }
}


/**
 * This model contains functionality related to the subcorp_form.tmpl template
 */
export class SubcorpForm {

    private pageModel:document.PageModel;

    private corplistComponent:CorpusArchive.Widget;

    private viewComponents:any; // TODO types

    private subcorpFormStore:subcorpFormStoreModule.SubcorpFormStore;

    constructor(pageModel:document.PageModel, corplistComponent:CorpusArchive.Widget, viewComponents,
            subcorpFormStore:subcorpFormStoreModule.SubcorpFormStore) {
        this.pageModel = pageModel;
        this.corplistComponent = corplistComponent;
        this.viewComponents = viewComponents;
        this.subcorpFormStore = subcorpFormStore;
    }

    formChangeCorpus(item:JQueryEventObject):void {
        let formAncestor;
        let ancestors = $(item.currentTarget).parents();

        for (let i = 0; i < ancestors.length; i += 1) {
            if (ancestors[i].nodeName === 'FORM') {
                formAncestor = ancestors[i];
                break;
            }
        }
        if (formAncestor !== undefined) {
            let srch = $(formAncestor).find('*[name="reload"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '1');
            }
            srch = $(formAncestor).find('*[name="usesubcorp"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '');
            }
            formAncestor.submit();
        }
    }

    subcCreationVariantSwitch(value:string):void {
        let widgetMap = {
            'raw': '#subc-within-row',
            'gui': '.text-type-params',
            'mixer': '#subc-mixer-row'
        };
        let jqSubmitBtn = $('#subcorp-form').find('input[type=submit]');
        for (let p in widgetMap) {
            if (widgetMap.hasOwnProperty(p)) {
                $(widgetMap[p]).hide();
            }
        }
        jqSubmitBtn.off('click.customized');
        let self = this;
        if (value === 'raw') {
            $('#subc-within-row').show();
            jqSubmitBtn.show();
            jqSubmitBtn.on('click.customized', (evt:JQueryEventObject) => {
                $('#within-json-field').val(self.subcorpFormStore.exportJson());
            });
            $('.text-type-params').find('input[type="checkbox"]').attr('disabled', '');
            this.pageModel.renderReactComponent(this.viewComponents.WithinBuilder,
                    $('#subc-within-row .container').get(0),
                    {
                        structsAndAttrs: this.pageModel.getConf('structsAndAttrs')
                    }
            );

        } else if (value === 'gui') {
            $('.text-type-params')
                .show()
                .find('input[type="checkbox"]').attr('disabled', null);
            jqSubmitBtn.show();

        } else if (value === 'mixer') {
            $(widgetMap['mixer']).show();
            jqSubmitBtn.hide(); // subcmixer uses its own button (nested React component); not sure about this
            subcmixer.create($(widgetMap['mixer']).find('.widget').get(0),
                    this.pageModel.pluginApi());
        }
    }

    initSubcCreationVariantSwitch():void {
        let self = this;
        $('input.method-select').on('click', function (event) {
            self.subcCreationVariantSwitch($(event.target).val());
        });
        this.subcCreationVariantSwitch($('input[name="method"]:checked').val());
    }

    /**
     * When user changes size from tokens to document counts (or other way around) he loses
     * current unsaved checkbox selection. This forces a dialog box to prevent unwanted action.
     */
    sizeUnitsSafeSwitch():void {
        let self = this;
        $('.text-type-top-bar a').on('click', function (event) {
            let ans = confirm(self.pageModel.translate('global__this_action_resets_current_selection'));

            if (!ans) {
                event.preventDefault();
                event.stopPropagation(); // in case some other actions are bound
            }
        });
    }

    initHints():void {
        let attrs = this.pageModel.getConf('structsAndAttrs');
        let msg = this.pageModel.translate('global__within_hint_text');
        let hintRoot = $(window.document.createElement('div'));
        let structList = $(window.document.createElement('ul'));
        let hintAttrs = $(window.document.createElement('p'));

        hintRoot.append('<p>' + msg + '</p>');
        hintRoot.append(hintAttrs);
        hintAttrs.append(this.pageModel.translate('global__within_hint_attrs'));

        for (let p in attrs) {
            if (attrs.hasOwnProperty(p)) {
                structList.append('<li><strong>' + p + '</strong>: ' + attrs[p].join(', ') + '</li>');
            }
        }
        hintAttrs.append(structList);

        popupBox.bind(
            $('#custom-within-hint').get(0),
            hintRoot,
            {
                width: 'nice'
            }
        );
    }

    init():void {
        this.initSubcCreationVariantSwitch();
        this.sizeUnitsSafeSwitch();
        this.initHints();
    }
}


export function init(conf:any) {
    let layoutModel:document.PageModel = new document.PageModel(conf);
    layoutModel.init();

    let extendedApi = new TmpExtendedApi(layoutModel.pluginApi());

    let subcForm = $('#subcorp-form');
    let corplist = corplistComponent.create(
        subcForm.find('select[name="corpname"]').get(0),
        extendedApi,
        {formTarget: 'subcorp_form', submitMethod: 'GET', editable: false}
    );

    let subcorpFormStore = new subcorpFormStoreModule.SubcorpFormStore(
        layoutModel.dispatcher, Object.keys(layoutModel.getConf('structsAndAttrs'))[0],
        layoutModel.getConf<Array<{[key:string]:string}>>('currentWithinJson'));
    let subcorpFormComponents = subcorpFormViews.init(layoutModel.dispatcher,
            layoutModel.exportMixins(), subcorpFormStore);

    let pageModel = new SubcorpForm(layoutModel, corplist, subcorpFormComponents,
            subcorpFormStore);
    pageModel.init();

    liveAttributes.init(extendedApi, conf, $('#live-attrs-update').get(0),
            $('#live-attrs-reset').get(0), $('.text-type-params').get(0));

}