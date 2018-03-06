/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

/// <reference path="../types/plugins.d.ts" />

import {Kontext} from '../types/common';
import {PageModel} from '../app/main';
import {MultiDict} from '../util';
import queryStoragePlugin from 'plugins/queryStorage/init';
import {init as initQueryHistoryViews} from '../views/query/history';
import {QueryFormProperties, QueryModel, QueryHintModel} from '../models/query/main';
import {init as corpnameLinkInit} from 'views/overview';
import {init as basicOverviewViewsInit} from '../views/query/basicOverview';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/queryHistory.less');


class QueryHistoryPage {

    private layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initCorpnameLink():void {
        const corpInfoViews = corpnameLinkInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.getModels().corpusInfoModel
        );
        const queryOverviewViews = basicOverviewViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('usesubcorp')
            }
        );
    }

    init():void {
        this.layoutModel.init().then(
            (data) => {
                return queryStoragePlugin(
                    this.layoutModel.pluginApi(),
                    this.layoutModel.getConf<number>('Offset'),
                    this.layoutModel.getConf<number>('Limit'),
                    this.layoutModel.getConf<number>('PageSize')
                );
            }

        ).then(
            (qsModel) => {
                qsModel.importData(this.layoutModel.getConf<Array<Kontext.QueryHistoryItem>>('Data'));
                const qhViews = initQueryHistoryViews(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    qsModel.getModel()
                );

                this.layoutModel.renderReactComponent(
                    qhViews.RecentQueriesPageList,
                    document.getElementById('query-history-mount'),
                    {}
                );

                this.initCorpnameLink();
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch(
            (err) => {
                console.error(err);
            }
        )
    }
}

export function init(conf:Kontext.Conf):void {
    new QueryHistoryPage(new PageModel(conf)).init();
}
