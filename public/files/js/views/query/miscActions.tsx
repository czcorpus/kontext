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

import * as React from 'react';
import { IActionDispatcher, BoundWithProps } from 'kombo';

import * as Kontext from '../../types/kontext';
import { Keyboard, List, pipe } from 'cnc-tskit';
import { ConcSampleModel, ConcSampleModelState } from '../../models/query/sample';
import { SwitchMainCorpModel, SwitchMainCorpModelState } from '../../models/query/switchmc';
import { Actions } from '../../models/query/actions';


export interface SampleFormViews {
    SampleForm:React.ComponentClass<SampleFormProps>;
    ShuffleForm:React.ComponentClass<ShuffleFormProps>;
    SwitchMainCorpForm:React.ComponentClass<SwitchMainCorpFormProps>;
}

// ----------

export interface SampleFormProps {
    formType:Kontext.ConcFormTypes.SAMPLE;
    sampleId:string;
    operationIdx?:number;
}

// -----------

export interface ShuffleFormProps {
    formType:Kontext.ConcFormTypes.SHUFFLE;
    shuffleMinResultWarning:number;
    lastOpSize:number;
    opKey:string;
    operationIdx?:number;
}

export interface ShuffleFormState {
    isWarning:boolean;
    isAutoSubmit:boolean;
}

// ----------

export interface SwitchMainCorpFormProps {
    formType:Kontext.ConcFormTypes.SWITCHMC;
    operationIdx?:number;
    opKey:string;
}

// --------

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
        sampleModel:ConcSampleModel, switchMcModel:SwitchMainCorpModel):SampleFormViews {

    // ------------------------ <SampleForm /> --------------------------------

    class _SampleForm extends React.PureComponent<SampleFormProps & ConcSampleModelState> {

        constructor(props) {
            super(props);
            this._handleInputChange = this._handleInputChange.bind(this);
            this._handleSubmitEvent = this._handleSubmitEvent.bind(this);
        }

        _handleInputChange(evt) {
            dispatcher.dispatch<typeof Actions.SampleFormSetRlines>({
                name: Actions.SampleFormSetRlines.name,
                payload: {
                    sampleId: this.props.sampleId,
                    value: evt.target.value
                }
            });
        }

        _handleSubmitEvent(evt:React.MouseEvent<HTMLButtonElement>|React.KeyboardEvent<HTMLFormElement>) {
            if (evt['key'] === undefined || evt['key'] === Keyboard.Value.ENTER) {
                if (this.props.operationIdx !== undefined) {
                    dispatcher.dispatch<typeof Actions.BranchQuery>({
                        name: Actions.BranchQuery.name,
                        payload: {operationIdx: this.props.operationIdx}
                    });

                } else {
                    dispatcher.dispatch<typeof Actions.SampleFormSubmit>({
                        name: Actions.SampleFormSubmit.name,
                        payload: {sampleId: this.props.sampleId}
                    });
                }
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        render() {
            return (
                <form onKeyDown={this._handleSubmitEvent}>
                    <p>{he.translate('query__create_sample_desc')}.</p>
                    <p>
                        {he.translate('query__create_sample_rlines_label')}:
                        {'\u00a0'}<input type="text" name="rlines" value={this.props.rlinesValues[this.props.sampleId]} style={{width: '4em'}}
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

    const SampleForm = BoundWithProps<SampleFormProps, ConcSampleModelState>(_SampleForm, sampleModel);

    // ------------------------ <ShuffleForm /> --------------------------------

    class ShuffleForm extends React.Component<ShuffleFormProps, ShuffleFormState> {

        constructor(props) {
            super(props);

            this.state = {
                isWarning: this.props.shuffleMinResultWarning <= this.props.lastOpSize,
                isAutoSubmit: this.props.shuffleMinResultWarning > this.props.lastOpSize
                                && this.props.operationIdx === undefined
            };

            this.handleSubmit = this.handleSubmit.bind(this);
        }

        private handleSubmit(
            evt:undefined|React.MouseEvent<HTMLButtonElement>|React.KeyboardEvent<HTMLFormElement>
        ):void {
            if (!evt || evt['key'] === undefined || evt['key'] === Keyboard.Value.ENTER) {
                if (this.props.operationIdx !== undefined) {
                    dispatcher.dispatch<typeof Actions.BranchQuery>({
                        name: Actions.BranchQuery.name,
                        payload: {operationIdx: this.props.operationIdx}
                    });

                } else {
                    dispatcher.dispatch<typeof Actions.ShuffleFormSubmit>({
                        name: Actions.ShuffleFormSubmit.name,
                        payload: {
                            opKey: this.props.opKey
                        }
                    });
                }
                if (evt) {
                    evt.preventDefault();
                    evt.stopPropagation();
                }
            }
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
                            onClick={this.handleSubmit}>
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
                    <p>{he.translate('query__the_form_no_params_to_change')}.</p>
                    <p>
                        <button type="button" className="default-button"
                                    onClick={this.handleSubmit}>
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
                    this.handleSubmit(undefined);
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
    class _SwitchMainCorpForm extends React.PureComponent<SwitchMainCorpFormProps & SwitchMainCorpModelState> {

        constructor(props) {
            super(props);
            this._handleSubmitEvent = this._handleSubmitEvent.bind(this);
            this._handleValueChange = this._handleValueChange.bind(this);
        }

        _handleSubmitEvent(evt) {
            if (evt.key === undefined || evt.key === Keyboard.Value.ENTER) {
                if (this.props.operationIdx !== undefined) {
                    dispatcher.dispatch<typeof Actions.BranchQuery>({
                        name: Actions.BranchQuery.name,
                        payload: {operationIdx: this.props.operationIdx}
                    });

                } else {
                    dispatcher.dispatch<typeof Actions.SwitchMcFormSubmit>({
                        name: Actions.SwitchMcFormSubmit.name,
                        payload: {operationId: this.props.opKey}
                    });
                }
                evt.preventDefault();
                evt.stopPropagation();
            }
        }

        _handleValueChange(evt:React.ChangeEvent<HTMLSelectElement>) {
            dispatcher.dispatch<typeof Actions.ReplayChangeMainCorp>({
                name: Actions.ReplayChangeMainCorp.name,
                payload: {
                    sourceId: this.props.opKey,
                    value: evt.target.value
                }
            });
        }

        render() {
            return (
                <div>
                    <p>
                        <label>{he.translate('query__set_main_corp_to_label')}</label>:{'\u00a0'}
                        <select value={this.props.maincorpValues[this.props.opKey]} onChange={this._handleValueChange}>
                            {pipe(
                                this.props.corpora,
                                List.map(({n, label}) => <option value={n} key={n}>{label}</option>)
                            )}
                        </select>
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

    const SwitchMainCorpForm = BoundWithProps<SwitchMainCorpFormProps, SwitchMainCorpModelState>(_SwitchMainCorpForm, switchMcModel);

    return {
        SampleForm,
        ShuffleForm,
        SwitchMainCorpForm
    };

}