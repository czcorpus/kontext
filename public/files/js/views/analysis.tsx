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
import { Kontext } from '../types/common';
import { FormsViews as CollFormsViews } from './coll/forms';
import { FormsViews as FreqFormsViews } from './freqs/forms';
import { IActionDispatcher, IModel, BoundWithProps } from 'kombo';
import { MainMenuModelState } from '../models/mainMenu';
import { Actions as MMActions, ActionName as MMActionName } from '../models/mainMenu/actions';
import { List } from 'cnc-tskit';

export interface AnalysisModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    collViews:CollFormsViews;
    freqViews:FreqFormsViews;
    mainMenuModel:IModel<MainMenuModelState>;
}

export interface AnalysisFrameProps {
    initialFreqFormVariant:string;
}

export interface FormsViews {
    AnalysisFrame:React.ComponentClass<AnalysisFrameProps>;
}


export function init({dispatcher, he, collViews, freqViews,
            mainMenuModel}:AnalysisModuleArgs):FormsViews {

    const layoutViews = he.getLayoutViews();

    // ------------------------- <AnalysisFrame /> ---------------------------

    class AnalysisFrame extends React.PureComponent<AnalysisFrameProps & MainMenuModelState> {

        constructor(props) {
            super(props);
            this._handleCloseClick = this._handleCloseClick.bind(this);
        }

        _renderContents() {
            switch ((this.props.activeItem || {actionName: null}).actionName) {
                case MMActionName.ShowCollForm:
                    return <collViews.CollForm />;
                case MMActionName.ShowFreqForm:
                    return <freqViews.FrequencyForm initialFreqFormVariant={this.props.initialFreqFormVariant} />;
            }
        }

        _getTitle() {
            switch ((this.props.activeItem || {actionName: null}).actionName) {
                case MMActionName.ShowCollForm:
                    return he.translate('coll__form_heading');
                case MMActionName.ShowFreqForm:
                    return he.translate('freq__h2_freq_distr');
                default:
                    return '?';
            }
        }

        _activeItemIsOurs() {
            const actions = [
                MMActionName.ShowCollForm,
                MMActionName.ShowFreqForm
            ];
            return this.props.activeItem !== null
                    && List.some(v => v === this.props.activeItem.actionName, actions);
        }

        _handleCloseClick() {
            dispatcher.dispatch<MMActions.ClearActiveItem>({
                name: MMActionName.ClearActiveItem
            });
        }

        render() {
            if (this._activeItemIsOurs()) {
                return (
                    <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                        <layoutViews.CloseableFrame onCloseClick={this._handleCloseClick}
                                label={this._getTitle()} scrollable={true}>
                            {this._renderContents()}
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay>
                );

            } else {
                return null;
            }
        }
    }

    const BoundAnalysisFrame = BoundWithProps<AnalysisFrameProps, MainMenuModelState>(AnalysisFrame, mainMenuModel);

    return {
        AnalysisFrame: BoundAnalysisFrame
    };
}