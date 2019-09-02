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

import {Kontext} from '../types/common';
import {PageModel} from '../app/main';
import {PluginInterfaces} from '../types/plugins';
import * as Immutable from 'immutable';
import {init as wordlistFormInit, WordlistFormExportViews} from '../views/wordlist/form';
import {init as basicOverviewViewsInit} from '../views/query/basicOverview';
import {WordlistFormModel, WlnumsTypes, WlTypes} from '../models/wordlist/form';
import {NonQueryCorpusSelectionModel} from '../models/corpsel';
import createCorparch from 'plugins/corparch/init';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/wordlistForm.less');

/**
 *
 */
class WordlistFormPage {

    private layoutModel:PageModel;

    private corpusIdent:Kontext.FullCorpusIdent;

    private views:WordlistFormExportViews;

    private wordlistFormModel:WordlistFormModel;

    private subcorpList:Immutable.List<Kontext.SubcorpListItem>;

    private subcorpSel:PluginInterfaces.Corparch.ICorpSelection;


    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
        this.subcorpList = Immutable.List<Kontext.SubcorpListItem>(
                this.layoutModel.getConf<Array<Kontext.SubcorpListItem>>('SubcorpList'));
    }

    private initCorpInfoToolbar():void {
        this.layoutModel.renderReactComponent(
            this.views.CorpInfoToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.corpusIdent.id,
                humanCorpname: this.corpusIdent.name,
                usesubcorp: this.corpusIdent.usesubcorp,
                origSubcorpName: undefined,
                foreignSubcorp: undefined
            }
        );
    }

    private initCorparchPlugin():PluginInterfaces.Corparch.WidgetView {
        return createCorparch(this.layoutModel.pluginApi()).createWidget(
            'wordlist_form',
            this.subcorpSel,
            {
                itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                    return this.layoutModel.switchCorpus(corpora, subcorpId).then(
                        () => {
                            // all the components must be deleted to prevent memory leaks
                            // and unwanted action handlers from previous instance
                            this.layoutModel.unmountReactComponent(window.document.getElementById('wordlist-form-mount'));
                            this.layoutModel.unmountReactComponent(window.document.getElementById('query-overview-mount'));
                            this.init();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    );
                }
            }
        );
    }

    init():void {
        this.corpusIdent = this.layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent');
        this.layoutModel.init().then(
            (d) => {
                this.subcorpSel = new NonQueryCorpusSelectionModel({
                    layoutModel: this.layoutModel,
                    dispatcher: this.layoutModel.dispatcher,
                    usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                    origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                    foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp,
                    corpora: [this.layoutModel.getCorpusIdent().id],
                    availSubcorpora: this.layoutModel.getConf<Array<Kontext.SubcorpListItem>>('SubcorpList')
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
                this.layoutModel.registerSwitchCorpAwareObject(this.wordlistFormModel);
                const corparchWidget = this.initCorparchPlugin();
                this.views = wordlistFormInit({
                    dispatcher: this.layoutModel.dispatcher,
                    he: this.layoutModel.getComponentHelpers(),
                    CorparchWidget: corparchWidget,
                    wordlistFormModel: this.wordlistFormModel
                });

                const queryOverviewViews = basicOverviewViewsInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.subcorpSel
                );
                this.layoutModel.renderReactComponent(
                    queryOverviewViews.EmptyQueryOverviewBar,
                    window.document.getElementById('query-overview-mount'),
                    {
                        corpname: this.layoutModel.getCorpusIdent().id,
                        humanCorpname: this.layoutModel.getCorpusIdent().name,
                    }
                );

                this.layoutModel.renderReactComponent(
                    this.views.WordListForm,
                    document.getElementById('wordlist-form-mount'),
                    {}
                );
            }

        ).then(
            (_) => {
                this.layoutModel.restoreModelsDataAfterSwitch();
                this.layoutModel.addUiTestingFlag();
            }

        ).catch(
            (err) => console.error(err)
        );
    }
}


export function init(conf:Kontext.Conf):void {
    new WordlistFormPage(new PageModel(conf)).init();
}