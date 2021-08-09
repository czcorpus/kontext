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
import { IActionDispatcher, IModel, BoundWithProps } from 'kombo';

import * as Kontext from '../../types/kontext';
import { init as fullViewInit } from './full';
import { MainMenuModelState } from '../../models/mainMenu';
import { Actions as MainMenuActions } from '../../models/mainMenu/actions';
import { SearchHistoryModel } from '../../models/searchHistory';

export interface MainModuleArgs {
    dispatcher:IActionDispatcher;
    helpers:Kontext.ComponentHelpers;
    searchHistoryModel:SearchHistoryModel;
    mainMenuModel:IModel<MainMenuModelState>;
}

export interface MainViews {
    HistoryContainer:React.ComponentClass<{}>;
}


export function init({dispatcher, helpers, searchHistoryModel, mainMenuModel}:MainModuleArgs):MainViews {

    const layoutViews = helpers.getLayoutViews();
    const widgetView = fullViewInit(dispatcher, helpers, searchHistoryModel);

    class HistoryContainer extends React.PureComponent<MainMenuModelState> {

        _isActiveItem(itemName) {
            return this.props.activeItem && this.props.activeItem.actionName === itemName;
        }

        _isActive() {
            return this._isActiveItem(MainMenuActions.ShowQueryHistory.name);
        }

        _handleCloseClick() {
            dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
                name: MainMenuActions.ClearActiveItem.name
            });
        }

        _renderForm() {
            if (this._isActive()) {
                return <widgetView.RecentQueriesPageList />;

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