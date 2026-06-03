/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { DownloadType, PageModel } from '../app/page.js';
import { KontextPage } from '../app/main.js';
import { init as viewInit } from '../views/keywords/result/index.js';
import { Root } from 'react-dom/client';
import { KeywordsResultModel } from '../models/keywords/result.js';
import { KeywordsSubmitArgs } from '../models/keywords/common.js';
import { Actions } from '../models/keywords/actions.js';
import { KeywordsResultsSaveModel } from '../models/keywords/save.js';
import { init as queryOverviewInit } from '../views/keywords/overview/index.js';
import { KeywordsFormModel } from '../models/keywords/form.js';
import * as PluginInterfaces from '../types/plugins/index.js';
import { Actions as GlobalActions } from '../models/common/actions.js';
import { Actions as CorparchActions } from '../types/plugins/corparch.js';
import createCorparch from '@plugins/corparch';
import { HTTP, List } from 'cnc-tskit';


/**
 *
 */
export class KeywordsResultPage {

    private readonly layoutModel:PageModel;

    private resultModel:KeywordsResultModel;

    private reactRoot:Root;

    private focusCorparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private refCorparchPlugin:PluginInterfaces.Corparch.IPlugin;

    private readonly focusCorpWidgetId = '1';

    private readonly refCorpWidgetId = '2';

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    setDownloadLink(name:string, format:string, urlConstructor:(taskId:string) => string, args?:any) {
        this.layoutModel.bgDownload({
            name,
            format,
            datasetType: DownloadType.KEYWORDS,
            urlConstructor,
            contentType: 'text/plain',
            args,
        }).subscribe();
    }

    private initFocusCorpWidget():PluginInterfaces.Corparch.WidgetView {
        return this.focusCorparchPlugin.createWidget(
            this.focusCorpWidgetId,
            'keywords/form',
            (corpora:Array<string>, subcorpId:string) => {
                this.layoutModel.dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                    name: GlobalActions.SwitchCorpus.name,
                    payload: {
                        corpora,
                        subcorpus: subcorpId,
                        widgetId: this.focusCorpWidgetId,
                    }
                });
            }
        );
    }

    private initRefCorpWidget():PluginInterfaces.Corparch.WidgetView {
        return this.refCorparchPlugin.createWidget(
            this.refCorpWidgetId,
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
                                widgetId: this.refCorpWidgetId,
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
                                widgetId: this.refCorpWidgetId,
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
        )
    }

    private initCorpnameLink(model:KeywordsFormModel):void {
        const queryOverviewViews = queryOverviewInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            keywordsFormModel: model,
            FocusCorpWidget: this.initFocusCorpWidget(),
            focusCorpWidgetId: this.focusCorpWidgetId,
            RefCorpWidget: this.initRefCorpWidget(),
            refCorpWidgetId: this.refCorpWidgetId,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel,
        });
        this.layoutModel.renderReactComponent(
            queryOverviewViews,
            window.document.getElementById('query-overview-mount'),
            {
                queryId: this.layoutModel.getConf<string>('QueryId')
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            this.resultModel = new KeywordsResultModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                refCorpname: this.layoutModel.getConf<KeywordsSubmitArgs>('KeywordsForm').ref_corpname,
                refSubcorpId: this.layoutModel.getConf<KeywordsSubmitArgs>('KeywordsForm').ref_usesubcorp,
                focusCorpname: this.layoutModel.getCorpusIdent().id,
                focusSubcorpname: this.layoutModel.getCorpusIdent().subcName,
                focusSubcorpId: this.layoutModel.getCorpusIdent().usesubcorp,
                attr: this.layoutModel.getConf<KeywordsSubmitArgs>('KeywordsForm').wlattr,
            });

            this.focusCorparchPlugin = createCorparch(this.layoutModel.pluginApi());
            this.refCorparchPlugin = createCorparch(this.layoutModel.pluginApi());

            const saveModel = new KeywordsResultsSaveModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                saveLinkFn: this.setDownloadLink.bind(this),
                quickSaveRowLimit: 10000 // TODO
            });

            const view = viewInit({
                dispatcher: this.layoutModel.dispatcher,
                he: this.layoutModel.getComponentHelpers(),
                keywordsResultModel: this.resultModel,
                saveModel,
            });
            this.reactRoot = this.layoutModel.renderReactComponent(
                view,
                window.document.getElementById('keywords-result-mount'),
            );

            const kwForm = this.layoutModel.getConf<KeywordsSubmitArgs>('KeywordsForm');
            const formModel = new KeywordsFormModel({
                dispatcher: this.layoutModel.dispatcher,
                layoutModel: this.layoutModel,
                initialArgs: kwForm,
                refWidgetId: this.refCorpWidgetId,
                availAttrs: this.layoutModel.getConf<Array<Kontext.AttrItem>>('CommonAttrList'),
                focusCorpusAttrs: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            });

            this.initCorpnameLink(formModel);

            this.layoutModel.getHistory().setOnPopState(
                (evt:PopStateEvent) => {
                    if ('kwsort' in evt.state && 'kwpage' in evt.state) {
                        this.layoutModel.dispatcher.dispatch(
                            Actions.KeywordsHistoryPopState,
                            {...evt.state}
                        );
                    }
                }
            );
            this.layoutModel.initKeyShortcuts();
        });
    }
}


export function init(conf:Kontext.Conf):void {
    new KeywordsResultPage(new KontextPage(conf)).init();
}