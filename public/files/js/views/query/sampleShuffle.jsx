/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
import {init as inputInit} from './input';


export function init(dispatcher, mixins, sampleStore) {

    // ------------------------ <SampleForm /> --------------------------------

    const SampleForm = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                rlines: sampleStore.getRlinesValues().get(this.props.sampleId)
            };
        },

        _handleStoreChange : function (store, action) {
            this.setState({
                rlines: sampleStore.getRlinesValues().get(this.props.sampleId)
            })
        },

        _handleInputChange : function (evt) {
            dispatcher.dispatch({
                actionType: 'SAMPLE_FORM_SET_RLINES',
                props: {
                    sampleId: this.props.sampleId,
                    value: evt.target.value
                }
            });
        },

        _handleSubmitClick : function () {
            if (this.props.operationIdx !== undefined) {
                dispatcher.dispatch({
                    actionType: 'BRANCH_QUERY',
                    props: {operationIdx: this.props.operationIdx}
                });

            } else {
                dispatcher.dispatch({
                    actionType: 'SAMPLE_FORM_SUBMIT',
                    props: {sampleId: this.props.sampleId}
                });
            }
        },

        componentDidMount : function () {
            sampleStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            sampleStore.removeChangeListener(this._handleStoreChange);
        },

        render : function () {
            return (
                <form>
                    <p>{this.translate('query__create_sample_desc')}.</p>
                    <p>
                        {this.translate('query__create_sample_rlines_label')}:
                        {'\u00a0'}<input type="text" name="rlines" value={this.state.rlines} style={{width: '4em'}}
                                onChange={this._handleInputChange} />
                    </p>
                    <div className="buttons">
                        <button type="button" className="default-button"
                                onClick={this._handleSubmitClick}>
                            {this.translate('query__create_sample_submit_btn')}
                        </button>
                    </div>
                </form>
            );
        }
    });


    // ------------------------ <ShuffleForm /> --------------------------------

    const ShuffleForm = React.createClass({

        mixins : mixins,

        getInitialState : function () {
            return {
                isWarning: this.props.shuffleMinResultWarning <= this.props.lastOpSize,
                isAutoSubmit: this.props.shuffleMinResultWarning > this.props.lastOpSize
                                && this.props.operationIdx === undefined
            };
        },

        _renderWarningState : function () {
            return (
                <div>
                    <p>
                        <img src={this.createStaticUrl('img/warning-icon.svg')}
                                alt={this.translate('global__warning_icon')}
                                style={{verticalAlign: 'middle', marginRight: '0.4em'}} />
                        {this.translate('query__shuffle_large_data_warn')}
                    </p>
                    <button type="button" className="default-button"
                            onClick={()=>this.props.shuffleSubmitFn()}>
                        {this.translate('global__submit_anyway')}
                    </button>
                </div>
            );
        },

        _renderAutoSubmitState : function () {
            return <div><img src={this.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={this.translate('global__loading')} /></div>;
        },

        componentDidMount : function () {
            if (this.state.isAutoSubmit) {
                window.setTimeout(() => {
                    this.props.shuffleSubmitFn();
                }, 0);
            }
        },

        _renderContents : function () {
            if (this.state.isWarning) {
                return this._renderWarningState();

            } else if (this.state.isAutoSubmit) {
                return this._renderAutoSubmitState();

            } else {
                return <div>{this.translate('query__shuffle_form_no_params_to_change')}</div>;
            }
        },

        render : function () {
            return <form>{this._renderContents()}</form>;
        }
    });


    return {
        SampleFormView: SampleForm,
        ShuffleFormView: ShuffleForm
    }

}