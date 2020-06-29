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

import { Kontext } from '../types/common';
import { PageModel } from '../app/page';
import { init as initQueryHistoryViews } from '../views/query/history';
import { init as corpnameLinkInit } from '../views/overview';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview';
import { NonQueryCorpusSelectionModel } from '../models/corpsel';
import { KontextPage } from '../app/main';
import queryStoragePlugin from 'plugins/queryStorage/init';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/queryHistory.less');

/**
 *
 */
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
            this.layoutModel.getComponentHelpers()
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            const corpSelModel = new NonQueryCorpusSelectionModel({
                layoutModel: this.layoutModel,
                dispatcher: this.layoutModel.dispatcher,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp,
                corpora: [this.layoutModel.getCorpusIdent().id],
                availSubcorpora: []
            });
            const qsModel = queryStoragePlugin(
                this.layoutModel.pluginApi(),
                this.layoutModel.getConf<number>('Offset'),
                this.layoutModel.getConf<number>('Limit'),
                this.layoutModel.getConf<number>('PageSize')
            );
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
        });
    }
}

export function init(conf:Kontext.Conf):void {
    new QueryHistoryPage(new KontextPage(conf)).init();
}
