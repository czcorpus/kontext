/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

import {Kontext, TextTypes} from '../types/common';
import {PluginInterfaces} from '../types/plugins';
import {PageModel, DownloadType} from '../app/main';
import {MultiDict, dictToPairs} from '../util';
import {CollFormModel, CollFormProps, CollFormInputs} from '../models/coll/collForm';
import {MLFreqFormModel, TTFreqFormModel, FreqFormInputs, FreqFormProps} from '../models/freqs/freqForms';
import {CTFormProperties, CTFormInputs, Freq2DFormModel} from '../models/freqs/ctFreqForm';
import {QueryReplayModel, IndirectQueryReplayModel} from '../models/query/replay';
import {QuerySaveAsFormModel} from '../models/query/save';
import {CollResultModel, CollResultData, CollResultHeading} from '../models/coll/result';
import {init as analysisFrameInit, FormsViews as AnalysisFrameViews} from '../views/analysis';
import {init as collFormInit} from '../views/coll/forms';
import {init as collResultViewInit} from '../views/coll/result';
import {init as freqFormInit, FormsViews as FreqFormViews} from '../views/freqs/forms';
import {init as queryOverviewInit, OverviewViews as QueryOverviewViews} from '../views/query/overview';
import {TextTypesModel} from '../models/textTypes/attrValues';
import {NonQueryCorpusSelectionModel} from '../models/corpsel';


declare var require:any;
// weback - ensure an individual style (even empty one) is created for the page
require('styles/coll.less');

/**
 *
 */
export class CollPage {

    private layoutModel:PageModel;

    private collFormModel:CollFormModel;

    private mlFreqModel:MLFreqFormModel;

    private ttFreqModel:TTFreqFormModel;

    private ctFreqFormModel:Freq2DFormModel;

    private queryReplayModel:IndirectQueryReplayModel;

    private collResultModel:CollResultModel;

    private querySaveAsFormModel:QuerySaveAsFormModel;

    private subcorpSel:PluginInterfaces.Corparch.ICorpSelection;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    initAnalysisViews():void {
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');
        const currArgs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        const structAttrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList');
        const freqFormInputs = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');

        const freqFormProps:FreqFormProps = {
            structAttrList: structAttrs,
            fttattr: freqFormInputs.fttattr,
            ftt_include_empty: freqFormInputs.ftt_include_empty,
            flimit: freqFormInputs.flimit,
            freq_sort: freqFormInputs.freq_sort,
            attrList: attrs,
            mlxattr: [attrs[0].n],
            mlxicase: [false],
            mlxctx: ['0>0'],  // = "Node'"
            alignType: ['left']
        }

        this.mlFreqModel = new MLFreqFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            freqFormProps,
            this.layoutModel.getConf<number>('multilevelFreqDistMaxLevels')
        );

        this.ttFreqModel = new TTFreqFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            freqFormProps
        );

        const ctFormInputs = this.layoutModel.getConf<CTFormInputs>('CTFreqFormProps');
        const ctFormProps:CTFormProperties = {
            attrList: attrs,
            structAttrList: this.layoutModel.getConf<Array<Kontext.AttrItem>>('StructAttrList'),
            ctattr1: ctFormInputs.ctattr1,
            ctattr2: ctFormInputs.ctattr2,
            ctfcrit1: ctFormInputs.ctfcrit1,
            ctfcrit2: ctFormInputs.ctfcrit2,
            multiSattrAllowedStructs: this.layoutModel.getConf<Array<string>>('multiSattrAllowedStructs'),
            ctminfreq: ctFormInputs.ctminfreq,
            ctminfreq_type: ctFormInputs.ctminfreq_type
        };


        this.ctFreqFormModel = new Freq2DFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps,
            this.initAdhocSubcDetector()
        );

        const freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqModel,
            this.ttFreqModel,
            this.ctFreqFormModel
        );

        // collocations ------------------------------------

        this.collFormModel = new CollFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                attrList: attrs,
                cattr: currArgs.cattr || attrs[0].n,
                cfromw: currArgs.cfromw,
                ctow: currArgs.ctow,
                cminfreq: currArgs.cminfreq,
                cminbgr: currArgs.cminbgr,
                cbgrfns: currArgs.cbgrfns,
                csortfn: currArgs.csortfn
            }
        );
        const collFormViews = collFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.collFormModel
        );
        // TODO: init freq form
        const analysisViews = analysisFrameInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            collViews: collFormViews,
            freqViews: freqFormViews,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel
        });
        this.layoutModel.renderReactComponent(
            analysisViews.AnalysisFrame,
            window.document.getElementById('analysis-forms-mount'),
            {
                initialFreqFormVariant: 'ml'
            }
        );

        // ---- coll result

        this.collResultModel = new CollResultModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.collFormModel,
            this.layoutModel.getConf<CollResultData>('CollResultData'),
            this.layoutModel.getConf<CollResultHeading>('CollResultHeading'),
            this.layoutModel.getConf<number>('CollPageSize'),
            this.setDownloadLink.bind(this),
            this.layoutModel.getConf<number>('CollSaveLinesLimit'),
            !!this.layoutModel.getConf<number>('CollUnfinished')
        );

        const collResultViews = collResultViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.collResultModel
        );

        this.layoutModel.renderReactComponent(
            collResultViews.CollResultView,
            document.getElementById('coll-view-mount'),
            {}
        );
    }

    private initQueryOpNavigation():void {
        this.queryReplayModel = new IndirectQueryReplayModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || []
        );
        this.querySaveAsFormModel = new QuerySaveAsFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            this.layoutModel.getConf<string>('concPersistenceOpId')
        );
        const queryOverviewViews = queryOverviewInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            viewDeps: {
                QueryFormView: null,
                FilterFormView: null,
                SubHitsForm: null,
                FirstHitsForm: null,
                SortFormView: null,
                SampleForm: null,
                ShuffleForm: null,
                SwitchMainCorpForm: null
            },
            queryReplayModel: this.queryReplayModel,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel,
            querySaveAsModel: this.querySaveAsFormModel,
            corparchModel: this.subcorpSel
        });
        this.layoutModel.renderReactComponent(
            queryOverviewViews.NonViewPageQueryToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                queryFormProps: {
                    formType: Kontext.ConcFormTypes.QUERY,
                    actionPrefix: '',
                    allowCorpusSelection: false,
                    tagHelperView: null,
                    queryStorageView: null,
                    liveAttrsView: null,
                    liveAttrsCustomTT: null,
                    attributes: [],
                    onEnterKey:()=>undefined
                },
                filterFormProps: {
                    formType: Kontext.ConcFormTypes.FILTER,
                    actionPrefix: '',
                    filterId: null,
                    tagHelperView: null,
                    queryStorageView: null
                },
                sortFormProps: {
                    formType: Kontext.ConcFormTypes.SORT,
                    sortId: null,
                },
                shuffleFormProps: {
                    formType: Kontext.ConcFormTypes.SHUFFLE,
                    shuffleMinResultWarning: null,
                    lastOpSize: null,
                    operationIdx: null,
                    shuffleSubmitFn:()=>undefined
                }
            }
        );
    }

    setDownloadLink(filename:string, url:string) {
        this.layoutModel.bgDownload(filename, DownloadType.COLL, url);
    }

    initAdhocSubcDetector():TextTypes.IAdHocSubcorpusDetector {
        return  new TextTypesModel(
            this.layoutModel.dispatcher,
            this.layoutModel.pluginApi(),
            this.layoutModel.getConf<any>('textTypesData')
        );
    }

    init():void {
        this.layoutModel.init().then(
            () => {
                this.subcorpSel = new NonQueryCorpusSelectionModel({
                    layoutModel: this.layoutModel,
                    dispatcher: this.layoutModel.dispatcher,
                    usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                    origSubcorpName: this.layoutModel.getCorpusIdent().origSubcorpName,
                    corpora: [this.layoutModel.getCorpusIdent().id],
                    availSubcorpora: []
                });
                const mainMenuModel = this.layoutModel.getModels().mainMenuModel;
                // we must capture concordance-related actions which lead
                // to specific "pop-up" forms and redirect user back to
                // the 'view' action with additional information (encoded in
                // the fragment part of the URL) which form should be opened
                // once the 'view' page is loaded
                mainMenuModel.addChangeListener(() => {
                    const activeItem = mainMenuModel.getActiveItem() || {actionName: null, actionArgs: []};
                    switch (activeItem.actionName) {
                        case 'MAIN_MENU_SHOW_FILTER':
                            const filterArgs = new MultiDict(dictToPairs(activeItem.actionArgs));
                            window.location.replace(
                                this.layoutModel.createActionUrl(
                                    'view',
                                    this.layoutModel.getConcArgs().items()
                                ) + '#filter/' + this.layoutModel.encodeURLParameters(filterArgs)
                            );
                        break;
                        case 'MAIN_MENU_SHOW_SORT':
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs().items()
                            ) + '#sort');
                        break;
                        case 'MAIN_MENU_SHOW_SAMPLE':
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs().items()
                            ) + '#sample');
                        break;
                        case 'MAIN_MENU_APPLY_SHUFFLE':
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs().items()
                            ) + '#shuffle');
                        break;
                    }
                });
                this.initAnalysisViews();
                this.initQueryOpNavigation();
            }

        ).then(
            this.layoutModel.addUiTestingFlag

        ).catch((err) => {
            console.error(err);
        });
    }
}


export function init(conf:Kontext.Conf, runningInBg:boolean):void {
    new CollPage(new PageModel(conf)).init();
}
