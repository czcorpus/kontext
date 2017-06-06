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

/// <reference path="../../../ts/declarations/react.d.ts" />

import React from 'vendor/react';
import {calcTextColorFromBg, importColor, color2str} from '../../util';


export function init(dispatcher, mixins, layoutViews, ctFreqDataRowsStore) {

    /**
     *
     */
    class QuantitySelect extends React.Component {

        constructor(props) {
            super(props);
            this._handleSelectChange = this._handleSelectChange.bind(this);
        }

        _handleSelectChange(evt) {
            this.props.changeQuantity(evt.target.value);
        }

        render() {
            return (
                <label>
                    {mixins.translate('freq__ct_quantity_label')}:{'\u00a0'}
                    <select value={this.props.currValue} onChange={this._handleSelectChange}>
                        <option value="ipm">i.p.m.</option>
                        <option value="abs">absolute freq.</option>
                    </select>
                </label>
            );
        }
    }

    /**
     *
     */
    class MinFreqInput extends React.Component {

        constructor(props) {
            super(props);
            this._handleInputChange = this._handleInputChange.bind(this);
        }

        _handleInputChange(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_MIN_ABS_FREQ',
                props: {value: evt.target.value}
            });
        }

        render() {
            return (
                <label>
                    {mixins.translate('freq__ct_min_freq_label')}:{'\u00a0'}
                    <input type="text" style={{width: '3em'}} value={this.props.currVal}
                            onChange={this._handleInputChange} />
                </label>
            );
        }
    }

    /**
     *
     */
    class EmptyVectorVisibilitySwitch extends React.Component {

        constructor(props) {
            super(props);
            this._handleCheckboxChange = this._handleCheckboxChange.bind(this);
        }

        _handleCheckboxChange(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY',
                props: {value: evt.target.checked}
            });
        }

        render() {
            return (
                <label>
                    {mixins.translate('freq__ct_hide_zero_vectors')}:{'\u00a0'}
                    <input type="checkbox" onChange={this._handleCheckboxChange}
                            checked={this.props.hideEmptyVectors} />
                </label>
            );
        }
    }

    /**
     *
     * @param {*} props
     */
    const TransposeTableCheckbox = (props) => {
        const handleClickTranspose = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_TRANSPOSE_TABLE',
                props: {}
            });
        };

        return (
            <label>
                {mixins.translate('freq__ct_transpose_table')}:{'\u00a0'}
                <input type="checkbox" checked={props.isChecked} onChange={handleClickTranspose} />
            </label>
        );
    }

    /**
     *
     */
    class CTTableModForm extends React.Component {

        constructor(props) {
            super(props);
        }

        render() {
            return (
                <form>
                    <fieldset>
                        <legend>{mixins.translate('freq__ct_parameters_legend')}</legend>
                        <ul className="items">
                            <li>
                                <QuantitySelect currVal={this.props.viewQuantity} changeQuantity={this.props.changeQuantity} />
                            </li>
                            <li>
                                <MinFreqInput currVal={this.props.minAbsFreq} />
                            </li>
                            <li>
                                <EmptyVectorVisibilitySwitch hideEmptyVectors={this.props.hideEmptyVectors} />
                            </li>
                            <li>
                                <TransposeTableCheckbox isChecked={this.props.transposeIsChecked} />
                            </li>
                        </ul>
                    </fieldset>
                </form>
            );
        }
    }

    /**
     *
     */
    class CTCellMenu extends React.Component {

        constructor(props) {
            super(props);
            this._handlePosClick = this._handlePosClick.bind(this);
            this._handleCloseClick = this._handleCloseClick.bind(this);
        }

        _handlePosClick(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_QUICK_FILTER_CONCORDANCE',
                props: {
                    args: this.props.pfilter
                }
            });
        }

        _handleCloseClick() {
            this.props.onClose();
        }

        render() {
            return (
                <layoutViews.PopupBox onCloseClick={this._handleCloseClick} customClass="menu">
                    <fieldset className="detail">
                        <legend>{mixins.translate('freq__ct_detail_legend')}</legend>
                        {mixins.translate('freq__ct_ipm_freq_label')}:
                        {'\u00a0'}{mixins.formatNumber(this.props.data.ipm, 1)}
                        <br />
                        {mixins.translate('freq__ct_abs_freq_label')}:
                        {'\u00a0'}{mixins.formatNumber(this.props.data.abs, 0)}
                    </fieldset>
                    <form>
                        <fieldset>
                            <legend>{mixins.translate('freq__ct_pfilter_legend')}</legend>
                            <table>
                                <tbody>
                                    <tr>
                                        <th>
                                            {this.props.attr1}:
                                        </th>
                                        <td>
                                            <input type="text" readonly value={this.props.label1} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>
                                            {this.props.attr2}:
                                        </th>
                                        <td>
                                            <input type="text" readonly value={this.props.label2} />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <button type="button" className="default-button"
                                    onClick={this._handlePosClick}>
                                {mixins.translate('freq__ct_pfilter_btn_label')}
                            </button>
                        </fieldset>
                    </form>
                </layoutViews.PopupBox>
            );
        }

    }

    /**
     *
     */
    class CTCell extends React.Component {

        constructor(props) {
            super(props);
            this._handleItemClick = this._handleItemClick.bind(this);
        }

        _getValue() {
            if (this._isNonEmpty()) {
                switch (this.props.quantity) {
                    case 'ipm':
                        return mixins.formatNumber(this.props.data.ipm, 1);
                    case 'abs':
                        return mixins.formatNumber(this.props.data.abs, 0);
                    default:
                        return NaN;
                }

            } else {
                return '';
            }
        }

        _isNonEmpty() {
            const v = (() => {
                switch (this.props.quantity) {
                    case 'ipm':
                        return this.props.data ? this.props.data.ipm : 0;
                    case 'abs':
                        return this.props.data ? this.props.data.abs : 0;
                    default:
                        return NaN;
                }
            })();
            return v > 0;
        }

        _handleItemClick() {
            this.props.onClick();
        }

        render() {
            if (this._isNonEmpty()) {
                const bgStyle = {};
                const linkStyle = {color: color2str(calcTextColorFromBg(importColor(this.props.data.bgColor, 1)))}
                const tdClasses = ['data-cell'];
                if (this.props.isHighlighted) {
                    tdClasses.push('highlighted');

                } else {
                    bgStyle['backgroundColor'] = this.props.data.bgColor;
                }
                return (
                    <td className={tdClasses.join(' ')} style={bgStyle} onMouseOut={this._onMouseOut}
                            onMouseOver={this._onMouseOver}>
                        <a onClick={this._handleItemClick} style={linkStyle}
                                title={mixins.translate('freq__ct_click_for_details')}>
                            {this._getValue()}
                        </a>
                        {this.props.isHighlighted ? <CTCellMenu onClose={this.props.onClose}
                                                            data={this.props.data}
                                                            attr1={this.props.attr1}
                                                            label1={this.props.label1}
                                                            attr2={this.props.attr2}
                                                            label2={this.props.label2} /> : null}
                    </td>
                );

            } else {
                return <td className="empty-cell" />;
            }
        }
    }

    /**
     *
     */
    class CTFreqResultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchState();
            this._changeQuantity = this._changeQuantity.bind(this);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._highlightItem = this._highlightItem.bind(this);
            this._resetHighlight = this._resetHighlight.bind(this);
        }

        _fetchState() {
            return {
                d1Labels: ctFreqDataRowsStore.getD1Labels(),
                d2Labels: ctFreqDataRowsStore.getD2Labels(),
                data: ctFreqDataRowsStore.getData(),
                attr1: ctFreqDataRowsStore.getAttr1(),
                attr2: ctFreqDataRowsStore.getAttr2(),
                adHocSubcWarning: ctFreqDataRowsStore.getQueryContainsWithin(),
                minAbsFreq: ctFreqDataRowsStore.getMinAbsFreq(),
                viewQuantity: 'ipm',
                highlightedCoord: null,
                transposeIsChecked: ctFreqDataRowsStore.getIsTransposed(),
                hideEmptyVectors: ctFreqDataRowsStore.getFilterZeroVectors()
            };
        }

        _changeQuantity(q) {
            const state = this._fetchState();
            state.viewQuantity = q;
            this.setState(state);
        }

        _handleStoreChange() {
            const newState = this._fetchState();
            newState.viewQuantity = this.state.viewQuantity;
            newState.highlightedCoord = this.state.highlightedCoord;
            this.setState(newState);
        }

        componentDidMount() {
            ctFreqDataRowsStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            ctFreqDataRowsStore.removeChangeListener(this._handleStoreChange);
        }

        _renderWarning() {
            if (this.state.adHocSpfilterVisibleubcWarning) {
                return (
                    <p className="warning">
                        <img src={mixins.createStaticUrl('img/warning-icon.svg')}
                                alt={mixins.translate('global__warning')} />
                        {mixins.translate('freq__ct_uses_ad_hoc_subcorpus_warn')}
                    </p>
                );
            }
        }

        _labels1() {
            return this.state.d1Labels.filter(x => x[1]).map(x => x[0]);
        }

        _labels2() {
            return this.state.d2Labels.filter(x => x[1]).map(x => x[0]);
        }

        _resetHighlight() {
            const newState = this._fetchState();
            newState.viewQuantity = this.state.viewQuantity;
            newState.highlightedCoord = null;
            this.setState(newState);
        }

        _highlightItem(i, j) {
            this._resetHighlight();
            const newState = this._fetchState();
            newState.viewQuantity = this.state.viewQuantity;
            newState.highlightedCoord = [i, j];
            this.setState(newState);
        }

        _isHighlighted(i, j) {
            return this.state.highlightedCoord !== null &&
                    this.state.highlightedCoord[0] === i &&
                    this.state.highlightedCoord[1] === j;
        }

        _isHighlightedRow(i) {
            return this.state.highlightedCoord !== null && this.state.highlightedCoord[0] === i;
        }

        _isHighlightedCol(j) {
            return this.state.highlightedCoord !== null && this.state.highlightedCoord[1] === j;
        }

        render() {
            return (
                <div className="CTFreqResultView">
                    {this._renderWarning()}
                    <div className="toolbar">
                        <CTTableModForm
                                minAbsFreq={this.state.minAbsFreq}
                                viewQuantity={this.state.viewQuantity}
                                changeQuantity={this._changeQuantity}
                                hideEmptyVectors={this.state.hideEmptyVectors}
                                transposeIsChecked={this.state.transposeIsChecked} />
                    </div>
                    <table className="ct-data">
                        <tbody>
                            <tr>
                                <th className="attr-label">
                                    {this.state.attr1} {'\u005C'} {this.state.attr2}
                                </th>
                                {this._labels2().map((label2, i) =>
                                    <th key={`lab-${i}`} className={this._is}
                                        className={this._isHighlightedCol(i) ? 'highlighted' : null}>{label2}</th>)}
                            </tr>
                            {this._labels1().map((label1, i) => {
                                const htmlClass = ['vert'];
                                if (this._isHighlightedRow(i)) {
                                    htmlClass.push('highlighted');
                                }
                                return (
                                    <tr key={`row-${i}`}>
                                        <th className={htmlClass.join(' ')}><span>{label1}</span></th>
                                        {this._labels2().map((label2, j) => {
                                            return <CTCell data={this.state.data[label1][label2]} key={`c-${i}:${j}`}
                                                            quantity={this.state.viewQuantity}
                                                            onClick={()=>this._highlightItem(i, j)}
                                                            onClose={this._resetHighlight}
                                                            attr1={this.state.attr1}
                                                            label1={label1}
                                                            attr2={this.state.attr2}
                                                            label2={label2}
                                                            isHighlighted={this._isHighlighted(i, j)} />;
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    return {
        CTFreqResultView: CTFreqResultView
    };

}
