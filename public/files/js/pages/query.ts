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

import { Dict, Ident, List, pipe, tuple } from 'cnc-tskit';

import * as Kontext from '../types/kontext';
import { PageModel } from '../app/page';
import { TextTypesModel } from '../models/textTypes/main';
import { FirstQueryFormModel } from '../models/query/first';
import { WithinBuilderModel } from '../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../models/query/virtualKeyboard';
import { QueryContextModel } from '../models/query/context';
import { UsageTipsModel } from '../models/usageTips';
import { init as queryFormInit, QueryFormProps } from '../views/query/first';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview';
import * as PluginInterfaces from '../types/plugins';
import { PluginName } from '../app/plugin';
import { KontextPage } from '../app/main';
import {
    ConcLinesStorage, StorageUsingState,
    openStorage } from '../models/concordance/selectionStorage';
import { Actions as GlobalActions } from '../models/common/actions';
import corplistComponent from 'plugins/corparch/init';
import liveAttributes from 'plugins/liveAttributes/init';
import tagHelperPlugin from 'plugins/taghelper/init';
import { QueryHelpModel } from '../models/help/queryHelp';
import { ConcFormArgs, QueryFormArgs } from '../models/query/formArgs';
import { QuickSubcorpModel } from '../models/subcorp/quickSubcorp';
import { importInitialTTData, TTInitialData } from '../models/textTypes/common';
import { ConcServerArgs } from '../models/concordance/common';
import { AnyTTSelection, ExportedSelection } from '../types/textTypes';
import { Root } from 'react-dom/client';


/**
 *
 */
export class QueryPage {

    private layoutModel:PageModel;

    private queryModel:FirstQueryFormModel;

    private textTypesModel:TextTypesModel;

    private quickSubcorpModel:QuickSubcorpModel;

    private liveAttrsPlugin:PluginInterfaces.LiveAttributes.IPlugin;

    private queryHintModel:UsageTipsModel;

    private queryHelpModel:QueryHelpModel;

    private withinBuilderModel:WithinBuilderModel;

    private virtualKeyboardModel:VirtualKeyboardModel;

    private queryContextModel:QueryContextModel;

    private queryFormRoot:Root;

    private topbarHelpRoot:Root;

    private queryOverviewRoot:Root;


    constructor(layoutModel:PageModel, clStorage:ConcLinesStorage<StorageUsingState>) {
        this.layoutModel = layoutModel;
    }

    getConf<T>(name:string):T {
        return this.layoutModel.getConf<T>(name);
    }

    translate(msg:string, values?:{[k:string]:string}):string {
        return this.layoutModel.translate(msg, values);
    }

    private initCorplistComponent(widgetId:string):[PluginInterfaces.Corparch.WidgetView, PluginInterfaces.Corparch.IPlugin] {
        const plg = corplistComponent(this.layoutModel.pluginApi());
        return tuple(
            plg.createWidget(
                widgetId,
                'query',
                (corpora:Array<string>, subcorpId:string) => {
                    this.layoutModel.dispatcher.dispatch<typeof GlobalActions.SwitchCorpus>({
                        name: GlobalActions.SwitchCorpus.name,
                        payload: {
                            corpora,
                            subcorpus: subcorpId
                        }
                    });
                }
            ),
            plg
        );
    }

    createTTViews(
        queryFormArgs:QueryFormArgs,
        textTypesData:TTInitialData,
        subcorpTTStructure:ExportedSelection
    ):[QueryFormProps, Array<AnyTTSelection>] {
        const attributes = importInitialTTData(
            textTypesData, subcorpTTStructure, subcorpTTStructure);
        this.textTypesModel = new TextTypesModel({
                dispatcher: this.layoutModel.dispatcher,
                pluginApi: this.layoutModel.pluginApi(),
                attributes,
                readonlyMode: false,
                bibIdAttr: textTypesData.bib_id_attr,
                bibLabelAttr: textTypesData.bib_label_attr
        });
        const hasSelectedItems = this.textTypesModel.applyCheckedItems(
            queryFormArgs.selected_text_types,
            queryFormArgs.bib_mapping
        );

        const availableAlignedCorpora = this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora');
        this.liveAttrsPlugin = liveAttributes(
            this.layoutModel.pluginApi(),
            this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES),
            false,
            {
                bibIdAttr: textTypesData.bib_id_attr,
                bibLabelAttr: textTypesData.bib_label_attr,
                availableAlignedCorpora,
                refineEnabled: hasSelectedItems,
                manualAlignCorporaMode: false,
                subcorpTTStructure,
                textTypesData: this.layoutModel.getConf<TTInitialData>('textTypesData')
            }
        );

        let liveAttrsViews:PluginInterfaces.LiveAttributes.Views;
        if (this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES)) {
            liveAttrsViews = this.liveAttrsPlugin.getViews(null, this.textTypesModel, !List.empty(availableAlignedCorpora));
            this.textTypesModel.enableAutoCompleteSupport();

        } else {
            liveAttrsViews = {
                LiveAttrsCustomTT: null,
                LiveAttrsView: null
            };
        }

        this.quickSubcorpModel = new QuickSubcorpModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.liveAttrsPlugin.isActive()
        );

        return tuple(
            {
                ...liveAttrsViews,
                formType: Kontext.ConcFormTypes.QUERY,
                tagHelperViews: {},
                allowCorpusSelection: null
            },
            attributes
        );
    }

    private initQueryModel(
        thPlugin:PluginInterfaces.TagHelper.IPlugin,
        queryFormArgs:QueryFormArgs,
        initialTTSelection:Array<AnyTTSelection>,
        bibIdAttr:string,
        bibLabelAttr:string
    ):void {
        const corpora = [this.layoutModel.getCorpusIdent().id].concat(
            this.layoutModel.getConf<Array<string>>('alignedCorpora') || []);
        this.queryModel = new FirstQueryFormModel({
            dispatcher: this.layoutModel.dispatcher,
            pageModel: this.layoutModel,
            quickSubcorpActive: Dict.size(TextTypesModel.exportSelections(
                initialTTSelection,
                bibIdAttr,
                bibLabelAttr,
                false,
                true,
            )) > 0,
            queryContextModel: this.queryContextModel,
            qsPlugin: this.layoutModel.qsuggPlugin,
            thPlugin,
            props: {
                corpora,
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>(
                    'availableAlignedCorpora'
                ),
                currQueryTypes: queryFormArgs.curr_query_types,
                currQueries: queryFormArgs.curr_queries,
                currParsedQueries: queryFormArgs.curr_parsed_queries,
                currPcqPosNegValues: queryFormArgs.curr_pcq_pos_neg_values,
                currIncludeEmptyValues: queryFormArgs.curr_include_empty_values,
                currLposValues: queryFormArgs.curr_lpos_values,
                currQmcaseValues: queryFormArgs.curr_qmcase_values,
                currDefaultAttrValues: queryFormArgs.curr_default_attr_values,
                currUseRegexpValues: queryFormArgs.curr_use_regexp_values,
                subcorpList: this.layoutModel.getConf<Array<Kontext.SubcorpListItem>>(
                    'SubcorpList'
                ),
                currentSubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                subcorpusId: this.layoutModel.getCorpusIdent().usesubcorp,
                isForeignSubcorpus: this.layoutModel.getCorpusIdent().foreignSubcorp,
                tagsets: queryFormArgs.tagsets,
                shuffleConcByDefault: this.layoutModel.getConf<boolean>('ShuffleConcByDefault'),
                forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
                attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
                structList: Kontext.structsAndAttrsToStructList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
                wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
                inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>(
                    'InputLanguages'
                ),
                textTypesNotes: this.layoutModel.getConf<string>('TextTypesNotes'),
                bibIdAttr,
                selectedTextTypes: queryFormArgs.selected_text_types,
                hasLemma: queryFormArgs.has_lemma,
                useRichQueryEditor:this.layoutModel.getConf<boolean>('UseRichQueryEditor'),
                isAnonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
                isLocalUiLang: this.layoutModel.getConf<boolean>('isLocalUiLang'),
                suggestionsConfigured: this.layoutModel.getConf<boolean>('QSEnabled'),
                simpleQueryDefaultAttrs: pipe(
                    [...this.layoutModel.getConf<Array<string>>('alignedCorpora')],
                    List.push(this.layoutModel.getCorpusIdent().id),
                    List.map(corp => tuple(
                        corp,
                        pipe(
                            this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                            List.map(v => v.n),
                            this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs').length > 0 ?
                                List.unshift<string|Array<string>>(this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs')) :
                                v => v
                        )
                    )),
                    Dict.fromEntries()
                ),
                concViewPosAttrs: this.getConf<ConcServerArgs>('currentArgs').attrs,
                alignCommonPosAttrs: this.getConf<Array<string>>('AlignCommonPosAttrs'),
                concPreflight: this.getConf<Kontext.PreflightConf|null>('concPreflight')
            }
        });
    }


    private attachQueryForm(
        properties:QueryFormProps,
        corparchWidget:PluginInterfaces.Corparch.WidgetView,
        corparchWidgetId:string

    ):void {
        const queryFormComponents = queryFormInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            CorparchWidget: corparchWidget,
            corparchWidgetId,
            queryModel: this.queryModel,
            textTypesModel: this.textTypesModel,
            quickSubcorpModel: this.quickSubcorpModel,
            queryHintModel: this.queryHintModel,
            withinBuilderModel: this.withinBuilderModel,
            virtualKeyboardModel: this.virtualKeyboardModel,
            queryContextModel: this.queryContextModel,
            querySuggest: this.layoutModel.qsuggPlugin,
            queryHelpModel: this.queryHelpModel,
            searchHistoryModel: this.layoutModel.getModels().searchHistoryModel
        });
        this.queryFormRoot = this.layoutModel.renderReactComponent(
            queryFormComponents.QueryForm,
            window.document.getElementById('query-form-mount'),
            properties
        );
        this.topbarHelpRoot = this.layoutModel.renderReactComponent(
            queryFormComponents.QueryHelp,
            window.document.getElementById('topbar-help-mount'),
            {
                isLocalUiLang: this.layoutModel.getConf<boolean>('isLocalUiLang')
            }
        );
    }

    private initCorpnameLink():void {
        const queryOverviewViews = basicOverviewViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.getModels().mainMenuModel
        );
        this.queryOverviewRoot = this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            this.queryHintModel = new UsageTipsModel(
                this.layoutModel.dispatcher,
                this.layoutModel.translate.bind(this.layoutModel)
            );
            this.withinBuilderModel = new WithinBuilderModel(
                this.layoutModel.dispatcher,
                this.layoutModel
            );

            this.virtualKeyboardModel = new VirtualKeyboardModel(
                this.layoutModel.dispatcher,
                this.layoutModel
            );

            const concFormsArgs = this.layoutModel.getConf<{[ident:string]:ConcFormArgs}>(
                'ConcFormsArgs'
            );

            let queryId = '__new__';
            const q = this.layoutModel.getNestedConf<string>('currentArgs', 'q');
            if (q.length > 0) {
                queryId = q[0].replace('~', '');
            }

            const queryFormArgs = concFormsArgs[queryId] as QueryFormArgs;
            this.queryContextModel = new QueryContextModel(
                this.layoutModel.dispatcher,
                queryFormArgs
            );

            this.queryHelpModel = new QueryHelpModel(
                this.layoutModel,
                this.layoutModel.dispatcher,
                {
                    isBusy: false,
                    rawHtml: '',
                    tagsets: queryFormArgs.tagsets,
                    activeCorpora: [
                        this.layoutModel.getCorpusIdent().id,
                        ...this.layoutModel.getConf<Array<string>>('alignedCorpora')
                    ]
                }
            );

            const textTypesData = this.layoutModel.getConf<TTInitialData>('textTypesData');
            const subcorpTTStructure = this.layoutModel.getConf<ExportedSelection>('SubcorpTTStructure');
            const [ttAns, ttSelection] = this.createTTViews(queryFormArgs, textTypesData, subcorpTTStructure);

            const tagBuilderCorpora = [
                this.layoutModel.getCorpusIdent().id,
                ...List.map(
                    v => v.n,
                    this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora')
                )
            ];
            const tagHelperPlg = tagHelperPlugin(this.layoutModel.pluginApi());
            ttAns.tagHelperViews = pipe(
                this.layoutModel.isNotEmptyPlugin(tagHelperPlg) ? tagBuilderCorpora : [],
                List.map(corpus => tuple(
                        corpus,
                        tagHelperPlg.getWidgetView(
                            corpus,
                            corpus,
                            this.layoutModel.getNestedConf<
                            Array<PluginInterfaces.TagHelper.TagsetInfo>>(
                                'pluginData', 'taghelper', 'corp_tagsets')
                        )
                )),
                Dict.fromEntries()
            );

            ttAns.allowCorpusSelection = true;

            this.initQueryModel(
                tagHelperPlg,
                queryFormArgs,
                ttSelection,
                textTypesData.bib_id_attr,
                textTypesData.bib_label_attr
            );
            const corparchWidgetId = Ident.puid()
            const [corparchWidget, corparchPlg]  = this.initCorplistComponent(corparchWidgetId);
            this.attachQueryForm(
                ttAns,
                corparchWidget,
                corparchWidgetId
            );
            this.initCorpnameLink();
            // all the models must be unregistered and components must
            // be unmounted to prevent memory leaks and unwanted action handlers
            // from previous instance
            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(this.queryFormRoot);
                    this.layoutModel.unmountReactComponent(this.queryOverviewRoot);
                    this.layoutModel.unmountReactComponent(this.topbarHelpRoot);
                    this.init();
                },
                this.queryModel,
                corparchPlg,
                this.queryHintModel,
                this.textTypesModel,
                this.queryContextModel,
                this.withinBuilderModel,
                this.virtualKeyboardModel,
                this.liveAttrsPlugin,
                this.quickSubcorpModel
            );
        });
    }
}


export function init(conf:Kontext.Conf):void {
    const layoutModel = new KontextPage(conf);
    const clStorage:ConcLinesStorage<StorageUsingState> = openStorage(
        layoutModel.dispatcher,
        (err:Error) => {
            layoutModel.showMessage('error', err);
        }
    );
    const pageModel = new QueryPage(layoutModel, clStorage);
    pageModel.init();
}