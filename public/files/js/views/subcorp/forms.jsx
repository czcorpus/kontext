/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';


export function init(dispatcher, he, layoutViews, CorparchComponent, subcorpFormStore, subcorpWithinFormStore) {

    // ------------------------------------------- <WithinSwitch /> ----------------------------

    const WithinSwitch = (props) => {

        const changeHandler = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_WITHIN_LINE_SET_WITHIN_TYPE',
                props: {
                    rowIdx: props.rowIdx,
                    value: ({'within': false, '!within': true})[evt.target.value]
                }
            });
        };
        return (
            <select className="code" onChange={changeHandler}
                    value={props.withinType}>
                <option value="within">within</option>
                <option value="!within">!within</option>
            </select>
        );
    };

    // ------------------------------------------- <CloseImg /> ----------------------------

    class CloseImg extends React.Component {

        constructor(props) {
            super(props);
            this.state = {img: he.createStaticUrl('img/close-icon.svg')};
            this._onMouseOver = this._onMouseOver.bind(this);
            this._onMouseOut = this._onMouseOut.bind(this);
        }

        _onMouseOver() {
            this.setState({img: he.createStaticUrl('img/close-icon_s.svg')});
        }

        _onMouseOut() {
            this.setState({img: he.createStaticUrl('img/close-icon.svg')});
        }

        render() {
            return <img className="remove-line"
                        onClick={this.props.onClick}
                        onMouseOver={this._onMouseOver}
                        onMouseOut={this._onMouseOut}
                        src={this.state.img}
                        title={he.translate('global__remove_line')} />;
        }
    }

    // ------------------------------------------- <ExpressionDescLine /> ----------------------------

    const ExpressionDescLine = (props) => {

        const createPrevLinkRef = (i) => {
            if (props.viewIdx > 0) {
                return he.translate('global__subc_all_the_matching_tokens_{prev}', {prev: i});

            } else {
                return he.translate('global__subc_all_the_tokens');
            }
        };

        return (
            <tr className="within-rel">
                <td className="line-id" rowSpan="2">{props.viewIdx + 1})</td>
                    <td colSpan="3">
                    <span className="set-desc">{createPrevLinkRef(props.viewIdx)}</span>
                </td>
            </tr>
        );
    };

    // ------------------------------------------- <StructLine /> ----------------------------

    const StructLine = (props) => {

        const removeHandler = () => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_WITHIN_LINE_REMOVED',
                props: {rowIdx: props.rowIdx}
            });
        };

        const getStructHint = (structName) => {
            return (props.structsAndAttrs[structName] || []).join(', ');
        };

        const handleStructChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_WITHIN_LINE_SET_STRUCT',
                props: {
                    rowIdx: props.rowIdx,
                    value: evt.target.value
                }
            });
        };

        const handleCqlChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_WITHIN_LINE_SET_CQL',
                props: {
                    rowIdx: props.rowIdx,
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <td>
                    <WithinSwitch withinType={props.lineData.negated ? '!within' : 'within'} rowIdx={props.rowIdx} />
                    {'\u00a0'}
                    <select value={props.lineData.structureName} onChange={handleStructChange}>
                    {
                        Object.keys(props.structsAndAttrs).map(
                            (item) => <option key={item}
                                                value={item}
                                                title={getStructHint(item)}>{item}</option>
                        )
                    }
                    </select>
                </td>
                <td>
                    <input type="text" value={props.lineData.attributeCql}
                            onChange={handleCqlChange}
                            style={{width: '30em'}} />
                </td>
                <td>
                    {props.rowIdx > 0
                        ? <CloseImg onClick={removeHandler} /> : null
                    }
                </td>
            </tr>
        );
    };

    // ------------------------------------------- <WithinBuilder /> ----------------------------

    class WithinBuilder extends React.Component {

        constructor(props) {
            super(props);
            this.state = {
                lines: subcorpWithinFormStore.getLines()
            };
            this._storeChangeHandler = this._storeChangeHandler.bind(this);
            this._addLineHandler = this._addLineHandler.bind(this);
        }

        _addLineHandler() {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_WITHIN_LINE_ADDED',
                props: {
                    negated: false,
                    structureName: Object.keys(this.props.structsAndAttrs)[0],
                    attributeCql: ''
                }
            });
        }

        _storeChangeHandler() {
            this.setState({lines: subcorpWithinFormStore.getLines()});
        }

        componentDidMount() {
            subcorpWithinFormStore.addChangeListener(this._storeChangeHandler);
        }

        componentWillUnmount() {
            subcorpWithinFormStore.removeChangeListener(this._storeChangeHandler);
        }

        _renderStructLine(line, viewIdx) {
            return [
                <ExpressionDescLine key ={'wl' + line.rowIdx} rowIdx={line.rowIdx} viewIdx={viewIdx}
                    lineData={line} structsAndAttrs={this.props.structsAndAttrs} />,
                <StructLine key={'sl' + line.rowIdx} rowIdx={line.rowIdx} viewIdx={viewIdx}
                    lineData={line} structsAndAttrs={this.props.structsAndAttrs} />
            ];
        }

        render() {
            return (
                <table>
                    <tbody>
                        {this.state.lines.map((line, i) => this._renderStructLine(line, i))}
                        <tr key="button-row" className="last-line">
                            <td>
                                <a className="add-within"
                                    onClick={this._addLineHandler}
                                    title={he.translate('global__add_within')}>+</a>
                            </td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }

    /**
     *
     * @param {*} props
     */
    const SubcNameInput = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_SET_SUBCNAME',
                props: {
                    value: evt.target.value
                }
            });
        };

        return <input type="text" value={props.value} onChange={handleChange} />
    };

    /**
     *
     * @param {*} props
     */
    const TDInputModeSelection = (props) => {
        return (
            <td>
                <select value={props.inputMode} onChange={(e)=>props.onModeChange(e.target.value)}>
                    <option value="gui">
                        {he.translate('subcform__mode_attr_list')}
                    </option>
                    <option value="raw">
                        {he.translate('subcform__mode_raw_within')}
                    </option>
                </select>
            </td>
        );
    };

    /**
     *
     * @param {*} props
     */
    const StructsHint = (props) => {

        const renderAttrs = () => {
            const ans = [];
            for (let p in props.structsAndAttrs) {
                ans.push(<li key={p}><strong>{p}</strong>:{'\u00a0'}{props.structsAndAttrs[p].join(', ')}</li>);
            }
            return ans;
        };

        const css = {
            position: 'absolute',
            maxWidth: '20em',
            fontWeight: 'normal',
            textAlign: 'left'
        };

        return (
            <layoutViews.PopupBox onCloseClick={props.onCloseClick}
                        customStyle={css}>
                <div>
                    {he.translate('global__within_hint_text')}
                </div>
                <ul>
                    {renderAttrs()}
                </ul>
            </layoutViews.PopupBox>
        );
    };

    /**
     *
     */
    class TRWithinBuilderWrapper extends React.Component {

        constructor(props) {
            super(props);
            this.state = {hintsVisible: false};
            this._handleHelpClick = this._handleHelpClick.bind(this);
            this._handleHelpCloseClick = this._handleHelpCloseClick.bind(this);
        }

        _handleHelpClick() {
            this.setState({hintsVisible: true});
        }

        _handleHelpCloseClick() {
            this.setState({hintsVisible: false});
        }

        render() {
            return (
                <tr id="subc-within-row">
                    <th>
                        {he.translate('subcform__mode_raw_within')}
                        <a id="custom-within-hint" className="context-help"
                                onClick={this._handleHelpClick}>
                            <img className="over-img" src={he.createStaticUrl('img/question-mark.svg')} />
                        </a>:
                        {this.state.hintsVisible ?
                            <StructsHint structsAndAttrs={this.props.structsAndAttrs}
                                    onCloseClick={this._handleHelpCloseClick} /> :
                            null
                        }
                    </th>
                    <td className="container">
                        <WithinBuilder structsAndAttrs={this.props.structsAndAttrs} />
                    </td>
                </tr>
            );
        }
    }

    /**
     *
     */
    class SubcorpForm extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleInputModeChange = this._handleInputModeChange.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _fetchStoreState() {
            return {
                subcname: subcorpFormStore.getSubcname(),
                inputMode: subcorpFormStore.getInputMode()
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        _handleInputModeChange(v) {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_SET_INPUT_MODE',
                props: {
                    value: v
                }
            });
        }

        _handleSubmitClick() {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_SUBMIT',
                props: {}
            });
        }

        componentDidMount() {
            subcorpFormStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            subcorpFormStore.removeChangeListener(this._handleStoreChange);
        }

        _renderTextTypeSelection() {
            switch (this.state.inputMode) {
                case 'raw':
                    return <TRWithinBuilderWrapper structsAndAttrs={this.props.structsAndAttrs} />;
                case 'gui':
                    return (
                        <tr>
                            <td colSpan="2">
                                <this.props.ttComponent {...this.props.ttProps} />
                            </td>
                        </tr>
                    );
                default:
                    return null;
            }
        }

        render() {
            return (
                <form id="subcorp-form">
                    <table className="form">
                        <tbody>
                            <tr>
                                <th>
                                    {he.translate('global__corpus')}:
                                </th>
                                <td>
                                    <CorparchComponent />
                                    <div className="starred"></div>
                                </td>
                            </tr>
                            <tr className="required">
                                <th style={{width: '20%'}}>
                                    {he.translate('global__new_subcorpus_name_lab')}:
                                </th>
                                <td style={{width: '80%'}}>
                                    <SubcNameInput value={this.state.subcName} />
                                </td>
                            </tr>
                            <tr>
                                <th>
                                    {he.translate('subcform__specify_subc_using')}:
                                </th>
                                <TDInputModeSelection inputMode={this.state.inputMode}
                                        onModeChange={this._handleInputModeChange} />
                            </tr>
                            {this._renderTextTypeSelection()}
                            <tr id="subc-mixer-row">
                                <th></th>
                                <td className="widget"></td>
                            </tr>
                        </tbody>
                    </table>

                    <button className="default-button" type="button"
                            onClick={this._handleSubmitClick}>
                        {he.translate('subcform__create_subcorpus')}
                    </button>
                </form>
            );
        }
    }

    return {
        SubcorpForm: SubcorpForm
    };
}