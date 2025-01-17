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
import { IActionDispatcher, IModel, BoundWithProps, StatelessModel } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { init as generalViewsInit } from '../general/index.js';
import { init as structsAttrsViewsInit } from '../structsAttrs/index.js';
import { CorpusViewOptionsModel } from '../../../models/options/structsAttrs.js';
import { MainMenuModelState } from '../../../models/mainMenu/index.js';
import { Actions as MainMenuActions } from '../../../models/mainMenu/actions.js';
import { GeneralViewOptionsModelState } from '../../../models/options/general.js';
import * as S from './style.js';


export interface MainModuleArgs {
    dispatcher:IActionDispatcher;
    helpers:Kontext.ComponentHelpers;
    generalOptionsModel:StatelessModel<GeneralViewOptionsModelState>;
    viewOptionsModel:CorpusViewOptionsModel;
    mainMenuModel:IModel<MainMenuModelState>;
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
        dispatcher,
        helpers,
        viewOptionsModel
    });

    class OptionsContainer extends React.PureComponent<OptionsContainerProps & MainMenuModelState> {

        _isActiveItem(itemName) {
            return this.props.activeItem && this.props.activeItem.actionName === itemName;
        }

        _isActive() {
            return this._isActiveItem(MainMenuActions.ShowAttrsViewOptions.name)
                || this._isActiveItem(MainMenuActions.ShowGeneralViewOptions.name);
        }

        _handleCloseClick() {
            dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
                name: MainMenuActions.ClearActiveItem.name
            });
        }

        _renderForm() {
            if (this._isActiveItem(MainMenuActions.ShowAttrsViewOptions.name)) {
                return <structsAttrsOptionsViews.StructAttrsViewOptions />;

            } else if (this._isActiveItem(MainMenuActions.ShowGeneralViewOptions.name)) {
                return <generalOptionsViews.GeneralOptions />;

            } else {
                return <div></div>;
            }
        }

        _renderTitle() {
            if (this._isActiveItem(MainMenuActions.ShowAttrsViewOptions.name)) {
                return helpers.translate('options__settings_apply_only_for_{corpname}', {corpname: this.props.corpusIdent.name})

            } else if (this._isActiveItem(MainMenuActions.ShowGeneralViewOptions.name)) {
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
                                label={this._renderTitle()}>
                            <S.OptionsContainer>
                                {this._renderForm()}
                            </S.OptionsContainer>
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay>;

            } else if (this.props.isBusy) {
                return <layoutViews.ModalOverlay onCloseKey={this._handleCloseClick}>
                        <layoutViews.CloseableFrame label={helpers.translate('global__loading')}
                                    onCloseClick={()=>undefined}
                                    customClass="OptionsContainer busy">
                            <S.OptionsContainer>
                                <layoutViews.AjaxLoaderImage htmlClass="ajax-loader" />
                            </S.OptionsContainer>
                        </layoutViews.CloseableFrame>
                    </layoutViews.ModalOverlay>;

            } else {
                return null;
            }
        }
    }

    return {
        OptionsContainer: BoundWithProps<OptionsContainerProps, MainMenuModelState>(OptionsContainer, mainMenuModel)
    };

}