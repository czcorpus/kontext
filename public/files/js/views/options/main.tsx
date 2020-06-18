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

import * as React from 'react';
import {IActionDispatcher, IModel} from 'kombo';
import {Kontext, ViewOptions} from '../../types/common';
import {init as generalViewsInit} from './general';
import {init as structsAttrsViewsInit} from './structsAttrs';
import { Subscription } from 'rxjs';
import { CorpusViewOptionsModel } from '../../models/options/structsAttrs';

export interface MainModuleArgs {
    dispatcher:IActionDispatcher;
    helpers:Kontext.ComponentHelpers;
    generalOptionsModel:ViewOptions.IGeneralViewOptionsModel;
    viewOptionsModel:CorpusViewOptionsModel;
    mainMenuModel:IModel<{}>;
}

export interface OptionsContainerProps {
    corpusIdent: Kontext.FullCorpusIdent;
}

export interface MainViews {
    OptionsContainer:React.ComponentClass<OptionsContainerProps>;
}


export function init({dispatcher, helpers, generalOptionsModel, viewOptionsModel, mainMenuModel}:MainModuleArgs):MainViews {

    const layoutViews = helpers.getLayoutViews();
    const generalOptionsViews = generalViewsInit(dispatcher, helpers, generalOptionsModel);
    const structsAttrsOptionsViews = structsAttrsViewsInit({
        dispatcher: dispatcher,
        helpers: helpers,
        viewOptionsModel: viewOptionsModel,
        mainMenuModel: mainMenuModel
    });

    class OptionsContainer extends React.Component<OptionsContainerProps, {
        activeItem:Kontext.MainMenuActiveItem;
        menuBusy:boolean;

    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._handleModelChange = this._handleModelChange.bind(this);
            this._handleModelChange = this._handleModelChange.bind(this);
        }

        _fetchModelState() {
            return {
                activeItem: mainMenuModel.getActiveItem(),
                menuBusy: mainMenuModel.isBusy()
            };
        }

        _handleModelChange() {
            this.setState(this._fetchModelState());
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
                name: 'MAIN_MENU_CLEAR_ACTIVE_ITEM',
                payload: {}
            });
        }

        componentDidMount() {
             this.modelSubscription = mainMenuModel.addListener(this._handleModelChange);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
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
                return helpers.translate('options__settings_apply_only_for_{corpname}', {corpname: this.props.corpusIdent.name})

            } else if (this._isActiveItem('MAIN_MENU_SHOW_GENERAL_VIEW_OPTIONS')) {
                return helpers.translate('options__general_options_heading');

            } else {
                return '--';
            }
        }

        render() {
            if (this._isActive()) {
                return <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                        <layoutViews.CloseableFrame
                                scrollable={true}
                                onCloseClick={this._handleCloseClick}
                                label={this._renderTitle()}
                                customClass="OptionsContainer">
                            {this._renderForm()}
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay>;

            } else if (this.state.menuBusy) {
                return <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                        <layoutViews.CloseableFrame label={helpers.translate('global__loading')}
                                    onCloseClick={()=>undefined}
                                    customClass="OptionsContainer busy">
                            <layoutViews.AjaxLoaderImage htmlClass="ajax-loader" />
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay>;

            } else {
                return null;
            }
        }
    }

    return {
        OptionsContainer: OptionsContainer
    };

}