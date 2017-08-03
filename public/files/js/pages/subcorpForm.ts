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
/// <reference path="../vendor.d.ts/rsvp.d.ts" />
/// <reference path="../vendor.d.ts/immutable.d.ts" />
/// <reference path="../vendor.d.ts/react.d.ts" />

import * as RSVP from 'vendor/rsvp';
import {PageModel} from './document';
import {init as subcorpViewsInit} from 'views/subcorp/forms';
import {SubcorpWithinFormStore, SubcorpFormStore} from '../stores/subcorp/form';
import liveAttributes from 'plugins/liveAttributes/init';
import subcMixer from 'plugins/subcmixer/init';
import {UserSettings} from '../userSettings';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {init as ttViewsInit} from 'views/textTypes';
import * as corplistComponent from 'plugins/corparch/init'
import * as Immutable from 'vendor/immutable';
import * as React from 'vendor/react';


export interface TTInitData {
    component:React.ReactClass;
    props:{[p:string]:any};
    ttStore:TextTypesStore;
}


/**
 * A page model for the 'create new subcorpus' page.
 */
export class SubcorpForm implements Kontext.QuerySetupHandler {

    private corpusIdent:Kontext.FullCorpusIdent;

    private layoutModel:PageModel;

    private corplistComponent:any;

    private viewComponents:any; // TODO types

    private subcorpFormStore:SubcorpFormStore;

    private subcorpWithinFormStore:SubcorpWithinFormStore;

    private textTypesStore:TextTypesStore;

    constructor(pageModel:PageModel, corpusIdent:Kontext.FullCorpusIdent) {
        this.layoutModel = pageModel;
        this.corpusIdent = corpusIdent;
    }

    registerCorpusSelectionListener(fn:(corpname:string, aligned:Immutable.List<string>, subcorp:string)=>void) {}

    getCurrentSubcorpus():string {
        return this.subcorpFormStore.getSubcname();
    }

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.corpusIdent.id]);
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return Immutable.List<{n:string; label:string}>();
    }

    initSubcorpForm(ttComponent:React.ReactClass, ttProps:{[p:string]:any}):void {
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

        const p1 = liveAttributes(
            this.layoutModel.pluginApi(),
            this.textTypesStore,
            null, // no corplist provider => manual aligned corp. selection mode
            () => this.textTypesStore.hasSelectedItems(),
            {
                bibAttr: textTypesData['bib_attr'],
                availableAlignedCorpora: this.layoutModel.getConf<Array<{n:string; label:string}>>('availableAlignedCorpora'),
                manualAlignCorporaMode: true
            }
        );
        const p2 = p1.then(
            (liveAttrsPlugin:TextTypes.AttrValueTextInputListener) => {
                if (liveAttrsPlugin) {
                    this.textTypesStore.setTextInputChangeCallback(liveAttrsPlugin.getListenerCallback());
                    this.textTypesStore.addSelectionChangeListener(target => {
                        liveAttrsPlugin.setControlsEnabled(target.hasSelectedItems() ||
                                liveAttrsPlugin.hasSelectedLanguages());
                    });
                }
                return subcMixer(
                    this.layoutModel.pluginApi(),
                    this.textTypesStore,
                    () => this.subcorpFormStore.getSubcname(),
                    () => liveAttrsPlugin.getAlignedCorpora(),
                    this.layoutModel.getConf<string>('CorpusIdAttr')
                );
            }
        );

        return RSVP.all([p1, p2]).then(
            (args:[PluginInterfaces.ILiveAttributes, PluginInterfaces.ISubcMixer]) => {
                const [liveAttrs, subcmixerPlugin] = args;
                let subcMixerComponent:React.ReactClass;

                if (subcmixerPlugin) {
                    liveAttrs.addUpdateListener(subcmixerPlugin.refreshData.bind(subcmixerPlugin));
                    subcMixerComponent = subcmixerPlugin.getWidgetView();

                } else {
                    subcMixerComponent = null;
                }
                const liveAttrsViews = liveAttrs.getViews(
                    subcMixerComponent,
                    this.textTypesStore
                );
                return {
                    component: ttViewComponents.TextTypesPanel,
                    props: {
                        liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                        liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                        attributes: this.textTypesStore.getAttributes(),
                        alignedCorpora: this.layoutModel.getConf<Array<any>>('availableAlignedCorpora'),
                        manualAlignCorporaMode: true
                    },
                    ttStore: this.textTypesStore
                };
            }
        );
    }

    init(conf:Kontext.Conf):void {
        const getStoredAlignedCorp = () => {
            return this.layoutModel.userSettings.get<Array<string>>(UserSettings.ALIGNED_CORPORA_KEY) || [];
        };

        const p1 = this.layoutModel.init().then(
            () => {
                return this.createTextTypesComponents()
            }
        ).then(
            (ttComponent) => {
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
                    this.layoutModel.getConf<string>('corpname')
                );
                return ttComponent;
            }
        );

        const p2 = p1.then(
            (ttComponent) => {
                return corplistComponent.createWidget(
                    this.layoutModel.createActionUrl('subcorpus/subcorp_form'),
                    this.layoutModel.pluginApi(),
                    {
                        getCurrentSubcorpus: () => null,
                        getAvailableSubcorpora: () => Immutable.List<string>(),
                        addChangeListener: (fn:Kontext.StoreListener) => undefined
                    },
                    this,
                    {
                        itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                            window.location.href = this.layoutModel.createActionUrl('subcorpus/subcorp_form',
                                    [['corpname', corpora[0]]]);
                        }
                    }
                );
            }
        );

        RSVP.all([p1, p2]).then(
            (items:[TTInitData, React.ReactClass]) => { // TODO typescript d.ts problem (should see wrapped value, not the promise)
                this.viewComponents = subcorpViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    this.layoutModel.layoutViews,
                    items[1],
                    this.subcorpFormStore,
                    this.subcorpWithinFormStore
                );
                this.initSubcorpForm(items[0].component, items[0].props);
            }
        ).catch((err) => {
            this.layoutModel.showMessage('error', err);
            return null;
        });
    }
}


export function init(conf:Kontext.Conf) {
    const layoutModel:PageModel = new PageModel(conf);
    const pageModel = new SubcorpForm(
        layoutModel,
        layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent')
    );
    pageModel.init(conf);
}