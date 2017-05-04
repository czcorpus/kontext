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
/// <reference path="../types/plugins/abstract.d.ts" />
/// <reference path="../types/ajaxResponses.d.ts" />
/// <reference path="../types/plugins/corparch.d.ts" />
/// <reference path="../../ts/declarations/immutable.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />


import * as corplistComponent from 'plugins/corparch/init';
import {PageModel} from './document';
import * as liveAttributes from 'plugins/liveAttributes/init';
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
import {init as structsAttrsViewInit, StructsAndAttrsViews} from 'views/options/structsAttrs';

/**
 *
 */
export class FirstFormPage implements Kontext.QuerySetupHandler {

    private clStorage:ConcLinesStorage;

    private corplistComponent:CorparchCommon.Widget;

    private layoutModel:PageModel;

    private queryStore:QueryStore;

    private textTypesStore:TextTypesStore;

    private queryHintStore:QueryHintStore;

    private withinBuilderStore:WithinBuilderStore;

    private virtualKeyboardStore:VirtualKeyboardStore;

    private queryContextStore:QueryContextStore;

    private viewOptionsViews:StructsAndAttrsViews;

    constructor(layoutModel:PageModel, clStorage:ConcLinesStorage) {
        this.layoutModel = layoutModel;
    }

    getConf<T>(name:string):T {
        return this.layoutModel.getConf<T>(name);
    }

    translate(msg:string, values?:{[k:string]:string}):string {
        return this.layoutModel.translate(msg, values);
    }

    /**
     * Registers a callback which is invoked after an aligned
     * corpus is added to the query page (i.e. firstForm's
     * internal actions are performed first then the list of
     * registered callbacks).
     *
     * @param fn:(corpname:string)=>void
     */
    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {
        this.queryStore.registerOnAddParallelCorpAction(fn);
    }

    /**
     * Registers a callback which is invoked AFTER an aligned
     * corpus is removed from the query page (i.e. firstForm's
     * internal actions are performed first then the list of
     * registered callbacks).
     *
     * @param fn:(corpname:string)=>void
     */
    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {
        this.queryStore.registerOnRemoveParallelCorpAction(fn);
    }

    /**
     * Registers a callback which is invoked BEFORE an aligned
     * corpus is removed from the query page (i.e. firstForm's
     * internal actions are performed this actions).
     *
     * @param fn
     */
    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {
        this.queryStore.registerOnBeforeRemoveParallelCorpAction(fn);
    }

    /**
     * Registers a callback which is invoked after the subcorpus
     * selection element is changed. It guarantees that all the
     * firstForm's internal actions are performed before this
     * externally registered ones.
     *
     * @param fn:(subcname:string)=>void
     */
    registerOnSubcorpChangeAction(fn:(corpname:string)=>void):void {
        this.queryStore.registerOnSubcorpChangeAction(fn);
    }

    getCorpora():Immutable.List<string> {
        return this.queryStore.getCorpora();
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return this.queryStore.getAvailableAlignedCorpora();
    }

    private initCorplistComponent():void {
        this.corplistComponent = corplistComponent.create(
            window.document.getElementById('corparch-mount'),
            'first_form',
            this.layoutModel.pluginApi(),
            this,
            {
                itemClickAction: (item) => {
                    const corpora = [item.corpus_id];
                    (item.corpora || []).forEach(corp => {
                        corpora.push(corp.corpus_id);
                    });
                    const subcorpId = item.type === 'subcorpus' ? item.subcorpus_id : undefined;
                    this.corplistComponent.setButtonLoader();
                    this.layoutModel.switchCorpus(corpora, subcorpId).then(
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
                            this.corplistComponent.disableButtonLoader();
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

        let liveAttrsProm;
        let ttTextInputCallback;
        if (this.layoutModel.hasPlugin('live_attributes')) {
            liveAttrsProm = liveAttributes.create(this.layoutModel.pluginApi(), this.textTypesStore, textTypesData['bib_attr']);

        } else {
            liveAttrsProm = new RSVP.Promise((fulfill:(v)=>void, reject:(err)=>void) => {
                fulfill(null);
            });
        }
        return liveAttrsProm.then(
            (liveAttrsStore:LiveAttributesInit.AttrValueTextInputListener) => {
                if (liveAttrsStore) {
                    this.textTypesStore.setTextInputChangeCallback(liveAttrsStore.getListenerCallback());
                }
                const subcmixerViews = {
                    Widget: null
                };
                let liveAttrsViews = liveAttributes.getViews(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    subcmixerViews,
                    this.textTypesStore,
                    liveAttrsStore
                );
                return {
                    liveAttrsView: 'LiveAttrsView' in liveAttrsViews ? liveAttrsViews['LiveAttrsView'] : null,
                    liveAttrsCustomTT: 'LiveAttrsCustomTT' in liveAttrsViews ? liveAttrsViews['LiveAttrsCustomTT'] : null,
                    attributes: this.textTypesStore.getAttributes()
                }
            }
        );
    }

    private attachQueryForm(properties:{[key:string]:any}):void {
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
        this.layoutModel.registerSwitchCorpAwareObject(this.queryStore);
        const queryFormComponents = queryFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
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

    private initViewOptions():void {
        this.viewOptionsViews = structsAttrsViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.layoutModel.getStores().viewOptionsStore,
            this.layoutModel.getStores().mainMenuStore
        );

        this.layoutModel.renderReactComponent(
            this.viewOptionsViews.StructAttrsViewOptions,
            window.document.getElementById('view-options-mount'),
            {
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                isSubmitMode: true,
                stateArgs: this.layoutModel.getConcArgs().items()
            }
        );

        this.layoutModel.getStores().mainMenuStore.addItemActionPrerequisite(
            'MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS',
            (args:Kontext.GeneralProps) => {
                return this.layoutModel.getStores().viewOptionsStore.loadData();
            }
        );
    }

    init():void {
        this.layoutModel.init().then(
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
                tagHelperPlugin.create(this.layoutModel.pluginApi());
            }
        ).then(
            () => {
                queryStoragePlugin.create(this.layoutModel.pluginApi());
            }
        ).then(
            () => {
                return this.createTTViews();
            }
        ).then(
            (props) => {
                props['tagHelperViews'] = tagHelperPlugin.getViews();
                props['queryStorageViews'] = queryStoragePlugin.getViews();
                props['allowCorpusSelection'] = true;
                props['actionPrefix'] = '';
                this.attachQueryForm(props);
                this.initCorplistComponent(); // non-React world here
                this.initCorpnameLink();
                this.initViewOptions();
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