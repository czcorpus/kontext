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
import * as Kontext from '../types/kontext';
import { PqueryFormModel } from '../models/pquery/form';
import * as PluginInterfaces from '../types/plugins';
import { Actions } from '../models/pquery/actions';
import { PqueryResultModel } from '../models/pquery/result';
import { init as resultViewInit } from '../views/pquery/result';
import { init as queryOverviewInit } from '../views/pquery/overview';
import { PqueryResult, FreqIntersectionArgs, importConcQueries, InvolvedConcFormArgs,
    storedQueryToModel } from '../models/pquery/common';
import { AttrHelper } from '../models/cqleditor/attrs';
import { PqueryResultsSaveModel } from '../models/pquery/save';
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
                queryId: this.layoutModel.getConf<string>('QueryId')
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {

            const attrHelper = new AttrHelper(
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                this.layoutModel.getConf<Array<string>>('StructList'),
                this.layoutModel.getConf<Array<PluginInterfaces.TagHelper.TagsetInfo>>('Tagsets')
            );
            const pqForm = this.layoutModel.getConf<FreqIntersectionArgs>('FormData');
            const formModel = new PqueryFormModel(
                this.layoutModel.dispatcher,
                storedQueryToModel(
                    pqForm,
                    importConcQueries(
                        this.layoutModel.getConf<InvolvedConcFormArgs>('ConcForms')
                    ),
                    this.layoutModel.getConf('AttrList'),
                    this.layoutModel.getConf('StructAttrList'),
                    this.layoutModel.getConf<boolean>('UseRichQueryEditor')
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

            // pquery result

            const resultModel = new PqueryResultModel(
                this.layoutModel.dispatcher,
                {
                    isBusy: !this.layoutModel.getConf<boolean>('DataReady'),
                    data: this.layoutModel.getConf<PqueryResult>('Freqs'),
                    queryId: this.layoutModel.getConf<string>('QueryId'),
                    concIds: pqForm.conc_ids,
                    sortColumn: {type: 'freq', reverse: true},
                    numLines: this.layoutModel.getConf<number>('TotalNumLines'),
                    page: 1,
                    pageInput: Kontext.newFormValue('1', true),
                    pageSize: this.layoutModel.getConf<number>('Pagesize'),
                    saveFormActive: false
                },
                this.layoutModel
            );

            const saveModel = new PqueryResultsSaveModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                saveLinkFn: (format:string, url:string) => {
                    this.layoutModel.bgDownload({
                        format,
                        datasetType: DownloadType.PQUERY,
                        url,
                        contentType: 'multipart/form-data'
                    });
                },
                quickSaveRowLimit: 10000 // TODO
            });

            const resultView = resultViewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                resultModel,
                saveModel
            });

            //

            this.layoutModel.renderReactComponent(
                resultView,
                window.document.getElementById('pquery-result-mount')
            );

            // history

            this.layoutModel.dispatcher.registerActionListener(
                (action, dispatch) => {
                    if (Actions.isSubmitQueryDone(action)) {
                        this.layoutModel.getHistory().replaceState(
                            'pquery/result',
                            {q: `~${this.layoutModel.getConf<string>('QueryId')}`},
                            {},
                            window.document.title
                        );
                    }
                }
            );

            this.layoutModel.getHistory().setOnPopState((event) => {
                if (event.state['onPopStateAction']) {
                    this.layoutModel.dispatcher.dispatch(event.state['onPopStateAction']);
                }
            });

            // ---

            this.initCorpnameLink(formModel, helpModel);
            this.layoutModel.initKeyShortcuts();

            // ---
            if (!this.layoutModel.getConf<boolean>('DataReady')) {
                window.setTimeout(() => {
                    this.layoutModel.dispatcher.dispatch<typeof Actions.SubmitQuery>({
                        name: Actions.SubmitQuery.name
                    });
                })
            }
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new ParadigmaticQueryPage(new KontextPage(conf)).init();
}