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

import * as React from 'react';
import * as Immutable from 'immutable';
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext} from '../../types/common';
import {PluginInterfaces} from '../../types/plugins';
import { SubcorpFormModel, SubcorpWithinFormModel, WithinLine } from '../../models/subcorp/form';
import { TextTypesPanelProps } from '../textTypes';
import { StructsAndAttrs } from '../../pages/subcorpForm';

export interface FormsModuleArgs {
    dispatcher:ActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorparchComponent:PluginInterfaces.Corparch.WidgetView;
    subcorpFormModel:SubcorpFormModel;
    subcorpWithinFormModel:SubcorpWithinFormModel;
}

export interface SubcorpFormProps {
    structsAndAttrs:StructsAndAttrs;
    ttProps:TextTypesPanelProps;
    ttComponent:React.ComponentClass<TextTypesPanelProps>;
}

export interface FormViews {
    SubcorpForm:React.ComponentClass<SubcorpFormProps>;
    SubcNamePublicCheckbox:React.SFC<{value:boolean}>;
    SubcDescription:React.SFC<{value:string}>;
}

export function init({dispatcher, he, CorparchComponent, subcorpFormModel,
            subcorpWithinFormModel}:FormsModuleArgs):FormViews {

    const layoutViews = he.getLayoutViews();

    // ------------------------------------------- <WithinSwitch /> ----------------------------

    const WithinSwitch:React.SFC<{
        rowIdx:number;
        withinType:string;

    }> = (props) => {

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

    class CloseImg extends React.Component<{
        onClick:()=>void;
    },
    {
        img:string;
    }> {

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

    const ExpressionDescLine:React.SFC<{
        viewIdx:number;

    }> = (props) => {

        const createPrevLinkRef = (i) => {
            if (props.viewIdx > 0) {
                return he.translate('global__subc_all_the_matching_tokens_{prev}', {prev: i});

            } else {
                return he.translate('global__subc_all_the_tokens');
            }
        };

        return (
            <tr className="within-rel">
                <td className="line-id" rowSpan={2}>{props.viewIdx + 1})</td>
                    <td colSpan={3}>
                    <span className="set-desc">{createPrevLinkRef(props.viewIdx)}</span>
                </td>
            </tr>
        );
    };

    // ------------------------------------------- <StructLine /> ----------------------------

    const StructLine:React.SFC<{
        rowIdx:number;
        structsAndAttrs:StructsAndAttrs;
        lineData:WithinLine;

    }> = (props) => {

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

    class WithinBuilder extends React.Component<{
        structsAndAttrs:StructsAndAttrs;
    },
    {
        lines:Immutable.List<WithinLine>;
    }> {

        constructor(props) {
            super(props);
            this.state = {
                lines: subcorpWithinFormModel.getLines()
            };
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
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

        _modelChangeHandler() {
            this.setState({lines: subcorpWithinFormModel.getLines()});
        }

        componentDidMount() {
            subcorpWithinFormModel.addChangeListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            subcorpWithinFormModel.removeChangeListener(this._modelChangeHandler);
        }

        _renderStructLine(line, viewIdx) {
            return <React.Fragment key ={'wl' + line.rowIdx}>
                <ExpressionDescLine viewIdx={viewIdx} />
                <StructLine rowIdx={line.rowIdx}
                        lineData={line} structsAndAttrs={this.props.structsAndAttrs} />
            </React.Fragment>;
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
     */
    const SubcNameInput:React.SFC<{
        value:string;
    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_SET_SUBCNAME',
                props: {
                    value: evt.target.value
                }
            });
        };

        return <input type="text" value={props.value} onChange={handleChange} />;
    };

    // ------------------------ <SubcNamePublicCheckbox /> --------------------------

    const SubcNamePublicCheckbox:React.SFC<{
        value:boolean;

    }> = (props) => {

        const handleCheckbox = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_SET_SUBC_AS_PUBLIC',
                props: {
                    value: !props.value
                }
            });
        };

        return <div>
            <input type="checkbox" onChange={handleCheckbox} checked={props.value}
                    style={{verticalAlign: 'middle'}} />
        </div>;
    };

    // ------------------------ <SubcDescription /> --------------------------

    const SubcDescription:React.SFC<{
        value:string;

    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<HTMLTextAreaElement>) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_SET_DESCRIPTION',
                props: {
                    value: evt.target.value
                }
            });
        };

        return <>
            <textarea rows={5} cols={60} value={props.value} onChange={handleChange} />
            <p className="note">({he.translate('global__markdown_supported')})</p>
        </>;
    };

    // ------------------------ <TDInputModeSelection /> --------------------------

    /**
     *
     */
    const TDInputModeSelection:React.SFC<{
        inputMode:string;
        onModeChange:(mode:string)=>void;

     }> = (props) => {
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
     */
    const StructsHint:React.SFC<{
        structsAndAttrs:StructsAndAttrs;
        onCloseClick:()=>void;

    }> = (props) => {

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
    class TRWithinBuilderWrapper extends React.Component<{
        structsAndAttrs:StructsAndAttrs;
    },
    {
        hintsVisible:boolean;
    }> {

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
    class SubcorpForm extends React.Component<SubcorpFormProps, {
        subcname:string;
        isPublic:boolean;
        inputMode:string;
        description:string;

    }> {

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleInputModeChange = this._handleInputModeChange.bind(this);
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
        }

        _fetchModelState() {
            return {
                subcname: subcorpFormModel.getSubcname(),
                inputMode: subcorpFormModel.getInputMode(),
                isPublic: subcorpFormModel.getIsPublic(),
                description: subcorpFormModel.getDescription()
            };
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
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
            subcorpFormModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            subcorpFormModel.removeChangeListener(this._handleModelChange);
        }

        _renderTextTypeSelection() {
            switch (this.state.inputMode) {
                case 'raw':
                    return <TRWithinBuilderWrapper structsAndAttrs={this.props.structsAndAttrs} />;
                case 'gui':
                    return (
                        <tr>
                            <td colSpan={2}>
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
                                    <SubcNameInput value={this.state.subcname} />
                                </td>
                            </tr>
                            <tr>
                                <th>
                                    {he.translate('subcform__set_as_public')}:
                                    <layoutViews.InlineHelp customStyle={{width: '20em'}} noSuperscript={true}>
                                        <p>{he.translate('subcform__publication_notes')}</p>
                                        <p>{he.translate('subcform__publication_notes_2')}</p>
                                    </layoutViews.InlineHelp>
                                </th>
                                <td>
                                    <SubcNamePublicCheckbox value={this.state.isPublic} />
                                </td>
                            </tr>
                            {this.state.isPublic ?
                                (<tr>
                                    <th>{he.translate('subcform__public_description')}:</th>
                                    <td>
                                        <SubcDescription value={this.state.description} />
                                    </td>
                                </tr>) : null
                            }
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
        SubcorpForm: SubcorpForm,
        SubcNamePublicCheckbox: SubcNamePublicCheckbox,
        SubcDescription: SubcDescription
    };
}