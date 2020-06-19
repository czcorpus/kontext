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
import {Kontext} from '../types/common';
import {FormsViews as CollFormsViews} from './coll/forms';
import {FormsViews as FreqFormsViews} from './freqs/forms';
import { IActionDispatcher, IModel, BoundWithProps } from 'kombo';
import { Subscription } from 'rxjs';
import { MainMenuModelState } from '../models/mainMenu';


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
                case 'MAIN_MENU_SHOW_COLL_FORM':
                    return <collViews.CollForm />;
                case 'MAIN_MENU_SHOW_FREQ_FORM':
                    return <freqViews.FrequencyForm initialFreqFormVariant={this.props.initialFreqFormVariant} />;
            }
        }

        _getTitle() {
            switch ((this.props.activeItem || {actionName: null}).actionName) {
                case 'MAIN_MENU_SHOW_COLL_FORM':
                    return he.translate('coll__form_heading');
                case 'MAIN_MENU_SHOW_FREQ_FORM':
                    return he.translate('freq__h2_freq_distr');
                default:
                    return '?';
            }
        }

        _activeItemIsOurs() {
            const actions = ['MAIN_MENU_SHOW_COLL_FORM', 'MAIN_MENU_SHOW_FREQ_FORM'];
            return this.props.activeItem !== null
                    && actions.indexOf(this.props.activeItem.actionName) > -1;
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                name: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                payload: {}
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