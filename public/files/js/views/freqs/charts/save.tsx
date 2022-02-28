/*
 * Copyright (c) 2022 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
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

import * as React from 'react';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { List } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import { FreqChartsSaveFormModel, FreqChartsSaveFormModelState } from '../../../models/freqs/regular/saveChart';
import { Actions } from '../../../models/freqs/regular/actions';
import { Actions as GlobalActions } from '../../../models/common/actions';
import * as S from './style';


interface SaveFormProps {
    onClose:()=>void;
}

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    freqChartsSaveModel:FreqChartsSaveFormModel
) {

    const layoutViews = he.getLayoutViews();

    // ---------------------- <FormatSelector /> -------------------------------------

    const FormatSelector:React.FC<{
        sourceId:string;
        value:Kontext.ChartExportFormat;

    }> = ({ sourceId, value }) => {

        const changeHandler = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.FreqChartsSetDownloadFormat,
                {
                    sourceId,
                    format: evt.target.value as Kontext.ChartExportFormat
                }
            )
        }

        return (
            <select value={value} onChange={changeHandler}>
                <option value="png">PNG</option>
                <option value="png-print">PNG ({he.translate('freq__print_quality')})</option>
                <option value="pdf">PDF</option>
            </select>
        );
    };

    // ---------------------- <ChartSelector /> --------------------------------------

    const ChartSelector:React.FC<{
        sourceId:string;
        charts:Array<{n:string; label:string}>;

    }> = ({ sourceId, charts }) => {

        const changeHandler = () => {
            dispatcher.dispatch(
                Actions.FreqChartsSetDownloadFormat,
                {
                    sourceId
                }
            )
        }

        return (
            <select value={sourceId} onChange={changeHandler}>
                {List.map(
                    ch => <option key={`crit:${ch.n}`} value={ch.n}>{ch.label}</option>,
                    charts
                )}
            </select>
        );
    }



    // ---------------------- <FreqChartsSaveView /> ---------------------------------

    const _FreqChartsSaveView:React.FC<FreqChartsSaveFormModelState & SaveFormProps> = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch(
                GlobalActions.ConvertChartSVG,
                {
                    sourceId: `${FreqChartsSaveFormModel.SVG_SAVE_ID_PREFIX}${props.sourceId}`,
                    format: props.formats[props.sourceId]
                }
            );
            props.onClose();
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.onClose}>
            <layoutViews.CloseableFrame onCloseClick={props.onClose} label={he.translate('freq__save_chart_form_label')}>
                <S.FreqChartsSaveViewForm>
                    <div className="block">
                        <label>
                            {he.translate('freq__chart_select_label')}:{'\u00a0'}
                            <ChartSelector charts={props.criteria} sourceId={props.sourceId} />
                        </label>
                        <label>
                            {he.translate('freq__chart_select_format')}:{'\u00a0'}
                            <FormatSelector value={props.formats[props.sourceId]} sourceId={props.sourceId} />
                        </label>
                    </div>
                    <div className="block">
                        <button type="button" className="default-button"
                                onClick={handleSubmitClick}>
                            {he.translate('coll__save_form_submit_btn')}
                        </button>
                    </div>
                </S.FreqChartsSaveViewForm>
            </layoutViews.CloseableFrame>
        </layoutViews.ModalOverlay>
        )
    }

    return BoundWithProps<SaveFormProps, FreqChartsSaveFormModelState>(_FreqChartsSaveView, freqChartsSaveModel);

}

