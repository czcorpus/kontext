/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as Kontext from '../types/kontext.js';
import * as TextTypes from '../types/textTypes.js';
import * as PluginInterfaces from '../types/plugins/index.js';
import { PageModel } from '../app/page.js';
import { init as subcorpViewsInit } from '../views/subcorp/forms.js';
import { SubcorpFormModel } from '../models/subcorp/new.js';
import { SubcorpWithinFormModel } from '../models/subcorp/withinForm.js';
import { TextTypesModel } from '../models/textTypes/main.js';
import { init as ttViewsInit, TextTypesPanelProps } from '../views/textTypes/index.js';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview/index.js';
import { PluginName } from '../app/plugin.js';
import { KontextPage } from '../app/main.js';
import corplistComponent from '@plugins/corparch';
import liveAttributes from '@plugins/live-attributes';
import subcMixer from '@plugins/subcmixer';
import { Actions as GlobalActions } from '../models/common/actions.js';
import { importInitialTTData, TTInitialData } from '../models/textTypes/common.js';
import { ConcFormArgs } from '../models/query/formArgs.js';
import { fetchQueryFormArgs } from '../models/query/first.js';
import { ServerWithinSelection } from '../models/subcorp/common.js';
import { Root } from 'react-dom/client';
import { Ident, List, pipe } from 'cnc-tskit';
import { IUnregistrable } from '../models/common/common.js';


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

        const availableAlignedCorpora = this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora');
        this.liveAttrsPlugin = liveAttributes(
            this.layoutModel.pluginApi(),
            this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES),
            {
                bibIdAttr: ttData.bib_id_attr,
                bibLabelAttr: ttData.bib_label_attr,
                availableAlignedCorpora,
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
            liveAttrsViews = this.liveAttrsPlugin.getViews(subcMixerComponent, this.textTypesModel, !List.empty(availableAlignedCorpora));
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

    registerCorpusSwitchAwareModels(
        onDone:()=>void,
        ...models:Array<IUnregistrable>
    ):void {
        this.layoutModel.registerCorpusSwitchAwareModels(
            () => {
                this.textTypesModel.unregister();
                this.subcorpFormModel.unregister();
                this.subcorpWithinFormModel.unregister();
                onDone();
            },
            ...models
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            const ttComponent = this.createTextTypesComponents(
                this.layoutModel.getConf<TextTypes.ExportedSelection>('SelectedTextTypes')
            );
            const withinCond = this.layoutModel.getConf<Array<ServerWithinSelection>>('WithinCond');
            const formType = withinCond ? 'within' : 'tt-sel';
            this.subcorpFormModel = new SubcorpFormModel({
                dispatcher: this.layoutModel.dispatcher,
                pageModel: this.layoutModel,
                corpname: this.layoutModel.getCorpusIdent().id,
                alignedCorpora: pipe(
                    this.layoutModel.getConf<Array<{n:string; label:string}>>('availableAlignedCorpora'),
                    List.filter(
                        x => List.findIndex(
                            x2 => x2 === x.n,
                            this.layoutModel.getConf<Array<string>>('alignedCorpora'),
                        ) > -1
                    ),
                    List.map(
                        ({n, label}) => ({
                            value: n,
                            label,
                            selected: true,
                            locked: false
                        })
                    )
                ),
                inputMode: formType,
                initialSubc: this.corpusIdent.usesubcorp ?
                    {
                        subcname: this.layoutModel.getConf<string>('SubcorpusName'),
                        description: this.layoutModel.getConf<string>('SubcorpusDesc'),
                        subcorpusId: this.corpusIdent.usesubcorp
                    } :
                    undefined
            });
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