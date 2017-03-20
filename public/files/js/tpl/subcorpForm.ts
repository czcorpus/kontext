/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../types/common.d.ts" />
/// <reference path="../types/views.d.ts" />
/// <reference path="../types/plugins/corparch.ts" />
/// <reference path="../types/plugins/liveAttributes.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />

import $ = require('jquery');
import * as RSVP from 'vendor/rsvp';
import {PageModel} from './document';
import * as popupBox from '../popupbox';
import {init as subcorpViewsInit} from 'views/subcorp/forms';
import {SubcorpFormStore} from '../stores/subcorp/form';
import * as liveAttributes from 'plugins/liveAttributes/init';
import subcMixer = require('plugins/subcmixer/init');
import {UserSettings} from '../userSettings';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {init as ttViewsInit} from 'views/textTypes';
import corplistComponent = require('plugins/corparch/init');
import * as Immutable from 'vendor/immutable';



/**
 * A page model for the 'create new subcorpus' page.
 */
export class SubcorpForm implements Kontext.QuerySetupHandler {

    private layoutModel:PageModel;

    private corplistComponent:CorpusArchive.Widget;

    private viewComponents:any; // TODO types

    private subcorpFormStore:SubcorpFormStore;

    private textTypesStore:TextTypesStore;

    constructor(pageModel:PageModel) {
        this.layoutModel = pageModel;
        const subcForm = $('#subcorp-form');
        this.corplistComponent = corplistComponent.create(
            window.document.getElementById('corparch-mount'),
            'subcorpus/subcorp_form',
            this.layoutModel.pluginApi(),
            this,
            {editable: true}
        );
    }

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void {}

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>();
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return Immutable.List<{n:string; label:string}>();
    }

    subcCreationVariantSwitch(value:string):void {
        const widgetMap = {
            'raw': '#subc-within-row',
            'gui': '#subcorp-text-type-selection'
        };
        const jqSubmitBtn = $('#subcorp-form').find('button[type="submit"]');
        for (let p in widgetMap) {
            if (widgetMap.hasOwnProperty(p)) {
                $(widgetMap[p]).hide();
            }
        }
        jqSubmitBtn.off('click.customized');
        $(widgetMap[value]).show();
        if (value === 'raw') {
            jqSubmitBtn.show();
            jqSubmitBtn.on('click.customized', (evt:JQueryEventObject) => {
                $('#within-json-field').val(this.subcorpFormStore.exportJson());
            });
            $('.text-type-params').find('input[type="checkbox"]').attr('disabled', '');
            this.layoutModel.renderReactComponent(this.viewComponents.WithinBuilder,
                    $('#subc-within-row .container').get(0),
                    {
                        structsAndAttrs: this.layoutModel.getConf('structsAndAttrs')
                    }
            );

        } else if (value === 'gui') {
            jqSubmitBtn.show();

        } else {
            throw new Error('Unknown subcorpus sub-menu item: ' + value);
        }
    }

    initSubcCreationVariantSwitch():void {
        $('input.method-select').on('click', (event) => {
            this.subcCreationVariantSwitch($(event.target).val());
        });
        this.subcCreationVariantSwitch($('input[name="method"]:checked').val());
    }

    /**
     * When user changes size from tokens to document counts (or other way around) he loses
     * current unsaved checkbox selection. This forces a dialog box to prevent unwanted action.
     */
    sizeUnitsSafeSwitch():void {
        $('.text-type-top-bar a').on('click', (event) => {
            const ans = confirm(this.layoutModel.translate('global__this_action_resets_current_selection'));

            if (!ans) {
                event.preventDefault();
                event.stopPropagation(); // in case some other actions are bound
            }
        });
    }

    initHints():void {
        const attrs = this.layoutModel.getConf('structsAndAttrs');
        const msg = this.layoutModel.translate('global__within_hint_text');
        const hintRoot = $(window.document.createElement('div'));
        const structList = $(window.document.createElement('ul'));
        const hintAttrs = $(window.document.createElement('p'));

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
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesStore = new TextTypesStore(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData,
                this.layoutModel.getConf<TextTypes.ServerCheckedValues>('CheckedSca')
        );
        const ttViewComponents = ttViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.textTypesStore
        );
        let liveAttrsProm;
        if (this.layoutModel.hasPlugin('live_attributes')) {
            liveAttrsProm = liveAttributes.create(this.layoutModel.pluginApi(), this.textTypesStore, textTypesData['bib_attr']);

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
                let subcmixerViews;
                if (this.layoutModel.getConf<boolean>('HasSubcmixer')
                        && this.layoutModel.getConf<string>('CorpusIdAttr')) {
                    const subcmixerStore = subcMixer.create(
                        this.layoutModel.pluginApi(),
                        this.textTypesStore,
                        () => $('#subcname').val(),
                        () => liveAttrsStore.getAlignedCorpora(),
                        this.layoutModel.getConf<string>('CorpusIdAttr')
                    );
                    liveAttrsStore.addUpdateListener(subcmixerStore.refreshData.bind(subcmixerStore));
                    subcmixerViews = subcMixer.getViews(
                        this.layoutModel.dispatcher,
                        this.layoutModel.exportMixins(),
                        this.layoutModel.layoutViews,
                        subcmixerStore
                    );

                } else {
                    subcmixerViews = {
                        Widget: null
                    };
                }
                const liveAttrsViews = liveAttributes.getViews(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    subcmixerViews,
                    this.textTypesStore,
                    liveAttrsStore
                );
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
        const getStoredAlignedCorp = () => {
            return this.layoutModel.userSettings.get<Array<string>>(UserSettings.ALIGNED_CORPORA_KEY) || [];
        };

        this.layoutModel.init().then(
            () => {
                this.subcorpFormStore = new SubcorpFormStore(
                    this.layoutModel.dispatcher,
                    Object.keys(this.layoutModel.getConf('structsAndAttrs'))[0], // TODO what about order?
                    this.layoutModel.getConf<Array<{[key:string]:string}>>('currentWithinJson')
                );
                this.viewComponents = subcorpViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    this.subcorpFormStore
                );
                this.initSubcCreationVariantSwitch();
                this.sizeUnitsSafeSwitch();
                this.initHints();
            },
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
        this.createTextTypesComponents();
    }
}


export function init(conf:Kontext.Conf) {
    const layoutModel:PageModel = new PageModel(conf);
    const pageModel = new SubcorpForm(layoutModel);
    pageModel.init(conf);
}