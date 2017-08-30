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

/// <reference path="../../vendor.d.ts/react.d.ts" />

import * as React from 'vendor/react';


export function init(dispatcher, he, sampleStore, switchMcStore) {

    // ------------------------ <SampleForm /> --------------------------------

    class SampleForm extends React.Component {

        constructor(props) {
            super(props);
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleSubmitEvent = this._handleSubmitEvent.bind(this);
            this.state = {
                rlines: sampleStore.getRlinesValues().get(this.props.sampleId)
            };
        }

        _handleStoreChange() {
            this.setState({
                rlines: sampleStore.getRlinesValues().get(this.props.sampleId)
            })
        }

        _handleInputChange(evt) {
            dispatcher.dispatch({
                actionType: 'SAMPLE_FORM_SET_RLINES',
                props: {
                    sampleId: this.props.sampleId,
                    value: evt.target.value
                }
            });
        }

        _handleSubmitEvent(evt) {
            if (evt.keyCode === undefined || evt.keyCode === 13) {
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
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        componentDidMount() {
            sampleStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            sampleStore.removeChangeListener(this._handleStoreChange);
        }

        render() {
            return (
                <form onKeyDown={this._handleSubmitEvent}>
                    <p>{he.translate('query__create_sample_desc')}.</p>
                    <p>
                        {he.translate('query__create_sample_rlines_label')}:
                        {'\u00a0'}<input type="text" name="rlines" value={this.state.rlines} style={{width: '4em'}}
                                onChange={this._handleInputChange} />
                    </p>
                    <div className="buttons">
                        <button type="button" className="default-button"
                                onClick={this._handleSubmitEvent}>
                            {he.translate('query__create_sample_submit_btn')}
                        </button>
                    </div>
                </form>
            );
        }
    }


    // ------------------------ <ShuffleForm /> --------------------------------

    class ShuffleForm extends React.Component {

        constructor(props) {
            super(props);

            this.state = {
                isWarning: this.props.shuffleMinResultWarning <= this.props.lastOpSize,
                isAutoSubmit: this.props.shuffleMinResultWarning > this.props.lastOpSize
                                && this.props.operationIdx === undefined
            };
        }

        _renderWarningState() {
            return (
                <div>
                    <p>
                        <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning_icon')}
                                style={{verticalAlign: 'middle', marginRight: '0.4em'}} />
                        {he.translate('query__shuffle_large_data_warn')}
                    </p>
                    <button type="button" className="default-button"
                            onClick={()=>this.props.shuffleSubmitFn()}>
                        {he.translate('global__submit_anyway')}
                    </button>
                </div>
            );
        }

        _renderAutoSubmitState() {
            return <div><img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                            alt={he.translate('global__loading')} /></div>;
        }

        _renderDefaultState() {
            return (
                <div>
                    <p>{he.translate('query__shuffle_form_no_params_to_change')}.</p>
                    <p>
                        <button type="button" className="default-button"
                                    onClick={()=>this.props.shuffleSubmitFn()}>
                            {he.translate('global__proceed')}
                        </button>
                    </p>
                </div>
            );
        }

        _renderContents() {
            if (this.state.isWarning) {
                return this._renderWarningState();

            } else if (this.state.isAutoSubmit) {
                return this._renderAutoSubmitState();

            } else {
                return this._renderDefaultState();
            }
        }

        componentDidMount() {
            if (this.state.isAutoSubmit) {
                window.setTimeout(() => {
                    this.props.shuffleSubmitFn();
                }, 0);
            }
        }

        render() {
            return <form>{this._renderContents()}</form>;
        }
    };

    /**
     *
     */
    class SwitchMainCorpFormView extends React.Component {

        constructor(props) {
            super(props);
            this.state = {maincorpValues: switchMcStore.getMainCorpValues()};
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleSubmitEvent = this._handleSubmitEvent.bind(this);
        }

        _handleStoreChange() {
            this.setState({maincorpValues: switchMcStore.getMainCorpValues()});
        }

        componentDidMount() {
            switchMcStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            switchMcStore.removeChangeListener(this._handleStoreChange);
        }

        _handleSubmitEvent(evt) {
            if (evt.keyCode === undefined || evt.keyCode === 13) {
                if (this.props.operationIdx !== undefined) {
                    dispatcher.dispatch({
                        actionType: 'BRANCH_QUERY',
                        props: {operationIdx: this.props.operationIdx}
                    });

                } else {
                    dispatcher.dispatch({
                        actionType: 'SWITCH_MC_FORM_SUBMIT',
                        props: {operationId: this.props.operationId}
                    });
                }
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        render() {
            return (
                <div>
                    <p>
                        <label>{he.translate('query__set_main_corp_to_label')}</label>:{'\u00a0'}
                        <input type="text" readOnly={true} value={this.state.maincorpValues.get(this.props.operationId)}
                                title={he.translate('query__value_cannot_be_changed')} />
                    </p>
                    <p>
                        <button type="button" className="default-button"
                                    onClick={this._handleSubmitEvent}>
                            {he.translate('global__proceed')}
                        </button>
                    </p>
                </div>
            );
        }
    }


    return {
        SampleFormView: SampleForm,
        ShuffleFormView: ShuffleForm,
        SwitchMainCorpFormView: SwitchMainCorpFormView
    };

}