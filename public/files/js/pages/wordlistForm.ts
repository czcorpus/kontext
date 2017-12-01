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

/// <reference path="../types/common.d.ts" />
/// <reference path="../vendor.d.ts/immutable.d.ts" />

import {PageModel, PluginApi} from './document';
import {createWidget as createCorparch} from 'plugins/corparch/init';
import * as Immutable from 'vendor/immutable';
import {init as wordlistFormInit, WordlistFormViews} from 'views/wordlist/form';
import {SimplePageStore} from '../stores/base';
import {WordlistFormStore} from '../stores/wordlist/form';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/wordlistForm.less');

/**
 *
 */
class WordlistFormPage implements Kontext.QuerySetupHandler {

    private layoutModel:PageModel;

    private corpusIdent:Kontext.FullCorpusIdent;

    private views:WordlistFormViews;

    private wordlistFormStore:WordlistFormStore;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    registerCorpusSelectionListener(fn:(corpname:string, aligned:Immutable.List<string>, subcorp:string)=>void) {}

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.corpusIdent.id]);
    }

    getCurrentSubcorpus():string {
        return this.wordlistFormStore.getCurrentSubcorpus();
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return Immutable.List<{n:string; label:string}>();
    }

    private initCorpInfoToolbar():void {
        this.layoutModel.renderReactComponent(
            this.views.CorpInfoToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('subcorpname')
            }
        );
    }

    private initCorparchPlugin():React.ComponentClass {
        return createCorparch(
            'wordlist_form',
            this.layoutModel.pluginApi(),
            this.wordlistFormStore,
            this,
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
                this.wordlistFormStore = new WordlistFormStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.corpusIdent,
                    this.layoutModel.getConf<Array<string>>('SubcorpList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList')
                );
                this.layoutModel.registerSwitchCorpAwareObject(this.wordlistFormStore);
                const corparchWidget = this.initCorparchPlugin();
                this.views = wordlistFormInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getComponentHelpers(),
                    this.layoutModel.layoutViews,
                    corparchWidget,
                    this.wordlistFormStore
                );

                this.layoutModel.renderReactComponent(
                    this.views.WordListForm,
                    document.getElementById('wordlist-form-mount'),
                    {}
                );
            }
        ).catch(
            (err) => console.error(err)
        );
    }
}


export function init(conf:Kontext.Conf) {
    const layoutModel = new PageModel(conf);
    new WordlistFormPage(layoutModel).init();
}