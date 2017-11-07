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

import * as React from 'vendor/react';
import {calcTextColorFromBg, importColor, color2str} from '../../util';

/* TODO remove layoutViews */
export function init(dispatcher, he, ctFreqDataRowsStore, ctFlatFreqDataRowsStore) {

    const layoutViews = he.getLayoutViews();

    const formatIpm = (v) => v >= 0.1 ? he.formatNumber(v, 1) : '\u2248 0';

    /**
     *
     */
    const QuantitySelect = (props) => {

        const handleSelectChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_DISPLAY_QUANTITY',
                props: {value: evt.target.value}
            });
        };

        return (
            <label>
                {he.translate('freq__ct_quantity_label')}:{'\u00a0'}
                <select value={props.value} onChange={handleSelectChange}>
                    <option value="ipm">
                        {he.translate('freq__ct_quantity_ipm')}
                    </option>
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
    const MinFreqInput = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_MIN_FREQ',
                props: {value: evt.target.value}
            });
        };

        const handleTypeChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_MIN_FREQ_TYPE',
                props: {value: evt.target.value}
            });
        };

        return (
            <label>
                {he.translate('freq__ct_min_freq_label')}
                {'\u00a0'}
                <select onChange={handleTypeChange} value={props.freqType}>
                    <option value="abs">{he.translate('freq__ct_min_abs_freq_opt')}</option>
                    <option value="ipm">{he.translate('freq__ct_min_ipm_opt')}</option>
                </select>
                {'\u00a0'}:{'\u00a0'}
                <input type="text" style={{width: '3em'}} value={props.currVal}
                        onChange={handleInputChange} />
            </label>
        );
    };

    /**
     *
     */
    const EmptyVectorVisibilitySwitch = (props) => {

        const handleCheckboxChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_EMPTY_VEC_VISIBILITY',
                props: {value: evt.target.checked}
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
                actionType: 'FREQ_CT_TRANSPOSE_TABLE',
                props: {}
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
    const ColorMappingSelector = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_COLOR_MAPPING',
                props: {value: evt.target.value}
            });
        };

        return (
            <label>
                {he.translate('freq__ct_color_mapping_label')}:{'\u00a0'}
                <select value={props.colorMapping} onChange={handleChange}>
                    <option value="linear">
                        {he.translate('freq__ct_color_mapping_linear')}
                    </option>
                    <option value="percentile">
                        {he.translate('freq__ct_color_mapping_percentile')}
                    </option>
                </select>
            </label>
        );
    };

    /**
     *
     * @param {*} props
     */
    const TableSortRowsSelect = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SORT_BY_DIMENSION',
                props: {
                    dim: 1,
                    attr: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('freq__ct_sort_row_label')}:{'\u00a0'}
                <select onChange={handleChange} value={props.sortAttr}>
                    <option value="ipm">{he.translate('freq__ct_sort_row_opt_ipm')}</option>
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
                actionType: 'FREQ_CT_SORT_BY_DIMENSION',
                props: {
                    dim: 2,
                    attr: evt.target.value
                }
            });
        };

        return (
            <label>
                {he.translate('freq__ct_sort_col_label')}:{'\u00a0'}
                <select onChange={handleChange} value={props.sortAttr}>
                    <option value="ipm">{he.translate('freq__ct_sort_col_opt_ipm')}</option>
                    <option value="abs">{he.translate('freq__ct_sort_col_opt_abs')}</option>
                    <option value="attr">{he.translate('freq__ct_sort_col_opt_attr')}</option>
                </select>
            </label>
        );
    };

    // ----------------------- <ConfidenceIntervalHint /> --------------------

    const ConfidenceIntervalHint = (props) => {
        return (
            <layoutViews.PopupBox onCloseClick={props.onCloseClick}>
                <p>
                    {he.translate('freq__ct_confidence_level_hint_paragraph_{threshold}{maxWidth}',
                        {threshold: props.confIntervalWarnRatio * 100, maxWidth: 50 * props.confIntervalWarnRatio})}
                </p>
                <p>{he.translate('freq__ct_references')}:</p>
                <ul className="references">
                    <li>
                        Newcombe, Robert G.: <a href="https://books.google.cz/books?id=hQxvnp2b47YC&lpg=PA65&dq=%22Clopper-Pearson%22%20interval&pg=PP1#v=onepage&q=%22Clopper-Pearson%22%20interval&f=false">
                        Confidence Intervals for Proportions and Related Measures of Effect Size</a> (CRC Press 2013)
                    </li>
                    <li>
                        <a href="https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval">Binomial proportion confidence interval</a> (Wikipedia)
                    </li>
                </ul>
            </layoutViews.PopupBox>
        );
    };

    /**
     *
     * @param {*} props
     */
    class AlphaLevelSelect extends React.Component {

        constructor(props) {
            super(props);
            this._onChange = this._onChange.bind(this);
            this._onHintClick = this._onHintClick.bind(this);
            this._onHintCloseClick = this._onHintCloseClick.bind(this);
            this.state = {hintVisible: false};
        }

        _onChange(evt) {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SET_ALPHA_LEVEL',
                props: {
                    value: evt.target.value
                }
            });
        }

        _onHintClick() {
            this.setState({hintVisible: true});
        }

        _onHintCloseClick() {
            this.setState({hintVisible: false});
        }

        render() {
            return (
                <span>
                    <label htmlFor="confidence-level-selection">
                        {he.translate('freq__ct_conf_level_label')}
                    </label>
                    <span>
                        <sup className="hint" onClick={this._onHintClick}>
                            <img src={he.createStaticUrl('img/info-icon.svg')}
                                    alt={he.translate('global__info_icon')} />
                        </sup>
                        {this.state.hintVisible ?
                            <ConfidenceIntervalHint onCloseClick={this._onHintCloseClick}
                                confIntervalWarnRatio={this.props.confIntervalWarnRatio} /> :
                            null
                        }
                    </span>
                    :{'\u00a0'}
                    <select id="confidence-level-selection" value={this.props.alphaLevel} onChange={this._onChange}>
                        {this.props.availAlphaLevels.map(item =>
                            <option key={item[0]} value={item[0]}>{item[1]}</option>)}
                    </select>
                </span>
            );
        }
    };

    /**
     *
     */
    const CTTableModForm = (props) => {

        return (
            <form className="CTTableModForm">
                <fieldset>
                    <legend>{he.translate('freq__ct_data_parameters_legend')}</legend>
                    <ul className="items">
                        <li>
                            <QuantitySelect value={props.displayQuantity} />
                        </li>
                        <li>
                            <MinFreqInput currVal={props.minFreq} freqType={props.minFreqType} />
                        </li>
                        <li>
                            <EmptyVectorVisibilitySwitch hideEmptyVectors={props.hideEmptyVectors} />
                        </li>
                        <li>
                            <AlphaLevelSelect alphaLevel={props.alphaLevel} availAlphaLevels={props.availAlphaLevels}
                                    confIntervalWarnRatio={props.confIntervalWarnRatio} />
                        </li>
                    </ul>
                </fieldset>
                <fieldset>
                    <legend>{he.translate('freq__ct_view_parameters_legend')}</legend>
                    <ul className="items">
                        <li>
                            <TableSortRowsSelect sortAttr={props.sortDim1} />
                        </li>
                        <li>
                            <TableSortColsSelect sortAttr={props.sortDim2} />
                        </li>
                        <li>
                            <TransposeTableCheckbox isChecked={props.transposeIsChecked} />
                        </li>
                        <li>
                            <ColorMappingSelector value={props.colorMapping} />
                        </li>
                    </ul>
                </fieldset>
            </form>
        );
    };

    /**
     *
     */
    const CTCellMenu = (props) => {

        const handlePosClick = (evt) => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_QUICK_FILTER_CONCORDANCE',
                props: {
                    args: props.data.pfilter
                }
            });
        };

        const handleCloseClick = () => {
            props.onClose();
        };

        return (
            <layoutViews.PopupBox onCloseClick={handleCloseClick} customClass="menu">
                <fieldset className="detail">
                    <legend>{he.translate('freq__ct_detail_legend')}</legend>
                    {he.translate('freq__ct_ipm_freq_label')}:
                    {'\u00a0'}
                    {formatIpm(props.data.ipm)}
                    {'\u00a0'}
                    ({he.formatNumber(props.data.ipmConfInterval[0], 1)}
                    {'\u00a0'}
                    -
                    {'\u00a0'}
                    {he.formatNumber(props.data.ipmConfInterval[1], 1)})
                    <br />
                    {he.translate('freq__ct_abs_freq_label')}:
                    {'\u00a0'}
                    {he.formatNumber(props.data.abs, 0)}
                    {'\u00a0'}
                    ({he.formatNumber(props.data.absConfInterval[0], 0)}
                    {'\u00a0'}
                    -
                    {'\u00a0'}
                    {he.formatNumber(props.data.absConfInterval[1], 0)})


                </fieldset>
                <form>
                    <fieldset>
                        <legend>{he.translate('freq__ct_pfilter_legend')}</legend>
                        <table>
                            <tbody>
                                <tr>
                                    <th>
                                        {props.attr1} =
                                    </th>
                                    <td>
                                        <input type="text" readOnly value={props.label1} />
                                    </td>
                                </tr>
                                <tr>
                                    <th>
                                        {props.attr2} =
                                    </th>
                                    <td>
                                        <input type="text" readOnly value={props.label2} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <p>
                            <button type="button" className="default-button"
                                    onClick={handlePosClick}>
                                {he.translate('freq__ct_pfilter_btn_label')}
                            </button>
                        </p>
                    </fieldset>
                </form>
            </layoutViews.PopupBox>
        );
    };

    /**
     *
     */
    const CTCell = (props) => {

        const getValue = () => {
            if (isNonEmpty()) {
                switch (props.quantity) {
                    case 'ipm':
                        return formatIpm(props.data.ipm);
                    case 'abs':
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

        const handleItemClick = () => {
            props.onClick();
        };

        const shouldWarn = (props) => {
            return (props.data.absConfInterval[1] - props.data.absConfInterval[0]) / props.data.abs  >
                props.confIntervalWarnRatio;
        };

        const renderWarning = (props) => {
            if (shouldWarn(props)) {
                const linkStyle = {color: color2str(calcTextColorFromBg(importColor(props.data.bgColor, 1)))}
                return <strong className="warn" style={linkStyle}
                            title={he.translate('freq__ct_conf_interval_too_wide_{threshold}',
                                {threshold: props.confIntervalWarnRatio * 100})}>
                            {'\u26A0'}{'\u00a0'}
                        </strong>;

            } else {
                return '';
            }
        };

        if (isNonEmpty()) {
            const bgStyle = {};
            const linkStyle = {color: color2str(calcTextColorFromBg(importColor(props.data.bgColor, 1)))}
            const tdClasses = ['data-cell'];
            if (props.isHighlighted) {
                tdClasses.push('highlighted');

            } else {
                bgStyle['backgroundColor'] = props.data.bgColor;
            }
            return (
                <td className={tdClasses.join(' ')} style={bgStyle}>
                    {renderWarning(props)}
                    <a onClick={handleItemClick} style={linkStyle}
                            title={he.translate('freq__ct_click_for_details')}>
                        {getValue()}
                    </a>
                    {props.isHighlighted ? <CTCellMenu onClose={props.onClose}
                                                        data={props.data}
                                                        attr1={props.attr1}
                                                        label1={props.label1}
                                                        attr2={props.attr2}
                                                        label2={props.label2} /> : null}
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
            dispatcher.dispatch({
                actionType: 'MAIN_MENU_SHOW_FREQ_FORM',
                props: {}
            });
        };

        return (
            <th className="attr-label">
                <a onClick={handleClick} title={he.translate('freq__ct_change_attrs')}>
                    {props.attr1}
                    {'\u005C'}
                    {props.attr2}
                </a>
            </th>
        );
    };

    /**
     *
     * @param {*} props
     */
    const CTDataTable = (props) => {
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

        return (
            <div>
                <table className="ct-data">
                    <tbody>
                        <tr>
                            <THRowColLabels attr1={props.attr1} attr2={props.attr2} />
                            {labels2().map((label2, i) =>
                                <th key={`lab-${i}`}
                                        className={isHighlightedCol(i) ? 'highlighted' : null}>
                                    {label2}
                                </th>
                            )}
                        </tr>
                        {labels1().map((label1, i) => {
                            const htmlClass = ['vert'];
                            if (isHighlightedRow(i)) {
                                htmlClass.push('highlighted');
                            }
                            return (
                                <tr key={`row-${i}`}>
                                    <th className={htmlClass.join(' ')}><span>{label1}</span></th>
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
                                                        confIntervalWarnRatio={props.confIntervalWarnRatio} />;
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

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
     */
    class CT2dFreqResultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchState();
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
                sortDim1: ctFreqDataRowsStore.getSortDim1(),
                sortDim2: ctFreqDataRowsStore.getSortDim2(),
                minFreq: ctFreqDataRowsStore.getMinFreq(),
                minFreqType: ctFreqDataRowsStore.getMinFreqType(),
                displayQuantity: ctFreqDataRowsStore.getDisplayQuantity(),
                highlightedCoord: null,
                transposeIsChecked: ctFreqDataRowsStore.getIsTransposed(),
                hideEmptyVectors: ctFreqDataRowsStore.getFilterZeroVectors(),
                isWaiting: ctFreqDataRowsStore.getIsWaiting(),
                alphaLevel: ctFreqDataRowsStore.getAlphaLevel(),
                availAlphaLevels: ctFreqDataRowsStore.getAvailAlphaLevels(),
                confIntervalWarnRatio: ctFreqDataRowsStore.getConfIntervalWarnRatio(),
                colorMapping: ctFreqDataRowsStore.getColorMapping()
            };
        }

        _handleStoreChange() {
            const newState = this._fetchState();
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
                        <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning')} />
                        {he.translate('freq__ct_uses_ad_hoc_subcorpus_warn')}
                    </p>
                );
            }
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
                    {this._renderWarning()}
                    <div className="toolbar">
                        <CTTableModForm
                                minFreq={this.state.minFreq}
                                minFreqType={this.state.minFreqType}
                                displayQuantity={this.state.displayQuantity}
                                hideEmptyVectors={this.state.hideEmptyVectors}
                                transposeIsChecked={this.state.transposeIsChecked}
                                sortDim1={this.state.sortDim1}
                                sortDim2={this.state.sortDim2}
                                alphaLevel={this.state.alphaLevel}
                                availAlphaLevels={this.state.availAlphaLevels}
                                confIntervalWarnRatio={this.state.confIntervalWarnRatio}
                                colorMapping={this.state.colorMapping} />
                    </div>
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
                                confIntervalWarnRatio={this.state.confIntervalWarnRatio} />
                    }
                </div>
            );
        }
    }

    /**
     *
     * @param {*} props
     */
    const TRFlatListRow = (props) => {

        const shouldWarn = (props) => {
            return (props.data.absConfInterval[1] - props.data.absConfInterval[0]) / props.data.abs  >
                props.confIntervalWarnRatio;
        };

        const formatRange = (interval) => {
            return interval.map(x => he.formatNumber(x, 1)).join('-');
        };

        const renderWarning = () => {
            if (shouldWarn(props)) {
                return (
                <strong className="warn" title={he.translate('freq__ct_conf_interval_too_wide_{threshold}',
                            {threshold: props.confIntervalWarnRatio * 100})}>
                        {'\u26A0'}{'\u00a0'}
                </strong>
                );

            } else {
                return '';
            }
        };

        return (
            <tr>
                <td className="num">{props.idx}.</td>
                <td>{props.data.val1}</td>
                <td>{props.data.val2}</td>
                <td className="num" title={formatRange(props.data.absConfInterval)}>
                    {renderWarning()}
                    {props.data.abs}
                </td>
                <td className="num" title={formatRange(props.data.ipmConfInterval)}>
                    {renderWarning()}
                    {props.data.ipm}
                </td>
            </tr>
        );
    }

    /**
     *
     * @param {*} props
     */
    const THSortableCol = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: 'FREQ_CT_SORT_FLAT_LIST',
                props: {
                    value: props.value,
                    reversed: props.isActive ? !props.isReversed : false
                }
            });
        };

        const renderFlag = () => {
            if (props.isActive) {
                if (props.isReversed) {
                    return <img src={he.createStaticUrl('img/sort_desc.svg')} />;

                } else {
                    return <img src={he.createStaticUrl('img/sort_asc.svg')} />;
                }
            }
            return null;
        };

        return (
            <th className="sort-col">
                <a onClick={handleClick} title={he.translate('global__sort_by_this_col')}>
                    {props.label}
                    {renderFlag()}
                </a>
            </th>
        );
    }

    /**
     *
     */
    class CTFlatFreqResultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _fetchStoreState() {
            return {
                data: ctFlatFreqDataRowsStore.getData(),
                attr1: ctFlatFreqDataRowsStore.getAttr1(),
                attr2: ctFlatFreqDataRowsStore.getAttr2(),
                minFreq: ctFlatFreqDataRowsStore.getMinFreq(),
                minFreqType: ctFlatFreqDataRowsStore.getMinFreqType(),
                sortCol: ctFlatFreqDataRowsStore.getSortCol(),
                sortColIsReversed: ctFlatFreqDataRowsStore.getSortColIsReversed(),
                confIntervalWarnRatio: ctFlatFreqDataRowsStore.getConfIntervalWarnRatio(),
                alphaLevel: ctFlatFreqDataRowsStore.getAlphaLevel(),
                availAlphaLevels: ctFlatFreqDataRowsStore.getAvailAlphaLevels()
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        componentDidMount() {
            ctFlatFreqDataRowsStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            ctFlatFreqDataRowsStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <div className="CTFlatFreqResultView">
                    <div className="toolbar">
                        <form>
                            <fieldset>
                                <legend>{he.translate('freq__ct_data_parameters_legend')}</legend>
                                <ul className="items">
                                    <li>
                                        <MinFreqInput currVal={this.state.minFreq} freqType={this.state.minFreqType} />
                                    </li>
                                    <li>
                                        <AlphaLevelSelect alphaLevel={this.state.alphaLevel}
                                                availAlphaLevels={this.state.availAlphaLevels}
                                                confIntervalWarnRatio={this.state.confIntervalWarnRatio} />
                                    </li>
                                </ul>
                            </fieldset>
                        </form>
                    </div>
                    <table className="data">
                        <tbody>
                            <tr>
                                <th />
                                <THSortableCol label={this.state.attr1} value={this.state.attr1}
                                        isActive={this.state.sortCol === this.state.attr1}
                                        isReversed={this.state.sortCol === this.state.attr1 && this.state.sortColIsReversed}
                                         />
                                <th>{this.state.attr2}</th>
                                <THSortableCol label={he.translate('freq__ct_abs_freq_label')}
                                        value="abs" isActive={this.state.sortCol === 'abs'}
                                        isReversed={this.state.sortCol === 'abs' && this.state.sortColIsReversed}
                                        />
                                <THSortableCol label={he.translate('freq__ct_ipm_freq_label')}
                                        value="ipm" isActive={this.state.sortCol === 'ipm'}
                                        isReversed={this.state.sortCol === 'ipm' && this.state.sortColIsReversed} />
                            </tr>
                            {this.state.data.map((item, i) =>
                                <TRFlatListRow key={`r_${i}`} idx={i+1} data={item} confIntervalWarnRatio={this.state.confIntervalWarnRatio} />)}
                        </tbody>
                    </table>
                </div>
            );
        }
    }

    /**
     *
     */
    class CTFreqResultView extends React.Component {

        constructor(props) {
            super(props);
            this.state = {mode: 'table'};
            this._handleModeSwitch = this._handleModeSwitch.bind(this);
        }

        _handleModeSwitch(evt) {
            this.setState({mode: evt.target.value});
        }

        _renderContents() {
            switch (this.state.mode) {
                case 'table':
                    return <CT2dFreqResultView {...this.props} />
                case 'list':
                    return <CTFlatFreqResultView {...this.props} />
                default:
                    return null;
            }
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
