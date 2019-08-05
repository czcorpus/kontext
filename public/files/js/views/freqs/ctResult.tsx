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

import {Kontext, TextTypes} from '../../types/common';
import * as Immutable from 'immutable';
import * as React from 'react';
import {calcTextColorFromBg, importColor, color2str} from '../../util';
import {init as ctFlatResultFactory} from './ctFlatResult';
import {init as ctViewOptsFactory} from './ctViewOpts';
import {Freq2DFlatViewModel} from '../../models/freqs/flatCtable';
import {Freq2DTableModel, Data2DTable, ColorMappings, TableInfo} from '../../models/freqs/ctable';
import {FreqFilterQuantities} from '../../models/freqs/ctFreqForm';
import {FreqQuantities, CTFreqCell} from '../../models/freqs/generalCtable';
import {DataPoint} from '../../charts/confIntervals';
import {IActionDispatcher} from 'kombo';
import { Subscription } from 'rxjs';


const enum TableViewMode {
    TABLE = "table",
    LIST = "list"
}


interface CTFreqResultViewProps {
    onConfIntervalFrameReady:()=>void;
    d3PaneWidth:number;
    d3PaneHeight:number;
}


interface CTFreqResultViewState {
    mode:TableViewMode;
}


interface Views {
    CTFreqResultView:React.ComponentClass<CTFreqResultViewProps>;
}


export function init(
            dispatcher:IActionDispatcher,
            he:Kontext.ComponentHelpers,
            ctFreqDataRowsModel:Freq2DTableModel,
            ctFlatFreqDataRowsModel:Freq2DFlatViewModel) {

    const layoutViews = he.getLayoutViews();
    const flatResultViews = ctFlatResultFactory(dispatcher, he, ctFlatFreqDataRowsModel);
    const ctViewOpts = ctViewOptsFactory(dispatcher, he);

    const formatIpm = (v) => v >= 0.1 ? he.formatNumber(v, 1) : '\u2248 0';

    /**
     *
     */
    const QuantitySelect = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_SET_DISPLAY_QUANTITY',
                payload: {value: evt.target.value}
            });
        };

        return (
            <label>
                {he.translate('freq__ct_quantity_label')}:{'\u00a0'}
                <select value={props.value} onChange={handleSelectChange}>
                    {props.canProvideIpm ?
                        <option value="ipm">
                            {he.translate('freq__ct_quantity_ipm')}
                        </option> :
                        null
                    }
                    <option value="abs">
                        {he.translate('freq__ct_quantity_abs')}
                    </option>
                </select>
            </label>
        );
    };

    /**
     *
     */
    const EmptyVectorVisibilitySwitch = (props) => {

        const handleCheckboxChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY',
                payload: {value: evt.target.checked}
            });
        };

        return (
            <label>
                {he.translate('freq__ct_hide_zero_vectors')}:{'\u00a0'}
                <input type="checkbox" onChange={handleCheckboxChange}
                        checked={props.hideEmptyVectors} />
            </label>
        );
    };

    /**
     *
     */
    const TransposeTableCheckbox = (props) => {
        const handleClickTranspose = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_TRANSPOSE_TABLE',
                payload: {}
            });
        };

        return (
            <label>
                {he.translate('freq__ct_transpose_table')}:{'\u00a0'}
                <input type="checkbox" checked={props.isChecked} onChange={handleClickTranspose}
                        style={{verticalAlign: 'middle'}} />
            </label>
        );
    };

    /**
     *
     * @param {*} props
     */
    const ColorMappingHint = (props) => {
        return (
            <layoutViews.PopupBox onCloseClick={props.onCloseClick} takeFocus={true} customClass="hint">
                <p>{he.translate('freq__ct_color_mapping_hint')}</p>
            </layoutViews.PopupBox>
        );
    };

    // ------------------------------- <ColorMappingSelector /> ---------------------

    interface ColorMappingSelectorProps {
        colorMapping:ColorMappings;
    }

    interface ColorMappingSelectorState {
        hintVisible:boolean;
    }

    /**
     *
     * @param {*} props
     */
    class ColorMappingSelector extends React.Component<ColorMappingSelectorProps, ColorMappingSelectorState> {

        constructor(props) {
            super(props);
            this.state = {hintVisible: false};
            this._handleChange = this._handleChange.bind(this);
            this._handleHintClick = this._handleHintClick.bind(this);
            this._handleHintClose = this._handleHintClose.bind(this);
        }

        _handleChange(evt) {
            dispatcher.dispatch({
                name: 'FREQ_CT_SET_COLOR_MAPPING',
                payload: {value: evt.target.value}
            });
        }

        _handleHintClick() {
            this.setState({hintVisible: true});
        }

        _handleHintClose() {
            this.setState({hintVisible: false});
        }

        render() {
            return (
                <span>
                    <label htmlFor="color-mapping-selector">
                        {he.translate('freq__ct_color_mapping_label')}
                    </label>
                    <span>
                        <sup className="hint" onClick={this._handleHintClick}>
                            <img src={he.createStaticUrl('img/info-icon.svg')}
                                    alt={he.translate('global__info_icon')} />
                        </sup>
                        {this.state.hintVisible ?
                            <ColorMappingHint onCloseClick={this._handleHintClose} /> : null}
                    </span>
                    {':\u00a0'}
                    <select value={this.props.colorMapping} onChange={this._handleChange}>
                        <option value="linear">
                            {he.translate('freq__ct_color_mapping_linear')}
                        </option>
                        <option value="percentile">
                            {he.translate('freq__ct_color_mapping_percentile')}
                        </option>
                    </select>
                </span>
            );
        }
    }

    /**
     *
     * @param {*} props
     */
    const TableSortRowsSelect = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_SORT_BY_DIMENSION',
                payload: {
                    dim: 1,
                    attr: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('freq__ct_sort_row_label')}:{'\u00a0'}
                <select onChange={handleChange} value={props.sortAttr}>
                    {props.canProvideIpm  ?
                        <option value="ipm">{he.translate('freq__ct_sort_row_opt_ipm')}</option> :
                        null
                    }
                    <option value="abs">{he.translate('freq__ct_sort_row_opt_abs')}</option>
                    <option value="attr">{he.translate('freq__ct_sort_col_opt_attr')}</option>
                </select>
            </label>
        );
    };

    /**
     *
     * @param {*} props
     */
    const TableSortColsSelect = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_SORT_BY_DIMENSION',
                payload: {
                    dim: 2,
                    attr: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('freq__ct_sort_col_label')}:{'\u00a0'}
                <select onChange={handleChange} value={props.sortAttr}>
                    {props.canProvideIpm  ?
                        <option value="ipm">{he.translate('freq__ct_sort_col_opt_ipm')}</option> :
                        null
                    }
                    <option value="abs">{he.translate('freq__ct_sort_col_opt_abs')}</option>
                    <option value="attr">{he.translate('freq__ct_sort_col_opt_attr')}</option>
                </select>
            </label>
        );
    };

    /**
     *
     * @param {*} props
     */
    const FieldsetBasicOptions = (props) => {

        const handleClick = (evt) => {
            dispatcher.dispatch({
                name: 'FREQ_CT_SORT_BY_DIMENSION',
                payload: {
                    dim: 1,
                    attr: evt.target.value
                }
            });
            dispatcher.dispatch({
                name: 'FREQ_CT_SORT_BY_DIMENSION',
                payload: {
                    dim: 2,
                    attr: evt.target.value
                }
            });
            dispatcher.dispatch({
                name: 'FREQ_CT_SET_DISPLAY_QUANTITY',
                payload: {value: evt.target.value}
            });
        };

        const genClassName = (modeType) => {
            return props.quickFreqMode === modeType ? 'util-button active' : 'util-button';
        }

        return (
            <fieldset>
                <legend>{he.translate('freq__ct_combo_actions_legend')}</legend>
                <ul className="ComboActionsSelector">
                    {props.canProvideIpm ?
                        <li>
                            <button type="button" className={genClassName('ipm')} value="ipm" onClick={handleClick}>
                                {he.translate('freq__ct_combo_action_ipm_button')}
                            </button>
                        </li> : null
                    }
                    <li>
                        <button type="button" className={genClassName('abs')} value="abs" onClick={handleClick}>
                            {he.translate('freq__ct_combo_action_abs_button')}
                        </button>
                    </li>
                    <li>
                        <TransposeTableCheckbox isChecked={props.transposeIsChecked} />
                    </li>
                </ul>
            </fieldset>
        );
    };

    // ------------------------- <ExpandActionLegend /> ----------------------

    class ExpandActionLegend extends React.Component<{
        isExpanded:boolean;
        onClick:()=>void;
    }, {
        isMouseover:boolean;

    }> {

        constructor(props) {
            super(props);
            this.handleMouseout = this.handleMouseout.bind(this);
            this.handleMouseover = this.handleMouseover.bind(this);
            this.state = {isMouseover: false};
        }

        private handleMouseover():void {
            this.setState({isMouseover: true});
        }

        private handleMouseout():void {
            this.setState({isMouseover: false});
        }

        render() {
            return (
                <legend>
                    {this.props.isExpanded ?
                        <layoutViews.ImgWithHighlight src={he.createStaticUrl('img/sort_desc.svg')}
                                alt={he.translate('global__click_to_hide')}
                                htmlClass="expand-collapse"
                                isHighlighted={this.state.isMouseover} /> :
                        <layoutViews.ImgWithHighlight src={he.createStaticUrl('img/next-page.svg')}
                                alt={he.translate('global__click_to_expand')}
                                htmlClass="expand-collapse"
                                isHighlighted={this.state.isMouseover} />
                    }
                    <a onClick={this.props.onClick} className={this.props.isExpanded ?
                            'form-extension-switch collapse' : 'form-extension-switch expand'}
                            onMouseOver={this.handleMouseover} onMouseOut={this.handleMouseout}>
                        {he.translate('freq__ct_advanced_fieldset_legend')}
                    </a>
                </legend>
            );
        }
    };

    // ------------------------- <FieldsetAdvancedOptions /> ----------------------

    interface FieldsetAdvancedOptionsProps {
        displayQuantity:FreqQuantities;
        canProvideIpm:boolean;
        minFreq:string;
        minFreqType:FreqFilterQuantities;
        hideEmptyVectors:boolean;
        alphaLevel:string;
        availAlphaLevels:Immutable.List<[string, string]>;
        confIntervalLeftMinWarn:number;
        colorMapping:ColorMappings;
        sortDim1:string;
        sortDim2:string;
    }

    interface FieldsetAdvancedOptionsState {
        visible:boolean;
    }

    /**
     *
     * @param {*} props
     */
    class FieldsetAdvancedOptions extends React.Component<FieldsetAdvancedOptionsProps, FieldsetAdvancedOptionsState> {

        constructor(props) {
            super(props);
            this.state = {visible: false};
            this._handleFieldsetClick = this._handleFieldsetClick.bind(this);
        }

        _handleFieldsetClick() {
            this.setState({visible: !this.state.visible});
        }

        render() {
            return (
                <fieldset className={this.state.visible ? null : 'collapsed'}>
                    <ExpandActionLegend onClick={this._handleFieldsetClick} isExpanded={this.state.visible} />
                    {this.state.visible ?
                        (<div>
                            <h3>{he.translate('freq__ct_data_parameters_legend')}</h3>
                            <ul className="items">
                                <li>
                                    <QuantitySelect value={this.props.displayQuantity} canProvideIpm={this.props.canProvideIpm} />
                                </li>
                                <li>
                                    <ctViewOpts.MinFreqInput currVal={this.props.minFreq} freqType={this.props.minFreqType} canProvideIpm={this.props.canProvideIpm} />
                                </li>
                                <li>
                                    <EmptyVectorVisibilitySwitch hideEmptyVectors={this.props.hideEmptyVectors} />
                                </li>
                                <li>
                                    <ctViewOpts.AlphaLevelSelect alphaLevel={this.props.alphaLevel} availAlphaLevels={this.props.availAlphaLevels}
                                            confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn} />
                                </li>
                            </ul>
                            <h3>{he.translate('freq__ct_view_parameters_legend')}</h3>
                            <ul className="items">
                                <li>
                                    <TableSortRowsSelect sortAttr={this.props.sortDim1} canProvideIpm={this.props.canProvideIpm} />
                                </li>
                                <li>
                                    <TableSortColsSelect sortAttr={this.props.sortDim2} canProvideIpm={this.props.canProvideIpm} />
                                </li>
                                <li>
                                    <ColorMappingSelector colorMapping={this.props.colorMapping} />
                                </li>
                            </ul>
                        </div>) :
                        null
                    }
                </fieldset>
            );
        }
    };

    // ------------------------ <TbodyCellAttrVals /> -------------------------------------

    interface TbodyCellAttrValsProps {
        attr1:string;
        attr2:string;
        label1:string;
        label2:string;
        pfilter:string;
    }

    interface TbodyCellAttrValsState {
        highlighted:boolean;
    }

    class TbodyCellAttrVals extends React.Component<TbodyCellAttrValsProps, TbodyCellAttrValsState> {

        constructor(props) {
            super(props);
            this._handleMouseOver = this._handleMouseOver.bind(this);
            this._handleMouseOut = this._handleMouseOut.bind(this);
            this.state = {highlighted: false};
        }

        _handleMouseOver() {
            this.setState({highlighted: true});
        }

        _handleMouseOut() {
            this.setState({highlighted: false});
        }

        render() {
            return (
                <tbody>
                    <tr>
                        <th>
                            {this.props.attr1}
                        </th>
                        <td colSpan={2}>
                            <input className={this.state.highlighted ? 'highlighted' : null}
                                    type="text" readOnly value={this.props.label1} />
                        </td>
                    </tr>
                    <tr>
                        <th>
                            {this.props.attr2}
                        </th>
                        <td colSpan={2}>
                            <input className={this.state.highlighted ? 'highlighted' : null}
                                    type="text" readOnly value={this.props.label2} />
                        </td>
                    </tr>
                    <tr>
                        <th />
                        <td colSpan={2}>
                            <a className="conc" href={this.props.pfilter}
                                    onMouseOver={this._handleMouseOver} onMouseOut={this._handleMouseOut}>
                                {he.translate('freq__ct_pfilter_btn_label')}
                            </a>
                        </td>
                    </tr>
                </tbody>
            );
        }
    }

    /**
     *
     */
    const CTCellMenu = (props) => {

        const handleCloseClick = () => {
            props.onClose();
        };

        return (
            <layoutViews.PopupBox onCloseClick={handleCloseClick} customClass="menu" takeFocus={true}>
                <h2>{he.translate('freq__ct_detail_legend')}</h2>
                <table>
                    <tbody>
                        {props.canProvideIpm ?
                            <tr>
                                <th>
                                    {he.translate('freq__ct_ipm_freq_label')}
                                </th>
                                <td>
                                    {formatIpm(props.data.ipm)}
                                </td>
                                <td>
                                    ({he.formatNumber(props.data.ipmConfInterval[0], 1)}
                                    {'\u2013'}
                                    {he.formatNumber(props.data.ipmConfInterval[1], 1)})
                                </td>
                            </tr> :
                            null
                        }
                        <tr>
                            <th>
                                {he.translate('freq__ct_abs_freq_label')}
                            </th>
                            <td>
                                {he.formatNumber(props.data.abs, 0)}
                            </td>
                            <td>
                                ({he.formatNumber(props.data.absConfInterval[0], 0)}
                                {'\u2013'}
                                {he.formatNumber(props.data.absConfInterval[1], 0)})
                            </td>
                        </tr>
                    </tbody>
                    <TbodyCellAttrVals attr1={props.attr1} attr2={props.attr2} label1={props.label1} label2={props.label2}
                            pfilter={props.data.pfilter} />
                </table>
            </layoutViews.PopupBox>
        );
    };

    // --------------------------- <CTCell /> -----------------------------------------

    interface CTCellProps {
        quantity:FreqQuantities;
        data:CTFreqCell;
        confIntervalLeftMinWarn:number;
        attr1:string;
        attr2:string;
        isHighlighted:boolean;
        canProvideIpm:boolean;
        label1:string;
        label2:string;

        onClick:()=>void;
        onClose:()=>void;
    }

    interface CTCellState {

    }

    /**
     *
     */
    class CTCell extends React.Component<CTCellProps, CTCellState> {

        constructor(props) {
            super(props);
            this.handleItemClick = this.handleItemClick.bind(this);
        }

        getValue() {
            if (this.isNonEmpty()) {
                switch (this.props.quantity) {
                    case FreqQuantities.IPM:
                        return formatIpm(this.props.data.ipm);
                    case FreqQuantities.ABS:
                        return he.formatNumber(this.props.data.abs, 0);
                    default:
                        return NaN;
                }

            } else {
                return '';
            }
        }

        isNonEmpty() {
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

        handleItemClick() {
            this.props.onClick();
        }

        shouldWarn() {
            if (this.props.quantity === 'ipm') {
                return this.props.data.ipmConfInterval[0] <= this.props.confIntervalLeftMinWarn;

            } else if (this.props.quantity === 'abs') {
                return this.props.data.absConfInterval[0] <= this.props.confIntervalLeftMinWarn;
            }
            return false;
        }

        renderWarning() {
            if (this.shouldWarn()) {
                const linkStyle = {color: color2str(calcTextColorFromBg(importColor(this.props.data.bgColor, 1)))}
                return <strong className="warn" style={linkStyle}
                                title={he.translate('freq__ct_conf_interval_too_uncertain')}>
                            {'\u00a0'}
                        </strong>;

            } else {
                return '';
            }
        }

        shouldComponentUpdate(nextProps, nextState) {
            return this.props.data !== nextProps.data || this.props.attr1 !== nextProps.attr1 ||
                    this.props.attr2 !== nextProps.attr2 ||
                    this.props.confIntervalLeftMinWarn !== nextProps.confIntervalLeftMinWarn ||
                    this.props.quantity !== nextProps.quantity || this.props.isHighlighted !== nextProps.isHighlighted;
        }

        render() {
            if (this.isNonEmpty()) {
                const bgStyle = {};
                const linkStyle = {};
                const tdClasses = ['data-cell'];
                if (this.props.isHighlighted) {
                    tdClasses.push('highlighted');

                } else {
                    bgStyle['backgroundColor'] = this.props.data.bgColor;
                    linkStyle['color'] = color2str(calcTextColorFromBg(importColor(this.props.data.bgColor, 1)));
                }
                return (
                    <td className={tdClasses.join(' ')} style={bgStyle}>
                        {this.renderWarning()}
                        <a onClick={this.handleItemClick} style={linkStyle}
                                title={he.translate('freq__ct_click_for_details')}>
                            {this.getValue()}
                        </a>
                        {this.props.isHighlighted ? <CTCellMenu onClose={this.props.onClose}
                                                            data={this.props.data}
                                                            attr1={this.props.attr1}
                                                            label1={this.props.label1}
                                                            attr2={this.props.attr2}
                                                            label2={this.props.label2}
                                                            canProvideIpm={this.props.canProvideIpm} /> : null}
                    </td>
                );

            } else {
                return <td className="empty-cell" />;
            }
        }
    };

    /**
     *
     */
    const THRowColLabels = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                name: 'MAIN_MENU_SHOW_FREQ_FORM',
                payload: {}
            });
        };

        return (
            <th className="attr-label" rowSpan={props.rowSpan}>
                <a onClick={handleClick} title={he.translate('freq__ct_change_attrs')}>
                    {props.attr1}
                    {'\u005C'}
                    {props.attr2}
                </a>
            </th>
        );
    };

    // ------------ <IntervalGroupVisualisation /> -----------------------------

    interface IntervalGroupVisualisationProps {
        highlightedGroup:[number, number];
        onConfIntervalFrameReady:(data:Array<DataPoint>, label:string)=>void;
        d3PaneWidth:number;
        d3PaneHeight:number;
        onCloseClick:()=>void;
        alphaLevel:number;
    }

    interface IntervalGroupVisualisationState {
        data:Array<DataPoint>;
        label:string;
    }

    /**
     *
     * @param {*} props
     */
    class IntervalGroupVisualisation extends React.Component<IntervalGroupVisualisationProps, IntervalGroupVisualisationState> {

        constructor(props) {
            super(props);
            this.state = {
                data: ctFreqDataRowsModel.exportGroup(this.props.highlightedGroup[0], this.props.highlightedGroup[1]),
                label: ctFreqDataRowsModel.exportGroupLabel(this.props.highlightedGroup[0], this.props.highlightedGroup[1])
            }
        }

        componentDidMount() {
            this.props.onConfIntervalFrameReady(this.state.data, this.state.label);
        }

        render() {
            return (
                <layoutViews.PopupBox onCloseClick={this.props.onCloseClick} takeFocus={true}>
                    <div id="confidence-intervals-frame" className="IntervalGroupVisualisation">
                        <h2 className="top" />
                        <div className="chart-wrapper">
                            <svg width={this.props.d3PaneWidth} height={this.props.d3PaneHeight} />
                            <div className="tooltip" style={{display: 'none'}} />
                        </div>
                        <div className="chart-help">
                                <img src={he.createStaticUrl('img/info-icon.svg')} style={{width: '1em'}}
                                        alt={he.translate('global__info_icon')} />
                                <span className="hint">
                                    {he.translate('freq__ct_ipm_x_axis_hint_{prob}', {prob: (100 * (1 - this.props.alphaLevel)).toFixed(2)})}
                                </span>
                            </div>
                    </div>
                </layoutViews.PopupBox>
            );
        }
    }

    /**
     *
     * @param {*} props
     */
    const CTEmptyDataTable = (props) => {
        return (
            <div>
                <table className="ct-data">
                    <tbody>
                        <tr>
                            <THRowColLabels attr1={props.attr1} attr2={props.attr2} />
                            <th />
                        </tr>
                        <tr>
                            <th />
                            <td className="empty-cell">-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };


    // ------------------------ <CTFullDataTable /> -----------------------------

    interface CTFullDataTableProps {
        d1Labels:Immutable.List<[string, boolean]>;
        d2Labels:Immutable.List<[string, boolean]>;
        highlightedCoord:[number, number];
        highlightedGroup:[number, number];
        usesAdHocSubcorpus:boolean;
        attr1:string;
        attr2:string;
        displayQuantity:FreqQuantities;
        confIntervalLeftMinWarn:number;
        canProvideIpm:boolean;
        tableInfo:TableInfo;
        data:Data2DTable;
        concSelectedTextTypes:TextTypes.ExportedSelection;

        onHighlight:(i:number, j:number)=>void;
        onResetHighlight:()=>void;
    }

    /**
     *
     * @param {*} props
     */
    const CTFullDataTable:React.SFC<CTFullDataTableProps> = (props) => {
        const labels1 = () => {
            return props.d1Labels.filter(x => x[1]).map(x => x[0]);
        };

        const labels2 = () => {
            return props.d2Labels.filter(x => x[1]).map(x => x[0]);
        };

        const isHighlightedRow = (i) => {
            return props.highlightedCoord !== null && props.highlightedCoord[0] === i;
        };

        const isHighlightedCol = (j) => {
            return props.highlightedCoord !== null && props.highlightedCoord[1] === j;
        };

        const isHighlighted = (i, j) => {
            return props.highlightedCoord !== null &&
                    props.highlightedCoord[0] === i &&
                    props.highlightedCoord[1] === j;
        };

        const isHighlightedGroup = (i, j) => {
            return props.highlightedGroup[0] !== null && props.highlightedGroup[0] === i ||
                props.highlightedGroup[1] !== null && props.highlightedGroup[1] === j;
        };

        const handleClickHighlightedGroupFn = (val) => {
            return () => {
                dispatcher.dispatch({
                    name: 'FREQ_CT_SET_HIGHLIGHTED_GROUP',
                    payload: {
                        value: val
                    }
                });
            };
        };

        const renderWarning = () => {
            if (props.usesAdHocSubcorpus) {
                return (
                    <p className="warning">
                        <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning')} />
                        {he.translate('freq__ct_uses_ad_hoc_subcorpus_warn')}
                        {'\u00a0'}
                        {he.translate('freq__ct_current_adhoc_subc_is')}:
                        {'\u00a0'}
                        {Object.keys(props.concSelectedTextTypes).map(v => (
                            <span key={v}>
                                <strong>{v}</strong>
                                {' \u2208 {' + props.concSelectedTextTypes[v].map(v => `"${v}"`).join(', ') + '}'}
                            </span>
                        ))}
                    </p>
                );
            }
        }

        return (
            <div>
                <table className="ct-data">
                    <tbody>
                        <tr>
                            <THRowColLabels attr1={props.attr1} attr2={props.attr2} rowSpan={props.displayQuantity === 'ipm' ? 2 : 1} />
                            {labels2().map((label2, i) =>
                                <th key={`lab-${i}`}
                                        className={isHighlightedCol(i) || isHighlightedGroup(null, i) ? 'highlighted' : null}>
                                    {label2}
                                </th>
                            )}
                        </tr>
                        {props.displayQuantity === 'ipm' ?
                            <tr>
                                {labels2().map((label2, i) =>
                                    <td key={`icon-${i}`} className="icon">
                                        <a onClick={handleClickHighlightedGroupFn([null, i])}
                                                    className="visualisation"
                                                    title={he.translate('freq__ct_click_to_compare_col')}>
                                                <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/chart-icon.svg')}
                                                            alt="chart-icon.svg" />
                                            </a>
                                    </td>
                                )}
                            </tr> : null
                        }
                        {labels1().map((label1, i) => {
                            const htmlClass = ['vert'];
                            if (isHighlightedRow(i) || isHighlightedGroup(i, null)) {
                                htmlClass.push('highlighted');
                            }
                            return (
                                <tr key={`row-${i}`}>
                                    <th className={htmlClass.join(' ')}>
                                        {label1}
                                        {props.displayQuantity === 'ipm' ?
                                            <a className="visualisation-r" onClick={handleClickHighlightedGroupFn([i, null])}
                                                    title={he.translate('freq__ct_click_to_compare_row')}>
                                                <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/chart-icon.svg')}
                                                            alt="chart-icon.svg" />
                                            </a> : null}
                                    </th>
                                    {labels2().map((label2, j) => {
                                        return <CTCell data={props.data[label1][label2]} key={`c-${i}:${j}`}
                                                        quantity={props.displayQuantity}
                                                        onClick={()=>props.onHighlight(i, j)}
                                                        onClose={props.onResetHighlight}
                                                        attr1={props.attr1}
                                                        label1={label1}
                                                        attr2={props.attr2}
                                                        label2={label2}
                                                        isHighlighted={isHighlighted(i, j)}
                                                        confIntervalLeftMinWarn={props.confIntervalLeftMinWarn}
                                                        canProvideIpm={props.canProvideIpm} />;
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {renderWarning()}
                <TableInfo {...props.tableInfo} />
            </div>
        );
    };


    /**
     *
     * @param {*} props
     */
    const CTDataTable = (props) => {
        if (!props.isEmpty) {
            return <CTFullDataTable {...props} />

        } else {
            return <CTEmptyDataTable attr1={props.attr1} attr2={props.attr2} />
        }
    }


    /**
     *
     * @param {*} props
     */
    const WaitingAnim = (props) => {
        return (
             <table className="ct-data">
                <tbody>
                    <tr>
                        <THRowColLabels attr1={props.attr1} attr2={props.attr2} />
                        <th>{'\u2026'}</th>
                    </tr>
                    <tr>
                        <th>{'\u22EE'}</th>
                        <td style={{padding: '2em'}}>
                            <img src={he.createStaticUrl('img/ajax-loader.gif')} alt={he.translate('global__loading')} />
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    /**
     *
     * @param {*} props
     */
    const TableInfo = (props) => {
        return (
            <p>
                ({he.translate('freq__ct_total_nonzero_pairs')}:{'\u00a0'}
                <strong>{he.formatNumber(props.numNonZero)},{'\u00a0'}</strong>
                {he.translate('freq__ct_total_abs_frequency')}:{'\u00a0'}
                <strong>{he.formatNumber(props.totalAbs)}</strong>)
            </p>
        );
    };

    // ---------------- <CT2dFreqResultView /> -----------------------------

    interface CT2dFreqResultViewState {
        d1Labels:Immutable.List<[string, boolean]>;
        d2Labels:Immutable.List<[string, boolean]>;
        data:Data2DTable;
        attr1:string;
        attr2:string;
        sortDim1:string;
        sortDim2:string;
        minFreq:string;
        minFreqType:FreqFilterQuantities;
        displayQuantity:FreqQuantities;
        highlightedCoord:[number, number];
        transposeIsChecked:boolean;
        hideEmptyVectors:boolean;
        isWaiting:boolean;
        alphaLevel:string;
        availAlphaLevels:Immutable.List<[string, string]>;
        confIntervalLeftMinWarn:number;
        colorMapping:ColorMappings;
        highlightedGroup:[number, number];
        quickFreqMode:string;
        canProvideIpm:boolean;
        isEmpty:boolean;
        tableInfo:TableInfo;
        usesAdHocSubcorpus:boolean;
        concSelectedTextTypes:TextTypes.ExportedSelection;
    }

    /**
     *
     */
    class CT2dFreqResultView extends React.Component<CTFreqResultViewProps, CT2dFreqResultViewState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchState();
            this._handleModelChange = this._handleModelChange.bind(this);
            this._highlightItem = this._highlightItem.bind(this);
            this._resetHighlight = this._resetHighlight.bind(this);
            this._handleHighlightedGroupClose = this._handleHighlightedGroupClose.bind(this);
        }

        _fetchState() {
            return {
                d1Labels: ctFreqDataRowsModel.getD1Labels(),
                d2Labels: ctFreqDataRowsModel.getD2Labels(),
                data: ctFreqDataRowsModel.getData(),
                attr1: ctFreqDataRowsModel.getAttr1(),
                attr2: ctFreqDataRowsModel.getAttr2(),
                sortDim1: ctFreqDataRowsModel.getSortDim1(),
                sortDim2: ctFreqDataRowsModel.getSortDim2(),
                minFreq: ctFreqDataRowsModel.getMinFreq(),
                minFreqType: ctFreqDataRowsModel.getMinFreqType(),
                displayQuantity: ctFreqDataRowsModel.getDisplayQuantity(),
                highlightedCoord: null,
                transposeIsChecked: ctFreqDataRowsModel.getIsTransposed(),
                hideEmptyVectors: ctFreqDataRowsModel.getFilterZeroVectors(),
                isWaiting: ctFreqDataRowsModel.getIsWaiting(),
                alphaLevel: ctFreqDataRowsModel.getAlphaLevel(),
                availAlphaLevels: ctFreqDataRowsModel.getAvailAlphaLevels(),
                confIntervalLeftMinWarn: ctFreqDataRowsModel.getConfIntervalLeftMinWarn(),
                colorMapping: ctFreqDataRowsModel.getColorMapping(),
                highlightedGroup: ctFreqDataRowsModel.getHighlightedGroup(),
                quickFreqMode: ctFreqDataRowsModel.getQuickFreqMode(),
                canProvideIpm: ctFreqDataRowsModel.canProvideIpm(),
                isEmpty: ctFreqDataRowsModel.isEmpty(),
                tableInfo: ctFreqDataRowsModel.getTableInfo(),
                usesAdHocSubcorpus: ctFreqDataRowsModel.getUsesAdHocSubcorpus(),
                concSelectedTextTypes: ctFreqDataRowsModel.getConcSelectedTextTypes()
            };
        }

        _handleModelChange() {
            const newState = this._fetchState();
            newState.highlightedCoord = this.state.highlightedCoord;
            this.setState(newState);
        }

        _handleHighlightedGroupClose() {
            dispatcher.dispatch({
                name: 'FREQ_CT_SET_HIGHLIGHTED_GROUP',
                payload: {
                    value: [null, null]
                }
            });
        }

        componentDidMount() {
            this.modelSubscription = ctFreqDataRowsModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        _resetHighlight() {
            const newState = this._fetchState();
            newState.highlightedCoord = null;
            this.setState(newState);
        }

        _highlightItem(i, j) {
            this._resetHighlight();
            const newState = this._fetchState();
            newState.highlightedCoord = [i, j];
            this.setState(newState);
        }

        render() {
            return (
                <div className="CT2dFreqResultView">
                    <div className="toolbar">
                        <form className="CTTableModForm">
                            <FieldsetBasicOptions
                                    transposeIsChecked={this.state.transposeIsChecked}
                                    quickFreqMode={this.state.quickFreqMode}
                                    canProvideIpm={this.state.canProvideIpm} />
                            <FieldsetAdvancedOptions
                                    minFreq={this.state.minFreq}
                                    minFreqType={this.state.minFreqType}
                                    displayQuantity={this.state.displayQuantity}
                                    hideEmptyVectors={this.state.hideEmptyVectors}
                                    sortDim1={this.state.sortDim1}
                                    sortDim2={this.state.sortDim2}
                                    alphaLevel={this.state.alphaLevel}
                                    availAlphaLevels={this.state.availAlphaLevels}
                                    confIntervalLeftMinWarn={this.state.confIntervalLeftMinWarn}
                                    colorMapping={this.state.colorMapping}
                                    canProvideIpm={this.state.canProvideIpm}  />
                        </form>
                    </div>
                    {this.state.highlightedGroup[0] !== null || this.state.highlightedGroup[1] !== null ?
                        <IntervalGroupVisualisation highlightedGroup={this.state.highlightedGroup}
                                onCloseClick={this._handleHighlightedGroupClose}
                                onConfIntervalFrameReady={this.props.onConfIntervalFrameReady}
                                d3PaneWidth={this.props.d3PaneWidth}
                                d3PaneHeight={this.props.d3PaneHeight}
                                alphaLevel={parseFloat(this.state.alphaLevel)} /> : null}
                    {this.state.isWaiting ?
                        <WaitingAnim attr1={this.state.attr1}
                                attr2={this.state.attr2} /> :
                        <CTDataTable
                                attr1={this.state.attr1}
                                attr2={this.state.attr2}
                                d1Labels={this.state.d1Labels}
                                d2Labels={this.state.d2Labels}
                                data={this.state.data}
                                displayQuantity={this.state.displayQuantity}
                                onHighlight={this._highlightItem}
                                onResetHighlight={this._resetHighlight}
                                highlightedCoord={this.state.highlightedCoord}
                                confIntervalLeftMinWarn={this.state.confIntervalLeftMinWarn}
                                highlightedGroup={this.state.highlightedGroup}
                                canProvideIpm={this.state.canProvideIpm}
                                isEmpty={this.state.isEmpty}
                                tableInfo={this.state.tableInfo}
                                usesAdHocSubcorpus={this.state.usesAdHocSubcorpus}
                                concSelectedTextTypes={this.state.concSelectedTextTypes} />
                    }
                </div>
            );
        }
    }

    /**
     *
     */
    class CTFreqResultView extends React.Component<CTFreqResultViewProps, CTFreqResultViewState> {

        constructor(props) {
            super(props);
            this.state = {mode: TableViewMode.TABLE};
            this._handleModeSwitch = this._handleModeSwitch.bind(this);
        }

        _handleModeSwitch(evt) {
            dispatcher.dispatch({
                name: 'FREQ_CT_SET_SAVE_MODE',
                payload: {value: evt.target.value}
            });
            this.setState({mode: evt.target.value});
        }

        _renderContents() {
            switch (this.state.mode) {
                case TableViewMode.TABLE:
                    return <CT2dFreqResultView {...this.props} />
                case TableViewMode.LIST:
                    return <flatResultViews.CTFlatFreqResultView {...this.props} />
                default:
                    return null;
            }
        }

        componentDidMount() {
            dispatcher.dispatch({
                name: 'FREQ_CT_SET_SAVE_MODE',
                payload: {value: this.state.mode}
            });
        }

        render() {
            return (
                <div className="CTFreqResultView">
                    <p className="mode-switch">
                        <label>
                            {he.translate('freq__ct_view_mode')}:{'\u00a0'}
                            <select onChange={this._handleModeSwitch}>
                                <option value="table">{he.translate('freq__ct_switch_table_view')}</option>
                                <option value="list">{he.translate('freq__ct_switch_list_view')}</option>
                            </select>
                        </label>
                    </p>
                    {this._renderContents()}
                </div>
            );
        }
    }

    return {
        CTFreqResultView: CTFreqResultView
    };

}
