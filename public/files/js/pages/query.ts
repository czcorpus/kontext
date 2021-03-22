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

import { IFullActionControl, StatelessModel } from 'kombo';
import { Dict, id, List, pipe, tuple } from 'cnc-tskit';

import { Kontext } from '../types/common';
import { AjaxResponse } from '../types/ajaxResponses';
import { PageModel } from '../app/page';
import { TextTypesModel } from '../models/textTypes/main';
import { FirstQueryFormModel } from '../models/query/first';
import { WithinBuilderModel } from '../models/query/withinBuilder';
import { VirtualKeyboardModel } from '../models/query/virtualKeyboard';
import { QueryContextModel } from '../models/query/context';
import { UsageTipsModel } from '../models/usageTips';
import { init as queryFormInit, QueryFormProps } from '../views/query/first';
import { init as basicOverviewViewsInit } from '../views/query/basicOverview';
import { PluginInterfaces } from '../types/plugins';
import { PluginName } from '../app/plugin';
import { KontextPage } from '../app/main';
import { ConcLinesStorage, StorageUsingState, openStorage } from '../models/concordance/selectionStorage';
import { Actions as QueryActions, ActionName as QueryActionName } from '../models/query/actions';
import { Actions as GlobalActions, ActionName as GlobalActionName } from '../models/common/actions';
import corplistComponent from 'plugins/corparch/init';
import liveAttributes from 'plugins/liveAttributes/init';
import tagHelperPlugin from 'plugins/taghelper/init';
import { QueryHelpModel } from '../models/help/queryHelp';


/**
 * ConfigWrapper ensures that actions we need to be bound
 * to the global app config trigger proper updates in the config.
 */
class ConfigWrapper extends StatelessModel<{}> {

    private layoutModel:PageModel;

    constructor(dispatcher:IFullActionControl, layoutModel:PageModel) {
        super(dispatcher, {});
        this.layoutModel = layoutModel;

        this.addActionHandler<QueryActions.QueryInputAddAlignedCorpus>(
            QueryActionName.QueryInputAddAlignedCorpus,
            null,
            (state, action, dispatch) => {
                const ac = this.layoutModel.getConf<Array<string>>('alignedCorpora');
                this.layoutModel.setConf<Array<string>>(
                    'alignedCorpora',
                    ac.concat([action.payload.corpname])
                );
            }
        );

        this.addActionHandler<QueryActions.QueryInputRemoveAlignedCorpus>(
            QueryActionName.QueryInputRemoveAlignedCorpus,
            null,
            (state, action, dispatch) => {
                const ac = this.layoutModel.getConf<Array<string>>('alignedCorpora');
                this.layoutModel.setConf<Array<string>>(
                    'alignedCorpora',
                    ac.filter(v => v !== action.payload.corpname)
                );
            }
        );
    }
}

/**
 *
 */
export class QueryPage {

    private layoutModel:PageModel;

    private queryModel:FirstQueryFormModel;

    private textTypesModel:TextTypesModel;

    private liveAttrsPlugin:PluginInterfaces.LiveAttributes.IPlugin;

    private queryHintModel:UsageTipsModel;

    private queryHelpModel:QueryHelpModel;

    private withinBuilderModel:WithinBuilderModel;

    private virtualKeyboardModel:VirtualKeyboardModel;

    private queryContextModel:QueryContextModel;


    constructor(layoutModel:PageModel, clStorage:ConcLinesStorage<StorageUsingState>) {
        this.layoutModel = layoutModel;
    }

    getConf<T>(name:string):T {
        return this.layoutModel.getConf<T>(name);
    }

    translate(msg:string, values?:{[k:string]:string}):string {
        return this.layoutModel.translate(msg, values);
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

    createTTViews(queryFormArgs:AjaxResponse.QueryFormArgs):QueryFormProps {
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesModel = new TextTypesModel(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData,
                false
        );
        this.textTypesModel.applyCheckedItems(
            queryFormArgs.selected_text_types,
            queryFormArgs.bib_mapping
        );

        this.liveAttrsPlugin = liveAttributes(
            this.layoutModel.pluginApi(),
            this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES),
            false,
            {
                bibAttr: textTypesData['bib_attr'],
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>(
                    'availableAlignedCorpora'
                ),
                refineEnabled: this.layoutModel.getConf<Array<string>>(
                    'alignedCorpora').length > 0 ||
                    Dict.keys(queryFormArgs.selected_text_types).length > 0,
                manualAlignCorporaMode: false
            }
        );

        let liveAttrsViews:PluginInterfaces.LiveAttributes.Views;
        if (this.layoutModel.pluginTypeIsActive(PluginName.LIVE_ATTRIBUTES)) {
            liveAttrsViews = this.liveAttrsPlugin.getViews(null, this.textTypesModel);
            this.textTypesModel.enableAutoCompleteSupport();

        } else {
            liveAttrsViews = {
                LiveAttrsCustomTT: null,
                LiveAttrsView: null
            };
        }
        return {
            ...liveAttrsViews,
            formType: Kontext.ConcFormTypes.QUERY,
            tagHelperViews: {},
            queryHistoryView: null,
            allowCorpusSelection: null
        };
    }

    private initQueryModel(queryFormArgs:AjaxResponse.QueryFormArgs):void {
        const corpora = [this.layoutModel.getCorpusIdent().id].concat(
            this.layoutModel.getConf<Array<string>>('alignedCorpora') || []);
        this.queryModel = new FirstQueryFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.textTypesModel,
            this.queryContextModel,
            this.layoutModel.qsuggPlugin,
            {
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
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                isForeignSubcorpus: this.layoutModel.getCorpusIdent().foreignSubcorp,
                tagsets: queryFormArgs.tagsets,
                shuffleConcByDefault: this.layoutModel.getConf<boolean>('ShuffleConcByDefault'),
                forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
                attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                structList: this.layoutModel.getConf<Array<string>>('StructList'),
                wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
                inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>(
                    'InputLanguages'
                ),
                textTypesNotes: this.layoutModel.getConf<string>('TextTypesNotes'),
                selectedTextTypes: queryFormArgs.selected_text_types,
                hasLemma: queryFormArgs.has_lemma,
                useRichQueryEditor:this.layoutModel.getConf<boolean>('UseRichQueryEditor'),
                isAnonymousUser: this.layoutModel.getConf<boolean>('anonymousUser'),
                isLocalUiLang: this.layoutModel.getConf<boolean>('isLocalUiLang'),
                suggestionsEnabled: this.layoutModel.getConf<boolean>('QSEnabled'),
                simpleQueryDefaultAttrs: pipe(
                    this.layoutModel.getConf<Array<string>>('alignedCorpora'),
                    List.push(this.layoutModel.getCorpusIdent().id),
                    List.map(corp => tuple(
                        corp,
                        pipe(
                            this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                            List.map(v => v.n),
                            this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs').length > 0 ?
                                List.unshift<string|Array<string>>(this.layoutModel.getConf<Array<string>>('SimpleQueryDefaultAttrs')) :
                                id
                        )
                    )),
                    Dict.fromEntries()
                )
            }
        );
    }


    private attachQueryForm(
        properties:QueryFormProps,
        corparchWidget:React.ComponentClass

    ):void {
        const queryFormComponents = queryFormInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            CorparchWidget: corparchWidget,
            queryModel: this.queryModel,
            textTypesModel: this.textTypesModel,
            queryHintModel: this.queryHintModel,
            withinBuilderModel: this.withinBuilderModel,
            virtualKeyboardModel: this.virtualKeyboardModel,
            queryContextModel: this.queryContextModel,
            querySuggest: this.layoutModel.qsuggPlugin,
            queryHelpModel: this.queryHelpModel
        });
        this.layoutModel.renderReactComponent(
            queryFormComponents.QueryForm,
            window.document.getElementById('query-form-mount'),
            properties
        );
        this.layoutModel.renderReactComponent(
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
            this.layoutModel.getComponentHelpers()
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp
            }
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

            const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>(
                'ConcFormsArgs'
            );
            const queryFormArgs = <AjaxResponse.QueryFormArgs>concFormsArgs['__new__'];
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

            const ttAns = this.createTTViews(queryFormArgs);

            ttAns.queryHistoryView = this.layoutModel.qhistPlugin.getWidgetView();

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

            this.initQueryModel(queryFormArgs);
            const [corparchWidget, corparchPlg]  = this.initCorplistComponent();
            this.attachQueryForm(
                ttAns,
                corparchWidget
            );
            this.initCorpnameLink();
            const cwrap = new ConfigWrapper(this.layoutModel.dispatcher, this.layoutModel);
            // all the models must be unregistered and components must
            // be unmounted to prevent memory leaks and unwanted action handlers
            // from previous instance
            this.layoutModel.registerCorpusSwitchAwareModels(
                () => {
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('view-options-mount'));
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('query-form-mount'));
                    this.layoutModel.unmountReactComponent(
                        window.document.getElementById('query-overview-mount'));
                    this.init();
                },
                this.queryModel,
                corparchPlg,
                this.queryHintModel,
                this.textTypesModel,
                this.queryContextModel,
                this.withinBuilderModel,
                this.virtualKeyboardModel,
                this.liveAttrsPlugin
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