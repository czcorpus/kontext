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

import * as Immutable from 'immutable';
import {Kontext} from '../types/common';
import {AjaxResponse} from '../types/ajaxResponses';
import {PageModel, PluginName} from '../app/main';
import {ConcLinesStorage, openStorage} from '../conclines';
import {TextTypesModel} from '../models/textTypes/main';
import {QueryModel} from '../models/query/main';
import {CQLEditorModel} from '../models/query/cqleditor/model';
import {WithinBuilderModel} from '../models/query/withinBuilder';
import {VirtualKeyboardModel} from '../models/query/virtualKeyboard';
import {QueryContextModel} from '../models/query/context';
import {UsageTipsModel} from '../models/usageTips';
import {init as queryFormInit, QueryFormProps} from '../views/query/main';
import {init as corpnameLinkInit} from '../views/overview';
import {init as basicOverviewViewsInit} from '../views/query/basicOverview';
import corplistComponent from 'plugins/corparch/init';
import liveAttributes from 'plugins/liveAttributes/init';
import tagHelperPlugin from 'plugins/taghelper/init';
import queryStoragePlugin from 'plugins/queryStorage/init';
import { StatefulModel } from '../models/base';
import { ActionDispatcher, ActionPayload } from '../app/dispatcher';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/firstForm.less');


/**
 * ConfigWrapper ensures that actions we need to be bound
 * to the global app config trigger proper updates in the config.
 */
class ConfigWrapper extends StatefulModel {

    private layoutModel:PageModel;

    constructor(dispatcher:ActionDispatcher, layoutModel:PageModel) {
        super(dispatcher);
        this.layoutModel = layoutModel;
        this.dispatcherRegister((action:ActionPayload) => {
            switch (action.actionType) {
                case 'QUERY_INPUT_ADD_ALIGNED_CORPUS': {
                    const ac = this.layoutModel.getConf<Array<string>>('alignedCorpora');
                    this.layoutModel.setConf<Array<string>>('alignedCorpora', ac.concat([action.props['corpname']]));
                }
                break;
                case 'QUERY_INPUT_REMOVE_ALIGNED_CORPUS': {
                    const ac = this.layoutModel.getConf<Array<string>>('alignedCorpora');
                    this.layoutModel.setConf<Array<string>>('alignedCorpora', ac.filter(v => v !== action.props['corpname']));
                }
                break;
            }
        });
    }
}

/**
 *
 */
export class FirstFormPage {

    private layoutModel:PageModel;

    private queryModel:QueryModel;

    private cqlEditorModel:CQLEditorModel;

    private textTypesModel:TextTypesModel;

    private queryHintModel:UsageTipsModel;

    private withinBuilderModel:WithinBuilderModel;

    private virtualKeyboardModel:VirtualKeyboardModel;

    private queryContextModel:QueryContextModel;

    private onQueryModelReady:(qs:QueryModel)=>void;


    constructor(layoutModel:PageModel, clStorage:ConcLinesStorage) {
        this.layoutModel = layoutModel;
    }

    getConf<T>(name:string):T {
        return this.layoutModel.getConf<T>(name);
    }

    translate(msg:string, values?:{[k:string]:string}):string {
        return this.layoutModel.translate(msg, values);
    }

    getCorpora():Immutable.List<string> {
        return this.queryModel.getCorpora();
    }

    getAvailableAlignedCorpora():Immutable.List<Kontext.AttrItem> {
        return this.queryModel.getAvailableAlignedCorpora();
    }

    getCurrentSubcorpus():string {
        return this.queryModel.getCurrentSubcorpus();
    }

    getAvailableSubcorpora():Immutable.List<{v:string; n:string}> {
        return this.queryModel.getAvailableSubcorpora();
    }


    private initCorplistComponent():React.ComponentClass {
        return corplistComponent(this.layoutModel.pluginApi()).createWidget(
            'first_form',
            this.queryModel,
            {
                itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                    return this.layoutModel.switchCorpus(corpora, subcorpId).then(
                        () => {
                            // all the components must be deleted to prevent memory leaks
                            // and unwanted action handlers from previous instance
                            this.layoutModel.unmountReactComponent(window.document.getElementById('view-options-mount'));
                            this.layoutModel.unmountReactComponent(window.document.getElementById('query-form-mount'));
                            this.layoutModel.unmountReactComponent(window.document.getElementById('query-overview-mount'));
                            this.init();
                        },
                        (err) => {
                            this.layoutModel.showMessage('error', err);
                        }
                    )
                }
            }
        );
    }

    createTTViews():QueryFormProps {
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = <AjaxResponse.QueryFormArgs>concFormsArgs['__new__'];
        const textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesModel = new TextTypesModel(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData
        );
        this.textTypesModel.applyCheckedItems(
            queryFormArgs.selected_text_types,
            queryFormArgs.bib_mapping
        );

        const liveAttrsPlugin = liveAttributes(
            this.layoutModel.pluginApi(),
            this.textTypesModel,
            () => this.queryModel.getCorpora(),
            () => this.textTypesModel.hasSelectedItems(),
            {
                bibAttr: textTypesData['bib_attr'],
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora'),
                refineEnabled: this.layoutModel.getConf<Array<string>>('alignedCorpora').length > 0 ||
                                    Object.keys(queryFormArgs.selected_text_types).length > 0,
                manualAlignCorporaMode: false
            }
        );

        let liveAttrsViews;
        if (liveAttrsPlugin && this.layoutModel.pluginIsActive(PluginName.LIVE_ATTRIBUTES)) {
            // Complicated dependencies between QueryModel, TextTypesModel and LiveAttrsModel
            // cause that LiveAttrs model needs QueryModel data but it is not available
            // here yet. That's the reason we have to define a callback here to configure
            // required values later.
            this.onQueryModelReady = (qs => {
                liveAttrsPlugin.selectLanguages(qs.getCorpora().rest().toList(), false);
            });
            this.textTypesModel.setTextInputChangeCallback(liveAttrsPlugin.getAutoCompleteTrigger());
            this.textTypesModel.addSelectionChangeListener(target => {
                liveAttrsPlugin.setControlsEnabled(target.hasSelectedItems() ||
                        liveAttrsPlugin.hasSelectedLanguages());
            });
            liveAttrsViews = liveAttrsPlugin.getViews(null, this.textTypesModel); // TODO 'this' reference = antipattern

        } else {
            this.onQueryModelReady = () => undefined;
            liveAttrsViews = {};
        }
        return {
            formType:Kontext.ConcFormTypes.QUERY,
            liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
            liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
            attributes: this.textTypesModel.getAttributes(),
            tagHelperView: null,
            queryStorageView: null,
            allowCorpusSelection: null,
            actionPrefix: null
        };
    }

    private initQueryModel():void {
        const formCorpora = [this.layoutModel.getCorpusIdent().id];
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = <AjaxResponse.QueryFormArgs>concFormsArgs['__new__'];
        this.queryModel = new QueryModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.textTypesModel,
            this.queryContextModel,
            {
                corpora: [this.layoutModel.getCorpusIdent().id].concat(
                    this.layoutModel.getConf<Array<string>>('alignedCorpora') || []),
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora'),
                currQueryTypes: queryFormArgs.curr_query_types,
                currQueries: queryFormArgs.curr_queries,
                currPcqPosNegValues: queryFormArgs.curr_pcq_pos_neg_values,
                currIncludeEmptyValues: queryFormArgs.curr_include_empty_values,
                currLposValues: queryFormArgs.curr_lpos_values,
                currQmcaseValues: queryFormArgs.curr_qmcase_values,
                currDefaultAttrValues: queryFormArgs.curr_default_attr_values,
                subcorpList: this.layoutModel.getConf<Array<Kontext.SubcorpListItem>>('SubcorpList'),
                currentSubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                isForeignSubcorpus: this.layoutModel.getCorpusIdent().foreignSubcorp,
                tagBuilderSupport: queryFormArgs.tag_builder_support,
                shuffleConcByDefault: this.layoutModel.getConf<boolean>('ShuffleConcByDefault'),
                forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
                attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
                structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
                lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
                inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages'),
                textTypesNotes: this.layoutModel.getConf<string>('TextTypesNotes'),
                selectedTextTypes: queryFormArgs.selected_text_types,
                hasLemma: queryFormArgs.has_lemma,
                tagsetDocs: queryFormArgs.tagset_docs,
                useCQLEditor:this.layoutModel.getConf<boolean>('UseCQLEditor'),
                tagAttr: this.layoutModel.getConf<string>('tagAttr')
            }
        );

        this.onQueryModelReady(this.queryModel);
        this.layoutModel.getModels().generalViewOptionsModel.addOnSubmitResponseHandler(model => {
            this.queryModel.onSettingsChange(model);
            this.layoutModel.dispatchSideEffect(
                model.getUseCQLEditor() ? 'CQL_EDITOR_ENABLE' : 'CQL_EDITOR_DISABLE',
                {}
            );
        });

        this.cqlEditorModel = new CQLEditorModel({
            dispatcher: this.layoutModel.dispatcher,
            pageModel: this.layoutModel,
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            tagAttr: this.layoutModel.pluginIsActive(PluginName.TAGHELPER) ? this.queryModel.getTagAttr() : null,
            actionPrefix: '',
            isEnabled: this.layoutModel.getConf<boolean>('UseCQLEditor')
        });
    }

    private attachQueryForm(properties:QueryFormProps, corparchWidget:React.ComponentClass):void {
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
            cqlEditorModel: this.cqlEditorModel
        });
        this.layoutModel.renderReactComponent(
            queryFormComponents.QueryForm,
            window.document.getElementById('query-form-mount'),
            properties
        );
    }

    private initCorpnameLink():void {
        const corpInfoViews = corpnameLinkInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.layoutModel.getModels().corpusInfoModel
        );
        const queryOverviewViews = basicOverviewViewsInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.queryModel
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
            }
        );
    }

    init():void {
        this.layoutModel.init().then(
            () => {
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
                this.queryContextModel = new QueryContextModel(this.layoutModel.dispatcher);

                const tagHelperPlg = tagHelperPlugin(this.layoutModel.pluginApi());
                const pageSize = this.layoutModel.getConf<number>('QueryHistoryPageNumRecords');
                const qsPlugin = queryStoragePlugin(this.layoutModel.pluginApi(), 0, pageSize, pageSize);
                const ttAns = this.createTTViews();
                ttAns.tagHelperView = this.layoutModel.isNotEmptyPlugin(tagHelperPlg) ? tagHelperPlg.getWidgetView() : null;
                ttAns.queryStorageView = qsPlugin.getWidgetView();
                ttAns.allowCorpusSelection = true;
                ttAns.actionPrefix = '';
                this.initQueryModel();
                const corparchWidget = this.initCorplistComponent();
                this.attachQueryForm(ttAns, corparchWidget);
                this.layoutModel.registerSwitchCorpAwareObject(this.cqlEditorModel);
                this.layoutModel.registerSwitchCorpAwareObject(this.queryModel);
                this.initCorpnameLink();
                new ConfigWrapper(this.layoutModel.dispatcher, this.layoutModel);
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
    const layoutModel = new PageModel(conf);
    const clStorage:ConcLinesStorage = openStorage((err) => {
        layoutModel.showMessage('error', err);
    });
    clStorage.clear();
    const pageModel = new FirstFormPage(layoutModel, clStorage);
    pageModel.init();
}