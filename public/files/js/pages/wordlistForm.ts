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

import * as Kontext from '../types/kontext.js';
import { PageModel } from '../app/page.js';
import * as PluginInterfaces from '../types/plugins/index.js';
import { init as wordlistFormInit, WordlistFormExportViews } from '../views/wordlist/form/index.js';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview/index.js';
import { WordlistFormModel, WordlistFormModelArgs } from '../models/wordlist/form.js';
import { KontextPage } from '../app/main.js';
import { WlnumsTypes } from '../models/wordlist/common.js';
import { Actions as GlobalActions } from '../models/common/actions.js';
import createCorparch from '@plugins/corparch';
import { Root } from 'react-dom/client';
import { Ident } from 'cnc-tskit';


/**
 *
 */
class WordlistFormPage {

    private layoutModel:PageModel;

    private corpusIdent:Kontext.FullCorpusIdent;

    private views:WordlistFormExportViews;

    private wordlistFormModel:WordlistFormModel;

    private corparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private queryOverviewRoot:Root;

    private wordlistFormRoot:Root;


    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initCorparchWidget(
        plg:PluginInterfaces.Corparch.IPlugin,
        corparchWidgetId:string
    ):PluginInterfaces.Corparch.WidgetView {

        return plg.createWidget(
            corparchWidgetId,
            'wordlist/form',
            (corpora:Array<string>, subcorpId:string) => {
                this.layoutModel.dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                    name: GlobalActions.SwitchCorpus.name,
                    payload: {
                        corpora: corpora,
                        subcorpus: subcorpId
                    }
                });
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
                wlposattrs: formData.wlposattrs,
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
                wlposattrs: [],
                wltype: 'simple'
            }
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            this.corpusIdent = this.layoutModel.getCorpusIdent();
            const wlForm = this.layoutModel.getConf<WordlistFormModelArgs["initialArgs"]>('FormData');
            this.wordlistFormModel = new WordlistFormModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                corpusIdent: this.corpusIdent,
                subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
                attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
                initialArgs: this.getInitialArgs(wlForm)
            });
            this.corparchPlugin = createCorparch(this.layoutModel.pluginApi());
            const corparchWidgetId = Ident.puid();
            this.views = wordlistFormInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                CorparchWidget: this.initCorparchWidget(this.corparchPlugin, corparchWidgetId),
                wordlistFormModel: this.wordlistFormModel,
                corparchWidgetId
            });

            const queryOverviewViews = basicOverviewViewsInit(
                this.layoutModel.dispatcher,
                this.layoutModel.getComponentHelpers(),
                this.layoutModel.getModels().mainMenuModel
            );
            this.queryOverviewRoot = this.layoutModel.renderReactComponent(
                queryOverviewViews.EmptyQueryOverviewBar,
                window.document.getElementById('query-overview-mount'),
            );

            this.wordlistFormRoot = this.layoutModel.renderReactComponent(
                this.views.WordListForm,
                document.getElementById('wordlist-form-mount'),
                {}
            );
            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(this.wordlistFormRoot);
                    this.layoutModel.unmountReactComponent(this.queryOverviewRoot);
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