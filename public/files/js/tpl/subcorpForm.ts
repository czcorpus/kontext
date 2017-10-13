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
/// <reference path="../types/plugins/corparch.d.ts" />
/// <reference path="../types/plugins/liveAttributes.d.ts" />
/// <reference path="../../ts/declarations/jquery.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/react.d.ts" />

import * as $ from 'jquery';
import * as RSVP from 'vendor/rsvp';
import {PageModel} from './document';
import * as popupBox from '../popupbox';
import {init as subcorpViewsInit} from 'views/subcorp/forms';
import {SubcorpWithinFormStore, SubcorpFormStore} from '../stores/subcorp/form';
import * as liveAttributes from 'plugins/liveAttributes/init';
import subcMixer = require('plugins/subcmixer/init');
import {UserSettings} from '../userSettings';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {init as ttViewsInit} from 'views/textTypes';
import corplistComponent = require('plugins/corparch/init');
import * as Immutable from 'vendor/immutable';
import * as React from 'vendor/react';


export interface TTInitData {
    component:React.Component;
    props:{[p:string]:any};
    ttStore:TextTypesStore;
    attachedAlignedCorporaProvider:()=>Immutable.List<TextTypes.AlignedLanguageItem>;
}


/**
 * A page model for the 'create new subcorpus' page.
 */
export class SubcorpForm implements Kontext.QuerySetupHandler {

    private layoutModel:PageModel;

    private corplistComponent:CorparchCommon.Widget;

    private viewComponents:any; // TODO types

    private subcorpFormStore:SubcorpFormStore;

    private subcorpWithinFormStore:SubcorpWithinFormStore;

    private textTypesStore:TextTypesStore;

    constructor(pageModel:PageModel) {
        this.layoutModel = pageModel;
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

    initSubcorpForm(ttComponent:React.Component, ttProps:{[p:string]:any}):void {
        this.layoutModel.renderReactComponent(
            this.viewComponents.SubcorpForm,
            window.document.getElementById('subcorp-form-mount'),
            {
                structsAndAttrs: this.layoutModel.getConf('structsAndAttrs'),
                ttComponent: ttComponent,
                ttProps: ttProps
            }
        );
    }

    createTextTypesComponents():RSVP.Promise<TTInitData> {
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
            liveAttrsProm = liveAttributes.create(
                this.layoutModel.pluginApi(),
                this.textTypesStore,
                null, // no corplist provider => manual aligned corp. selection mode
                () => this.textTypesStore.hasSelectedItems(),
                textTypesData['bib_attr']
            );

        } else {
            liveAttrsProm = new RSVP.Promise((fulfill:(v)=>void, reject:(err)=>void) => {
                fulfill(null);
            });
        }
        return liveAttrsProm.then(
            (liveAttrsStore:LiveAttributesInit.AttrValueTextInputListener) => {
                if (liveAttrsStore) {
                    this.textTypesStore.setTextInputChangeCallback(liveAttrsStore.getListenerCallback());
                    this.textTypesStore.addSelectionChangeListener(target => {
                        liveAttrsStore.setControlsEnabled(target.hasSelectedItems() ||
                                liveAttrsStore.hasSelectedLanguages());
                    });
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

                const attachedAlignedCorporaProvider = liveAttrsStore ?
                        () => liveAttrsStore.getAlignedCorpora() : () => Immutable.List<TextTypes.AlignedLanguageItem>();

                return {
                    component: ttViewComponents.TextTypesPanel,
                    props: {
                        liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                        liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                        attributes: this.textTypesStore.getAttributes(),
                        alignedCorpora: this.layoutModel.getConf<Array<any>>('availableAlignedCorpora'),
                        manualAlignCorporaMode: true
                    },
                    ttStore: this.textTypesStore,
                    attachedAlignedCorporaProvider: attachedAlignedCorporaProvider
                };
            }
        );
    }

    init(conf:Kontext.Conf):void {
        const getStoredAlignedCorp = () => {
            return this.layoutModel.userSettings.get<Array<string>>(UserSettings.ALIGNED_CORPORA_KEY) || [];
        };

        this.layoutModel.init().then(
            () => {
                return this.createTextTypesComponents()
            }
        ).then(
            (ttComponent:any) => { // TODO typescript d.ts problem (should see wrapped value, not the promise)
                this.subcorpWithinFormStore = new SubcorpWithinFormStore(
                    this.layoutModel.dispatcher,
                    Object.keys(this.layoutModel.getConf('structsAndAttrs'))[0], // TODO what about order?
                    this.layoutModel.getConf<Array<{[key:string]:string}>>('currentWithinJson')
                );
                this.subcorpFormStore = new SubcorpFormStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.subcorpWithinFormStore,
                    ttComponent.ttStore,
                    this.layoutModel.getConf<string>('corpname'),
                    ttComponent.attachedAlignedCorporaProvider
                );
                this.viewComponents = subcorpViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    this.layoutModel.layoutViews,
                    this.subcorpFormStore,
                    this.subcorpWithinFormStore
                );
                this.initSubcorpForm(ttComponent.component, ttComponent.props);
            }
        ).then(
            () => {
                this.corplistComponent = corplistComponent.create(
                    window.document.getElementById('corparch-mount'),
                    'subcorpus/subcorp_form',
                    this.layoutModel.pluginApi(),
                    this,
                    {editable: true}
                );
            }
        ).then(
            ()=>undefined,
            (err) => {
                this.layoutModel.showMessage('error', err);
            }
        );
    }
}


export function init(conf:Kontext.Conf) {
    const layoutModel:PageModel = new PageModel(conf);
    const pageModel = new SubcorpForm(layoutModel);
    pageModel.init(conf);
}