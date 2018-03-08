/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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
import {Kontext, TextTypes} from '../../types/common';
import {SubcMixerModel, SubcMixerExpression, CalculationResults} from './init';


export interface WidgetProps {
    isActive:boolean;
}


export interface Views {
    Widget:React.ComponentClass<WidgetProps>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers,
            subcMixerModel:SubcMixerModel):Views {

    const layoutViews = he.getLayoutViews();

    // ------------ <ValueShare /> -------------------------------------

    const ValueShare:React.SFC<{
        rowId:number;
        hasResults:boolean;
        attrName:string;
        attrValue:string;
        baseRatio:string;
        ratio:string;
        result:[string, number, boolean];

    }> = (props) => {

        const handleRatioValueChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SET_RATIO',
                props: {
                    attrName: props.attrName,
                    attrValue: props.attrValue,
                    ratio: evt.target.value
                }
            });
        };

        const renderEvalResult = () => {
            if (props.result) {
                const actualVal = props.result[1].toFixed(2);
                if (props.result[2] === true) {
                    return (
                        <span className="checked"
                            title={he.translate('ucnk_subc__condition_fulfilled_{actual_val}',
                                {actual_val: actualVal})}>
                            {'\u2713'}
                        </span>
                    );

                } else {
                    return (
                        <span className="crossed" title={he.translate(
                            'ucnk_subc__condition_failed_{actual_val}',
                            {actual_val: actualVal})}>{'\u2717'}
                        </span>
                    );
                }

            } else {
                return <span>-</span>;
            }
        };

        return (
            <tr>
                <td className="num">{props.rowId}.</td>
                <td className="expression">
                    <strong>{props.attrName} = </strong>
                    {'\u0022' + props.attrValue + '\u0022'}
                </td>
                <td className="num">
                    <span>
                        <input type="text" className={'num' + (props.hasResults ? ' disabled' : '')}
                                style={{width: '3em'}} value={props.ratio}
                                disabled={props.hasResults ? true : false}
                                onChange={handleRatioValueChange} />
                        {'\u00a0'}<strong>%</strong>
                    </span>
                </td>
                <td className="num">
                    {props.baseRatio}<strong>%</strong>
                </td>
                <td className="status">
                    {renderEvalResult()}
                </td>
            </tr>
        );
    };

    // ------------ <ValuesTable /> -------------------------------------

    const ValuesTable:React.SFC<{
        currentResults:CalculationResults;
        hasResults:boolean;
        items:Immutable.List<SubcMixerExpression>;

    }> = (props) => {

        return (
            <table className="data subcmixer-ratios">
                <tbody>
                    <tr>
                        <th />
                        <th>{he.translate('ucnk_subc__ratios_th_expression')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_required_ratio')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_orig_ratio')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_status')}</th>
                    </tr>
                    {props.items.map((item, i) => (
                        <ValueShare key={i}
                                rowId={i + 1}
                                attrName={item.attrName}
                                hasResults={props.hasResults}
                                attrValue={item.attrValue}
                                baseRatio={item.baseRatio}
                                ratio={item.ratio}
                                result={props.currentResults ? props.currentResults['attrs'].get(i) : null} />
                    ))}
                </tbody>
            </table>
        );
    };

    // ------------ <ReenterArgsButton /> -------------------------------------

    const ReenterArgsButton:React.SFC<{
        css:{[key:string]:string};

    }> = (props) => {

        const handleUpdateParamsButton = () => {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_CLEAR_RESULT',
                props: {}
            });
        };

        return (
            <button className="default-button" type="button"
                    style={props.css}
                    onClick={handleUpdateParamsButton}>
                {he.translate('ucnk_subc__modify_params_btn') + '\u2026'}
            </button>
        );
    };

    // ------------ <ResultsControls /> -------------------------------------

    const ResultsControls:React.SFC<{
        numErrors:number;
        totalSize:number;
        numConditions:number;
        currentSubcname:string;

    }> = (props) => {

        const handleCreateSubcorpClick = () => {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS',
                props: {}
            });
        };

        const handleSubcnameInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SET_SUBCNAME',
                props: {
                    value: evt.target.value
                }
            });
        };

        const renderDesc = () => {
            if (props.numErrors === 0) {
                return (
                    <span>
                        <img className="icon"
                                src={he.createStaticUrl('img/info-icon.svg')}
                                alt={he.translate('global__info_icon')} />
                        {he.translate('ucnk_subc__subc_found_{size}',
                            {size: he.formatNumber(props.totalSize)})}
                    </span>
                );

            } else if (props.numErrors === props.numConditions) {
                return (
                    <span>
                        <img className="icon"
                                src={he.createStaticUrl('img/error-icon.svg')}
                                alt={he.translate('global__error_icon')} />
                        {he.translate('ucnk_subc__subc_not_found')}
                    </span>
                );

            } else {
                return he.translate('ucnk_subc__subc_found_with_errors{size}{num_errors}',
                        {size: he.formatNumber(props.totalSize),
                        num_errors: props.numErrors});
            }
        };

        const renderControls = () => {
            if (props.numErrors < props.numConditions) {
                return (
                    <div>
                        <p>
                            <label>
                                {he.translate('ucnk_subcm__new_subc_name')}:{'\u00a0'}
                                <input type="text" value={props.currentSubcname}
                                        onChange={handleSubcnameInputChange} />
                            </label>
                        </p>
                        <button className="default-button" type="button"
                                onClick={handleCreateSubcorpClick}>
                            {he.translate('ucnk_subcm__create_subc')}
                        </button>
                        <ReenterArgsButton css={{display: 'inline-block', marginLeft: '0.7em'}} />
                    </div>
                );

            } else {
                return <div><ReenterArgsButton css={{}} /></div>;
            }
        };

        return (
            <div>
                <p className="desc">
                    {renderDesc()}
                </p>
                {renderControls()}
            </div>
        );
    };

    // ------------ <Controls /> -------------------------------------

    const Controls:React.SFC<{
        isWaiting:boolean;
        hasResults:boolean;
        totalSize:number;
        numErrors:number;
        numConditions:number;
        currentSubcname:string;
        usedAttributes:Immutable.Set<string>;
        setWaitingFn:()=>void;

    }> = (props) => {

        const handleCalculateCategoriesClick = () => {
            props.setWaitingFn();
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SUBMIT_TASK',
                props: {}
            });
        };

        const renderButtons = () => {
            if (props.isWaiting) {
                return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                            alt={he.translate('global__calculating')} />;

            } else if (props.hasResults) {
                return <ResultsControls
                            totalSize={props.totalSize}
                            numErrors={props.numErrors}
                            numConditions={props.numConditions}
                            currentSubcname={props.currentSubcname} />;

            } else {
                return (
                    <div>
                        {props.usedAttributes.size > 1 ?
                            (<p className="attr-warning">
                                <img className="warning" src={he.createStaticUrl('img/warning-icon.svg')}
                                        alt={he.translate('global__warning_icon')} />
                                {he.translate('ucnk_subc__multiple_attrs_mixing_warning{attrs}',
                                    {attrs: props.usedAttributes.toArray().join(', ')})}
                            </p>)
                            : null}
                        <button className="default-button" type="button"
                                onClick={handleCalculateCategoriesClick}>
                            {he.translate('ucnk_subcm__calculate')}
                        </button>
                    </div>
                );
            }
        };

        return (
            <div className="controls">
                {renderButtons()}
            </div>
        );
    };

    // ------------ <SubcMixer /> -------------------------------------

    class SubcMixer extends React.Component<{
        selectedValues:Immutable.List<SubcMixerExpression>;
        currentResults:CalculationResults;
        numErrors:number;
        currentSubcname:string;
        usedAttributes:Immutable.Set<string>;
        errorTolerance:number;
        alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
        closeClickHandler:()=>void;
    },
    {
        isWaiting: boolean;
    }> {

        constructor(props) {
            super(props);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._setWaiting = this._setWaiting.bind(this);
            this._handleErrorToleranceChange = this._handleErrorToleranceChange.bind(this);
            this.state = {isWaiting: false};
        }

        _handleModelChange() {
            this.setState({isWaiting: false});
        }

        _setWaiting() {
            this.setState({isWaiting: true});
        }

        _handleErrorToleranceChange(evt) {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SET_ERROR_TOLERANCE',
                props: {value: evt.target.value}
            });
        }

        componentDidMount() {
            subcMixerModel.addChangeListener(this._handleModelChange);
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_FETCH_CURRENT_SUBCNAME',
                props: {}
            });
        }

        componentWillUnmount() {
            subcMixerModel.removeChangeListener(this._handleModelChange);
        }

        _renderAlignedCorpInfo() {
            return (
                <p>
                    <img src={he.createStaticUrl('img/info-icon.svg')}
                            style={{width: '1em', marginRight: '0.3em', verticalAlign: 'middle'}}
                            alt={he.translate('global__info_icon')} />
                    {he.translate('ucnk_subcm__there_are_aligned_corpora_msg')}:{'\u00a0'}
                    <strong>{this.props.alignedCorpora.map(v => v.label).join(', ')}</strong>
                </p>
            );
        }

        render() {
            const hasResults = !!this.props.currentResults;
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.CloseableFrame onCloseClick={this.props.closeClickHandler}
                            customClass="subcmixer-widget"
                            label={he.translate('ucnk_subcm__widget_header')}>
                        <div>
                            {this.props.alignedCorpora.size > 0 ? this._renderAlignedCorpInfo() : null}
                            <ValuesTable items={this.props.selectedValues}
                                    currentResults={this.props.currentResults}
                                    hasResults={hasResults} />
                            <div className="error-tolerance-block">
                                <label>{he.translate('ucnk_subc__error_tolerance')}
                                :{'\u00a0\u00B1'}
                                <input type="text" value={this.props.errorTolerance}
                                        onChange={this._handleErrorToleranceChange} style={{width: '2em'}}
                                        className={'num' + (hasResults ? ' disabled' : '')}
                                        disabled={hasResults ? true : false} />
                                %
                                </label>
                            </div>
                            <Controls isWaiting={this.state.isWaiting}
                                    setWaitingFn={this._setWaiting}
                                    hasResults={!!this.props.currentResults}
                                    totalSize={this.props.currentResults ? this.props.currentResults['total'] : null}
                                    numErrors={this.props.numErrors}
                                    numConditions={this.props.selectedValues.size}
                                    currentSubcname={this.props.currentSubcname}
                                    usedAttributes={this.props.usedAttributes} />
                        </div>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );
        }
    }

    // ------------ <Widget /> -------------------------------------

    class Widget extends React.Component<WidgetProps, {
        useWidget:boolean;
        selectedValues:Immutable.List<SubcMixerExpression>;
        currentResults:CalculationResults;
        numErrors:number;
        currentSubcname:string;
        usedAttributes:Immutable.Set<string>;
        errorTolerance:number;
        alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
    }> {

        constructor(props) {
            super(props);
            this._handleTrigger = this._handleTrigger.bind(this);
            this._handleCloseWidget = this._handleCloseWidget.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
            this.state = {
                useWidget: false,
                selectedValues: subcMixerModel.getShares(),
                currentResults: subcMixerModel.getCurrentCalculationResults(),
                numErrors: subcMixerModel.getNumOfErrors(),
                currentSubcname: subcMixerModel.getCurrentSubcname(),
                usedAttributes: subcMixerModel.getUsedAttributes(),
                errorTolerance: subcMixerModel.getErrorTolerance(),
                alignedCorpora: subcMixerModel.getAlignedCorpora()
            };
        }

        _handleTrigger() {
            this.setState({
                useWidget: true,
                selectedValues: subcMixerModel.getShares(),
                currentResults: subcMixerModel.getCurrentCalculationResults(),
                currentSubcname: subcMixerModel.getCurrentSubcname(),
                usedAttributes: subcMixerModel.getUsedAttributes(),
                errorTolerance: subcMixerModel.getErrorTolerance(),
                alignedCorpora: subcMixerModel.getAlignedCorpora()
            });
        }

        _handleCloseWidget() {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_CLEAR_RESULT',
                props: {}
            });
            this.setState({
                useWidget: false,
                selectedValues: null,
                currentResults: null,
                numErrors: 0,
                currentSubcname: null,
                usedAttributes: null,
                errorTolerance: null,
                alignedCorpora: subcMixerModel.getAlignedCorpora()
            });
        }

        _handleModelChange() {
            this.setState({
                useWidget: this.state.useWidget,
                selectedValues: subcMixerModel.getShares(),
                currentResults: subcMixerModel.getCurrentCalculationResults(),
                numErrors: subcMixerModel.getNumOfErrors(),
                currentSubcname: subcMixerModel.getCurrentSubcname(),
                usedAttributes: subcMixerModel.getUsedAttributes(),
                errorTolerance: subcMixerModel.getErrorTolerance(),
                alignedCorpora: subcMixerModel.getAlignedCorpora()
            });
        }

        componentDidMount() {
            subcMixerModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            subcMixerModel.removeChangeListener(this._handleModelChange);
        }

        _renderButton() {
            if (this.props.isActive) {
                return (
                    <a className="trigger util-button"
                            title={he.translate('ucnk_subcm__set_shares')}
                            onClick={this._handleTrigger}>
                        {he.translate('ucnk_subcm__define_proportions')}
                    </a>
                );

            } else {
                return (
                    <span className="util-button disabled"
                            title={he.translate('ucnk_subcm__currently_disabled_refine_to_enable')}>
                        {he.translate('ucnk_subcm__define_proportions')}
                    </span>
                );
            }
        }

        render() {
            return (
                <div className="mixer-trigger">
                    {this._renderButton()}
                    {this.state.useWidget ?
                        <SubcMixer closeClickHandler={this._handleCloseWidget}
                                selectedValues={this.state.selectedValues}
                                currentResults={this.state.currentResults}
                                numErrors={this.state.numErrors}
                                currentSubcname={this.state.currentSubcname}
                                usedAttributes={this.state.usedAttributes}
                                errorTolerance={this.state.errorTolerance}
                                alignedCorpora={this.state.alignedCorpora} />
                        : null}
                </div>
            );
        }
    }

    return {
        Widget: Widget
    };

}
