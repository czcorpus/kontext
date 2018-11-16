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
import {init as subcorpViewsInit} from '../../views/subcorp/forms';
import {PluginInterfaces} from '../../types/plugins';
import { SubcorpFormModel } from '../../models/subcorp/form';


export interface WidgetProps {
    isActive:boolean;
}


export interface Views {
    Widget:React.ComponentClass<WidgetProps>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers,
            subcMixerModel:SubcMixerModel, subcFormModel:PluginInterfaces.SubcMixer.ISubcorpFormModel):Views {

    const layoutViews = he.getLayoutViews();
    const subcFormViews = subcorpViewsInit({
        dispatcher: dispatcher,
        he: he,
        CorparchComponent: null,
        subcorpFormModel: null,
        subcorpWithinFormModel: null
    });

    // ------------ <CalculatedRatio /> -------------------------------------

    const CalculatedRatio:React.SFC<{
        ratio:number;
        success:boolean;
        limit:number;

    }> = (props) => {
        return <>
            {props.success ?
                null :
                <img className="warning" src={he.createStaticUrl('img/warning-icon.svg')} alt={he.translate('global__warning_icon')}
                            title={he.translate('ucnk_subc__condition_failed_{limit}', {limit: props.limit})}/>
            }
            <strong>{he.formatNumber(props.ratio, 1) + '%'}</strong>
        </>;
    }

    // ------------ <ValueShare /> -------------------------------------

    const ValueShare:React.SFC<{
        rowId:number;
        hasResults:boolean;
        attrName:string;
        attrValue:string;
        baseRatio:string;
        ratio:string;
        result:[string, number, boolean];
        ratioLimitPercent:number;

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

        return (
            <tr className="ucnkSyntaxViewer_ValueShare">
                <td className="num">{props.rowId}.</td>
                <td className="expression">
                    <strong>{props.attrName} = </strong>
                    {'\u0022' + props.attrValue + '\u0022'}
                </td>
                <td className="num">
                    {props.baseRatio}<strong>%</strong>
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
                    {props.result ? <CalculatedRatio success={props.result[2]} limit={props.ratioLimitPercent}
                                                ratio={props.result[1]} /> : <span>-</span>}
                </td>
            </tr>
        );
    };

    // ------------ <ValuesTable /> -------------------------------------

    const ValuesTable:React.SFC<{
        currentResults:CalculationResults;
        hasResults:boolean;
        items:Immutable.List<SubcMixerExpression>;
        ratioLimitPercent:number;

    }> = (props) => {

        return (
            <table className="data subcmixer-ratios">
                <tbody>
                    <tr>
                        <th />
                        <th>{he.translate('ucnk_subc__ratios_th_expression')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_orig_ratio')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_required_ratio')}</th>
                        <th>{he.translate('ucnk_subc__ratios_th_calculated_ratio')}</th>
                    </tr>
                    {props.items.map((item, i) => (
                        <ValueShare key={i}
                                rowId={i + 1}
                                attrName={item.attrName}
                                hasResults={props.hasResults}
                                attrValue={item.attrValue}
                                baseRatio={item.baseRatio}
                                ratio={item.ratio}
                                result={props.currentResults ? props.currentResults['attrs'].get(i) : null}
                                ratioLimitPercent={props.ratioLimitPercent} />
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
        currentSubcname:Kontext.FormValue<string>;
        isPublic:boolean;
        description:Kontext.FormValue<string>;

    }> = (props) => {

        const handleCreateSubcorpClick = () => {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS',
                props: {}
            });
        };

        const handleSubcnameInputChange = (evt) => {
            dispatcher.dispatch({
                actionType: 'SUBCORP_FORM_SET_SUBCNAME',
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
                return he.translate('ucnk_subc__subc_found_with_errors{size}',
                        {size: he.formatNumber(props.totalSize)});
            }
        };

        const renderControls = () => {
            if (props.numErrors < props.numConditions) {
                return (
                    <div>
                        <p>
                            <label>
                                {he.translate('ucnk_subcm__new_subc_name')}:{'\u00a0'}
                                <layoutViews.ValidatedItem invalid={props.currentSubcname.isInvalid}>
                                    <input type="text" value={props.currentSubcname.value}
                                            onChange={handleSubcnameInputChange} />
                                </layoutViews.ValidatedItem>
                            </label>
                        </p>
                        <div>
                            {he.translate('subcform__set_as_public')}:
                            <layoutViews.InlineHelp customStyle={{width: '20em'}} noSuperscript={true}>
                                <p>{he.translate('subcform__publication_notes')}</p>
                                <p>{he.translate('subcform__publication_notes_2')}</p>
                            </layoutViews.InlineHelp>
                            <subcFormViews.SubcNamePublicCheckbox value={props.isPublic} />
                            {props.isPublic ?
                                (<div>
                                    <h3>{he.translate('subcform__public_description')}:</h3>
                                    <div>
                                        <subcFormViews.SubcDescription
                                            value={props.description} />
                                    </div>
                                </div>) : null
                            }
                        </div>
                        <p>
                            <button className="default-button" type="button"
                                    onClick={handleCreateSubcorpClick}>
                                {he.translate('ucnk_subcm__create_subc')}
                            </button>
                            <ReenterArgsButton css={{display: 'inline-block', marginLeft: '0.7em'}} />
                        </p>
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
        currentSubcname:Kontext.FormValue<string>;
        usedAttributes:Immutable.Set<string>;
        isPublic:boolean;
        description:Kontext.FormValue<string>;

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
                            currentSubcname={props.currentSubcname}
                            isPublic={props.isPublic}
                            description={props.description} />;

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
        currentSubcname:Kontext.FormValue<string>;
        usedAttributes:Immutable.Set<string>;
        alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
        ratioLimitPercent:number;
        closeClickHandler:()=>void;
    },
    {
        isWaiting:boolean;
        isPublic:boolean;
        description:Kontext.FormValue<string>;
    }> {

        constructor(props) {
            super(props);
            this._handleModelChange = this._handleModelChange.bind(this);
            this._setWaiting = this._setWaiting.bind(this);
            this.state = {
                isWaiting: false,
                isPublic: subcFormModel.getIsPublic(),
                description: subcFormModel.getDescription()
            };
        }

        _handleModelChange() {
            this.setState({
                isWaiting: false,
                isPublic: subcFormModel.getIsPublic(),
                description: subcFormModel.getDescription()
            });
        }

        _setWaiting() {
            this.setState({
                isWaiting: true,
                isPublic: subcFormModel.getIsPublic(),
                description: subcFormModel.getDescription()
            });
        }

        componentDidMount() {
            subcMixerModel.addChangeListener(this._handleModelChange);
            subcFormModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            subcMixerModel.removeChangeListener(this._handleModelChange);
            subcFormModel.removeChangeListener(this._handleModelChange);
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
                                    hasResults={hasResults}
                                    ratioLimitPercent={this.props.ratioLimitPercent} />
                            <Controls isWaiting={this.state.isWaiting}
                                    setWaitingFn={this._setWaiting}
                                    hasResults={!!this.props.currentResults}
                                    totalSize={this.props.currentResults ? this.props.currentResults['total'] : null}
                                    numErrors={this.props.numErrors}
                                    numConditions={this.props.selectedValues.size}
                                    currentSubcname={this.props.currentSubcname}
                                    usedAttributes={this.props.usedAttributes}
                                    isPublic={this.state.isPublic}
                                    description={this.state.description} />
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
        currentSubcname:Kontext.FormValue<string>;
        usedAttributes:Immutable.Set<string>;
        alignedCorpora:Immutable.List<TextTypes.AlignedLanguageItem>;
        ratioLimitPercent:number;
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
                currentSubcname: subcFormModel.getSubcName(),
                usedAttributes: subcMixerModel.getUsedAttributes(),
                alignedCorpora: subcMixerModel.getAlignedCorpora(),
                ratioLimitPercent: subcMixerModel.getRatioLimitPercent()
            };
        }

        _handleTrigger() {
            this.setState({
                useWidget: true,
                selectedValues: subcMixerModel.getShares(),
                currentResults: subcMixerModel.getCurrentCalculationResults(),
                currentSubcname: subcFormModel.getSubcName(),
                usedAttributes: subcMixerModel.getUsedAttributes(),
                alignedCorpora: subcMixerModel.getAlignedCorpora(),
                ratioLimitPercent: subcMixerModel.getRatioLimitPercent()
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
                alignedCorpora: subcMixerModel.getAlignedCorpora()
            });
        }

        _handleModelChange() {
            this.setState({
                useWidget: this.state.useWidget,
                selectedValues: subcMixerModel.getShares(),
                currentResults: subcMixerModel.getCurrentCalculationResults(),
                numErrors: subcMixerModel.getNumOfErrors(),
                currentSubcname: subcFormModel.getSubcName(),
                usedAttributes: subcMixerModel.getUsedAttributes(),
                alignedCorpora: subcMixerModel.getAlignedCorpora(),
                ratioLimitPercent: subcMixerModel.getRatioLimitPercent()
            });
        }

        componentDidMount() {
            subcMixerModel.addChangeListener(this._handleModelChange);
            subcFormModel.addChangeListener(this._handleModelChange);
        }

        componentWillUnmount() {
            subcMixerModel.removeChangeListener(this._handleModelChange);
            subcFormModel.removeChangeListener(this._handleModelChange);
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
                                alignedCorpora={this.state.alignedCorpora}
                                ratioLimitPercent={this.state.ratioLimitPercent} />
                        : null}
                </div>
            );
        }
    }

    return {
        Widget: Widget
    };

}
