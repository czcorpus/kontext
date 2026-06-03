/*
 * Copyright (c) 2026 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2026 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as Kontext from '../../../types/kontext.js';
import { IActionDispatcher, IModel, useModel } from 'kombo';
import * as PluginInterfaces from '../../../types/plugins/index.js';
import { MainMenuModelState } from '../../../models/mainMenu/index.js';
import { init as basicOverviewViewsInit } from '../../query/basicOverview/index.js';
import * as S from './style.js';
import { KeywordsFormModel } from '../../../models/keywords/form.js';
import { Actions } from '../../../models/keywords/actions.js';
import { init as formInit } from '../form/index.js';


export interface OverviewProps {
    queryId:string;
}


interface initArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    keywordsFormModel:KeywordsFormModel;
    mainMenuModel:IModel<MainMenuModelState>;
    FocusCorpWidget:PluginInterfaces.Corparch.WidgetView;
    focusCorpWidgetId:string;
    RefCorpWidget:PluginInterfaces.Corparch.WidgetView;
    refCorpWidgetId:string;
}


export function init({
    dispatcher,
    he,
    keywordsFormModel,
    mainMenuModel,
    FocusCorpWidget,
    focusCorpWidgetId,
    RefCorpWidget,
    refCorpWidgetId
}:initArgs):React.FC<OverviewProps> {

    const basicOverview = basicOverviewViewsInit(dispatcher, he, mainMenuModel);
    const layoutViews = he.getLayoutViews();
    const KeywordsForm = formInit({
            dispatcher, he, keywordsFormModel, RefCorpWidget,
            refCorpWidgetId, FocusCorpWidget, focusCorpWidgetId});


    const Overview:React.FC<OverviewProps> = (props) => {

        const state = useModel(keywordsFormModel);

        const handleQueryClick = () => {
            dispatcher.dispatch<typeof Actions.ToggleModalForm>({
                name: Actions.ToggleModalForm.name,
                payload: {
                    visible: true
                }
            });
        };

        const handleModalClose = () => {
            dispatcher.dispatch<typeof Actions.ToggleModalForm>({
                name: Actions.ToggleModalForm.name,
                payload: {
                    visible: false
                }
            });
        };

        return (
            <S.Overview>
                <basicOverview.EmptyQueryOverviewBar>
                    {props.queryId ?
                        <li>
                            {' | '}
                            <strong>{he.translate('kwords__overview_title')}: </strong>
                            <a className="args" onClick={handleQueryClick}>
                                vs. {state.refCorp}
                            </a>
                        </li> :
                        null
                    }
                    {state.modalVisible ?
                        <layoutViews.ModalOverlay onCloseKey={handleModalClose}>
                            <layoutViews.CloseableFrame onCloseClick={handleModalClose}
                                    label={he.translate('kwords__overview_title')}>
                                <KeywordsForm />
                            </layoutViews.CloseableFrame>
                        </layoutViews.ModalOverlay> :
                        null
                    }
                </basicOverview.EmptyQueryOverviewBar>
            </S.Overview>
        );
    }

    return Overview;

}