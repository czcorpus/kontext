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

import { PageModel } from '../app/page';
import { KontextPage } from '../app/main';
import { Kontext } from '../types/common';
import { init as formViewInit } from '../views/pquery/form';
import { PqueryFormModel } from '../models/pquery/form';
import { PluginInterfaces } from '../types/plugins';
import corplistComponent from 'plugins/corparch/init';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../models/common/actions';
import { Dict, List, pipe, tuple } from 'cnc-tskit';
import { init as queryOverviewInit } from '../views/pquery/overview';
import { FreqIntersectionArgs, importConcQueries, newModelState, StoredAdvancedQuery, StoredQueryFormArgs, storedQueryToModel } from '../models/pquery/common';
import { AttrHelper } from '../models/query/cqleditor/attrs';



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

    private initCorpnameLink(model:PqueryFormModel):void {
        const queryOverviewViews = queryOverviewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            model
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
            const formModel = new PqueryFormModel(
                this.layoutModel.dispatcher,
                storedForm ?
                    storedQueryToModel(
                        this.layoutModel.getConf<FreqIntersectionArgs>('FormData'),
                        importConcQueries(this.layoutModel.getConf<Array<StoredQueryFormArgs>>('ConcQueries')),
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

            // qquery form

            const formView = formViewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                model: formModel
            });
            const [corparchWidget, corparchPlg]  = this.initCorplistComponent();
            this.layoutModel.renderReactComponent(
                formView,
                window.document.getElementById('pquery-form-mount'),
                {
                    corparchWidget
                }
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

            this.initCorpnameLink(formModel);
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new ParadigmaticQueryPage(new KontextPage(conf)).init();
}