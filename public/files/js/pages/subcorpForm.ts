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
import * as Immutable from 'immutable';
import * as React from 'react';
import RSVP from 'rsvp';
import {Kontext, TextTypes} from '../types/common';
import {PluginInterfaces} from '../types/plugins';
import {PageModel} from '../app/main';
import {init as subcorpViewsInit} from '../views/subcorp/forms';
import {SubcorpWithinFormModel, SubcorpFormModel} from '../models/subcorp/form';
import {UserSettings} from '../app/userSettings';
import {TextTypesModel} from '../models/textTypes/attrValues';
import {init as ttViewsInit, TextTypesPanelProps} from '../views/textTypes';
import {NonQueryCorpusSelectionModel} from '../models/corpsel';
import {init as basicOverviewViewsInit} from '../views/query/basicOverview';
import * as corplistComponent from 'plugins/corparch/init';
import liveAttributes from 'plugins/liveAttributes/init';
import subcMixer from 'plugins/subcmixer/init';

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
export class SubcorpForm {

    private corpusIdent:Kontext.FullCorpusIdent;

    private layoutModel:PageModel;

    private corplistComponent:PluginInterfaces.ICorparchCorpSelection;

    private viewComponents:any; // TODO types

    private subcorpFormModel:SubcorpFormModel;

    private subcorpWithinFormModel:SubcorpWithinFormModel;

    private textTypesModel:TextTypesModel;

    private subcorpSel:PluginInterfaces.ICorparchCorpSelection;

    constructor(pageModel:PageModel, corpusIdent:Kontext.FullCorpusIdent) {
        this.layoutModel = pageModel;
        this.corpusIdent = corpusIdent;
    }

    getCurrentSubcorpus():string {
        return this.subcorpFormModel.getSubcname();
    }

    getOrigSubcorpName():string {
        return this.subcorpFormModel.getSubcname();
    }

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.corpusIdent.id]);
    }

    getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem> {
        return Immutable.List<Kontext.AttrItem>();
    }

    getAvailableSubcorpora():Immutable.List<Kontext.SubcorpListItem> {
        return Immutable.List<{n:string; v:string; pub:string}>();
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

    createTextTypesComponents():TTInitData {
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

        const liveAttrsPlugin:PluginInterfaces.ILiveAttributes = liveAttributes(
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
        if (this.layoutModel.pluginIsActive('live_attributes')) {
            this.textTypesModel.setTextInputChangeCallback(liveAttrsPlugin.getAutoCompleteTrigger());
            this.textTypesModel.addSelectionChangeListener(target => {
                liveAttrsPlugin.setControlsEnabled(target.hasSelectedItems() ||
                        liveAttrsPlugin.hasSelectedLanguages());
            });
        }
        const subcmixerPlg = subcMixer(
            this.layoutModel.pluginApi(),
            this.textTypesModel,
            () => this.subcorpFormModel.getSubcname(),
            () => liveAttrsPlugin.getAlignedCorpora(),
            this.layoutModel.getConf<string>('CorpusIdAttr')
        );

        let subcMixerComponent:React.ComponentClass;
        if (this.layoutModel.pluginIsActive('subcmixer')) {
            if (liveAttrsPlugin) {
                liveAttrsPlugin.addUpdateListener(subcmixerPlg.refreshData.bind(subcmixerPlg));
                subcMixerComponent = subcmixerPlg.getWidgetView();

            } else {
                throw new Error('Subcmixer plug-in requires live_attributes plug-in to be operational');
            }

        } else {
            subcMixerComponent = null;
        }
        const liveAttrsViews = liveAttrsPlugin ? liveAttrsPlugin.getViews(subcMixerComponent,this.textTypesModel) : {};

        const attachedAlignedCorporaProvider = this.layoutModel.pluginIsActive('live_attributes') ?
            () => liveAttrsPlugin.getAlignedCorpora().filter(v => v.selected).toList() :
            () => Immutable.List<TextTypes.AlignedLanguageItem>();

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

    private initCorpusInfo():void {
        const queryOverviewViews = basicOverviewViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.subcorpSel
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
            }
        );
    }

    init():void {
        const getModeldAlignedCorp = () => {
            return this.layoutModel.userSettings.get<Array<string>>(UserSettings.ALIGNED_CORPORA_KEY) || [];
        };

        this.layoutModel.init().then(
            () => {
                const ttComponent = this.createTextTypesComponents();
                    this.subcorpWithinFormModel = new SubcorpWithinFormModel(
                    this.layoutModel.dispatcher,
                    Object.keys(this.layoutModel.getConf('structsAndAttrs'))[0], // TODO what about order?
                    this.layoutModel.getConf<Array<{[key:string]:string}>>('currentWithinJson')
                );
                this.subcorpSel = new NonQueryCorpusSelectionModel({
                    layoutModel: this.layoutModel,
                    dispatcher: this.layoutModel.dispatcher,
                    usesubcorp: this.corpusIdent.usesubcorp,
                    origSubcorpName: this.corpusIdent.origSubcorpName,
                    corpora: [this.corpusIdent.id],
                    availSubcorpora: []
                });
                this.subcorpFormModel = new SubcorpFormModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.subcorpWithinFormModel,
                    ttComponent.ttModel,
                    this.layoutModel.getCorpusIdent().id,
                    ttComponent.attachedAlignedCorporaProvider
                );

                const corplistWidget = corplistComponent.createWidget(
                    this.layoutModel.createActionUrl('subcorpus/subcorp_form'),
                    this.layoutModel.pluginApi(),
                    this.subcorpSel,
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

                this.initCorpusInfo();

                this.viewComponents = subcorpViewsInit({
                    dispatcher: this.layoutModel.dispatcher,
                    he: this.layoutModel.getComponentHelpers(),
                    CorparchComponent: corplistWidget,
                    subcorpFormModel: this.subcorpFormModel,
                    subcorpWithinFormModel: this.subcorpWithinFormModel
                });
                this.initSubcorpForm(ttComponent.component, ttComponent.props);
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