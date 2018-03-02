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
import {PageModel, PluginApi} from '../app/main';
import {PluginInterfaces} from '../types/plugins';
import {createWidget as createCorparch} from 'plugins/corparch/init';
import * as Immutable from 'immutable';
import {init as wordlistFormInit, WordlistFormExportViews} from '../views/wordlist/form';
import {StatefulModel} from '../models/base';
import {WordlistFormModel} from '../models/wordlist/form';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/wordlistForm.less');

/**
 *
 */
class WordlistFormPage implements Kontext.QuerySetupHandler {

    private layoutModel:PageModel;

    private corpusIdent:Kontext.FullCorpusIdent;

    private views:WordlistFormExportViews;

    private wordlistFormModel:WordlistFormModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    registerCorpusSelectionListener(fn:(corpname:string, aligned:Immutable.List<string>, subcorp:string)=>void) {}

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.corpusIdent.id]);
    }

    getCurrentSubcorpus():string {
        return this.wordlistFormModel.getCurrentSubcorpus();
    }

    getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem> {
        return Immutable.List<Kontext.AttrItem>();
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

    private initCorparchPlugin():PluginInterfaces.CorparchWidgetView {
        return createCorparch(
            'wordlist_form',
            this.layoutModel.pluginApi(),
            this.wordlistFormModel,
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
                this.wordlistFormModel = new WordlistFormModel(
                    this.layoutModel.dispatcher,
                    this.layoutModel,
                    this.corpusIdent,
                    this.layoutModel.getConf<Array<string>>('SubcorpList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList')
                );
                this.layoutModel.registerSwitchCorpAwareObject(this.wordlistFormModel);
                const corparchWidget = this.initCorparchPlugin();
                this.views = wordlistFormInit({
                    dispatcher: this.layoutModel.dispatcher,
                    he: this.layoutModel.getComponentHelpers(),
                    CorparchWidget: corparchWidget,
                    wordlistFormModel: this.wordlistFormModel
                });

                this.layoutModel.renderReactComponent(
                    this.views.WordListForm,
                    document.getElementById('wordlist-form-mount'),
                    {}
                );
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch(
            (err) => console.error(err)
        );
    }
}


export function init(conf:Kontext.Conf):void {
    const layoutModel = new PageModel(conf);
    new WordlistFormPage(layoutModel).init();
}