/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { PageModel } from '../app/page.js';
import { KontextPage } from '../app/main.js';
import * as Kontext from '../types/kontext.js';
import { init as formViewInit } from '../views/pquery/form/index.js';
import { PqueryFormModel } from '../models/pquery/form.js';
import * as PluginInterfaces from '../types/plugins/index.js';
import corplistComponent from 'plugins/corparch/init';
import { Actions as GlobalActions } from '../models/common/actions.js';
import { Ident, tuple } from 'cnc-tskit';
import { init as queryOverviewInit } from '../views/pquery/overview/index.js';
import { FreqIntersectionArgs, importConcQueries, newModelState, InvolvedConcFormArgs,
    storedQueryToModel } from '../models/pquery/common.js';
import { AttrHelper } from '../models/cqleditor/attrs.js';
import { HtmlHelpModel } from '../models/help/help.js';
import { Root } from 'react-dom/client';



/**
 * This page model controls both query form and a respective result
 * for paradigmatic queries.
 */
class ParadigmaticQueryPage {

    private readonly layoutModel:PageModel;

    private pqueryFormRoot:Root;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initCorplistComponent():[React.ComponentClass, PluginInterfaces.Corparch.IPlugin, string] {
        const plg = corplistComponent(this.layoutModel.pluginApi());
        const widgetId = Ident.puid();
        return tuple(
            plg.createWidget(
                widgetId,
                'pquery/index',
                (corpora:Array<string>, subcorpId:string) => {
                    this.layoutModel.dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                        name: GlobalActions.SwitchCorpus.name,
                        payload: {
                            corpora,
                            subcorpus: subcorpId
                        }
                    });
                }
            ),
            plg,
            widgetId,
        );
    }

    private initCorpnameLink(model:PqueryFormModel, helpModel:HtmlHelpModel):void {
        const queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            model,
            helpModel,
            this.layoutModel.getModels().mainMenuModel
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews,
            window.document.getElementById('query-overview-mount'),
            {
                queryId: undefined
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {

            const attrHelper = new AttrHelper(
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
                Kontext.structsAndAttrsToStructList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
                this.layoutModel.getConf<Array<PluginInterfaces.TagHelper.TagsetInfo>>('Tagsets')
            );
            const pqForm = this.layoutModel.getConf<FreqIntersectionArgs>('FormData');
            const formModel = new PqueryFormModel(
                this.layoutModel.dispatcher,
                pqForm ?
                    storedQueryToModel(
                        pqForm,
                        importConcQueries(
                            this.layoutModel.getConf<InvolvedConcFormArgs>('ConcForms')
                        ),
                        this.layoutModel.getConf('AttrList'),
                        Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
                        this.layoutModel.getConf<boolean>('UseRichQueryEditor')
                    ) :
                    newModelState(
                        this.layoutModel.getCorpusIdent().id,
                        this.layoutModel.getCorpusIdent().usesubcorp,
                        this.layoutModel.getConf('AttrList'),
                        Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
                        this.layoutModel.getConf<boolean>('UseRichQueryEditor'),
                        this.layoutModel.getConf<string>('DefaultAttr')
                    ),
                this.layoutModel,
                attrHelper
            );
            const helpModel = new HtmlHelpModel(
                this.layoutModel,
                this.layoutModel.dispatcher,
                {
                    isBusy: false,
                    rawHtml: ''
                }
            );

            // qquery form

            const pqueryView = formViewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                model: formModel,
                helpModel
            });
            const [corparchWidget, corparchPlg, corparchWidgetId]  = this.initCorplistComponent();
            this.pqueryFormRoot = this.layoutModel.renderReactComponent(
                pqueryView.PqueryForm,
                window.document.getElementById('pquery-form-mount'),
                {
                    corparchWidget,
                    corparchWidgetId,
                }
            );

            this.layoutModel.renderReactComponent(
                pqueryView.PqueryHelp,
                window.document.getElementById('topbar-help-mount'),
                {}
            );

            // ---

            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(this.pqueryFormRoot);
                    this.init();
                },
                formModel,
                corparchPlg
            );

            // ---

            this.initCorpnameLink(formModel, helpModel);
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new ParadigmaticQueryPage(new KontextPage(conf)).init();
}