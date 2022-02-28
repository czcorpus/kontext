/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import { IFullActionControl } from 'kombo';
import { Maths, List, pipe, tuple, Dict } from 'cnc-tskit';

import { PageModel, DownloadType } from '../../../app/page';
import { GeneralFreq2DModel, CTFreqCell, GeneralFreq2DModelState, importAvailAlphaLevels } from './generalDisplay';
import { CTFormProperties, roundFloat, FreqFilterQuantities, FreqQuantities, CTFreqResultData } from './common';
import { Actions } from './actions';

/**
 * En extended 2d freq. data item containing
 * also a value pair.
 */
export interface FreqDataItem extends CTFreqCell {
    val1:string;
    val2:string;
}


/**
 * A helper type used when exporting data for Excel etc.
 */
export type ExportTableRow = [string, string, number, number, number, number, number, number];


/**
 * A type representing exported (for Excel etc.) data
 * sent to a server for conversion.
 */
export interface FormatConversionExportData {
    headings:Array<string>;
    minFreq:number;
    minFreqType:string;
    alphaLevel:number;
    data:Array<ExportTableRow>;
}

export interface Freq2DFlatViewModelState extends GeneralFreq2DModelState {

    /**
     * Original data as imported from page initialization.
     */
    origData:Array<FreqDataItem>;

    /**
     * Current data derived from origData by applying filters etc.
     */
    data:Array<FreqDataItem>;

    sortBy:string;

    sortReversed:boolean;
}


/**
 * A model for operations on a flat version of 2d frequency table
 */
export class Freq2DFlatViewModel extends GeneralFreq2DModel<Freq2DFlatViewModelState> {

    constructor(dispatcher:IFullActionControl, pageModel:PageModel, props:CTFormProperties) {
        super(
            dispatcher,
            pageModel,
            {
                ctFcrit1: props.ctfcrit1,
                ctFcrit2: props.ctfcrit2,
                attr1: props.ctattr1,
                attr2: props.ctattr2,
                minFreq: props.ctminfreq,
                minFreqType: props.ctminfreq_type,
                alphaLevel: Maths.AlphaLevel.LEVEL_5,
                availAlphaLevels: importAvailAlphaLevels(),
                fullSize: null,
                usesAdHocSubcorpus: props.usesAdHocSubcorpus,
                origData: [],
                data: [],
                sortBy: FreqQuantities.IPM,
                sortReversed: true,
                confIntervalLeftMinWarn: GeneralFreq2DModel.CONF_INTERVAL_LEFT_MIN_WARN
            }
        );

        this.addActionHandler<typeof Actions.FreqctFormSetMinFreq>(
            Actions.FreqctFormSetMinFreq.name,
            action => {
                if (this.validateMinAbsFreqAttr(action.payload.value)) {
                    this.changeState(state => {
                        state.minFreq = action.payload.value;
                        if (state.data) {
                            this.updateData(state);
                        }
                    });

                } else {
                    // we do not show error because other active model for 2d table handles this
                }
            }
        );

        this.addActionHandler<typeof Actions.FreqctFormSetMinFreqType>(
            Actions.FreqctFormSetMinFreqType.name,
            action => {
                this.changeState(state => {
                    state.minFreqType = action.payload.value;
                });
            }
        );

        this.addActionHandler<typeof Actions.FreqctSetAlphaLevel>(
            Actions.FreqctSetAlphaLevel.name,
            action => {
                this.changeState(state => {
                    state.alphaLevel = action.payload.value;
                    this.recalculateConfIntervals(state);
                    this.updateData(state);
                });
            }
        );

        this.addActionHandler<typeof Actions.FreqctSortFlatList>(
            Actions.FreqctSortFlatList.name,
            action => {
                this.changeState(state => {
                    state.sortBy = action.payload.value;
                    state.sortReversed = action.payload.reversed;
                    this.updateData(state);
                });
            }
        );
    }

    private recalculateConfIntervals(state:Freq2DFlatViewModelState):void {
        state.origData = List.map(
            (cell, i) => {
                const confInt = Maths.wilsonConfInterval(cell.abs, cell.domainSize, state.alphaLevel);
                return {
                    origOrder: i,
                    val1: cell.val1,
                    val2: cell.val2,
                    ipm: cell.ipm,
                    ipmConfInterval: tuple(confInt[0] * 1e6, confInt[1] * 1e6),
                    abs: cell.abs,
                    absConfInterval: tuple(confInt[0] * cell.domainSize, confInt[1] * cell.domainSize),
                    domainSize: cell.domainSize,
                    pfilter: cell.pfilter,
                    bgColor: cell.bgColor
                }
            },
            state.origData
        );
    }

    private updateData(state:Freq2DFlatViewModelState):void {
        const a1 = state.sortReversed ? -1 : 1;
        const a2 = state.sortReversed ? 1 : -1;
        state.data = List.filter(
            this.createMinFreqFilterFn(state),
            state.origData
        );

        switch (state.sortBy) {
            case state.attr1:
                state.data = List.sorted(
                    (v1, v2) => {
                        const s1 = v1.val1 + v1.val2;
                        const s2 = v2.val1 + v2.val2;
                        return s1.localeCompare(s2) * a1;
                    },
                    state.data
                );
            break;
            case 'abs':
                state.data = List.sorted(
                    (v1, v2) => {
                        if (v1.abs > v2.abs) {
                            return a1;
                        }
                        if (v1.abs === v2.abs) {
                            return 0;
                        }
                        if (v1.abs < v2.abs) {
                            return a2;
                        }
                    },
                    state.data
                );
            break;
            case 'ipm':
                state.data = List.sorted(
                    (v1, v2) => {
                        if (v1.ipm > v2.ipm) {
                            return a1;
                        }
                        if (v1.ipm === v2.ipm) {
                            return 0;
                        }
                        if (v1.ipm < v2.ipm) {
                            return a2;
                        }
                    },
                    state.data
                );
            break;
        }
    }

    initialImportData(data:CTFreqResultData):void {
        this.importData(this.state, data);
    }

    protected importData(state:Freq2DFlatViewModelState, data:CTFreqResultData):void {
        state.fullSize = data.full_size;
        state.origData = List.map(
            ([label1, label2, absFreq, total], i) => {
                const confInt = Maths.wilsonConfInterval(absFreq, total, state.alphaLevel);
                return {
                    origOrder: i,
                    val1: label1,
                    val2: label2,
                    abs: absFreq,
                    absConfInterval: [Math.round(confInt[0] * total), Math.round(confInt[1] * total)],
                    ipm: GeneralFreq2DModel.calcIpm(absFreq, total),
                    ipmConfInterval: [roundFloat(confInt[0] * 1e6), roundFloat(confInt[1] * 1e6)],
                    domainSize: total,
                    pfilter: this.generatePFilter(state, label1, label2),
                    bgColor: '#FFFFFF'
                };
            },
            data.data
        );
        this.updateData(state);
    }

    private getFreqFetchFn(state:Freq2DFlatViewModelState):(c:CTFreqCell)=>number {
        switch (state.minFreqType) {
            case FreqFilterQuantities.ABS:
            case FreqFilterQuantities.ABS_PERCENTILE:
                return (c:CTFreqCell) => c.abs;
            case FreqFilterQuantities.IPM:
            case FreqFilterQuantities.IPM_PERCENTILE:
                return (c:CTFreqCell) => c.ipm;
            default:
                throw new Error('Unknown quantity: ' + state.minFreqType);
        }
    }

    createPercentileSortMapping(state:Freq2DFlatViewModelState):[{[key:string]:number}, number] {
        const fetchFreq = this.getFreqFetchFn(state);
        const asList = pipe(
            this.state.origData,
            List.map(x => tuple(x.origOrder, fetchFreq(x))),
            List.filter(x => x !== undefined),
            List.sorted((x1, x2) => x1[1] - x2[1]),
            List.map((x, i) => tuple(x[0].toFixed(), i))
        );
        return tuple(Dict.fromEntries(asList), List.size(asList));
    }

    exportData():FormatConversionExportData {
        const data = this.state.data.map<ExportTableRow>(v => ([
            v.val1,
            v.val2,
            v.absConfInterval[0],
            v.abs,
            v.absConfInterval[1],
            v.ipmConfInterval[0],
            v.ipm,
            v.ipmConfInterval[1]
        ]));
        return {
            headings: [
                this.state.attr1,
                this.state.attr2,
                this.pageModel.translate('freq__ct_abs_freq_label'),
                this.pageModel.translate('freq__ct_ipm_freq_label')
            ],
            minFreq: parseFloat(this.state.minFreq),
            minFreqType: this.state.minFreqType,
            alphaLevel: parseFloat(this.state.alphaLevel),
            data: data
        };
    }

    submitDataConversion(format:string):void {
        const args = {
            saveformat: format,
            savemode: 'flat'
        };
        this.pageModel.bgDownload({
            format,
            datasetType: DownloadType.FREQ2D,
            url: this.pageModel.createActionUrl('export_freqct', args),
            contentType: 'application/json',
            args: this.exportData()
        });
    }
}