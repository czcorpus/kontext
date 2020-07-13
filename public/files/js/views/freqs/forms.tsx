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
import { IActionDispatcher} from 'kombo';

import { Kontext} from '../../types/common';
import { MLFreqFormModel, TTFreqFormModel } from '../../models/freqs/freqForms';
import { init as freqFormsFactory } from './freqForms';
import { ActionName } from '../../models/freqs/actions';
import { init as ctFreqFormFactory } from './twoDimension/form';
import { Freq2DFormModel } from '../../models/freqs/twoDimension/form';

// -------------------------- exported component ----------

interface FrequencyFormProps {
    initialFreqFormVariant:string;
}

interface FrequencyFormState {
    formType:string;
}

export interface FormsViews {
    FrequencyForm:React.ComponentClass<FrequencyFormProps>;
}


export function init(
        dispatcher:IActionDispatcher,
        he:Kontext.ComponentHelpers,
        mlFreqFormModel:MLFreqFormModel,
        ttFreqFormModel:TTFreqFormModel,
        cTFreqFormModel:Freq2DFormModel):FormsViews {

    const layoutViews = he.getLayoutViews();
    const ctFreqForm = ctFreqFormFactory(dispatcher, he, cTFreqFormModel);
    const freqForms = freqFormsFactory(dispatcher, he, ttFreqFormModel, mlFreqFormModel);

    // ---------------------- <FrequencyForm /> ---------------------

    class FrequencyForm extends React.Component<FrequencyFormProps, FrequencyFormState> {

        constructor(props) {
            super(props);
            this.state = {formType: this.props.initialFreqFormVariant};
            this._handleSubmitClick = this._handleSubmitClick.bind(this);
            this._handleFormSwitch = this._handleFormSwitch.bind(this);
        }

        _handleFormSwitch(value) {
            this.setState({
                formType: value
            });
        }

        _handleSubmitClick() {
            const actions = {
                ml: ActionName.MLSubmit,
                tt: ActionName.TTSubmit,
                ct: 'FREQ_CT_SUBMIT'
            };
            dispatcher.dispatch({
                name: actions[this.state.formType],
                payload: {}
            });
        }

        render() {
            const items = [
                {id: 'ml', label: he.translate('freq__sel_form_type_ml')},
                {id: 'tt', label: he.translate('freq__sel_form_type_tt')},
                {id: 'ct', label: he.translate('freq__sel_form_type_ct')},
            ];

            return (
                <div className="FrequencyForm">
                    <form className="freq-form">
                        <layoutViews.TabView
                            className="FreqFormSelector"
                            defaultId={this.state.formType}
                            callback={this._handleFormSwitch}
                            items={items} >

                            <freqForms.MLFreqForm />
                            <freqForms.TTFreqForm />
                            <ctFreqForm.CTFreqForm />
                        </layoutViews.TabView>

                        <div className="buttons">
                            <button className="default-button" type="button" onClick={this._handleSubmitClick}>
                                {he.translate('freq__make_freq_list_btn')}
                            </button>
                        </div>
                    </form>
                </div>
            );
        }
    }


    return {
        FrequencyForm: FrequencyForm
    };
}

