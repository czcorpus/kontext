/*
 * Copyright (c) 2013 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Kontext from '../types/kontext.js';
import { PageModel } from '../app/page.js';
import { SubcorpListModel, SortKey, SubcListFilter } from '../models/subcorp/list.js';
import { init as listViewInit } from '../views/subcorp/list.js';
import { KontextPage } from '../app/main.js';
import { SubcorpusEditModel } from '../models/subcorp/edit.js';
import { TextTypesModel } from '../models/textTypes/main.js';
import { SubcorpWithinFormModel } from '../models/subcorp/withinForm.js';
import * as PluginInterfaces from '../types/plugins/index.js';
import { PluginName } from '../app/plugin.js';
import liveAttributes from '@plugins/live-attributes';
import { SubcorpusServerRecord } from '../models/subcorp/common.js';
import { RawCQLEmptyModel } from '../models/subcorp/rawCql.js';

/**
 *
 */
class SubcorpListPage {

    private layoutModel:PageModel;

    private subcorpListModel:SubcorpListModel;

    private subcorpEditModel:SubcorpusEditModel;

    private textTypesModel:TextTypesModel;

    private subcorpWithinFormModel:SubcorpWithinFormModel;

    private rawCQLEmptyModel:RawCQLEmptyModel;

    private liveAttrsPlugin:PluginInterfaces.LiveAttributes.IPlugin;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private renderView():void {
        let liveAttrsViews:PluginInterfaces.LiveAttributes.Views;
        if (this.liveAttrsPlugin !== undefined) {
            liveAttrsViews = this.liveAttrsPlugin.getViews(null, this.textTypesModel, true);
        } else {
            liveAttrsViews = {
                LiveAttrsCustomTT: null,
                LiveAttrsView: null,
            };
        }
        const views = listViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.subcorpListModel,
            this.subcorpEditModel,
            this.textTypesModel,
            this.subcorpWithinFormModel,
            liveAttrsViews,
        );
        this.layoutModel.renderReactComponent(
            views.SubcorpList,
            window.document.getElementById('my-subcorpora-mount'),
            {}
        );
    }

    init():void {
        this.layoutModel.init(
            true,
            [],
            () => {
                this.subcorpListModel = new SubcorpListModel({
                    dispatcher: this.layoutModel.dispatcher,
                    layoutModel: this.layoutModel,
                    data: this.layoutModel.getConf<Array<SubcorpusServerRecord>>('SubcorpList'),
                    sortKey: this.layoutModel.getConf<SortKey>('SortKey'),
                    relatedCorpora: this.layoutModel.getConf<Array<string>>('RelatedCorpora'),
                    unfinished: this.layoutModel.getConf<Array<Kontext.AsyncTaskInfo>>('ProcessedSubcorpora'),
                    initialFilter: this.layoutModel.getConf<SubcListFilter>('Filter')
                });
                this.textTypesModel = new TextTypesModel({
                    dispatcher: this.layoutModel.dispatcher,
                    pluginApi: this.layoutModel.pluginApi(),
                    attributes: [],
                    bibIdAttr: undefined,
                    bibLabelAttr: undefined,
                    readonlyMode: false,
                });
                this.subcorpEditModel = new SubcorpusEditModel(
                    this.layoutModel.dispatcher,
                    {
                        isBusy: false,
                        data: undefined,
                        liveAttrsEnabled: false,
                        liveAttrsInitialized: false,
                        previewEnabled: false,
                        prevRawDescription: undefined
                    },
                    this.layoutModel,
                );
                this.subcorpWithinFormModel = new SubcorpWithinFormModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    'within',
                    this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')
                );
                this.rawCQLEmptyModel = new RawCQLEmptyModel(
                    this.layoutModel.dispatcher
                );

                if (this.layoutModel.getConf<boolean>('UsesLiveAttrs')) {
                    this.liveAttrsPlugin = liveAttributes(
                        this.layoutModel.pluginApi(),
                        this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES),
                        {
                            bibIdAttr: null,
                            bibLabelAttr: null,
                            availableAlignedCorpora: [],
                            refineEnabled: false,
                            manualAlignCorporaMode: false,
                            subcorpTTStructure: {},
                            textTypesData: { // here we insert "nothing" as actual data will
                                // be loaded based on user's click on subc. list item
                                Blocks: [{Line: []}],
                                Normslist: [],
                                bib_label_attr: null,
                                bib_id_attr: null
                            }
                        }
                    );
                }

                this.renderView();
            }
        );
    }
}

/**
 * A function used to initialize the model on a respective page.
 */
export function init(conf):void {
    new SubcorpListPage(new KontextPage(conf)).init();
}
