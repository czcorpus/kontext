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

import React from 'vendor/react';
import $ from 'jquery';


export function init(dispatcher, mixins, layoutViews, subcMixerStore) {

    // ------------ <ValueShare /> -------------------------------------

    const ValueShare = React.createClass({

        mixins,

        _handleRatioValueChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SET_RATIO',
                props: {
                    attrName: this.props.attrName,
                    attrValue: this.props.attrValue,
                    ratio: evt.target.value
                }
            });
        },

        _renderEvalResult : function () {
            if (this.props.result) {
                const actualVal = this.props.result[1].toFixed(2);
                if (this.props.result[2] === true) {
                    return (
                        <span className="checked"
                            title={this.translate('ucnk_subc__condition_fulfilled_{actual_val}',
                                {actual_val: actualVal})}>
                            {'\u2713'}
                        </span>
                    );

                } else {
                    return (
                        <span className="crossed" title={this.translate(
                            'ucnk_subc__condition_failed_{actual_val}',
                            {actual_val: actualVal})}>{'\u2717'}
                        </span>
                    );
                }

            } else {
                return null;
            }
        },

        render : function () {
            return (
                <tr>
                    <td className="num">{this.props.rowId}.</td>
                    <td className="expression">
                        <strong>{this.props.attrName} = </strong>
                        {'\u0022' + this.props.attrValue + '\u0022'}
                    </td>
                    <td className="num">
                        <span>
                            <input type="text" className={'num' + (this.props.hasResults ? ' disabled' : '')}
                                    style={{width: '3em'}} value={this.props.ratio}
                                    disabled={this.props.hasResults ? true : false}
                                    onChange={this._handleRatioValueChange} />
                            <strong>%</strong>
                        </span>
                    </td>
                    <td className="status">
                        {this._renderEvalResult()}
                    </td>
                    <td className="num">
                        {this.props.baseRatio}<strong>%</strong>
                    </td>
                </tr>
            );
        }
    });

    // ------------ <ValuesTable /> -------------------------------------

    const ValuesTable = React.createClass({

        mixins : mixins,

        render : function () {
            return (
                <table className="data subcmixer-ratios">
                    <tbody>
                        <tr>
                            <th />
                            <th>{this.translate('ucnk_subc__ratios_th_expression')}</th>
                            <th>{this.translate('ucnk_subc__ratios_th_required_ratio')}</th>
                            <th>{this.translate('ucnk_subc__ratios_th_status')}</th>
                            <th>{this.translate('ucnk_subc__ratios_th_orig_ratio')}</th>
                        </tr>
                        {this.props.items.map((item, i) => (
                            <ValueShare key={i}
                                    rowId={i + 1}
                                    attrName={item.attrName}
                                    hasResults={this.props.hasResults}
                                    attrValue={item.attrValue}
                                    baseRatio={item.baseRatio}
                                    ratio={item.ratio}
                                    result={this.props.currentResults ? this.props.currentResults['attrs'].get(i) : null} />
                        ))}
                    </tbody>
                </table>
            );
        }
    });

    // ------------ <ReenterArgsButton /> -------------------------------------

    const ReenterArgsButton = React.createClass({

        mixins : mixins,

        _handleUpdateParamsButton : function () {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_CLEAR_RESULT',
                props: {}
            });
        },

        render : function () {
            return (
                <button className="default-button" type="button"
                        style={this.props.css}
                        onClick={this._handleUpdateParamsButton}>
                    {this.translate('ucnk_subc__modify_params_btn') + '\u2026'}
                </button>
            );
        }

    });

    // ------------ <ResultsControls /> -------------------------------------

    const ResultsControls = React.createClass({

        mixins : mixins,

        _handleCreateSubcorpClick : function () {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_CREATE_SUBCORPUS',
                props: {}
            });
        },

        _handleSubcnameInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SET_SUBCNAME',
                props: {
                    value: evt.target.value
                }
            });
        },

        _renderDesc : function () {
            if (this.props.numErrors === 0) {
                return (
                    <span>
                        <img className="icon"
                                src={this.createStaticUrl('img/info-icon.svg')}
                                alt={this.translate('global__info_icon')} />
                        {this.translate('ucnk_subc__subc_found_{size}',
                            {size: this.formatNumber(this.props.totalSize)})}
                    </span>
                );

            } else if (this.props.numErrors === this.props.numConditions) {
                return (
                    <span>
                        <img className="icon"
                                src={this.createStaticUrl('img/error-icon.svg')}
                                alt={this.translate('global__error_icon')} />
                        {this.translate('ucnk_subc__subc_not_found')}
                    </span>
                );

            } else {
                return this.translate('ucnk_subc__subc_found_with_errors{size}{num_errors}',
                        {size: this.formatNumber(this.props.totalSize),
                        num_errors: this.props.numErrors});
            }
        },

        _renderControls : function () {
            if (this.props.numErrors < this.props.numConditions) {
                return (
                    <div>
                        <p>
                            <label>
                                {this.translate('ucnk_subcm__new_subc_name')}:{'\u00a0'}
                                <input type="text" value={this.props.currentSubcname}
                                        onChange={this._handleSubcnameInputChange} />
                            </label>
                        </p>
                        <button className="default-button" type="button"
                                onClick={this._handleCreateSubcorpClick}>
                            {this.translate('ucnk_subcm__create_subc')}
                        </button>
                        <ReenterArgsButton css={{display: 'inline-block', marginLeft: '0.7em'}} />
                    </div>
                );

            } else {
                return <div><ReenterArgsButton /></div>;
            }
        },

        render : function () {
            return (
                <div>
                    <p className="desc">
                        {this._renderDesc()}
                    </p>
                    {this._renderControls()}
                </div>
            );
        }
    });

    // ------------ <Controls /> -------------------------------------

    const Controls = React.createClass({

        mixins : mixins,

        _handleCalculateCategoriesClick : function () {
            this.props.setWaitingFn();
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SUBMIT_TASK',
                props: {}
            });
        },

        _renderButtons : function () {
            if (this.props.isWaiting) {
                return <img src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                                            alt={this.translate('global__calculating')} />;

            } else if (this.props.hasResults) {
                return <ResultsControls
                            totalSize={this.props.totalSize}
                            numErrors={this.props.numErrors}
                            numConditions={this.props.numConditions}
                            currentSubcname={this.props.currentSubcname} />;

            } else {
                return (
                    <div>
                        {this.props.usedAttributes.size > 1 ?
                            (<p className="attr-warning">
                                <img className="warning" src={this.createStaticUrl('img/warning-icon.svg')}
                                        alt={this.translate('global__warning_icon')} />
                                {this.translate('ucnk_subc__multiple_attrs_mixing_warning{attrs}',
                                    {attrs: this.props.usedAttributes.toArray().join(', ')})}
                            </p>)
                            : null}
                        <button className="default-button" type="button"
                                onClick={this._handleCalculateCategoriesClick}>
                            {this.translate('ucnk_subcm__calculate')}
                        </button>
                    </div>
                );
            }
        },

        render : function () {
            return (
                <div className="controls">
                    {this._renderButtons()}
                </div>
            );
        }

    });

    // ------------ <SubcMixer /> -------------------------------------

    const SubcMixer = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {isWaiting: false};
        },

        _handleStoreChange : function () {
            this.setState({isWaiting: false});
        },

        _setWaiting : function () {
            this.setState({isWaiting: true});
        },

        componentDidMount : function () {
            subcMixerStore.addChangeListener(this._handleStoreChange);
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_FETCH_CURRENT_SUBCNAME',
                props: {}
            });
        },

        _handleErrorToleranceChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'UCNK_SUBCMIXER_SET_ERROR_TOLERANCE',
                props: {value: evt.target.value}
            });
        },

        componentWillUnmount : function () {
            subcMixerStore.removeChangeListener(this._handleStoreChange);
        },

        render : function () {
            const hasResults = !!this.props.currentResults;
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.CloseableFrame onCloseClick={this.props.closeClickHandler}
                            customClass="subcmixer-widget"
                            label={this.translate('ucnk_subcm__widget_header')}>
                        <div>
                            <ValuesTable items={this.props.selectedValues}
                                    currentResults={this.props.currentResults}
                                    hasResults={hasResults} />
                            <div className="error-tolerance-block">
                                <label>{this.translate('ucnk_subc__error_tolerance')}
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
    });

    // ------------ <Widget /> -------------------------------------

    const Widget = React.createClass({

        mixins : mixins,

        _handleTrigger : function () {
            this.setState({
                useWidget: true,
                selectedValues: subcMixerStore.getShares(),
                currentResults: subcMixerStore.getCurrentCalculationResults(),
                currentSubcname: subcMixerStore.getCurrentSubcname(),
                usedAttributes: subcMixerStore.getUsedAttributes(),
                errorTolerance: subcMixerStore.getErrorTolerance()
            });
        },

        _handleCloseWidget : function () {
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
                errorTolerance: null
            });
        },

        getInitialState : function () {
            return {
                useWidget: false,
                selectedValues: subcMixerStore.getShares(),
                currentResults: subcMixerStore.getCurrentCalculationResults(),
                numErrors: subcMixerStore.getNumOfErrors(),
                currentSubcname: subcMixerStore.getCurrentSubcname(),
                usedAttributes: subcMixerStore.getUsedAttributes(),
                errorTolerance: subcMixerStore.getErrorTolerance()
            };
        },

        _handleStoreChange : function () {
            this.setState({
                useWidget: this.state.useWidget,
                selectedValues: subcMixerStore.getShares(),
                currentResults: subcMixerStore.getCurrentCalculationResults(),
                numErrors: subcMixerStore.getNumOfErrors(),
                currentSubcname: subcMixerStore.getCurrentSubcname(),
                usedAttributes: subcMixerStore.getUsedAttributes(),
                errorTolerance: subcMixerStore.getErrorTolerance()
            });
        },

        componentDidMount : function () {
            subcMixerStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            subcMixerStore.removeChangeListener(this._handleStoreChange);
        },

        _renderButton : function () {
            if (this.props.isActive) {
                return (
                    <a className="trigger util-button"
                            title={this.translate('ucnk_subcm__set_shares')}
                            onClick={this._handleTrigger}>
                        {this.translate('ucnk_subcm__define_proportions')}
                    </a>
                );

            } else {
                return (
                    <span className="util-button disabled"
                            title={this.translate('ucnk_subcm__currently_disabled_refine_to_enable')}>
                        {this.translate('ucnk_subcm__define_proportions')}
                    </span>
                );
            }
        },

        render : function () {
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
                                errorTolerance={this.state.errorTolerance} />
                        : null}
                </div>
            );
        }
    });

    return {
        Widget: Widget
    };

}
