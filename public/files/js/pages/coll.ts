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

import * as Kontext from '../types/kontext';
import * as TextTypes from '../types/textTypes';
import { PageModel, DownloadType } from '../app/page';
import { KontextPage } from '../app/main';
import { CollFormModel, CollFormInputs, CollFormProps } from '../models/coll/collForm';
import {
    MLFreqFormModel, TTFreqFormModel, FreqFormInputs, FreqFormProps
} from '../models/freqs/regular/freqForms';
import { Freq2DFormModel } from '../models/freqs/twoDimension/form';
import { QuerySaveAsFormModel } from '../models/query/save';
import { CollResultModel } from '../models/coll/result';
import { init as analysisFrameInit } from '../views/analysis';
import { init as collFormInit } from '../views/coll/forms';
import { init as collResultViewInit, CollResultViewProps } from '../views/coll/result';
import { init as freqFormInit } from '../views/freqs/forms';
import { init as queryOverviewInit } from '../views/query/overview';
import { TextTypesModel } from '../models/textTypes/main';
import { IndirectQueryReplayModel } from '../models/query/replay/indirect';
import { List, tuple } from 'cnc-tskit';
import { CollResultsSaveModel } from '../models/coll/save';
import { CollResultData, CollResultHeading } from '../models/coll/common';
import { CTFormInputs, CTFormProperties, AlignTypes } from '../models/freqs/twoDimension/common';
import { Actions } from '../models/coll/actions';
import { DispersionResultModel } from '../models/dispersion/result';
import { importInitialTTData, TTInitialData } from '../models/textTypes/common';
import { ConcFormArgs } from '../models/query/formArgs';
import { fetchQueryFormArgs } from '../models/query/first';
import { transferActionToViewPage } from '../app/navigation/interpage';


/**
 *
 */
export class CollPage {

    private layoutModel:PageModel;

    private collFormModel:CollFormModel;

    private mlFreqModel:MLFreqFormModel;

    private ttFreqModel:TTFreqFormModel;

    private dispersionModel:DispersionResultModel;

    private ctFreqFormModel:Freq2DFormModel;

    private queryReplayModel:IndirectQueryReplayModel;

    private collResultModel:CollResultModel;

    private collResultSaveModel:CollResultsSaveModel;

    private querySaveAsFormModel:QuerySaveAsFormModel;

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    initAnalysisViews():void {
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');
        const currArgs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        const structAttrs = Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs'));
        const freqFormInputs = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');
        const initFreqLevel = this.layoutModel.getConf<number>('InitialFreqLevel');

        const freqFormProps:FreqFormProps = {
            structAttrList: structAttrs,
            fttattr: freqFormInputs.fttattr,
            flimit: freqFormInputs.flimit,
            freq_sort: freqFormInputs.freq_sort,
            attrList: attrs,
            mlxattr: List.repeat(() => attrs[0].n, initFreqLevel),
            mlxicase: List.repeat(() => false, initFreqLevel),
            mlxctx: List.repeat(() => '0>0', initFreqLevel),  // = "Node'"
            alignType: List.repeat(() => AlignTypes.LEFT, initFreqLevel)
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

        this.dispersionModel = new DispersionResultModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                isBusy: false,
                concordanceId: this.layoutModel.getConf<string>('concPersistenceOpId'),
                resolution: Kontext.newFormValue('100', true),
                maxResolution: this.layoutModel.getConf<number>('maxDispersionResolution'),
                data: [],
                downloadFormat: 'png'
            }
        );

        const ctFormInputs = this.layoutModel.getConf<CTFormInputs>('CTFreqFormProps');
        const ttData = this.layoutModel.getConf<TTInitialData>('textTypesData');
        const [tt, ttSelections] = this.initTextTypesModel(ttData);
        const ctFormProps:CTFormProperties = {
            attrList: attrs,
            structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
            ctattr1: ctFormInputs.ctattr1,
            ctattr2: ctFormInputs.ctattr2,
            ctfcrit1: ctFormInputs.ctfcrit1,
            ctfcrit2: ctFormInputs.ctfcrit2,
            ctminfreq: ctFormInputs.ctminfreq,
            ctminfreq_type: ctFormInputs.ctminfreq_type,
            usesAdHocSubcorpus:  TextTypesModel.findHasSelectedItems(ttSelections),
            selectedTextTypes: TextTypesModel.exportSelections(
                ttSelections,
                ttData.bib_id_attr,
                ttData.bib_label_attr,
                false,
                true,
            )
        };


        this.ctFreqFormModel = new Freq2DFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );

        const freqFormViews = freqFormInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqModel,
            this.ttFreqModel,
            this.ctFreqFormModel,
            this.dispersionModel
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
                initialFreqFormVariant: 'tokens' as Kontext.FreqModuleType
            }
        );

        // ---- coll result

        this.collResultModel = new CollResultModel({
            dispatcher: this.layoutModel.dispatcher,
            layoutModel: this.layoutModel,
            formModel: this.collFormModel,
            initialData: this.layoutModel.getConf<CollResultData>('CollResultData'),
            resultHeading: this.layoutModel.getConf<CollResultHeading>('CollResultHeading'),
            pageSize: this.layoutModel.getConf<number>('CollPageSize'),
            saveLinesLimit: this.layoutModel.getConf<number>('CollSaveLinesLimit'),
            unfinished: !!this.layoutModel.getConf<number>('CollUnfinished'),
            sortFn: this.layoutModel.getConf<CollFormProps>('CollFormProps').csortfn,
            cattr: this.layoutModel.getConf<CollFormProps>('CollFormProps').cattr,
            currPage: this.layoutModel.getConf<number>('CurrentPage'),
        });

        this.collResultSaveModel = new CollResultsSaveModel({
            dispatcher: this.layoutModel.dispatcher,
            layoutModel: this.layoutModel,
            saveLinkFn: this.setDownloadLink.bind(this),
            quickSaveRowLimit: this.layoutModel.getConf<number>('QuickSaveRowLimit')
        });

        const collResultViews = collResultViewInit(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.collResultModel,
            this.collResultSaveModel
        );

        this.layoutModel.renderReactComponent<CollResultViewProps>(
            collResultViews.CollResultView,
            document.getElementById('coll-view-mount'),
            {
                onClose: () => undefined
            }
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
            this.layoutModel.getConf<string>('concPersistenceOpId'),
            this.layoutModel.getConf<number>('concUrlTTLDays')
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
            querySaveAsModel: this.querySaveAsFormModel
        });
        this.layoutModel.renderReactComponent(
            queryOverviewViews.NonViewPageQueryToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getCorpusIdent().id,
                humanCorpname: this.layoutModel.getCorpusIdent().name,
                usesubcorp: this.layoutModel.getCorpusIdent().usesubcorp,
                subcName: this.layoutModel.getCorpusIdent().subcName,
                foreignSubcorp: this.layoutModel.getCorpusIdent().foreignSubcorp,
                queryFormProps: {
                    formType: Kontext.ConcFormTypes.QUERY,
                    allowCorpusSelection: false,
                    tagHelperViews: {},
                    LiveAttrsView: null,
                    LiveAttrsCustomTT: null
                },
                filterFormProps: {
                    formType: Kontext.ConcFormTypes.FILTER,
                    filterId: null,
                    corpname: this.layoutModel.getCorpusIdent().id,
                    tagHelperView: null
                },
                sortFormProps: {
                    formType: Kontext.ConcFormTypes.SORT,
                    sortId: null
                },
                cutoff: this.layoutModel.getConcArgs().cutoff
            }
        );
    }

    setDownloadLink(name:string, format:string, url:string, args?:any) {
        this.layoutModel.bgDownload({
            name,
            format,
            datasetType: DownloadType.COLL,
            contentType: 'multipart/form-data',
            url,
            args,
        }).subscribe();
    }

    initTextTypesModel(ttData:TTInitialData):[TextTypesModel, Array<TextTypes.AnyTTSelection>] {
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);
        const attributes = importInitialTTData(ttData, {});
        const ttModel = new TextTypesModel({
            dispatcher: this.layoutModel.dispatcher,
            pluginApi: this.layoutModel.pluginApi(),
            attributes,
            readonlyMode: true,
            bibIdAttr: ttData.bib_id_attr,
            bibLabelAttr: ttData.bib_label_attr
        });
        ttModel.applyCheckedItems(queryFormArgs.selected_text_types, {});
        return tuple(ttModel, attributes);
    }

    private setupBackButtonListening():void {
        this.layoutModel.getHistory().setOnPopState((event) => {
            if (event.state['onPopStateAction']) {
                this.layoutModel.dispatcher.dispatch(event.state['onPopStateAction']);
            }
        });
        const state = this.collResultModel.getState(); // no antipattern here
        const formState = this.collFormModel.getState();
        const args = {
            ...this.collResultModel.getSubmitArgs(
                state, this.collFormModel.getSubmitArgs(formState)
            ),
            format: undefined
        };
        this.layoutModel.getHistory().replaceState(
            'collx',
            args,
            {
                onPopStateAction: {
                    name: Actions.PopHistory.name,
                    payload: {
                        currPage: state.currPage,
                        currPageInput: state.currPageInput,
                        sortFn: state.sortFn
                    }
                }
            }
        );
    }

    init():void {
        this.layoutModel.init(true, [], () => {
            // we must capture concordance-related actions which lead
            // to specific "pop-up" forms and redirect user back to
            // the 'view' action with additional information (encoded in
            // the fragment part of the URL) specifying which form should be opened
            // once the 'view' page is loaded
            this.layoutModel.dispatcher.registerActionListener(
                transferActionToViewPage(this.layoutModel)
            );
            this.initAnalysisViews();
            this.initQueryOpNavigation();
            this.setupBackButtonListening();
            this.layoutModel.initKeyShortcuts();
        });
    }
}


export function init(conf:Kontext.Conf, runningInBg:boolean):void {
    new CollPage(new KontextPage(conf)).init();
}
