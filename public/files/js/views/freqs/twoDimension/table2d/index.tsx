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

import * as React from 'react';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Color, pipe, Maths, Dict, List } from 'cnc-tskit';

import { Kontext, TextTypes } from '../../../../types/common';
import { init as ctFlatResultFactory } from '../flatTable';
import { init as ctViewOptsFactory } from '../viewOpts';
import { Freq2DFlatViewModel } from '../../../../models/freqs/twoDimension/flatTable';
import { Freq2DTableModel, Data2DTable, ColorMappings, TableInfo, Freq2DTableModelState } from '../../../../models/freqs/twoDimension/table2d';
import { FreqFilterQuantities, Dimensions, FreqQuantities } from '../../../../models/freqs/twoDimension/common';
import { CTFreqCell } from '../../../../models/freqs/twoDimension/generalDisplay';
import { DataPoint } from '../../../../charts/confIntervals';
import { Actions, ActionName } from '../../../../models/freqs/actions';
import { Actions as MainMenuActions, ActionName as MainMenuActionName } from '../../../../models/mainMenu/actions';
import * as S from './style';


const enum TableViewMode {
    TABLE = 'table',
    LIST = 'list'
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
            dispatcher.dispatch<Actions.FreqctSetDisplayQuantity>({
                name: ActionName.FreqctSetDisplayQuantity,
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
            dispatcher.dispatch<Actions.FreqctSetEmptyVecVisibility>({
                name: ActionName.FreqctSetEmptyVecVisibility,
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
            dispatcher.dispatch<Actions.FreqctTransposeTable>({
                name: ActionName.FreqctTransposeTable
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
            dispatcher.dispatch<Actions.FreqctSetColorMapping>({
                name: ActionName.FreqctSetColorMapping,
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
            dispatcher.dispatch<Actions.FreqctSortByDimension>({
                name: ActionName.FreqctSortByDimension,
                payload: {
                    dim: Dimensions.FIRST,
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
            dispatcher.dispatch<Actions.FreqctSortByDimension>({
                name: ActionName.FreqctSortByDimension,
                payload: {
                    dim: Dimensions.SECOND,
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
            dispatcher.dispatch<Actions.FreqctSortByDimension>({
                name: ActionName.FreqctSortByDimension,
                payload: {
                    dim: Dimensions.FIRST,
                    attr: evt.target.value
                }
            });
            dispatcher.dispatch<Actions.FreqctSortByDimension>({
                name: ActionName.FreqctSortByDimension,
                payload: {
                    dim: Dimensions.SECOND,
                    attr: evt.target.value
                }
            });
            dispatcher.dispatch<Actions.FreqctSetDisplayQuantity>({
                name: ActionName.FreqctSetDisplayQuantity,
                payload: {value: evt.target.value}
            });
        };

        const genClassName = (modeType) => {
            return props.quickFreqMode === modeType ? 'util-button active' : 'util-button';
        }

        return (
            <div className="options">
                <layoutViews.ExpandableArea alwaysExpanded={true}
                        initialExpanded={true}
                        label={he.translate('freq__ct_combo_actions_legend')}>
                    <fieldset>
                        <S.ComboActionsSelectorUL>
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
                        </S.ComboActionsSelectorUL>
                    </fieldset>
                </layoutViews.ExpandableArea>
            </div>
        );
    };

    // ------------------------- <FieldsetAdvancedOptions /> ----------------------

    interface FieldsetAdvancedOptionsProps {
        displayQuantity:FreqQuantities;
        canProvideIpm:boolean;
        minFreq:string;
        minFreqType:FreqFilterQuantities;
        hideEmptyVectors:boolean;
        alphaLevel:string;
        availAlphaLevels:Array<[Maths.AlphaLevel, string]>;
        confIntervalLeftMinWarn:number;
        colorMapping:ColorMappings;
        sortDim1:string;
        sortDim2:string;
    }

    // ---------------------------- <FieldsetAdvancedOptions /> --------------------------------

    const FieldsetAdvancedOptions:React.FC<FieldsetAdvancedOptionsProps> = (props) => (
        <div className="options">
            <layoutViews.ExpandableArea initialExpanded={false}
                    label={he.translate('freq__ct_advanced_fieldset_legend')}>
                <fieldset>
                    <h3>{he.translate('freq__ct_data_parameters_legend')}</h3>
                    <ul className="items">
                        <li>
                            <QuantitySelect value={props.displayQuantity} canProvideIpm={props.canProvideIpm} />
                        </li>
                        <li>
                            <ctViewOpts.MinFreqInput currVal={props.minFreq} freqType={props.minFreqType} canProvideIpm={props.canProvideIpm} />
                        </li>
                        <li>
                            <EmptyVectorVisibilitySwitch hideEmptyVectors={props.hideEmptyVectors} />
                        </li>
                        <li>
                            <ctViewOpts.AlphaLevelSelect alphaLevel={props.alphaLevel} availAlphaLevels={props.availAlphaLevels}
                                    confIntervalLeftMinWarn={props.confIntervalLeftMinWarn} />
                        </li>
                    </ul>
                    <h3>{he.translate('freq__ct_view_parameters_legend')}</h3>
                    <ul className="items">
                        <li>
                            <TableSortRowsSelect sortAttr={props.sortDim1} canProvideIpm={props.canProvideIpm} />
                        </li>
                        <li>
                            <TableSortColsSelect sortAttr={props.sortDim2} canProvideIpm={props.canProvideIpm} />
                        </li>
                        <li>
                            <ColorMappingSelector colorMapping={props.colorMapping} />
                        </li>
                    </ul>
                </fieldset>
            </layoutViews.ExpandableArea>
        </div>
    );

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

    const TbodyCellAttrVals:React.FC<TbodyCellAttrValsProps> = (props) => {

        const [highlighted, setHighlighted] = React.useState(false);

        const handleMouseOver = () => {
            setHighlighted(true);
        };

        const handleMouseOut = () => {
            setHighlighted(false);
        };

        const handlePFilter = () => {
            dispatcher.dispatch<Actions.FreqctApplyQuickFilter>({
                name: ActionName.FreqctApplyQuickFilter,
                payload: {
                    url: props.pfilter
                }
            });
        };

        return (
            <tbody>
                <tr>
                    <th>
                        {props.attr1}
                    </th>
                    <td colSpan={2}>
                        <input className={highlighted ? 'highlighted' : null}
                                type="text" readOnly value={props.label1} />
                    </td>
                </tr>
                <tr>
                    <th>
                        {props.attr2}
                    </th>
                    <td colSpan={2}>
                        <input className={highlighted ? 'highlighted' : null}
                                type="text" readOnly value={props.label2} />
                    </td>
                </tr>
                <tr>
                    <th />
                    <td colSpan={2}>
                        <a className="conc" onClick={handlePFilter}
                                onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
                            {he.translate('freq__ct_pfilter_btn_label')}
                        </a>
                    </td>
                </tr>
            </tbody>
        );
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

    /**
     *
     */
    const CTCell:React.SFC<CTCellProps> = (props) => {

        const getValue = () => {
            if (isNonEmpty()) {
                switch (props.quantity) {
                    case FreqQuantities.IPM:
                        return formatIpm(props.data.ipm);
                    case FreqQuantities.ABS:
                        return he.formatNumber(props.data.abs, 0);
                    default:
                        return NaN;
                }

            } else {
                return '';
            }
        };

        const isNonEmpty = () => {
            const v = (() => {
                switch (props.quantity) {
                    case 'ipm':
                        return props.data ? props.data.ipm : 0;
                    case 'abs':
                        return props.data ? props.data.abs : 0;
                    default:
                        return NaN;
                }
            })();
            return v > 0;
        };

        const shouldWarn = () => {
            if (props.quantity === 'ipm') {
                return props.data.ipmConfInterval[0] <= props.confIntervalLeftMinWarn;

            } else if (props.quantity === 'abs') {
                return props.data.absConfInterval[0] <= props.confIntervalLeftMinWarn;
            }
            return false;
        };

        const renderWarning = () => {
            if (shouldWarn()) {
                const linkStyle = {color: pipe(props.data.bgColor, Color.importColor(1), Color.textColorFromBg(), Color.color2str())}
                return <strong className="warn" style={linkStyle}
                                title={he.translate('freq__ct_conf_interval_too_uncertain')}>
                            {'\u00a0'}
                        </strong>;

            } else {
                return '';
            }
        }

        if (isNonEmpty()) {
            const bgStyle = {};
            const linkStyle = {};
            const tdClasses = ['data-cell'];
            if (props.isHighlighted) {
                tdClasses.push('highlighted');

            } else {
                bgStyle['backgroundColor'] = props.data.bgColor;
                linkStyle['color'] = pipe(props.data.bgColor, Color.importColor(1), Color.textColorFromBg(), Color.color2str());
            }
            return (
                <td className={tdClasses.join(' ')} style={bgStyle}>
                    {renderWarning()}
                    <a onClick={props.onClick} style={linkStyle}
                            title={he.translate('freq__ct_click_for_details')}>
                        {getValue()}
                    </a>
                    {props.isHighlighted ? <CTCellMenu onClose={props.onClose}
                                                        data={props.data}
                                                        attr1={props.attr1}
                                                        label1={props.label1}
                                                        attr2={props.attr2}
                                                        label2={props.label2}
                                                        canProvideIpm={props.canProvideIpm} /> : null}
                </td>
            );

        } else {
            return <td className="empty-cell" />;
        }
    };

    /**
     *
     */
    const THRowColLabels = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<MainMenuActions.ShowFreqForm>({
                name: MainMenuActionName.ShowFreqForm
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
                    <S.IntervalGroupVisualisation id="confidence-intervals-frame">
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
                    </S.IntervalGroupVisualisation>
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
        d1Labels:Array<[string, boolean]>;
        d2Labels:Array<[string, boolean]>;
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
                dispatcher.dispatch<Actions.FreqctSetHighlightedGroup>({
                    name: ActionName.FreqctSetHighlightedGroup,
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
                        {Object.keys(props.concSelectedTextTypes).map(v => {
                            const data = props.concSelectedTextTypes[v];
                            const values = Array.isArray(data) ? data : [data];

                            return (
                                <span key={v}>
                                    <strong>{v}</strong>
                                    {' \u2208 {' + List.map<string|number, string>(v => `"${v}"`, values).join(', ') + '}'}
                                </span>
                            );
                        })}
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


    // ------------------------- <CTDataTable /> --------------------------------------

    const CTDataTable = (props) => {
        if (!props.isEmpty) {
            return <CTFullDataTable {...props} />

        } else {
            return <CTEmptyDataTable attr1={props.attr1} attr2={props.attr2} />
        }
    }

    // ------------------------- <WaitingAnim /> --------------------------------------

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

    /**
     *
     */
    class CT2dFreqResultView extends React.PureComponent<CTFreqResultViewProps & Freq2DTableModelState> {

        constructor(props) {
            super(props);
            this._highlightItem = this._highlightItem.bind(this);
            this._resetHighlight = this._resetHighlight.bind(this);
            this._handleHighlightedGroupClose = this._handleHighlightedGroupClose.bind(this);
        }

        _handleHighlightedGroupClose() {
            dispatcher.dispatch<Actions.FreqctSetHighlightedGroup>({
                name: ActionName.FreqctSetHighlightedGroup,
                payload: {
                    value: [null, null]
                }
            });
        }

        _resetHighlight() {
            dispatcher.dispatch<Actions.FreqctReset2DCoordHighlight>({
                name: ActionName.FreqctReset2DCoordHighlight
            });
        }

        _highlightItem(i:number, j:number) {
            dispatcher.dispatch<Actions.FreqctHighlight2DCoord>({
                name: ActionName.FreqctHighlight2DCoord,
                payload: {
                    coord: [i, j]
                }
            });
        }

        render() {
            return (
                <S.CT2dFreqResultView>
                    <div className="toolbar">
                        <S.CTTableModForm>
                            <FieldsetBasicOptions
                                    transposeIsChecked={this.props.isTransposed}
                                    quickFreqMode={Freq2DTableModel.determineQuickFreqMode(this.props)}
                                    canProvideIpm={Freq2DTableModel.canProvideIpm(this.props)} />
                            <FieldsetAdvancedOptions
                                    minFreq={this.props.minFreq}
                                    minFreqType={this.props.minFreqType}
                                    displayQuantity={this.props.displayQuantity}
                                    hideEmptyVectors={this.props.filterZeroVectors}
                                    sortDim1={this.props.sortDim1}
                                    sortDim2={this.props.sortDim2}
                                    alphaLevel={this.props.alphaLevel}
                                    availAlphaLevels={this.props.availAlphaLevels}
                                    confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn}
                                    colorMapping={this.props.colorMapping}
                                    canProvideIpm={Freq2DTableModel.canProvideIpm(this.props)}  />
                        </S.CTTableModForm>
                    </div>
                    {this.props.highlightedGroup[0] !== null || this.props.highlightedGroup[1] !== null ?
                        <IntervalGroupVisualisation highlightedGroup={this.props.highlightedGroup}
                                onCloseClick={this._handleHighlightedGroupClose}
                                onConfIntervalFrameReady={this.props.onConfIntervalFrameReady}
                                d3PaneWidth={this.props.d3PaneWidth}
                                d3PaneHeight={this.props.d3PaneHeight}
                                alphaLevel={parseFloat(this.props.alphaLevel)} /> : null}
                    {this.props.isWaiting ?
                        <WaitingAnim attr1={this.props.attr1}
                                attr2={this.props.attr2} /> :
                        <CTDataTable
                                attr1={this.props.attr1}
                                attr2={this.props.attr2}
                                d1Labels={this.props.d1Labels}
                                d2Labels={this.props.d2Labels}
                                data={this.props.data}
                                displayQuantity={this.props.displayQuantity}
                                onHighlight={this._highlightItem}
                                onResetHighlight={this._resetHighlight}
                                highlightedCoord={this.props.highlightedCoord}
                                confIntervalLeftMinWarn={this.props.confIntervalLeftMinWarn}
                                highlightedGroup={this.props.highlightedGroup}
                                canProvideIpm={Freq2DTableModel.canProvideIpm(this.props)}
                                isEmpty={Dict.size(this.props.data) === 0}
                                tableInfo={Freq2DTableModel.getTableInfo(this.props)}
                                usesAdHocSubcorpus={this.props.usesAdHocSubcorpus}
                                concSelectedTextTypes={this.props.selectedTextTypes} />
                    }
                </S.CT2dFreqResultView>
            );
        }
    }

    const BoundCT2dFreqResultView = BoundWithProps<CTFreqResultViewProps, Freq2DTableModelState>(CT2dFreqResultView, ctFreqDataRowsModel)

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
            dispatcher.dispatch<Actions.SetCtSaveMode>({
                name: ActionName.SetCtSaveMode,
                payload: {value: evt.target.value}
            });
            this.setState({mode: evt.target.value});
        }

        _renderContents() {
            switch (this.state.mode) {
                case TableViewMode.TABLE:
                    return <BoundCT2dFreqResultView {...this.props} />
                case TableViewMode.LIST:
                    return <flatResultViews.CTFlatFreqResultView {...this.props} />
                default:
                    return null;
            }
        }

        componentDidMount() {
            dispatcher.dispatch<Actions.SetCtSaveMode>({
                name: ActionName.SetCtSaveMode,
                payload: {value: this.state.mode}
            });
        }

        render() {
            return (
                <S.CTFreqResultView>
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
                </S.CTFreqResultView>
            );
        }
    }

    return {
        CTFreqResultView
    };

}
