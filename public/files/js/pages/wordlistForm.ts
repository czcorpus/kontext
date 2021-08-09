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

import * as Kontext from '../types/kontext';
import { PageModel } from '../app/page';
import * as PluginInterfaces from '../types/plugins';
import { init as wordlistFormInit, WordlistFormExportViews } from '../views/wordlist/form';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview';
import { WordlistFormModel, WordlistFormModelArgs } from '../models/wordlist/form';
import { NonQueryCorpusSelectionModel } from '../models/corpsel';
import { KontextPage } from '../app/main';
import { WlnumsTypes } from '../models/wordlist/common';
import { Actions as GlobalActions } from '../models/common/actions';
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
                    this.layoutModel.dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                        name: GlobalActions.SwitchCorpus.name,
                        payload: {
                            corpora: corpora,
                            subcorpus: subcorpId
                        }
                    });
                }
            }
        );
    }

    private getInitialArgs(formData: WordlistFormModelArgs["initialArgs"]):WordlistFormModelArgs["initialArgs"] {
        return formData ?
            {
                include_nonwords: formData.include_nonwords,
                wlminfreq: formData.wlminfreq,
                subcnorm: formData.subcnorm,
                wlnums: formData.wlnums,
                nfilter_words: formData.nfilter_words,
                pfilter_words: formData.pfilter_words,
                wlpat: formData.wlpat,
                wlsort: formData.wlsort,
                wlattr: formData.wlattr,
                wltype: formData.wltype
            } : {
                include_nonwords: 0,
                wlminfreq: 5,
                subcnorm: '',
                wlnums: WlnumsTypes.FRQ,
                nfilter_words: [],
                pfilter_words: [],
                wlpat: '',
                wlsort: 'f',
                wlattr: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList')[0].n,
                wltype: 'simple'
            }
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
            const wlForm = this.layoutModel.getConf<WordlistFormModelArgs["initialArgs"]>('FormData');
            this.wordlistFormModel = new WordlistFormModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                corpusIdent: this.corpusIdent,
                subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
                attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                initialArgs: this.getInitialArgs(wlForm)
            });
            this.corparchPlugin = createCorparch(this.layoutModel.pluginApi());
            this.views = wordlistFormInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                CorparchWidget: this.initCorparchWidget(this.corparchPlugin),
                wordlistFormModel: this.wordlistFormModel
            });

            const queryOverviewViews = basicOverviewViewsInit(
                this.layoutModel.dispatcher,
                this.layoutModel.getComponentHelpers(),
                this.layoutModel.getModels().mainMenuModel
            );
            this.layoutModel.renderReactComponent(
                queryOverviewViews.EmptyQueryOverviewBar,
                window.document.getElementById('query-overview-mount'),
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