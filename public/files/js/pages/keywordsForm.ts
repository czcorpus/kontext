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

import * as Kontext from '../types/kontext';
import { PageModel } from '../app/page';
import { KontextPage } from '../app/main';
import * as PluginInterfaces from '../types/plugins';
import createCorparch from 'plugins/corparch/init';
import { KeywordsFormModel } from '../models/keywords/form';
import { init as viewInit } from '../views/keywords/form';
import { Actions as GlobalActions } from '../models/common/actions';
import { Root } from 'react-dom/client';


/**
 *
 */
export class KeywordsFormPage {

    private readonly layoutModel:PageModel;

    private formModel:KeywordsFormModel;

    private corparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private reactRoot:Root;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initCorparchWidget(plg:PluginInterfaces.Corparch.IPlugin):PluginInterfaces.Corparch.WidgetView {
        return plg.createWidget(
            'keywords_form',
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

    init():void {
        this.layoutModel.init(true, [], () => {
            this.formModel = new KeywordsFormModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel
            });
            this.corparchPlugin = createCorparch(this.layoutModel.pluginApi());
            const view = viewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                keywordsFormModel: this.formModel,
                CorparchWidget: this.initCorparchWidget(this.corparchPlugin)
            });
            this.reactRoot = this.layoutModel.renderReactComponent(
                view,
                window.document.getElementById('keywords-form-mount'),
            );
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new KeywordsFormPage(new KontextPage(conf)).init();
}