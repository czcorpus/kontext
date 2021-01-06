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

import * as React from 'react';

import { Kontext, TextTypes } from '../types/common';
import { PluginInterfaces } from '../types/plugins';
import { PageModel } from '../app/page';
import { init as subcorpViewsInit } from '../views/subcorp/forms';
import { SubcorpFormModel } from '../models/subcorp/form';
import { SubcorpWithinFormModel } from '../models/subcorp/withinForm';
import { TextTypesModel } from '../models/textTypes/main';
import { init as ttViewsInit, TextTypesPanelProps } from '../views/textTypes';
import { NonQueryCorpusSelectionModel } from '../models/corpsel';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview';
import { PluginName } from '../app/plugin';
import { KontextPage } from '../app/main';
import corplistComponent from 'plugins/corparch/init';
import liveAttributes from 'plugins/liveAttributes/init';
import subcMixer from 'plugins/subcmixer/init';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../models/common/actions';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/subcorpForm.less');


interface TTProps {
    alignedCorpora:Array<string>;
    LiveAttrsCustomTT:React.ComponentClass|React.SFC|null;
    LiveAttrsView:React.ComponentClass|React.SFC;
    manualAlignCorporaMode:boolean;
}


export interface TTInitData {
    component:React.ComponentClass<TextTypesPanelProps>;
    props:TTProps;
    ttModel:TextTypesModel;
}


/**
 * A page model for the 'create new subcorpus' page.
 */
export class SubcorpForm {

    private corpusIdent:Kontext.FullCorpusIdent;

    private layoutModel:PageModel;

    private viewComponents:any; // TODO types

    private subcorpFormModel:SubcorpFormModel;

    private subcorpWithinFormModel:SubcorpWithinFormModel;

    private textTypesModel:TextTypesModel;

    private subcorpSel:NonQueryCorpusSelectionModel;

    private corparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private liveAttrsPlugin:PluginInterfaces.LiveAttributes.IPlugin;

    constructor(pageModel:PageModel, corpusIdent:Kontext.FullCorpusIdent) {
        this.layoutModel = pageModel;
        this.corpusIdent = corpusIdent;
    }

    private initSubcorpForm(ttComponent:React.ComponentClass<TextTypesPanelProps>, ttProps:TTProps):void {
        this.layoutModel.renderReactComponent(
            this.viewComponents.SubcorpForm,
            window.document.getElementById('subcorp-form-mount'),
            {
                ttComponent,
                ttProps
            }
        );
    }

    private createTextTypesComponents(selectedTextTypes:TextTypes.ExportedSelection):TTInitData {
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesModel = new TextTypesModel(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData,
                false,
                selectedTextTypes
        );
        const ttViewComponents = ttViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.textTypesModel
        );

        this.liveAttrsPlugin = liveAttributes(
            this.layoutModel.pluginApi(),
            this.textTypesModel,
            this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES),
            true, // manual aligned corp. selection mode
            {
                bibAttr: textTypesData['bib_attr'],
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>(
                    'availableAlignedCorpora'
                ),
                refineEnabled: true,
                manualAlignCorporaMode: true
            }
        );

        const subcmixerPlg = subcMixer(
            this.layoutModel.pluginApi(),
            this.textTypesModel,
            this.layoutModel.getConf<string>('CorpusIdAttr')
        );

        let subcMixerComponent:PluginInterfaces.SubcMixer.View;
        if (this.layoutModel.pluginTypeIsActive(PluginName.SUBCMIXER) &&
                    this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES)) {
                subcMixerComponent = subcmixerPlg.getWidgetView();

        } else {
            subcMixerComponent = null;
        }

        let liveAttrsViews:PluginInterfaces.LiveAttributes.Views;
        if (this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES)) {
            liveAttrsViews = this.liveAttrsPlugin.getViews(subcMixerComponent, this.textTypesModel);
            this.textTypesModel.enableAutoCompleteSupport();

        } else {
            liveAttrsViews = {
                LiveAttrsCustomTT: null,
                LiveAttrsView: null
            };
        }
        return {
            component: ttViewComponents.TextTypesPanel,
            props: {
                ...liveAttrsViews,
                alignedCorpora: this.layoutModel.getConf<Array<any>>('availableAlignedCorpora'),
                manualAlignCorporaMode: true
            },
            ttModel: this.textTypesModel
        };
    }

    private initCorpusInfo():void {
        const queryOverviewViews = basicOverviewViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers()
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            const ttComponent = this.createTextTypesComponents(
                this.layoutModel.getConf<TextTypes.ExportedSelection>('SelectedTextTypes')
            );
            this.subcorpSel = new NonQueryCorpusSelectionModel({
                layoutModel: this.layoutModel,
                dispatcher: this.layoutModel.dispatcher,
                usesubcorp: this.corpusIdent.usesubcorp,
                origSubcorpName: this.corpusIdent.origSubcorpName,
                foreignSubcorp: this.corpusIdent.foreignSubcorp,
                corpora: [this.corpusIdent.id],
                availSubcorpora: []
            });
            this.subcorpFormModel = new SubcorpFormModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                ttComponent.ttModel,
                this.layoutModel.getCorpusIdent().id,
                'gui'
            );

            this.subcorpWithinFormModel = new SubcorpWithinFormModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                'gui',
                this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs'),
                this.subcorpFormModel
            );

            this.corparchPlugin = corplistComponent(this.layoutModel.pluginApi());

            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('subcorp-form-mount')
                    );
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('view-options-mount')
                    );
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('general-overview-mount')
                    );
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('query-overview-mount')
                    );
                    this.init();
                },
                this.corparchPlugin,
                this.textTypesModel,
                this.liveAttrsPlugin,
                this.subcorpFormModel,
                this.subcorpWithinFormModel
            );

            this.initCorpusInfo();

            const corplistWidget = this.corparchPlugin.createWidget(
                this.layoutModel.createActionUrl('subcorpus/subcorp_form'),
                {
                    itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                        this.layoutModel.dispatcher.dispatch<GlobalActions.SwitchCorpus>({
                            name: GlobalActionName.SwitchCorpus,
                            payload: {
                                corpora: corpora,
                                subcorpus: subcorpId
                            }
                        });
                    }
                }
            );

            this.viewComponents = subcorpViewsInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                CorparchComponent: corplistWidget,
                subcorpFormModel: this.subcorpFormModel,
                subcorpWithinFormModel: this.subcorpWithinFormModel
            });
            this.initSubcorpForm(ttComponent.component, ttComponent.props);
        });
    }
}


export function init(conf:Kontext.Conf):void {
    const layoutModel:PageModel = new KontextPage(conf);
    const pageModel = new SubcorpForm(
        layoutModel,
        layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent')
    );
    pageModel.init();
}