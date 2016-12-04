/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
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
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import {PageModel} from './document';
import queryStoragePlugin from 'plugins/queryStorage/init';
import * as liveAttributes from 'plugins/liveAttributes/init';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {QueryFormProperties, QueryHintStore} from '../stores/query/main';
import {FilterStore} from '../stores/query/filter';
import {WithinBuilderStore} from '../stores/query/withinBuilder';
import {VirtualKeyboardStore} from '../stores/query/virtualKeyboard';
import {QueryContextStore} from '../stores/query/context';
import * as RSVP from 'vendor/rsvp';
import {init as ttViewsInit} from 'views/textTypes';
import {init as contextViewsInit} from 'views/query/context';
import {init as queryFormInit} from 'views/query/main';
import tagHelperPlugin from 'plugins/taghelper/init';

/**
 * Corpus handling actions are not used here on the "filter" page but
 * the ExtendedApi class needs them anyway.
 */
class CorpusSetupHandler implements Kontext.QuerySetupHandler {

    registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void {}

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>();
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return Immutable.List<{n:string; label:string}>();
    }
}


export class FilterFormpage {

    private layoutModel:PageModel;

    private querySetupHandler:Kontext.QuerySetupHandler;

    private textTypesStore:TextTypesStore;

    private filterStore:FilterStore;

    private queryHintStore:QueryHintStore;

    private withinBuilderStore:WithinBuilderStore;

    private virtualKeyboardStore:VirtualKeyboardStore;

    private queryContextStore:QueryContextStore;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
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
                    SubcMixer: null,
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
        this.filterStore = new FilterStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.textTypesStore,
            this.queryContextStore,
            {
                filters: [0], // TODO this will be dynamic and based on the current query pipeline
                currPnFilterValues: {0: this.layoutModel.getConf<string>('Pnfilter')}, // TODO dtto
                currentArgs: this.layoutModel.getConf<Kontext.MultiDictSrc>('currentArgs'),
                corpname: this.layoutModel.getConf<string>('corpname'),
                currQueryTypes: this.layoutModel.getConf<{[corpname:string]:string}>('CurrQueryTypes'),
                currQueries: this.layoutModel.getConf<{[corpname:string]:string}>('CurrQueries'),
                currPcqPosNegValues: this.layoutModel.getConf<{[corpname:string]:string}>('CurrPcqPosNegValues'),
                tagBuilderSupport: this.layoutModel.getConf<{[corpname:string]:boolean}>('TagBuilderSupport'),
                lposlist: this.layoutModel.getConf<Array<{v:string; n:string}>>('Lposlist'),
                currLposValues: this.layoutModel.getConf<{[corpname:string]:string}>('CurrLposValues'),
                currQmcaseValues: this.layoutModel.getConf<{[corpname:string]:boolean}>('CurrQmcaseValues'),
                currDefaultAttrValues: this.layoutModel.getConf<{[corpname:string]:string}>('CurrDefaultAttrValues'),
                forcedAttr: this.layoutModel.getConf<string>('ForcedAttr'),
                attrList: this.layoutModel.getConf<Array<{n:string; label:string}>>('AttrList'),
                tagsetDocUrl: this.layoutModel.getConf<string>('TagsetDocUrl'),
                lemmaWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                posWindowSizes: [1, 2, 3, 4, 5, 7, 10, 15],
                hasLemmaAttr: this.layoutModel.getConf<boolean>('hasLemmaAttr'),
                wPoSList: this.layoutModel.getConf<Array<{v:string; n:string}>>('Wposlist'),
                inputLanguage: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages')[this.layoutModel.getConf<string>('corpname')]
            }
        );
        const queryFormComponents = queryFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.filterStore,
            this.textTypesStore,
            this.queryHintStore,
            this.withinBuilderStore,
            this.virtualKeyboardStore,
            this.queryContextStore
        );
        this.layoutModel.renderReactComponent(
            queryFormComponents.FilterForm,
            window.document.getElementById('query-form-mount'),
            properties
        );
    }

    init():void {
        this.layoutModel.init().then(
            () => {
                this.queryHintStore = new QueryHintStore(
                    this.layoutModel.dispatcher, this.layoutModel.getConf<Array<string>>('queryHints'));
                this.withinBuilderStore = new WithinBuilderStore(
                    this.layoutModel.dispatcher, this.layoutModel);
                this.virtualKeyboardStore = new VirtualKeyboardStore(
                    this.layoutModel.dispatcher, this.layoutModel);
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
                props['allowCorpusSelection'] = false;
                props['actionPrefix'] = 'FILTER_';
                props['filterId'] = 0; // TODO this should be based on the position within the query pipeline
                this.attachQueryForm(props);
            }
        ).then(
            () => undefined,
            (err) => console.error(err)
        );
    }
}

export function init(conf:Kontext.Conf):void {
    const layoutModel = new PageModel(conf);
    const pageModel = new FilterFormpage(layoutModel);
    pageModel.init();
}

