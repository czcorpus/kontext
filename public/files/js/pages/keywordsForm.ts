/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
import { KontextPage } from '../app/main.js';
import * as PluginInterfaces from '../types/plugins/index.js';
import createCorparch from 'plugins/corparch/init';
import { KeywordsFormModel } from '../models/keywords/form.js';
import { init as viewInit } from '../views/keywords/form/index.js';
import { Actions as GlobalActions } from '../models/common/actions.js';
import { Actions as CorparchActions } from '../types/plugins/corparch.js';
import { Root } from 'react-dom/client';
import { KeywordsSubmitArgs } from '../models/keywords/common.js';
import { HTTP, List } from 'cnc-tskit';


/**
 *
 */
export class KeywordsFormPage {

    private readonly layoutModel:PageModel;

    private formModel:KeywordsFormModel;

    private focusCorparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private refCorparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private reactRoot:Root;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initFocusCorpWidget(plg:PluginInterfaces.Corparch.IPlugin, widgetId:string):PluginInterfaces.Corparch.WidgetView {
        return plg.createWidget(
            widgetId,
            'keywords/form',
            (corpora:Array<string>, subcorpId:string) => {
                this.layoutModel.dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                    name: GlobalActions.SwitchCorpus.name,
                    payload: {
                        corpora,
                        subcorpus: subcorpId,
                        widgetId,
                    }
                });
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            this.focusCorparchPlugin = createCorparch(this.layoutModel.pluginApi());
            this.refCorparchPlugin = createCorparch(this.layoutModel.pluginApi());
            // We can not use `Ident.puid()` if we want to use corpus switch restore on widgets
            // because identificator changes after switching
            const focusCorpWidgetId = '1';
            const refCorpWidgetId = '2';

            const kwForm = this.layoutModel.getConf<KeywordsSubmitArgs>('FormData');
            this.formModel = new KeywordsFormModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                initialArgs: kwForm,
                refWidgetId: refCorpWidgetId,
                availAttrs: this.layoutModel.getConf<Array<Kontext.AttrItem>>('CommonAttrList'),
                focusCorpusAttrs: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList')
            });
            const view = viewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                keywordsFormModel: this.formModel,
                FocusCorpWidget: this.initFocusCorpWidget(this.focusCorparchPlugin, focusCorpWidgetId),
                focusCorpWidgetId,
                RefCorpWidget: this.refCorparchPlugin.createWidget(
                    refCorpWidgetId,
                    'keywords/form',
                    (corpora:Array<string>, subcorpId:string) => {
                        const args = {corpname: List.head(corpora)};
                        if (subcorpId) {
                            args['usesubcorp'] = subcorpId;
                        }
                        this.layoutModel.ajax$<{
                            corpusIdent:Kontext.FullCorpusIdent;
                            availableSubcorpora:Array<Kontext.SubcorpListItem>;
                            attrList:Array<Kontext.AttrItem>;
                        }>(
                            HTTP.Method.GET,
                            this.layoutModel.createActionUrl('corpora/ajax_get_corparch_item'),
                            args,
                        ).subscribe({
                            next: data => {
                                this.layoutModel.dispatcher.dispatch(
                                    CorparchActions.SecondaryCorpusChange,
                                    {
                                        widgetId: refCorpWidgetId,
                                        corpusIdent: data.corpusIdent,
                                        availableSubcorpora: data.availableSubcorpora,
                                        attrList: data.attrList
                                    }
                                );
                            },
                            error: err => {
                                this.layoutModel.showMessage('error', err);
                                this.layoutModel.dispatcher.dispatch(
                                    CorparchActions.SecondaryCorpusChange,
                                    {
                                        widgetId: refCorpWidgetId,
                                        corpusIdent: undefined,
                                        availableSubcorpora: undefined,
                                        attrList: []
                                    },
                                    err,
                                );
                            }
                        });
                    },
                    {
                        corpusIdent: this.layoutModel.getConf<Kontext.FullCorpusIdent>('refCorpusIdent'),
                        availableSubcorpora: this.layoutModel.getConf<Array<Kontext.SubcorpListItem>>('availableRefSubcorpora'),
                    }
                ),
                refCorpWidgetId,
            });
            this.reactRoot = this.layoutModel.renderReactComponent(
                view,
                window.document.getElementById('keywords-form-mount'),
            );
            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(this.reactRoot);
                    this.init();
                },
                this.formModel,
                this.focusCorparchPlugin,
                this.refCorparchPlugin,
            );
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new KeywordsFormPage(new KontextPage(conf)).init();
}