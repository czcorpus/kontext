/*
 * Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
import { IActionDispatcher, IModel, BoundWithProps, StatefulModel } from 'kombo';

import { Kontext } from '../../types/common';
import { init as historyViewsInit } from './history';
import { MainMenuModelState } from '../../models/mainMenu';
import { ActionName as MainMenuActionName, Actions as MainMenuActions } from '../../models/mainMenu/actions';
import { PluginInterfaces } from '../../types/plugins';

export interface MainModuleArgs {
    dispatcher:IActionDispatcher;
    helpers:Kontext.ComponentHelpers;
    recentQueriesModel:IModel<PluginInterfaces.QueryHistory.ModelState>;
    mainMenuModel:IModel<MainMenuModelState>;
}

export interface MainViews {
    HistoryContainer:React.ComponentClass<{}>;
}


export function init({dispatcher, helpers, recentQueriesModel, mainMenuModel}:MainModuleArgs):MainViews {

    const layoutViews = helpers.getLayoutViews();
    const historyViews = historyViewsInit(dispatcher, helpers, recentQueriesModel);

    class HistoryContainer extends React.PureComponent<MainMenuModelState> {

        _isActiveItem(itemName) {
            return this.props.activeItem && this.props.activeItem.actionName === itemName;
        }

        _isActive() {
            return this._isActiveItem(MainMenuActionName.ShowQueryHistory);
        }

        _handleCloseClick() {
            dispatcher.dispatch<MainMenuActions.ClearActiveItem>({
                name: MainMenuActionName.ClearActiveItem
            });
        }

        _renderForm() {
            if (this._isActive()) {
                return <historyViews.RecentQueriesPageList />;

            } else {
                return <div></div>;
            }
        }

        _renderTitle() {
            if (this._isActive()) {
                return helpers.translate('query__recent_queries_link')

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

            } else if (this.props.isBusy) {
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
        HistoryContainer: BoundWithProps<{}, MainMenuModelState>(HistoryContainer, mainMenuModel)
    };

}