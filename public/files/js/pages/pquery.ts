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

import { DownloadType, PageModel } from '../app/page';
import { KontextPage } from '../app/main';
import { Kontext } from '../types/common';
import { init as formViewInit } from '../views/pquery/form';
import { PqueryFormModel } from '../models/pquery/form';
import { PluginInterfaces } from '../types/plugins';
import corplistComponent from 'plugins/corparch/init';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../models/common/actions';
import { tuple } from 'cnc-tskit';
import { init as queryOverviewInit } from '../views/pquery/overview';
import { FreqIntersectionArgs, importConcQueries, newModelState, InvolvedConcFormArgs,
    storedQueryToModel } from '../models/pquery/common';
import { AttrHelper } from '../models/query/cqleditor/attrs';
import { HtmlHelpModel } from '../models/help/help';



/**
 * This page model controls both query form and a respective result
 * for paradigmatic queries.
 */
class ParadigmaticQueryPage {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initCorplistComponent():[React.ComponentClass, PluginInterfaces.Corparch.IPlugin] {
        const plg = corplistComponent(this.layoutModel.pluginApi());
        return tuple(
            plg.createWidget(
                'query',
                {
                    itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                        this.layoutModel.dispatcher.dispatch<GlobalActions.SwitchCorpus>({
                            name: GlobalActionName.SwitchCorpus,
                            payload: {
                                corpora,
                                subcorpus: subcorpId
                            }
                        });
                    }
                }
            ),
            plg
        );
    }

    private initCorpnameLink(model:PqueryFormModel, helpModel:HtmlHelpModel):void {
        const queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            model,
            helpModel
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews,
            window.document.getElementById('query-overview-mount'),
            {
                currCorpus: this.layoutModel.getCorpusIdent(),
                queryId: undefined
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {

            const storedForm = this.layoutModel.getConf<FreqIntersectionArgs>('FormData');
            const attrHelper = new AttrHelper(
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                this.layoutModel.getConf<Array<string>>('StructList'),
                this.layoutModel.getConf<Array<PluginInterfaces.TagHelper.TagsetInfo>>('Tagsets')
            );
            const pqForm = this.layoutModel.getConf<FreqIntersectionArgs>('FormData');
            const formModel = new PqueryFormModel(
                this.layoutModel.dispatcher,
                storedForm ?
                    storedQueryToModel(
                        pqForm,
                        importConcQueries(
                            pqForm.conc_ids,
                            this.layoutModel.getConf<InvolvedConcFormArgs>('ConcForms')
                        ),
                        this.layoutModel.getConf('AttrList'),
                        this.layoutModel.getConf('StructAttrList'),
                        this.layoutModel.getConf<boolean>('UseRichQueryEditor')
                    ) :
                    newModelState(
                        this.layoutModel.getCorpusIdent().id,
                        this.layoutModel.getCorpusIdent().usesubcorp,
                        this.layoutModel.getConf('AttrList'),
                        this.layoutModel.getConf('StructAttrList'),
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
            const [corparchWidget, corparchPlg]  = this.initCorplistComponent();
            this.layoutModel.renderReactComponent(
                pqueryView.PqueryForm,
                window.document.getElementById('pquery-form-mount'),
                {
                    corparchWidget
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
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('pquery-form-mount'));
                    this.init();
                },
                formModel,
                corparchPlg
            );

            // ---

            this.initCorpnameLink(formModel, helpModel);
        });
    }

    setDownloadLink(filename:string, url:string) {
        this.layoutModel.bgDownload(filename, DownloadType.PQUERY, url);
    }
}


export function init(conf:Kontext.Conf):void {
    new ParadigmaticQueryPage(new KontextPage(conf)).init();
}