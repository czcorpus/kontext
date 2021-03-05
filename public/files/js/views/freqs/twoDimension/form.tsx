/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import { IActionDispatcher, Bound } from 'kombo';

import { Kontext } from '../../../types/common';
import { FreqFilterQuantities, Dimensions, isStructAttr } from '../../../models/freqs/twoDimension/common';
import { Freq2DFormModel, Freq2DFormModelState } from '../../../models/freqs/twoDimension/form';
import { Actions, ActionName } from '../../../models/freqs/actions';

import * as S from './style';



interface ExportedComponents {
    CTFreqForm:React.ComponentClass<{}>;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    ctFreqFormModel:Freq2DFormModel):ExportedComponents {


    // -------------------- <CTFreqFormMinFreqInput /> --------------------------------------------

    interface CTFreqFormMinFreqInputProps {
        freqType:FreqFilterQuantities;
        value:string;
        hint:string;
    }

    const CTFreqFormMinFreqInput:React.SFC<CTFreqFormMinFreqInputProps> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.FreqctFormSetMinFreq>({
                name: ActionName.FreqctFormSetMinFreq,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleTypeChange = (evt) => {
            dispatcher.dispatch<Actions.FreqctFormSetMinFreqType>({
                name: ActionName.FreqctFormSetMinFreqType,
                payload: {value: evt.target.value}
            });
        };

        return (
            <span>
                <label>
                    {he.translate('freq__ct_min_freq_label')}
                    {'\u00a0'}
                    <select onChange={handleTypeChange} value={props.freqType}>
                        <option value="abs">{he.translate('freq__ct_min_abs_freq_opt')}</option>
                        <option value="pabs">{he.translate('freq__ct_min_pabs_freq_opt')}</option>
                        <option value="ipm">{he.translate('freq__ct_min_ipm_opt')}</option>
                        <option value="pipm">{he.translate('freq__ct_min_pipm_opt')}</option>
                    </select>
                    {'\u00a0'}:{'\u00a0'}
                    <input type="text" onChange={handleInputChange}
                            value={props.value} style={{width: '3em'}} />
                </label>
                {props.hint ? <span className="hint"> ({props.hint})</span> : null}
            </span>
        );
    };

    // -------- <CTFreqPosSelect /> --------------------------------

    interface CTFreqPosSelectProps {
        dim:number;
        value:number;
        positionRangeLabels:Array<string>;
    }

    const CTFreqPosSelect:React.SFC<CTFreqPosSelectProps> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<Actions.FreqctFormSetCtx>({
                name: ActionName.FreqctFormSetCtx,
                payload: {
                    dim: props.dim,
                    value: parseInt(evt.target.value, 10)
                }
            });
        };

        return (
            <select value={props.value} onChange={handleChange}>
                {props.positionRangeLabels.map((item, i) => <option key={i} value={i}>{item}</option>)}
            </select>
        );
    };

    // -------- <CTFreqNodeStartSelect /> --------------------------------

    interface CTFreqNodeStartSelectProps {
        dim:number;
        value:string;
    }

    const CTFreqNodeStartSelect:React.SFC<CTFreqNodeStartSelectProps> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<Actions.FreqctFormSetAlignType>({
                name: ActionName.FreqctFormSetAlignType,
                payload: {
                    dim: props.dim,
                    value: evt.target.value
                }
            });
        };

        return (
            <select onChange={handleChange} value={props.value}>
                <option>{he.translate('freq__align_type_left')}</option>
                <option>{he.translate('freq__align_type_right')}</option>
            </select>
        );
    };

    // -------------------- <CTFreqForm /> --------------------------------------------

    class CTFreqForm extends React.PureComponent<Freq2DFormModelState> {

        constructor(props) {
            super(props);
            this._handleAttrSelChange = this._handleAttrSelChange.bind(this);
        }

        _handleAttrSelChange(dimension, evt) {
            dispatcher.dispatch<Actions.FreqctFormSetDimensionAttr>({
                name: ActionName.FreqctFormSetDimensionAttr,
                payload: {
                    dimension: dimension,
                    value: evt.target.value
                }
            });
        }

        _renderPosAttrOpts(dim:Dimensions) {
            return [
                <tr key="label">
                    <th>
                        {he.translate('freq__ml_th_position')}:
                    </th>
                    <td>
                        <CTFreqPosSelect
                                positionRangeLabels={this.props.positionRangeLabels}
                                dim={dim}
                                value={dim === 1 ? this.props.ctxIndex1 : this.props.ctxIndex2} />
                    </td>
                </tr>,
                <tr key="input">
                    <th>
                        {he.translate('freq__ml_th_node_start_at')}:
                    </th>
                    <td>
                        <CTFreqNodeStartSelect
                                dim={dim}
                                value={dim === 1 ? this.props.alignType1 : this.props.alignType2} />
                    </td>
                </tr>
            ];
        }

        _renderWarning() {
            if (this.props.usesAdHocSubcorpus) {
                return (
                    <p className="warning">
                        <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning')} />
                        {he.translate('freq__ct_uses_ad_hoc_subcorpus_future_warn')}
                    </p>
                );
            }
        }

        render() {
            return (
                <S.CTFreqForm>
                    <div className="toolbar">
                            <CTFreqFormMinFreqInput value={this.props.minFreq} freqType={this.props.minFreqType}
                                    hint={this.props.minFreqHint} />
                    </div>
                    <table className="form">
                        <tbody className="dim1">
                            <tr>
                                <th className="main" rowSpan={3}>
                                    <strong>1.</strong>
                                    ({he.translate('freq__ct_dim1')})
                                </th>
                                <th>
                                    {he.translate('freq__ml_th_attribute')}:
                                </th>
                                <td>
                                    <select onChange={this._handleAttrSelChange.bind(this, 1)}
                                            value={this.props.attr1}>
                                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                                            {this.props.availAttrList.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                                            {this.props.availStructAttrList.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                    </select>
                                </td>
                            </tr>
                            {!isStructAttr(this.props.attr1) ? this._renderPosAttrOpts(1) : <tr><td colSpan={2} rowSpan={2} /></tr>}
                        </tbody>
                        <tbody className="dim2">
                            <tr>
                                <th className="main" rowSpan={3}>
                                    <strong>2.</strong>
                                    ({he.translate('freq__ct_dim2')})
                                </th>
                                <th>
                                    {he.translate('freq__ml_th_attribute')}:
                                </th>
                                <td>
                                    <select onChange={this._handleAttrSelChange.bind(this, 2)}
                                            value={this.props.attr2}>
                                        <optgroup label={he.translate('global__attrsel_group_pos_attrs')}>
                                            {this.props.availAttrList.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                        <optgroup label={he.translate('global__attrsel_group_struct_attrs')}>
                                            {this.props.availStructAttrList.map(item =>
                                                <option key={item.n} disabled={item.n === null} value={item.n}>{item.label}</option>)}
                                        </optgroup>
                                    </select>
                                </td>
                            </tr>
                            {!isStructAttr(this.props.attr2) ? this._renderPosAttrOpts(2) : <tr><td colSpan={2} rowSpan={2} /></tr>}
                        </tbody>
                    </table>
                    {this._renderWarning()}
                </S.CTFreqForm>
            );
        }
    }

    return {
        CTFreqForm: Bound<Freq2DFormModelState>(CTFreqForm, ctFreqFormModel)
    };

}