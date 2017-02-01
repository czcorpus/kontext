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


export function init(dispatcher, mixins, layoutViews, collViews, freqViews, mainMenuStore) {

    // ------------------------- <AnalysisFrame /> ---------------------------

    const AnalysisFrame = React.createClass({

        getInitialState : function () {
            return {
                activeItem: mainMenuStore.getActiveItem()
            }
        },

        _renderContents : function () {
            switch ((this.state.activeItem || {}).actionName) {
                case 'MAIN_MENU_SHOW_COLL_FORM':
                    return <collViews.CollForm />;
                case 'MAIN_MENU_SHOW_FREQ_FORM':
                    return <freqViews.FrequencyForm initialFreqFormVariant={this.props.initialFreqFormVariant} />;
            }
        },

        _activeItemIsOurs : function () {
            const actions = ['MAIN_MENU_SHOW_COLL_FORM', 'MAIN_MENU_SHOW_FREQ_FORM'];
            return this.state.activeItem !== null
                    && actions.indexOf(this.state.activeItem.actionName) > -1;
        },

        _handleStoreChange: function () {
            this.setState({
                activeItem: mainMenuStore.getActiveItem()
            });
        },

        _handleCloseClick : function () {
            dispatcher.dispatch({
                actionType: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                props: {}
            });
        },

        componentDidMount : function () {
            mainMenuStore.addChangeListener(this._handleStoreChange);
        },

        componentWillUnmount : function () {
            mainMenuStore.removeChangeListener(this._handleStoreChange);
        },

        render : function () {
            if (this._activeItemIsOurs()) {
                return (
                    <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                        <layoutViews.PopupBox onCloseClick={this._handleCloseClick}>
                            {this._renderContents()}
                        </layoutViews.PopupBox>
                    </layoutViews.ModalOverlay>
                );

            } else {
                return null;
            }
        }

    });


    return {
        AnalysisFrame: AnalysisFrame
    };


}