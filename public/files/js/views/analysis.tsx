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
import { List } from 'cnc-tskit';

import * as Kontext from '../types/kontext.js';
import { FormsViews as CollFormsViews } from './coll/forms.js';
import { FormsViews as FreqFormsViews } from './freqs/forms.js';
import { IActionDispatcher, IModel, BoundWithProps } from 'kombo';
import { MainMenuModelState } from '../models/mainMenu/index.js';
import { Actions as MainMenuActions } from '../models/mainMenu/actions.js';
import * as S from './style.js';


export interface AnalysisModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    collViews:CollFormsViews;
    freqViews:FreqFormsViews;
    mainMenuModel:IModel<MainMenuModelState>;
}

export interface AnalysisFrameProps {
    initialFreqFormVariant:Kontext.FreqModuleType;
    concHasAdhocQuery:boolean;
}

export interface FormsViews {
    AnalysisFrame:React.ComponentClass<AnalysisFrameProps>;
}


export function init({dispatcher, he, collViews, freqViews,
            mainMenuModel}:AnalysisModuleArgs):FormsViews {

    const layoutViews = he.getLayoutViews();

    // ------------------------- <AnalysisFrame /> ---------------------------

    const AnalysisFrame:React.FC<AnalysisFrameProps & MainMenuModelState> = (props) => {

        const renderContents = () => {
            switch ((props.activeItem || {actionName: null}).actionName) {
                case MainMenuActions.ShowCollForm.name:
                    return <collViews.CollForm />;
                case MainMenuActions.ShowFreqForm.name:
                    return <freqViews.FrequencyForm initialFreqFormVariant={props.initialFreqFormVariant} />;
            }
        };

        const getTitle = () => {
            switch ((props.activeItem || {actionName: null}).actionName) {
                case MainMenuActions.ShowCollForm.name:
                    return he.translate('coll__form_heading');
                case MainMenuActions.ShowFreqForm.name:
                    return he.translate('freq__h2_freq_distr');
                default:
                    return '?';
            }
        };

        const activeItemIsOurs = () => {
            const actions = [
                MainMenuActions.ShowCollForm.name,
                MainMenuActions.ShowFreqForm.name
            ];
            return props.activeItem !== null
                    && List.some(v => v === props.activeItem.actionName, actions);
        };

        const handleCloseClick = () => {
            dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
                name: MainMenuActions.ClearActiveItem.name
            });
        };

        if (activeItemIsOurs()) {
            return (
                <layoutViews.ModalOverlay onCloseKey={handleCloseClick}>
                    <layoutViews.CloseableFrame onCloseClick={handleCloseClick}
                            label={getTitle()} scrollable={true}>
                        <S.AnalysisFrame>
                            {renderContents()}

                            {props.concHasAdhocQuery ?
                                <S.AdhocSubcWarning>
                                    <layoutViews.StatusIcon status="warning" />
                                    <p>
                                        {he.translate('global__concordance_is_based_on_adhoc_subc_warning')}
                                    </p>
                                </S.AdhocSubcWarning> :
                                null
                            }
                        </S.AnalysisFrame>
                    </layoutViews.CloseableFrame>
                </layoutViews.ModalOverlay>
            );

        } else {
            return null;
        }
    }

    const BoundAnalysisFrame = BoundWithProps<AnalysisFrameProps, MainMenuModelState>(
        AnalysisFrame, mainMenuModel);

    return {
        AnalysisFrame: BoundAnalysisFrame
    };
}