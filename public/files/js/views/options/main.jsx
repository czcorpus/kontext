/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

 /// <reference path="../../../ts/declarations/react.d.ts" />

import * as React from 'vendor/react';
import {init as generalViewsInit} from './general';
import {init as structsAttrsViewsInit} from './structsAttrs';


export function init(dispatcher, helpers, layoutViews, generalOptionsStore, viewOptionsStore, mainMenuStore) {

    const generalOptionsViews = generalViewsInit(dispatcher, helpers, layoutViews, generalOptionsStore);
    const structsAttrsOptionsViews = structsAttrsViewsInit(dispatcher, helpers, layoutViews, viewOptionsStore, mainMenuStore);

    class OptionsContainer extends React.Component {

        constructor(props) {
            super(props);
            this.state = this._fetchStoreState();
            this._handleStoreChange = this._handleStoreChange.bind(this);
            this._handleStoreChange = this._handleStoreChange.bind(this);
        }

        _fetchStoreState() {
            return {
                activeItem: mainMenuStore.getActiveItem(),
                corpusIdent: viewOptionsStore.getCorpusIdent()
            };
        }

        _handleStoreChange() {
            this.setState(this._fetchStoreState());
        }

        _isActiveItem(itemName) {
            return this.state.activeItem && this.state.activeItem.actionName === itemName;
        }

        _isActive() {
            return this._isActiveItem('MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS')
                || this._isActiveItem('MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS');
        }

        _handleCloseClick() {
            dispatcher.dispatch({
                actionType: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                props: {}
            });
        }

        componentDidMount() {
             mainMenuStore.addChangeListener(this._handleStoreChange);
        }

        componentWillUnmount() {
            mainMenuStore.removeChangeListener(this._handleStoreChange);
        }

        _renderForm() {
            if (this._isActiveItem('MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS')) {
                return <structsAttrsOptionsViews.StructAttrsViewOptions />;

            } else if (this._isActiveItem('MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS')) {
                return <generalOptionsViews.GeneralOptions />;

            } else {
                return <div></div>;
            }
        }

        _renderTitle() {
            if (this._isActiveItem('MAIN_MENU_SHOW_ATTRS_VIEW_OPTIONS')) {
                return helpers.translate('options__settings_apply_only_for_{corpname}', {corpname: this.state.corpusIdent.name})

            } else if (this._isActiveItem('MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS')) {
                return helpers.translate('options__general_options_heading');

            } else {
                return <div></div>;
            }
        }

        render() {
            if (this._isActive()) {
                return (
                    <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                        <layoutViews.CloseableFrame
                                scrollable={true}
                                onCloseClick={this._handleCloseClick}
                                label={this._renderTitle()}>
                            {this._renderForm()}
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay>
                );

            } else {
                return null;
            }
        }
    }

    return {
        OptionsContainer: OptionsContainer
    };

}