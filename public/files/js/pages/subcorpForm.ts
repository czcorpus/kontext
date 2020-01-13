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
import {Kontext, TextTypes} from '../types/common';
import {PluginInterfaces} from '../types/plugins';
import {PageModel} from '../app/page';
import {init as subcorpViewsInit} from '../views/subcorp/forms';
import {SubcorpFormModel} from '../models/subcorp/form';
import {SubcorpWithinFormModel} from '../models/subcorp/withinForm';
import {TextTypesModel, SelectedTextTypes} from '../models/textTypes/main';
import {init as ttViewsInit, TextTypesPanelProps} from '../views/textTypes';
import {NonQueryCorpusSelectionModel} from '../models/corpsel';
import {init as basicOverviewViewsInit} from '../views/query/basicOverview';
import corplistComponent from 'plugins/corparch/init';
import liveAttributes from 'plugins/liveAttributes/init';
import subcMixer from 'plugins/subcmixer/init';
import { InputMode } from '../models/subcorp/common';
import { PluginName } from '../app/plugin';
import { KontextPage } from '../app/main';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/subcorpForm.less');


interface TTProps {
    alignedCorpora:Array<string>;
    attributes:Immutable.List<TextTypes.AttributeSelection>;
    liveAttrsCustomTT:React.ComponentClass<{}>|null;
    liveAttrsView:React.ComponentClass<{}>;
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

    private subcorpSel:PluginInterfaces.Corparch.ICorpSelection;

    constructor(pageModel:PageModel, corpusIdent:Kontext.FullCorpusIdent) {
        this.layoutModel = pageModel;
        this.corpusIdent = corpusIdent;
    }

    getCurrentSubcorpus():string {
        return this.subcorpFormModel.getSubcname().value;
    }

    getCurrentSubcorpusOrigName():string {
        return this.subcorpFormModel.getSubcname().value;
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

    initSubcorpForm(ttComponent:React.ComponentClass<TextTypesPanelProps>, ttProps:TTProps):void {
        this.layoutModel.renderReactComponent(
            this.viewComponents.SubcorpForm,
            window.document.getElementById('subcorp-form-mount'),
            {
                ttComponent: ttComponent,
                ttProps: ttProps
            }
        );
    }

    createTextTypesComponents(selectedTextTypes:SelectedTextTypes):TTInitData {
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesModel = new TextTypesModel(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData,
                selectedTextTypes
        );
        const ttViewComponents = ttViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.textTypesModel
        );

        const liveAttrsPlugin:PluginInterfaces.LiveAttributes.IPlugin = liveAttributes(
            this.layoutModel.pluginApi(),
            this.textTypesModel,
            this.layoutModel.pluginIsActive(PluginName.LIVE_ATTRIBUTES),
            true, // manual aligned corp. selection mode
            {
                bibAttr: textTypesData['bib_attr'],
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora'),
                refineEnabled: true,
                manualAlignCorporaMode: true
            }
        );

        const subcmixerPlg = subcMixer(
            this.layoutModel.pluginApi(),
            this.textTypesModel,
            {
                getIsPublic: () => this.subcorpFormModel.getIsPublic(),
                getDescription: () => this.subcorpFormModel.getDescription(),
                getSubcName: () => this.subcorpFormModel.getSubcname(),
                validateForm: () => this.subcorpFormModel.validateForm(false),
                addListener: (fn:Kontext.ModelListener) => this.subcorpFormModel.addListener(fn)
            },
            this.layoutModel.getConf<string>('CorpusIdAttr')
        );

        let subcMixerComponent:React.ComponentClass;
        if (this.layoutModel.pluginIsActive(PluginName.SUBCMIXER)) {
            if (liveAttrsPlugin && this.layoutModel.pluginIsActive(PluginName.LIVE_ATTRIBUTES)) {
                subcMixerComponent = subcmixerPlg.getWidgetView();

            } else {
                throw new Error('Subcmixer plug-in requires live_attributes plug-in to be operational');
            }

        } else {
            subcMixerComponent = null;
        }

        let liveAttrsViews;
        if (liveAttrsPlugin && this.layoutModel.pluginIsActive(PluginName.LIVE_ATTRIBUTES)) {
            liveAttrsViews = liveAttrsPlugin.getViews(subcMixerComponent, this.textTypesModel);
            this.textTypesModel.enableAutoCompleteSupport();

        } else {
            liveAttrsViews = {};
        }
        return {
            component: ttViewComponents.TextTypesPanel,
            props: {
                liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                attributes: this.textTypesModel.getAttributes(),
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
        this.layoutModel.init(() => {
            const ttComponent = this.createTextTypesComponents(
                this.layoutModel.getConf<SelectedTextTypes>('SelectedTextTypes')
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
                InputMode.GUI
            );

            this.subcorpWithinFormModel = new SubcorpWithinFormModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                InputMode.GUI,
                this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs'),
                this.subcorpFormModel
            );

            const corplistWidget = corplistComponent(this.layoutModel.pluginApi()).createWidget(
                this.layoutModel.createActionUrl('subcorpus/subcorp_form'),
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
            this.layoutModel.addUiTestingFlag();
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