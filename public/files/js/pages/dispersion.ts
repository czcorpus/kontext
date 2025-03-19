/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
 * Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

import { KontextPage } from '../app/main.js';
import * as Kontext from '../types/kontext.js';
import * as TextTypes from '../types/textTypes.js';

import { DispersionDataRow, DispersionResultModel } from '../models/dispersion/result.js';
import { ImageConversionModel } from '../models/common/imgConv.js';
import { Conf } from '../types/kontext.js';
import { init as viewInit } from '../views/dispersion/result.js';
import { IndirectQueryReplayModel } from '../models/query/replay/indirect.js';
import { init as queryOverviewInit } from '../views/query/overview/index.js';
import { QuerySaveAsFormModel } from '../models/query/save.js';
import { List, pipe, tuple, URL as CURL } from 'cnc-tskit';
import { Actions as MainMenuActions } from '../models/mainMenu/actions.js';
import { CollFormInputs, CollFormModel } from '../models/coll/collForm.js';
import { init as collFormFactory } from '../views/coll/forms.js';
import { init as analysisFrameInit } from '../views/analysis.js';
import { init as freqFormFactory } from '../views/freqs/forms.js';
import { Freq2DFlatViewModel } from '../models/freqs/twoDimension/flatTable.js';
import { Freq2DFormModel } from '../models/freqs/twoDimension/form.js';
import { FreqFormInputs, FreqFormProps, MLFreqFormModel, TTFreqFormModel } from '../models/freqs/regular/freqForms.js';
import { AlignTypes, CTFormInputs, CTFormProperties } from '../models/freqs/twoDimension/common.js';
import { TextTypesModel } from '../models/textTypes/main.js';
import { Freq2DTableModel } from '../models/freqs/twoDimension/table2d.js';
import { FreqCTResultsSaveModel } from '../models/freqs/twoDimension/save.js';
import { importInitialTTData, TTInitialData } from '../models/textTypes/common.js';
import { ConcFormArgs, QueryFormArgsResponse } from '../models/query/formArgs.js';
import { fetchQueryFormArgs } from '../models/query/first.js';
import { QueryProps } from '../models/cqleditor/qprops.js';



export class DispersionPage {

    private readonly layoutModel:KontextPage;

    private queryReplayModel:IndirectQueryReplayModel;

    private querySaveAsFormModel:QuerySaveAsFormModel;

    private mlFreqModel:MLFreqFormModel;

    private ttFreqModel:TTFreqFormModel;

    private cTFreqFormModel:Freq2DFormModel;

    private ctFreqModel:Freq2DTableModel;

    private ctFlatFreqModel:Freq2DFlatViewModel;

    private dispersionModel:DispersionResultModel;

    private ctResultSaveModel:FreqCTResultsSaveModel;

    private collFormModel:CollFormModel;

    private imgConversionModel:ImageConversionModel;

    constructor(layoutModel:KontextPage) {
        this.layoutModel = layoutModel;

    }

    private initTTModel(
        ttData:TTInitialData,
        queryFormArgs:QueryFormArgsResponse
    ):[TextTypesModel, Array<TextTypes.AnyTTSelection>] {
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

    private initAnalysisViews():void {
        const ttData = this.layoutModel.getConf<TTInitialData>('textTypesData');
        const concFormArgs = this.layoutModel.getConf<{[ident:string]:ConcFormArgs}>(
            'ConcFormsArgs'
        );
        const queryFormArgs = fetchQueryFormArgs(concFormArgs);
        const [,ttSelection] = this.initTTModel(ttData, queryFormArgs);
        const attrs = this.layoutModel.getConf<Array<Kontext.AttrItem>>('AttrList');

        // -------------------- freq form -------------------

        const freqFormInputs = this.layoutModel.getConf<FreqFormInputs>('FreqFormProps');
        const initFreqLevel = this.layoutModel.getConf<number>('InitialFreqLevel');
        const freqFormProps:FreqFormProps = {
            fttattr: freqFormInputs.fttattr || [],
            flimit: freqFormInputs.flimit || '1',
            freq_sort: 'freq',
            mlxattr: freqFormInputs.mlxattr || List.repeat(() => attrs[0].n, initFreqLevel),
            mlxicase: freqFormInputs.mlxicase || List.repeat(() => false, initFreqLevel),
            mlxctx: freqFormInputs.mlxctx || List.repeat(() => '0>0', initFreqLevel),
            alignType: freqFormInputs.alignType ||
                List.repeat(() => AlignTypes.LEFT, initFreqLevel),
            attrList: attrs,
            structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs'))
        };

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
            structAttrList: Kontext.structsAndAttrsToStructAttrList(this.layoutModel.getConf<Kontext.StructsAndAttrs>('structsAndAttrs')),
            ctattr1: ctFormInputs.ctattr1,
            ctattr2: ctFormInputs.ctattr2,
            ctfcrit1: ctFormInputs.ctfcrit1,
            ctfcrit2: ctFormInputs.ctfcrit2,
            ctminfreq: ctFormInputs.ctminfreq,
            ctminfreq_type: ctFormInputs.ctminfreq_type,
            usesAdHocSubcorpus: TextTypesModel.findHasSelectedItems(ttSelection),
            selectedTextTypes: TextTypesModel.exportSelections(
                ttSelection, ttData.bib_id_attr, ttData.bib_label_attr, false, true)
        };

        this.cTFreqFormModel = new Freq2DFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );
        this.ctFreqModel = new Freq2DTableModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );
        this.ctFlatFreqModel = new Freq2DFlatViewModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            ctFormProps
        );
        this.ctResultSaveModel = new FreqCTResultsSaveModel(
            this.layoutModel.dispatcher,
            this.ctFreqModel,
            this.ctFlatFreqModel
        );
        this.dispersionModel = new DispersionResultModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                isBusy: false,
                concordanceId: this.layoutModel.getConf<string>('concPersistenceOpId'),
                resolution: Kontext.newFormValue(
                    this.layoutModel.getConf<number>('dispersionResolution') + '',
                    true
                ),
                maxResolution: this.layoutModel.getConf<number>('maxDispersionResolution'),
                data: this.layoutModel.getConf<Array<DispersionDataRow>>('dispersionData'),
                downloadFormat: 'png',
            }
        );

        const freqFormViews = freqFormFactory(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.mlFreqModel,
            this.ttFreqModel,
            this.cTFreqFormModel,
            this.dispersionModel
        );

        this.imgConversionModel = new ImageConversionModel(
            this.layoutModel.dispatcher,
            this.layoutModel
        );

        // -------------------- coll form -------------------

        const collFormArgs = this.layoutModel.getConf<CollFormInputs>('CollFormProps');
        this.collFormModel = new CollFormModel(
            this.layoutModel.dispatcher,
            this.layoutModel,
            {
                attrList: attrs,
                cattr: collFormArgs.cattr || attrs[0].n,
                cfromw: collFormArgs.cfromw,
                ctow: collFormArgs.ctow,
                cminfreq: collFormArgs.cminfreq,
                cminbgr: collFormArgs.cminbgr,
                cbgrfns: collFormArgs.cbgrfns,
                csortfn: collFormArgs.csortfn
            }
        );

        const collFormViews = collFormFactory(
            this.layoutModel.dispatcher,
            this.layoutModel.getComponentHelpers(),
            this.collFormModel
        );

        const analysisViews = analysisFrameInit({
            dispatcher: this.layoutModel.dispatcher,
            he: this.layoutModel.getComponentHelpers(),
            collViews: collFormViews,
            freqViews: freqFormViews,
            mainMenuModel: this.layoutModel.getModels().mainMenuModel
        });
        const rawQuery = pipe(
            this.layoutModel.getConf<Array<Kontext.QueryOperation>>('queryOverview') || [],
            List.head(),
            x => x.args
        );
        const qProps = new QueryProps(rawQuery);
        this.layoutModel.renderReactComponent(
            analysisViews.AnalysisFrame,
            window.document.getElementById('analysis-forms-mount'),
            {
                initialFreqFormVariant: 'dispersion' as Kontext.FreqModuleType,
                concHasAdhocQuery: qProps.containsAdhocSubcorp()
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
                SwitchMainCorpForm: null,
                MissingAlignedQueryForm: null
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
                    sortId: null,
                },
                cutoff: this.layoutModel.getConcArgs().cutoff
            }
        );
    }

    init() {
        this.layoutModel.init(true, [], () => {
            const mainMenuModel = this.layoutModel.getModels().mainMenuModel;
            // we must capture concordance-related actions which lead
            // to specific "pop-up" forms and redirect user back to
            // the 'view' action with additional information (encoded in
            // the fragment part of the URL) which form should be opened
            // once the 'view' page is loaded
            this.layoutModel.dispatcher.registerActionListener(
                (action) => {
                    switch (action.name) {
                        case MainMenuActions.ShowFilter.name:
                            window.location.replace(
                                this.layoutModel.createActionUrl(
                                    'view',
                                    this.layoutModel.getConcArgs()
                                ) + '#filter/' + pipe(
                                    action.payload,
                                    CURL.valueToPairs(),
                                    List.map(([k, v]) => `${k}=${v}`)
                                ).join('&')
                            );
                        break;
                        case MainMenuActions.ShowSort.name:
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs()
                            ) + '#sort');
                        break;
                        case MainMenuActions.ShowSample.name:
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs()
                            ) + '#sample');
                        break;
                        case MainMenuActions.ApplyShuffle.name:
                            window.location.replace(this.layoutModel.createActionUrl(
                                'view',
                                this.layoutModel.getConcArgs()
                            ) + '#shuffle');
                        break;
                    }
                }
            );
            this.initQueryOpNavigation();
            this.initAnalysisViews();

            const resultView = viewInit(
                this.layoutModel.dispatcher,
                this.layoutModel.getComponentHelpers(),
                this.dispersionModel
            );
            this.layoutModel.renderReactComponent(
                resultView,
                window.document.getElementById('result-mount'),
                {
                }
            );
        });
    }
}



export function init(conf:Conf):void {
    const page = new DispersionPage(new KontextPage(conf));
    page.init();
}