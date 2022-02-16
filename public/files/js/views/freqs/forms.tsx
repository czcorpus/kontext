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

import * as Kontext from '../../types/kontext';
import { init as freqFormsFactory } from './regular/freqForms';
import { Actions as ActionsRF } from '../../models/freqs/regular/actions';
import { Actions as Actions2DF } from '../../models/freqs/twoDimension/actions';
import { init as ctFreqFormFactory } from './twoDimension/form';
import { init as dispersionFormFactory } from '../dispersion/form';
import { Freq2DFormModel } from '../../models/freqs/twoDimension/form';
import { MLFreqFormModel, TTFreqFormModel } from '../../models/freqs/regular/freqForms';
import { Actions as ActionsDp } from '../../models/dispersion/actions';


import * as S from './regular/style';
import { DispersionResultModel } from '../../models/dispersion/result';


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
        cTFreqFormModel:Freq2DFormModel,
        dispersionModel:DispersionResultModel
):FormsViews {

    const layoutViews = he.getLayoutViews();
    const ctFreqForm = ctFreqFormFactory(dispatcher, he, cTFreqFormModel);
    const freqForms = freqFormsFactory(dispatcher, he, ttFreqFormModel, mlFreqFormModel);
    const DispersionForm = dispersionFormFactory(dispatcher, he, dispersionModel);

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
            switch (this.state.formType) {
                case 'ml':
                    dispatcher.dispatch<typeof ActionsRF.MLSubmit>({
                        name: ActionsRF.MLSubmit.name
                    });
                break;
                case 'tt':
                    dispatcher.dispatch<typeof ActionsRF.TTSubmit>({
                        name: ActionsRF.TTSubmit.name
                    });
                break;
                case 'dp':
                    dispatcher.dispatch<typeof ActionsDp.SubmitForm>({
                        name: ActionsDp.SubmitForm.name,
                        payload: {
                            reloadPage: true
                        }
                    });
                break;
                case 'ct':
                    dispatcher.dispatch<typeof Actions2DF.FreqctFormSubmit>({
                        name: Actions2DF.FreqctFormSubmit.name
                    });
            }
        }

        render() {
            const items = [
                {id: 'ml', label: he.translate('freq__sel_form_type_ml')},
                {id: 'tt', label: he.translate('freq__sel_form_type_tt')},
                {id: 'dp', label: he.translate('freq__sel_form_type_dp')},
                {id: 'ct', label: he.translate('freq__sel_form_type_ct')}
            ];

            return (
                <S.FrequencyForm>
                    <form className="freq-form">
                        <layoutViews.TabView
                            className="FreqFormSelector"
                            defaultId={this.state.formType}
                            callback={this._handleFormSwitch}
                            items={items} >

                            <freqForms.MLFreqForm />
                            <freqForms.TTFreqForm />
                            <DispersionForm />
                            <ctFreqForm.CTFreqForm />
                        </layoutViews.TabView>

                        <div className="buttons">
                            <button className="default-button" type="button" onClick={this._handleSubmitClick}>
                                {he.translate('freq__make_freq_list_btn')}
                            </button>
                        </div>
                    </form>
                </S.FrequencyForm>
            );
        }
    }


    return {
        FrequencyForm
    };
}

