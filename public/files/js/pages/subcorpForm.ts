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

import {Kontext, TextTypes} from '../types/common';
import {PluginInterfaces} from '../types/plugins';
import RSVP from 'rsvp';
import {PageModel} from '../app/main';
import {init as subcorpViewsInit} from '../views/subcorp/forms';
import {SubcorpWithinFormModel, SubcorpFormModel} from '../models/subcorp/form';
import liveAttributes from 'plugins/liveAttributes/init';
import subcMixer from 'plugins/subcmixer/init';
import {UserSettings} from '../app/userSettings';
import {TextTypesModel} from '../models/textTypes/attrValues';
import {init as ttViewsInit, TextTypesPanelProps} from '../views/textTypes';
import * as corplistComponent from 'plugins/corparch/init'
import * as Immutable from 'immutable';
import * as React from 'react';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/subcorpForm.less');


export interface TTInitData {
    component:React.ComponentClass<TextTypesPanelProps>;
    props:{[p:string]:any};
    ttModel:TextTypesModel;
    attachedAlignedCorporaProvider:()=>Immutable.List<TextTypes.AlignedLanguageItem>;
}


export type StructsAndAttrs = {[struct:string]:Array<string>};


/**
 * A page model for the 'create new subcorpus' page.
 */
export class SubcorpForm implements PluginInterfaces.ICorparchCorpSelection {

    private corpusIdent:Kontext.FullCorpusIdent;

    private layoutModel:PageModel;

    private corplistComponent:any;

    private viewComponents:any; // TODO types

    private subcorpFormModel:SubcorpFormModel;

    private subcorpWithinFormModel:SubcorpWithinFormModel;

    private textTypesModel:TextTypesModel;

    constructor(pageModel:PageModel, corpusIdent:Kontext.FullCorpusIdent) {
        this.layoutModel = pageModel;
        this.corpusIdent = corpusIdent;
    }

    getCurrentSubcorpus():string {
        return this.subcorpFormModel.getSubcname();
    }

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.corpusIdent.id]);
    }

    getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem> {
        return Immutable.List<Kontext.AttrItem>();
    }

    getAvailableSubcorpora():Immutable.List<{n:string; v:string}> {
        return Immutable.List<{n:string; v:string}>();
    }

    initSubcorpForm(ttComponent:React.ComponentClass<TextTypesPanelProps>, ttProps:{[p:string]:any}):void {
        this.layoutModel.renderReactComponent(
            this.viewComponents.SubcorpForm,
            window.document.getElementById('subcorp-form-mount'),
            {
                structsAndAttrs: this.layoutModel.getConf<StructsAndAttrs>('structsAndAttrs'),
                ttComponent: ttComponent,
                ttProps: ttProps
            }
        );
    }

    createTextTypesComponents():RSVP.Promise<TTInitData> {
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesModel = new TextTypesModel(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData
        );
        const ttViewComponents = ttViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.textTypesModel
        );

        const p1 = liveAttributes(
            this.layoutModel.pluginApi(),
            this.textTypesModel,
            null, // no corplist provider => manual aligned corp. selection mode
            () => this.textTypesModel.hasSelectedItems(),
            {
                bibAttr: textTypesData['bib_attr'],
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora'),
                refineEnabled: true,
                manualAlignCorporaMode: true
            }
        );
        const p2 = p1.then(
            (liveAttrsPlugin:TextTypes.AttrValueTextInputListener) => {
                if (this.layoutModel.pluginIsActive('live_attributes')) {
                    this.textTypesModel.setTextInputChangeCallback(liveAttrsPlugin.getAutoCompleteTrigger());
                    this.textTypesModel.addSelectionChangeListener(target => {
                        liveAttrsPlugin.setControlsEnabled(target.hasSelectedItems() ||
                                liveAttrsPlugin.hasSelectedLanguages());
                    });
                }
                return subcMixer(
                    this.layoutModel.pluginApi(),
                    this.textTypesModel,
                    () => this.subcorpFormModel.getSubcname(),
                    () => liveAttrsPlugin.getAlignedCorpora(),
                    this.layoutModel.getConf<string>('CorpusIdAttr')
                );
            }
        );

        return RSVP.all([p1, p2]).then(
            (args:[PluginInterfaces.ILiveAttributes, PluginInterfaces.ISubcMixer]) => {
                const [liveAttrs, subcmixerPlugin] = args;
                let subcMixerComponent:React.ComponentClass;
                if (this.layoutModel.pluginIsActive('subcmixer')) {
                    if (liveAttrs) {
                        liveAttrs.addUpdateListener(subcmixerPlugin.refreshData.bind(subcmixerPlugin));
                        subcMixerComponent = subcmixerPlugin.getWidgetView();

                    } else {
                        throw new Error('Subcmixer plug-in requires live_attributes plug-in to be operational');
                    }

                } else {
                    subcMixerComponent = null;
                }
                const liveAttrsViews = liveAttrs ? liveAttrs.getViews(subcMixerComponent,this.textTypesModel) : {};

                const attachedAlignedCorporaProvider = this.layoutModel.pluginIsActive('live_attributes') ?
                    () => liveAttrs.getAlignedCorpora() : () => Immutable.List<TextTypes.AlignedLanguageItem>();

                return {
                    component: ttViewComponents.TextTypesPanel,
                    props: {
                        liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                        liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                        attributes: this.textTypesModel.getAttributes(),
                        alignedCorpora: this.layoutModel.getConf<Array<any>>('availableAlignedCorpora'),
                        manualAlignCorporaMode: true
                    },
                    ttModel: this.textTypesModel,
                    attachedAlignedCorporaProvider: attachedAlignedCorporaProvider
                };
            }
        );
    }

    init():void {
        const getModeldAlignedCorp = () => {
            return this.layoutModel.userSettings.get<Array<string>>(UserSettings.ALIGNED_CORPORA_KEY) || [];
        };

        const p1 = this.layoutModel.init().then(
            () => {
                return this.createTextTypesComponents()
            }
        ).then(
            (ttComponent) => {
                 this.subcorpWithinFormModel = new SubcorpWithinFormModel(
                    this.layoutModel.dispatcher,
                    Object.keys(this.layoutModel.getConf('structsAndAttrs'))[0], // TODO what about order?
                    this.layoutModel.getConf<Array<{[key:string]:string}>>('currentWithinJson')
                );
                this.subcorpFormModel = new SubcorpFormModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.subcorpWithinFormModel,
                    ttComponent.ttModel,
                    this.layoutModel.getConf<string>('corpname'),
                    ttComponent.attachedAlignedCorporaProvider
                );
                return ttComponent;
            }
        );

        const p2 = p1.then(
            (ttComponent) => {
                return corplistComponent.createWidget(
                    this.layoutModel.createActionUrl('subcorpus/subcorp_form'),
                    this.layoutModel.pluginApi(),
                    this,
                    {
                        itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                            return this.layoutModel.switchCorpus(corpora, subcorpId).then(
                                () => {
                                    // all the components must be deleted to prevent memory leaks
                                    // and unwanted action handlers from previous instance
                                    this.layoutModel.unmountReactComponent(window.document.getElementById('subcorp-form-mount'));
                                    this.layoutModel.unmountReactComponent(window.document.getElementById('view-options-mount'));
                                    this.layoutModel.unmountReactComponent(window.document.getElementById('general-overview-mount'));
                                    this.layoutModel.unmountReactComponent(window.document.getElementById('query-overview-mount'));
                                    this.init();
                                },
                                (err) => {
                                    this.layoutModel.showMessage('error', err);
                                }
                            )
                        }
                    }
                );
            }
        );

        RSVP.all([p1, p2]).then(
            (items:[TTInitData, React.ComponentClass<TextTypesPanelProps>]) => { // TODO typescript d.ts problem (should see wrapped value, not the promise)
                this.viewComponents = subcorpViewsInit({
                    dispatcher: this.layoutModel.dispatcher,
                    he: this.layoutModel.getComponentHelpers(),
                    CorparchComponent: items[1],
                    subcorpFormModel: this.subcorpFormModel,
                    subcorpWithinFormModel: this.subcorpWithinFormModel
                });
                this.initSubcorpForm(items[0].component, items[0].props);
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch(
            (err) => console.error(err)
        );
    }
}


export function init(conf:Kontext.Conf):void {
    const layoutModel:PageModel = new PageModel(conf);
    const pageModel = new SubcorpForm(
        layoutModel,
        layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent')
    );
    pageModel.init();
}