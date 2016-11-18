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
import * as subcMixer from 'plugins/subcmixer/init';
import {TextTypesStore} from '../stores/textTypes/attrValues';
import {QueryFormProperties, QueryStore, QueryHintStore, WithinBuilderStore, VirtualKeyboardStore} from '../stores/query';
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
}


export class FilterFormpage {

    private layoutModel:PageModel;

    private querySetupHandler:Kontext.QuerySetupHandler;

    private textTypesStore:TextTypesStore;

    private queryStore:QueryStore;

    private queryHintStore:QueryHintStore;

    private withinBuilderStore:WithinBuilderStore;

    private virtualKeyboardStore:VirtualKeyboardStore;

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
                let subcmixerViews;
                if (this.layoutModel.getConf<boolean>('HasSubcmixer')) {
                    const subcmixerStore = subcMixer.create(this.layoutModel.pluginApi(), this.textTypesStore);
                    subcmixerViews = subcMixer.getViews(
                        this.layoutModel.dispatcher,
                        this.layoutModel.exportMixins(),
                        this.layoutModel.layoutViews,
                        subcmixerStore
                    );

                } else {
                    subcmixerViews = {
                        SubcMixer: null,
                        TriggerBtn: null
                    };
                }
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
        this.queryStore = new QueryStore(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                currentArgs: this.layoutModel.getConf<Kontext.MultiDictSrc>('currentArgs'),
                corpora: [this.layoutModel.getConf<string>('corpname')].concat(
                        this.layoutModel.getConf<Array<string>>('alignedCorpora') || []),
                availableAlignedCorpora: this.layoutModel.getConf<Array<{n:string; label:string}>>('availableAlignedCorpora'),
                currQueryTypes: this.layoutModel.getConf<{[corpname:string]:string}>('CurrQueryTypes'),
                currQueries: this.layoutModel.getConf<{[corpname:string]:string}>('CurrQueries'),
                currPcqPosNegValues: this.layoutModel.getConf<{[corpname:string]:string}>('CurrPcqPosNegValues'),
                subcorpList: this.layoutModel.getConf<Array<string>>('SubcorpList'),
                currentSubcorp: this.layoutModel.getConf<string>('CurrentSubcorp'),
                tagBuilderSupport: this.layoutModel.getConf<{[corpname:string]:boolean}>('TagBuilderSupport'),
                shuffleConcByDefault: this.layoutModel.getConf<boolean>('ShuffleConcByDefault'),
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
                inputLanguages: this.layoutModel.getConf<{[corpname:string]:string}>('InputLanguages')
            }
        );
        const queryFormComponents = queryFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.exportMixins(),
            this.layoutModel.layoutViews,
            this.queryStore,
            this.textTypesStore,
            this.queryHintStore,
            this.withinBuilderStore,
            this.virtualKeyboardStore
        );
        this.layoutModel.renderReactComponent(
            queryFormComponents.QueryForm,
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
                this.attachQueryForm(props);
            }
        );
    }
}

export function init(conf:Kontext.Conf):void {
    const layoutModel = new PageModel(conf);
    const pageModel = new FilterFormpage(layoutModel);
    pageModel.init();
}

