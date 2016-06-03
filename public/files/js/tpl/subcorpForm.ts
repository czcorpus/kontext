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
/// <reference path="../common/plugins/liveAttributes.d.ts" />
/// <reference path="../views/subcorpForm.d.ts" />

// -- dynamic loading of custom plug-in implementation
/// <amd-dependency path="plugins/corparch/init" name="corplistComponent" />
/// <amd-dependency path="plugins/subcmixer/init" name="subcmixer" />

/// <amd-dependency path="../views/textTypes" name="ttViews" />

import $ = require('jquery');
import document = require('./document');
import popupBox = require('popupbox');
import subcorpFormViews = require('views/subcorpForm');
import subcorpFormStoreModule = require('../stores/subcorpForm');
import queryInput = require('../queryInput');
import liveAttributes = require('plugins/liveAttributes/init');
import userSettings = require('../userSettings');
import textTypesStore = require('../stores/textTypes');

// dynamic imports
declare var subcmixer:Subcmixer.Module;
declare var corplistComponent:CorpusArchive.Module;

declare var ttViews:any;


/**
 * This model contains functionality related to the subcorp_form.tmpl template
 */
export class SubcorpForm implements Kontext.CorpusSetupHandler {

    private layoutModel:document.PageModel;

    private corplistComponent:CorpusArchive.Widget;

    private viewComponents:any; // TODO types

    private subcorpFormStore:subcorpFormStoreModule.SubcorpFormStore;

    private extendedApi:Kontext.QueryPagePluginApi;

    private textTypesStore:textTypesStore.TextTypesStore;

    constructor(pageModel:document.PageModel, viewComponents,
            subcorpFormStore:subcorpFormStoreModule.SubcorpFormStore) {
        this.layoutModel = pageModel;
        this.extendedApi = queryInput.extendedApi(pageModel, this);
        let subcForm = $('#subcorp-form');
        let corplist = corplistComponent.create(subcForm.find('select[name="corpname"]').get(0),
                this.extendedApi, {formTarget: 'subcorp_form', submitMethod: 'GET', editable: false});
        this.corplistComponent = corplistComponent;
        this.viewComponents = viewComponents;
        this.subcorpFormStore = subcorpFormStore;
    }

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnSubcorpChangeAction(fn:(corpname:string)=>void):void {}

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {}

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
            this.layoutModel.renderReactComponent(this.viewComponents.WithinBuilder,
                    $('#subc-within-row .container').get(0),
                    {
                        structsAndAttrs: this.layoutModel.getConf('structsAndAttrs')
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
                    this.layoutModel.pluginApi());
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
            let ans = confirm(self.layoutModel.translate('global__this_action_resets_current_selection'));

            if (!ans) {
                event.preventDefault();
                event.stopPropagation(); // in case some other actions are bound
            }
        });
    }

    initHints():void {
        let attrs = this.layoutModel.getConf('structsAndAttrs');
        let msg = this.layoutModel.translate('global__within_hint_text');
        let hintRoot = $(window.document.createElement('div'));
        let structList = $(window.document.createElement('ul'));
        let hintAttrs = $(window.document.createElement('p'));

        hintRoot.append('<p>' + msg + '</p>');
        hintRoot.append(hintAttrs);
        hintAttrs.append(this.layoutModel.translate('global__within_hint_attrs') + ':');

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

    createTextTypesComponents():void {
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
        if (this.layoutModel.hasPlugin('live_attributes')) {
            liveAttrsProm = liveAttributes.create(this.extendedApi, this.textTypesStore, textTypesData['bib_attr']);

        } else {
            liveAttrsProm = new RSVP.Promise((fulfill:(v)=>void, reject:(err)=>void) => {
                fulfill(null);
            });
        }
        liveAttrsProm.then(
            (liveAttrsStore:LiveAttributesInit.AttrValueTextInputListener) => {
                if (liveAttrsStore) {
                    this.textTypesStore.setTextInputChangeCallback(liveAttrsStore.getListenerCallback());
                }
                let liveAttrsViews = liveAttributes.getViews(this.layoutModel.dispatcher,
                        this.layoutModel.exportMixins(), this.textTypesStore, liveAttrsStore);
                this.layoutModel.renderReactComponent(
                    ttViewComponents.TextTypesPanel,
                    $('#subcorp-text-type-selection').get(0),
                    {
                        liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                        liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                        attributes: this.textTypesStore.getAttributes(),
                        alignedCorpora: this.layoutModel.getConf<Array<any>>('availableAlignedCorpora')
                    }
                );
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }

    init(conf:Kontext.Conf):void {
        let getStoredAlignedCorp = () => {
            return this.layoutModel.userSettings.get<Array<string>>(userSettings.UserSettings.ALIGNED_CORPORA_KEY) || [];
        }
        this.layoutModel.init().add({
            initSubcCreationVariantSwitch: this.initSubcCreationVariantSwitch(),
            sizeUnitsSafeSwitch: this.sizeUnitsSafeSwitch(),
            initHints: this.initHints()
        });
        this.createTextTypesComponents();
    }
}


export function init(conf:Kontext.Conf) {
    let layoutModel:document.PageModel = new document.PageModel(conf);
    let subcorpFormStore = new subcorpFormStoreModule.SubcorpFormStore(
        layoutModel.dispatcher, Object.keys(layoutModel.getConf('structsAndAttrs'))[0],
        layoutModel.getConf<Array<{[key:string]:string}>>('currentWithinJson'));
    let subcorpFormComponents = subcorpFormViews.init(layoutModel.dispatcher,
            layoutModel.exportMixins(), subcorpFormStore);
    let pageModel = new SubcorpForm(layoutModel, subcorpFormComponents,
            subcorpFormStore);
    pageModel.init(conf);
}