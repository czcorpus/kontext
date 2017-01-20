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


    return {
        SampleFormView: SampleForm
    }

}