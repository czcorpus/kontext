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
import { PqueryFormModel } from '../models/pquery/form';
import { PluginInterfaces } from '../types/plugins';
import { Actions, ActionName } from '../models/pquery/actions';
import { PqueryResultModel } from '../models/pquery/result';
import { init as resultViewInit } from '../views/pquery/result';
import { init as queryOverviewInit } from '../views/pquery/overview';
import { MultiDict } from '../multidict';
import { PqueryResult, FreqIntersectionArgs, importConcQueries, StoredQueryFormArgs,
    storedQueryToModel } from '../models/pquery/common';
import { AttrHelper } from '../models/query/cqleditor/attrs';
import { PqueryResultsSaveModel } from '../models/pquery/save';



/**
 * This page model controls both query form and a respective result
 * for paradigmatic queries.
 */
class ParadigmaticQueryPage {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
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
            const formModel = new PqueryFormModel(
                this.layoutModel.dispatcher,
                storedQueryToModel(
                    this.layoutModel.getConf<FreqIntersectionArgs>('FormData'),
                    importConcQueries(this.layoutModel.getConf<Array<StoredQueryFormArgs>>('ConcQueries')),
                    this.layoutModel.getConf('AttrList'),
                    this.layoutModel.getConf('StructAttrList'),
                    this.layoutModel.getConf<boolean>('UseRichQueryEditor')
                ),
                this.layoutModel,
                attrHelper
            );

            // pquery result

            const resultModel = new PqueryResultModel(
                this.layoutModel.dispatcher,
                {
                    isBusy: !this.layoutModel.getConf<boolean>('DataReady'),
                    data: this.layoutModel.getConf<PqueryResult>('Freqs'),
                    queryId: this.layoutModel.getConf<string>('QueryId'),
                    sortKey: {column: 'freq', reverse: true},
                    numLines: this.layoutModel.getConf<number>('TotalNumLines'),
                    page: 1,
                    pageSize: this.layoutModel.getConf<number>('Pagesize'),
                    saveFormActive: false
                },
                this.layoutModel
            );

            const saveModel = new PqueryResultsSaveModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                saveLinkFn: (filename:string, url:string) => {
                    this.layoutModel.bgDownload(filename, DownloadType.PQUERY, url);
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
                    const args = new MultiDict();
                    if (Actions.isSubmitQueryDone(action)) {
                        args.set('corpname', action.payload.corpname);
                        args.set('usesubcorp', action.payload.usesubcorp);
                        args.set('query_id', this.layoutModel.getConf<string>('QueryId'));
                        this.layoutModel.getHistory().replaceState(
                            'pquery/result',
                            args,
                            {},
                            window.document.title
                        );
                    }
                }
            );

            this.layoutModel.getHistory().setOnPopState((event) => {
                console.log('event state ', event.state);
                if (event.state['onPopStateAction']) {
                    this.layoutModel.dispatcher.dispatch(event.state['onPopStateAction']);
                }
            });

            // ---

            this.initCorpnameLink(formModel);

            // ---
            if (!this.layoutModel.getConf<boolean>('DataReady')) {
                window.setTimeout(() => {
                    this.layoutModel.dispatcher.dispatch<Actions.SubmitQuery>({
                        name: ActionName.SubmitQuery
                    });
                })
            }
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new ParadigmaticQueryPage(new KontextPage(conf)).init();
}