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
                if (this.props.result[2] === true) {
                    return <span className="checked">{'\u2713'}</span>;

                } else {
                    return <span className="crossed" title={this.props.result[1].toFixed(2)}>!</span>;
                }

            } else {
                return null;
            }
        },

        render : function () {
            return (
                <tr>
                    <td className="num">{`${this.props.rowId})`}</td>
                    <td className="expression">
                        <strong>{this.props.attrName} = </strong>
                        {'\u0022' + this.props.attrValue + '\u0022'}:
                    </td>
                    <td>
                        <span>
                            <input type="text" style={{width: '3em'}}
                                value={this.props.ratio}
                                onChange={this._handleRatioValueChange} />
                            <strong>%</strong>
                        </span>
                    </td>
                    <td>
                        {this._renderEvalResult()}
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
                <table>
                    <tbody>
                        {this.props.items.map((item, i) => (
                            <ValueShare key={i} rowId={i + 1} attrName={item.attrName}
                                    attrValue={item.attrValue} ratio={item.ratio}
                                    result={this.props.currentResults ? this.props.currentResults['attrs'].get(i) : null} />
                        ))}
                    </tbody>
                </table>
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

        _renderButtons : function () {
            if (this.props.isWaiting) {
                return <img src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                                            alt={this.translate('global__calculating')} />;

            } else if (this.props.hasResults) {
                return (
                    <div>
                        <p>
                            <label>
                                {this.translate('ucnk_subcm__new_subc_name')}:{'\u00a0'}
                                <input type="text" value={this.props.currentSubcname}
                                        onChange={this._handleSubcnameInputChange} />
                            </label>
                        </p>
                        <p>
                            <button className="default-button" type="button"
                                    onClick={this._handleCreateSubcorpClick}>
                                {this.translate('ucnk_subcm__create_subc')}
                            </button>
                        </p>
                    </div>
                );

            } else {
                return (
                    <button className="default-button" type="button"
                            onClick={this._handleCalculateCategoriesClick}>
                        {this.translate('ucnk_subcm__calculate')}
                    </button>
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

        componentWillUnmount : function () {
            subcMixerStore.removeChangeListener(this._handleStoreChange);
        },

        render : function () {
            return (
                <layoutViews.ModalOverlay onCloseKey={this.props.closeClickHandler}>
                    <layoutViews.PopupBox customClass="subcmixer-widget"
                            onCloseClick={this.props.closeClickHandler}>
                        <div>
                            <h3>{this.translate('ucnk_subcm__widget_header')}</h3>
                            <ValuesTable items={this.props.selectedValues}
                                    currentResults={this.props.currentResults} />
                            <Controls isWaiting={this.state.isWaiting}
                                    setWaitingFn={this._setWaiting}
                                    hasResults={!!this.props.currentResults}
                                    currentSubcname={this.props.currentSubcname} />
                        </div>
                    </layoutViews.PopupBox>
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
                currentSubcname: subcMixerStore.getCurrentSubcname()
            });
        },

        _handleCloseWidget : function () {
            this.setState({
                useWidget: false,
                selectedValues: null,
                currentResults: null,
                currentSubcname: null
            });
        },

        getInitialState : function () {
            return {
                useWidget: false,
                selectedValues: subcMixerStore.getShares(),
                currentResults: subcMixerStore.getCurrentCalculationResults(),
                currentSubcname: subcMixerStore.getCurrentSubcname()
            };
        },

        _handleStoreChange : function () {
            this.setState({
                useWidget: this.state.useWidget,
                selectedValues: subcMixerStore.getShares(),
                currentResults: subcMixerStore.getCurrentCalculationResults(),
                currentSubcname: subcMixerStore.getCurrentSubcname()
            });
        },

        componentDidMount : function () {
            subcMixerStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            subcMixerStore.removeChangeListener(this._handleStoreChange);
        },

        render : function () {
            return (
                <div className="mixer-trigger step-block">
                    <table className="step">
                        <tbody>
                            <tr>
                                <td className="num">?</td>
                                <td>
                                    <a className="trigger" title={this.translate('ucnk_subcm__set_shares')}
                                            onClick={this._handleTrigger}>
                                        <img src={this.createStaticUrl('js/plugins/ucnkSubcmixer/mixer.svg')} />
                                    </a>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    {this.state.useWidget ?
                        <SubcMixer closeClickHandler={this._handleCloseWidget}
                                selectedValues={this.state.selectedValues}
                                currentResults={this.state.currentResults}
                                currentSubcname={this.state.currentSubcname} />
                        : null}
                </div>
            );
        }
    });

    return {
        Widget: Widget
    };

}
