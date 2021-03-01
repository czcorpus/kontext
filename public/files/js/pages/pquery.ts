/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { PageModel } from '../app/page';
import { KontextPage } from '../app/main';
import { Kontext } from '../types/common';
import { init as formViewInit } from '../views/pquery/form';
import { generatePqueryName, PqueryFormModel } from '../models/pquery/form';
import { PluginInterfaces } from '../types/plugins';
import corplistComponent from 'plugins/corparch/init';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../models/common/actions';
import { tuple } from 'cnc-tskit';


class ParadigmaticQueryFormPage {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    private initCorplistComponent():[React.ComponentClass, PluginInterfaces.Corparch.IPlugin] {
        const plg = corplistComponent(this.layoutModel.pluginApi());
        return tuple(
            plg.createWidget(
                'query',
                {
                    itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                        this.layoutModel.dispatcher.dispatch<GlobalActions.SwitchCorpus>({
                            name: GlobalActionName.SwitchCorpus,
                            payload: {
                                corpora,
                                subcorpus: subcorpId
                            }
                        });
                    }
                }
            ),
            plg
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {


            const model = new PqueryFormModel(
                this.layoutModel.dispatcher,
                {
                    isBusy: false,
                    corpname: this.layoutModel.getCorpusIdent().id,
                    usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                    queries: {[generatePqueryName(0)]: {
                        corpname: this.layoutModel.getCorpusIdent().id,
                        qtype: 'advanced',
                        query: '',
                        parsedAttrs: [],
                        focusedAttr: undefined,
                        rawAnchorIdx: 0,
                        rawFocusIdx: 0,
                        queryHtml: '',
                        pcq_pos_neg: 'pos',
                        include_empty: true,
                        default_attr: null
                    }},
                    minFreq: 5,
                    position: '0<0',
                    attr: this.layoutModel.getConf('AttrList')[0].n,
                    attrs: this.layoutModel.getConf('AttrList'),
                    structAttrs: this.layoutModel.getConf('StructAttrList')
                },
                this.layoutModel
            );

            const formView = formViewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                model
            });
            const [corparchWidget, corparchPlg]  = this.initCorplistComponent();
            this.layoutModel.renderReactComponent(
                formView,
                window.document.getElementById('pquery-form-mount'),
                {
                    corparchWidget
                }
            );

            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('pquery-form-mount'));
                    this.init();
                },
                model,
                corparchPlg
            );

            console.log('init query page done'); // TODO
        });
    }
}


class ParadigmaticQueryResultPage {

    private readonly layoutModel:PageModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            console.log('init result page done'); // TODO
        });
    }
}


export function init(conf:Kontext.Conf):void {
    const layout = new KontextPage(conf);
    const view = layout.getConf<string>('View');
    switch (view) {
        case 'form':
            new ParadigmaticQueryFormPage(layout).init();
            break;
        case 'result':
            new ParadigmaticQueryResultPage(layout).init();
            break;
        default:
            layout.showMessage('error', `Invalid view specified: ${view}`);
    }
}