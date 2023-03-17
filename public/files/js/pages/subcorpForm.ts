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

import * as Kontext from '../types/kontext';
import * as TextTypes from '../types/textTypes';
import * as PluginInterfaces from '../types/plugins';
import { PageModel } from '../app/page';
import { init as subcorpViewsInit } from '../views/subcorp/forms';
import { SubcorpFormModel } from '../models/subcorp/new';
import { SubcorpWithinFormModel } from '../models/subcorp/withinForm';
import { TextTypesModel } from '../models/textTypes/main';
import { init as ttViewsInit, TextTypesPanelProps } from '../views/textTypes';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview';
import { PluginName } from '../app/plugin';
import { KontextPage } from '../app/main';
import corplistComponent from 'plugins/corparch/init';
import liveAttributes from 'plugins/liveAttributes/init';
import subcMixer from 'plugins/subcmixer/init';
import { Actions as GlobalActions } from '../models/common/actions';
import { importInitialTTData, TTInitialData } from '../models/textTypes/common';
import { ConcFormArgs } from '../models/query/formArgs';
import { fetchQueryFormArgs } from '../models/query/first';
import { ServerWithinSelection } from '../models/subcorp/common';
import { Root } from 'react-dom/client';
import { Ident } from 'cnc-tskit';


interface TTProps {
    alignedCorpora:Array<string>;
    LiveAttrsCustomTT:React.ComponentClass|React.FC|null;
    LiveAttrsView:React.ComponentClass|React.FC;
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

    private corparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private liveAttrsPlugin:PluginInterfaces.LiveAttributes.IPlugin;

    private subcorpFormRoot:Root;

    private queryOverviewRoot:Root;

    constructor(pageModel:PageModel, corpusIdent:Kontext.FullCorpusIdent) {
        this.layoutModel = pageModel;
        this.corpusIdent = corpusIdent;
    }

    private initSubcorpForm(ttComponent:React.ComponentClass<TextTypesPanelProps>, ttProps:TTProps):void {
        this.subcorpFormRoot = this.layoutModel.renderReactComponent(
            this.viewComponents.SubcorpForm,
            window.document.getElementById('subcorp-form-mount'),
            {
                ttComponent,
                ttProps
            }
        );
    }

    unregister():void {}

    private createTextTypesComponents(selectedTextTypes:TextTypes.ExportedSelection):TTInitData {
        const ttData = this.layoutModel.getConf<TTInitialData>('textTypesData');
        const ttSelections = importInitialTTData(ttData, {});
        this.textTypesModel = new TextTypesModel({
                dispatcher: this.layoutModel.dispatcher,
                pluginApi: this.layoutModel.pluginApi(),
                attributes: ttSelections,
                readonlyMode: false,
                bibIdAttr: ttData.bib_id_attr,
                bibLabelAttr: ttData.bib_label_attr
        });
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);
        const hasSelectedItems = this.textTypesModel.applyCheckedItems(selectedTextTypes, queryFormArgs.bib_mapping);


        const ttViewComponents = ttViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.textTypesModel
        );

        this.liveAttrsPlugin = liveAttributes(
            this.layoutModel.pluginApi(),
            this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES),
            true, // manual aligned corp. selection mode
            {
                bibIdAttr: ttData.bib_id_attr,
                bibLabelAttr: ttData.bib_label_attr,
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>(
                    'availableAlignedCorpora'
                ),
                refineEnabled: hasSelectedItems,
                manualAlignCorporaMode: true,
                subcorpTTStructure: {},
                textTypesData: this.layoutModel.getConf<TTInitialData>('textTypesData')
            }
        );

        const subcmixerPlg = subcMixer(
            this.layoutModel.pluginApi(),
            ttSelections,
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
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.getModels().mainMenuModel
        );
        this.queryOverviewRoot = this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            const ttComponent = this.createTextTypesComponents(
                this.layoutModel.getConf<TextTypes.ExportedSelection>('SelectedTextTypes')
            );
            const withinCond = this.layoutModel.getConf<Array<ServerWithinSelection>>('WithinCond');
            const formType = withinCond ? 'within' : 'tt-sel';
            this.subcorpFormModel = new SubcorpFormModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                this.layoutModel.getCorpusIdent().id,
                formType,
                this.corpusIdent.usesubcorp ?
                    {
                        subcname: this.layoutModel.getConf<string>('SubcorpusName'),
                        description: this.layoutModel.getConf<string>('SubcorpusDesc'),
                        subcorpusId: this.corpusIdent.usesubcorp
                    } :
                    undefined
            );
            this.subcorpWithinFormModel = new SubcorpWithinFormModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                formType,
                this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs'),
                withinCond,
            );

            this.corparchPlugin = corplistComponent(this.layoutModel.pluginApi());

            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(this.subcorpFormRoot);
                    this.layoutModel.unmountReactComponent(this.queryOverviewRoot);
                    this.init();
                },
                this.corparchPlugin,
                this.textTypesModel,
                this.liveAttrsPlugin,
                this.subcorpFormModel,
                this.subcorpWithinFormModel
            );

            this.initCorpusInfo();

            const corparchWidgetId = Ident.puid();
            const corplistWidget = this.corparchPlugin.createWidget(
                corparchWidgetId,
                'subcorpus/new',
                (corpora:Array<string>, subcorpId:string) => {
                    this.layoutModel.dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                        name: GlobalActions.SwitchCorpus.name,
                        payload: {
                            corpora: corpora,
                            subcorpus: subcorpId
                        }
                    });
                }
            );

            this.viewComponents = subcorpViewsInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                CorparchComponent: corplistWidget,
                subcorpFormModel: this.subcorpFormModel,
                subcorpWithinFormModel: this.subcorpWithinFormModel,
                corparchWidgetId
            });
            this.initSubcorpForm(ttComponent.component, ttComponent.props);
        });
    }
}


export function init(conf:Kontext.Conf):void {
    const layoutModel:PageModel = new KontextPage(conf);
    const pageModel = new SubcorpForm(
        layoutModel,
        layoutModel.getCorpusIdent()
    );
    pageModel.init();
}