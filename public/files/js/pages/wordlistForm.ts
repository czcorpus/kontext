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
import { PluginInterfaces } from '../types/plugins';
import { init as wordlistFormInit, WordlistFormExportViews } from '../views/wordlist/form';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview';
import { WordlistFormModel } from '../models/wordlist/form';
import { NonQueryCorpusSelectionModel } from '../models/corpsel';
import { KontextPage } from '../app/main';
import { WlnumsTypes, WlTypes } from '../models/wordlist/common';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../models/common/actions';
import createCorparch from 'plugins/corparch/init';


/**
 *
 */
class WordlistFormPage {

    private layoutModel:PageModel;

    private corpusIdent:Kontext.FullCorpusIdent;

    private views:WordlistFormExportViews;

    private wordlistFormModel:WordlistFormModel;

    private subcorpSel:NonQueryCorpusSelectionModel;

    private corparchPlugin:PluginInterfaces.Corparch.IPlugin;


    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initCorparchWidget(plg:PluginInterfaces.Corparch.IPlugin):PluginInterfaces.Corparch.WidgetView {
        return plg.createWidget(
            'wordlist_form',
            {
                itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                    this.layoutModel.dispatcher.dispatch<GlobalActions.SwitchCorpus>({
                        name: GlobalActionName.SwitchCorpus,
                        payload: {
                            corpora: corpora,
                            subcorpus: subcorpId
                        }
                    });
                }
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            this.corpusIdent = this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent');
            this.subcorpSel = new NonQueryCorpusSelectionModel({
                layoutModel: this.layoutModel,
                dispatcher: this.layoutModel.dispatcher,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp,
                corpora: [this.layoutModel.getCorpusIdent().id],
                availSubcorpora: this.layoutModel.getConf<Array<Kontext.SubcorpListItem>>(
                    'SubcorpList'
                )
            });
            this.wordlistFormModel = new WordlistFormModel(
                this.layoutModel.dispatcher,
                this.layoutModel,
                this.corpusIdent,
                this.layoutModel.getConf<Array<string>>('SubcorpList'),
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                {
                    includeNonwords: 0,
                    wlminfreq: 5,
                    subcnorm: '',
                    wlnums: WlnumsTypes.FRQ,
                    blacklist: '',
                    wlwords: '',
                    wlpat: '',
                    wlsort: 'f',
                    wlattr: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList')[0].n,
                    wltype: WlTypes.SIMPLE
                }
            );
            this.corparchPlugin = createCorparch(this.layoutModel.pluginApi());
            this.views = wordlistFormInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                CorparchWidget: this.initCorparchWidget(this.corparchPlugin),
                wordlistFormModel: this.wordlistFormModel
            });

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

            this.layoutModel.renderReactComponent(
                this.views.WordListForm,
                document.getElementById('wordlist-form-mount'),
                {}
            );
            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('wordlist-form-mount'));
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('query-overview-mount'));
                    this.init();
                },
                this.wordlistFormModel,
                this.corparchPlugin
            );
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new WordlistFormPage(new KontextPage(conf)).init();
}