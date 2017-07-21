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
/// <reference path="../types/views.d.ts" />
/// <reference path="../types/plugins.d.ts" />
/// <reference path="../types/ajaxResponses.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />


import * as corplistComponent from 'plugins/corparch/init';
import {PageModel} from './document';
import liveAttributes from 'plugins/liveAttributes/init';
import {ConcLinesStorage, openStorage} from '../conclines';
import * as Immutable from 'vendor/immutable';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {QueryFormProperties, QueryStore, QueryHintStore} from '../stores/query/main';
import {WithinBuilderStore} from '../stores/query/withinBuilder';
import {VirtualKeyboardStore} from '../stores/query/virtualKeyboard';
import {QueryContextStore} from '../stores/query/context';
import tagHelperPlugin from 'plugins/taghelper/init';
import queryStoragePlugin from 'plugins/queryStorage/init';
import * as RSVP from 'vendor/rsvp';
import {init as queryFormInit} from 'views/query/main';
import {init as corpnameLinkInit} from 'views/overview';

/**
 *
 */
export class FirstFormPage implements Kontext.QuerySetupHandler {

    private clStorage:ConcLinesStorage;

    private corplistComponent:React.Component;

    private layoutModel:PageModel;

    private queryStore:QueryStore;

    private textTypesStore:TextTypesStore;

    private queryHintStore:QueryHintStore;

    private withinBuilderStore:WithinBuilderStore;

    private virtualKeyboardStore:VirtualKeyboardStore;

    private queryContextStore:QueryContextStore;

    private onQueryStoreReady:(qs:QueryStore)=>void;

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
        this.queryStore.registerCorpusSelectionListener(fn);
    }

    getCorpora():Immutable.List<string> {
        return this.queryStore.getCorpora();
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return this.queryStore.getAvailableAlignedCorpora();
    }

    getCurrentSubcorpus():string {
        return this.queryStore.getCurrentSubcorpus();
    }

    getAvailableSubcorpora():Immutable.List<string> {
        return this.queryStore.getAvailableSubcorpora();
    }


    private initCorplistComponent():React.Component {
        return corplistComponent.createWidget(
            'first_form',
            this.layoutModel.pluginApi(),
            this.queryStore,
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
        let textTypesData = this.layoutModel.getConf<any>('textTypesData');
        this.textTypesStore = new TextTypesStore(
                this.layoutModel.dispatcher,
                this.layoutModel.pluginApi(),
                textTypesData,
                this.layoutModel.getConf<TextTypes.ServerCheckedValues>('CheckedSca')
        );

        return liveAttributes(
            this.layoutModel.pluginApi(),
            this.textTypesStore,
            () => this.queryStore.getCorpora(),
            () => this.textTypesStore.hasSelectedItems(),
            textTypesData['bib_attr']
        ).then(
            (liveAttrsPlugin) => {
                let liveAttrsViews;
                if (liveAttrsPlugin && this.layoutModel.pluginIsActive('live_attributes')) {
                    // Complicated dependencies between QueryStore, TextTypesStore and LiveAttrsStore
                    // cause that LiveAttrs store needs QueryStore data but it is not available
                    // here yet. That's the reason we have to define a callback here to configure
                    // required values later.
                    this.onQueryStoreReady = (qs => {
                        liveAttrsPlugin.selectLanguages(qs.getCorpora().rest().toList(), false);
                    });
                    this.onAlignedCorporaChanged = (corpora => {
                        if (liveAttrsPlugin.hasSelectionSteps()) {
                            liveAttrsPlugin.reset();
                            liveAttrsPlugin.notifyChangeListeners();
                            this.textTypesStore.notifyChangeListeners();
                        }
                        liveAttrsPlugin.selectLanguages(corpora, true);
                    });
                    this.textTypesStore.setTextInputChangeCallback(liveAttrsPlugin.getListenerCallback());
                    this.textTypesStore.addSelectionChangeListener(target => {
                        liveAttrsPlugin.setControlsEnabled(target.hasSelectedItems() ||
                                liveAttrsPlugin.hasSelectedLanguages());
                    });
                    liveAttrsViews = liveAttrsPlugin.getViews(null, this.textTypesStore); // TODO 'this' reference = antipattern

                } else {
                    this.onQueryStoreReady = () => undefined;
                    this.onAlignedCorporaChanged = (_) => undefined;
                    liveAttrsViews = {};
                }

                return {
                    liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                    liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                    attributes: this.textTypesStore.getAttributes()
                }
            }
        );
    }

    private initQueryStore():void {
        const formCorpora = [this.layoutModel.getConf<string>('corpname')];
        const concFormsArgs = this.layoutModel.getConf<{[ident:string]:AjaxResponse.ConcFormArgs}>('ConcFormsArgs');
        const queryFormArgs = <AjaxResponse.QueryFormArgs>concFormsArgs['__new__'];
        this.queryStore = new QueryStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.textTypesStore,
            this.queryContextStore,
            {
                corpora: [this.layoutModel.getConf<string>('corpname')].concat(
                    this.layoutModel.getConf<Array<string>>('alignedCorpora') || []),
                availableAlignedCorpora: this.layoutModel.getConf<Array<{n:string; label:string}>>('availableAlignedCorpora'),
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
                lposlist: this.layoutModel.getConf<Array<{v:string; n:string}>>('Lposlist'),
                forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
                attrList: this.layoutModel.getConf<Array<{n:string; label:string}>>('AttrList'),
                tagsetDocUrl: this.layoutModel.getConf<string>('TagsetDocUrl'),
                lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                hasLemmaAttr: this.layoutModel.getConf<boolean>('hasLemmaAttr'),
                wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
                inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages'),
                textTypesNotes: this.layoutModel.getConf<string>('TextTypesNotes')
            }
        );
        this.queryStore.registerCorpusSelectionListener((corpname, aligned, subcorp) =>
                this.onAlignedCorporaChanged(aligned));
        this.onQueryStoreReady(this.queryStore);
    }

    private attachQueryForm(properties:{[key:string]:any}, corparchWidget:React.Component):void {

        this.layoutModel.registerSwitchCorpAwareObject(this.queryStore);
        const queryFormComponents = queryFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            corparchWidget,
            this.queryStore,
            this.textTypesStore,
            this.queryHintStore,
            this.withinBuilderStore,
            this.virtualKeyboardStore,
            this.queryContextStore
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
            this.layoutModel.exportMixins(),
            this.layoutModel.getStores().corpusInfoStore,
            this.layoutModel.layoutViews.PopupBox
        );
        this.layoutModel.renderReactComponent(
            this.layoutModel.layoutViews.EmptyQueryOverviewBar,
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
                this.queryHintStore = new QueryHintStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel.getConf<Array<string>>('queryHints')
                );
                this.withinBuilderStore = new WithinBuilderStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel
                );
                this.virtualKeyboardStore = new VirtualKeyboardStore(
                    this.layoutModel.dispatcher,
                    this.layoutModel
                );
                this.queryContextStore = new QueryContextStore(this.layoutModel.dispatcher);
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
                props['tagHelperView'] = taghelper.getWidgetView();
                props['queryStorageView'] = qsplug.getWidgetView();
                props['allowCorpusSelection'] = true;
                props['manualAlignCorporaMode'] = false;
                props['actionPrefix'] = '';
                this.initQueryStore();
                const corparchWidget = this.initCorplistComponent();
                this.attachQueryForm(props, corparchWidget);
                this.initCorpnameLink();
            }
        ).then(
            () => undefined,
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