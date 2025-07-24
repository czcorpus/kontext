/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import * as Kontext from '../../types/kontext.js';
import { init as freqFormsFactory } from './regular/freqForms.js';
import { Actions as ActionsRF } from '../../models/freqs/regular/actions.js';
import { Actions as Actions2DF } from '../../models/freqs/twoDimension/actions.js';
import { init as ctFreqFormFactory } from './twoDimension/form.js';
import { init as dispersionFormFactory } from '../dispersion/form.js';
import { Freq2DFormModel } from '../../models/freqs/twoDimension/form.js';
import { MLFreqFormModel, TTFreqFormModel } from '../../models/freqs/regular/freqForms.js';
import { Actions as ActionsDp } from '../../models/dispersion/actions.js';


import * as S from './regular/style.js';
import { DispersionResultModel } from '../../models/dispersion/result.js';


// -------------------------- exported component ----------

interface FrequencyFormProps {
    initialFreqFormVariant:Kontext.FreqModuleType;
}

interface FrequencyFormState {
    formType:Kontext.FreqModuleType;
}

export interface FormsViews {
    FrequencyForm:React.FC<FrequencyFormProps>;
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

    const FrequencyForm:React.FC<FrequencyFormProps> = (props) => {

        const [state, updateState] = React.useState<FrequencyFormState>({
            formType: props.initialFreqFormVariant
        });

        const items:Array<{id:Kontext.FreqModuleType; label:string}> = [
            {id: 'tokens', label: he.translate('freq__sel_form_type_ml')},
            {id: 'text-types', label: he.translate('freq__sel_form_type_tt')},
            {id: 'dispersion', label: he.translate('freq__sel_form_type_dp')},
            {id: '2-attribute', label: he.translate('freq__sel_form_type_ct')}
        ];

        const handleFormSwitch = (value) => {
            updateState({
                formType: value
            });
        };

        const handleSubmitClick = () => {
            switch (state.formType) {
                case 'tokens':
                    dispatcher.dispatch<typeof ActionsRF.MLSubmit>({
                        name: ActionsRF.MLSubmit.name
                    });
                break;
                case 'text-types':
                    dispatcher.dispatch<typeof ActionsRF.TTSubmit>({
                        name: ActionsRF.TTSubmit.name
                    });
                break;
                case '2-attribute':
                    dispatcher.dispatch<typeof Actions2DF.FreqctFormSubmit>({
                        name: Actions2DF.FreqctFormSubmit.name
                    });
                    break;
                case 'dispersion':
                    dispatcher.dispatch<typeof ActionsDp.SubmitForm>({
                        name: ActionsDp.SubmitForm.name,
                        payload: {reloadPage: true}
                    });
            }
        };

        return (
            <S.FrequencyForm>
                <form className="freq-form">
                    <layoutViews.TabView
                        className="FreqFormSelector"
                        defaultId={state.formType}
                        callback={handleFormSwitch}
                        items={items} >

                        <freqForms.MLFreqForm />
                        <freqForms.TTFreqForm />
                        <DispersionForm />
                        <ctFreqForm.CTFreqForm />
                    </layoutViews.TabView>

                    <div className="buttons">
                        <button className="default-button" type="button" onClick={handleSubmitClick}>
                            {he.translate('freq__make_freq_list_btn')}
                        </button>
                    </div>
                </form>
            </S.FrequencyForm>
        );
    }


    return {
        FrequencyForm
    };
}

