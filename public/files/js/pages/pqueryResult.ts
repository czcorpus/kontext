/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { DownloadType, PageModel } from '../app/page.js';
import { KontextPage } from '../app/main.js';
import * as Kontext from '../types/kontext.js';
import { PqueryFormModel } from '../models/pquery/form.js';
import * as PluginInterfaces from '../types/plugins/index.js';
import { Actions } from '../models/pquery/actions.js';
import { PqueryResultModel } from '../models/pquery/result.js';
import { init as resultViewInit } from '../views/pquery/result/index.js';
import { init as queryOverviewInit } from '../views/pquery/overview/index.js';
import { PqueryResult, FreqIntersectionArgs, importConcQueries, InvolvedConcFormArgs,
    storedQueryToModel } from '../models/pquery/common.js';
import { AttrHelper } from '../models/cqleditor/attrs.js';
import { PqueryResultsSaveModel } from '../models/pquery/save.js';
import { HtmlHelpModel } from '../models/help/help.js';



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

    setDownloadLink(name:string, format:string, url:string, args?:any) {
        this.layoutModel.bgDownload({
            name,
            format,
            datasetType: DownloadType.PQUERY,
            url,
            contentType: 'text/plain',
            args,
        }).subscribe();
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
                storedQueryToModel(
                    pqForm,
                    importConcQueries(
                        this.layoutModel.getConf<InvolvedConcFormArgs>('ConcForms')
                    ),
                    this.layoutModel.getConf('AttrList'),
                    Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
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
                saveLinkFn: this.setDownloadLink.bind(this),
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