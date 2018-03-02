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

/// <reference path="../types/views.d.ts" />
/// <reference path="../types/plugins.d.ts" />
/// <reference path="../vendor.d.ts/rsvp.d.ts" />

import {Kontext} from '../types/common';
import {AjaxResponse} from '../types/ajaxResponses';
import * as corplistComponent from 'plugins/corparch/init';
import {PageModel, PluginName} from '../app/main';
import liveAttributes from 'plugins/liveAttributes/init';
import {ConcLinesStorage, openStorage} from '../conclines';
import * as Immutable from 'immutable';
import {TextTypesModel} from '../models/textTypes/attrValues';
import {QueryFormProperties, QueryModel, QueryHintModel} from '../models/query/main';
import {CQLEditorModel} from '../models/query/cqleditor/model';
import {WithinBuilderModel} from '../models/query/withinBuilder';
import {VirtualKeyboardModel} from '../models/query/virtualKeyboard';
import {QueryContextModel} from '../models/query/context';
import tagHelperPlugin from 'plugins/taghelper/init';
import queryStoragePlugin from 'plugins/queryStorage/init';
import * as RSVP from 'vendor/rsvp';
import {init as queryFormInit} from 'views/query/main';
import {init as corpnameLinkInit} from 'views/overview';
import {init as basicOverviewViewsInit} from 'views/query/basicOverview';
import { CQLEditorProps } from '../views/query/cqlEditor';

declare var require:any;
// weback - ensure a style (even empty one) is created for the page
require('styles/firstForm.less');

/**
 *
 */
export class FirstFormPage implements Kontext.QuerySetupHandler {

    private clStorage:ConcLinesStorage;

    private corplistComponent:React.ComponentClass;

    private layoutModel:PageModel;

    private queryModel:QueryModel;

    private cqlEditorModel:CQLEditorModel;

    private textTypesModel:TextTypesModel;

    private queryHintModel:QueryHintModel;

    private withinBuilderModel:WithinBuilderModel;

    private virtualKeyboardModel:VirtualKeyboardModel;

    private queryContextModel:QueryContextModel;

    private onQueryModelReady:(qs:QueryModel)=>void;

    private onAlignedCorporaChanged:(corpora:Immutable.List<string>)=>void;


    constructor(layoutModel:PageModel, clStorage:ConcLinesStorage) {
        this.layoutModel = layoutModel;
    }

    getConf<T>(name:string):T {
        return this.layoutModel.getConf<T>(name);
    }

    translate(msg:string, values?:{[k:string]:string}):string {
        return this.layoutModel.translate(msg, values);
    }

    registerCorpusSelectionListener(fn:(corpusId:string, aligned:Immutable.List<string>, subcorpusId:string)=>void):void {
        this.queryModel.registerCorpusSelectionListener(fn);
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

    getAvailableSubcorpora():Immutable.List<string> {
        return this.queryModel.getAvailableSubcorpora();
    }


    private initCorplistComponent():React.ComponentClass {
        return corplistComponent.createWidget(
            'first_form',
            this.layoutModel.pluginApi(),
            this.queryModel,
            this,
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

    createTTViews():RSVP.Promise<{[key:string]:any}> {
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

        return liveAttributes(
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

        ).then(
            (liveAttrsPlugin) => {
                let liveAttrsViews;
                if (liveAttrsPlugin && this.layoutModel.pluginIsActive(PluginName.LIVE_ATTRIBUTES)) {
                    // Complicated dependencies between QueryModel, TextTypesModel and LiveAttrsModel
                    // cause that LiveAttrs model needs QueryModel data but it is not available
                    // here yet. That's the reason we have to define a callback here to configure
                    // required values later.
                    this.onQueryModelReady = (qs => {
                        liveAttrsPlugin.selectLanguages(qs.getCorpora().rest().toList(), false);
                    });
                    this.onAlignedCorporaChanged = (corpora => {
                        if (liveAttrsPlugin.hasSelectionSteps()) {
                            liveAttrsPlugin.reset();
                            liveAttrsPlugin.notifyChangeListeners();
                            this.textTypesModel.notifyChangeListeners();
                        }
                        liveAttrsPlugin.selectLanguages(corpora, true);
                    });
                    this.textTypesModel.setTextInputChangeCallback(liveAttrsPlugin.getAutoCompleteTrigger());
                    this.textTypesModel.addSelectionChangeListener(target => {
                        liveAttrsPlugin.setControlsEnabled(target.hasSelectedItems() ||
                                liveAttrsPlugin.hasSelectedLanguages());
                    });
                    liveAttrsViews = liveAttrsPlugin.getViews(null, this.textTypesModel); // TODO 'this' reference = antipattern

                } else {
                    this.onQueryModelReady = () => undefined;
                    this.onAlignedCorporaChanged = (_) => undefined;
                    liveAttrsViews = {};
                }

                return {
                    liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                    liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                    attributes: this.textTypesModel.getAttributes()
                }
            }
        );
    }

    private initQueryModel():void {
        const formCorpora = [this.layoutModel.getConf<string>('corpname')];
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = <AjaxResponse.QueryFormArgs>concFormsArgs['__new__'];
        this.queryModel = new QueryModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.textTypesModel,
            this.queryContextModel,
            {
                corpora: [this.layoutModel.getConf<string>('corpname')].concat(
                    this.layoutModel.getConf<Array<string>>('alignedCorpora') || []),
                availableAlignedCorpora: this.layoutModel.getConf<Array<Kontext.AttrItem>>('availableAlignedCorpora'),
                currQueryTypes: queryFormArgs.curr_query_types,
                currQueries: queryFormArgs.curr_queries,
                currPcqPosNegValues: queryFormArgs.curr_pcq_pos_neg_values,
                currLposValues: queryFormArgs.curr_lpos_values,
                currQmcaseValues: queryFormArgs.curr_qmcase_values,
                currDefaultAttrValues: queryFormArgs.curr_default_attr_values,
                subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
                currentSubcorp: this.layoutModel.getConf<string>('CurrentSubcorp'),
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

        this.queryModel.registerCorpusSelectionListener((corpname, aligned, subcorp) =>
                this.onAlignedCorporaChanged(aligned));
        this.onQueryModelReady(this.queryModel);
        this.layoutModel.getModels().generalViewOptionsModel.addOnSubmitResponseHandler(model => {
            this.queryModel.onSettingsChange(model);
        });

        this.cqlEditorModel = new CQLEditorModel({
            dispatcher: this.layoutModel.dispatcher,
            pageModel: this.layoutModel,
            attrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList'),
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            tagAttr: this.layoutModel.pluginIsActive(PluginName.TAGHELPER) ? this.queryModel.getTagAttr() : null,
            actionPrefix: ''
        });
    }

    private attachQueryForm(properties:{[key:string]:any}, corparchWidget:React.ComponentClass):void {

        this.layoutModel.registerSwitchCorpAwareObject(this.queryModel);
        const queryFormComponents = queryFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            corparchWidget,
            this.queryModel,
            this.textTypesModel,
            this.queryHintModel,
            this.withinBuilderModel,
            this.virtualKeyboardModel,
            this.queryContextModel,
            this.cqlEditorModel
        );
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
        );
        this.layoutModel.renderReactComponent(
            queryOverviewViews.EmptyQueryOverviewBar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('usesubcorp')
            }
        );
    }

    init():void {
        const p1 = this.layoutModel.init().then(
            () => {
                this.queryHintModel = new QueryHintModel(
                    this.layoutModel.dispatcher,
                    ['query__tip_01', 'query__tip_02', 'query__tip_03', 'query__tip_04'],
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
            }
        ).then(
            () => {
                return tagHelperPlugin(this.layoutModel.pluginApi());
            }
        );

        const p2 = p1.then(
            () => {
                const pageSize = this.layoutModel.getConf<number>('QueryHistoryPageNumRecords');
                return queryStoragePlugin(this.layoutModel.pluginApi(), 0, pageSize, pageSize);
            }
        );

        const p3 = p2.then(
            () => {
                return this.createTTViews();
            }
        );

        RSVP.all([p1, p2, p3]).then(
            (args:any) => {
                const [taghelper, qsplug, props] = args;
                props['tagHelperView'] = this.layoutModel.isInstalledPlugin(taghelper) ? taghelper.getWidgetView() : null;
                props['queryStorageView'] = qsplug.getWidgetView();
                props['allowCorpusSelection'] = true;
                props['actionPrefix'] = '';
                this.initQueryModel();
                const corparchWidget = this.initCorplistComponent();
                this.attachQueryForm(props, corparchWidget);
                this.initCorpnameLink();
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
    const clStorage:ConcLinesStorage = openStorage((err) => {
        layoutModel.showMessage('error', err);
    });
    clStorage.clear();
    const pageModel = new FirstFormPage(layoutModel, clStorage);
    pageModel.init();
}