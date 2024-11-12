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
import { Actions } from '../../models/searchHistory/actions';
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

    const HistoryContainer:React.FC<MainMenuModelState> = (props) => {

        const _isActive = () => {
            return props.activeItem &&
                props.activeItem.actionName === MainMenuActions.ShowQueryHistory.name;
        };

        const _handleCloseClick = () => {
            dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
                name: MainMenuActions.ClearActiveItem.name
            });
        };

        const _handleHelpClick = () => {
            dispatcher.dispatch<typeof Actions.ToggleHelpView>({
                name: Actions.ToggleHelpView.name
            });
        };

        if (_isActive()) {
            return <widgetView.RecentQueriesPageList
                    onCloseClick={_handleCloseClick}
                    onHelpClick={_handleHelpClick} />

        } else if (props.isBusy) {
            return <layoutViews.ModalOverlay onCloseKey={_handleCloseClick}>
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

    return {
        HistoryContainer: BoundWithProps<{}, MainMenuModelState>(HistoryContainer, mainMenuModel)
    };

}