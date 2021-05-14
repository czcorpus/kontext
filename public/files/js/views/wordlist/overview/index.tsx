/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import { BoundWithProps, IActionDispatcher, IModel } from 'kombo';
import { Kontext } from '../../../types/common';
import { init as basicOverviewViewsInit } from '../../query/basicOverview';
import { init as formInit } from '../form';
import * as React from 'react';
import { ActionName, Actions } from '../../../models/wordlist/actions';
import { MainMenuModelState } from '../../../models/mainMenu';
import { WordlistFormModel, WordlistFormState } from '../../../models/wordlist/form';
import { PluginInterfaces } from '../../../types/plugins';
import * as S from './style';
import { List } from 'cnc-tskit';
import { splitFilterWords } from '../../../models/wordlist/common';


export interface OverviewProps {
    queryId:string;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    wordlistFormModel:WordlistFormModel,
    CorparchWidget:PluginInterfaces.Corparch.WidgetView,
    mainMenuModel:IModel<MainMenuModelState>
):React.ComponentClass<OverviewProps> {

    const basicOverview = basicOverviewViewsInit(dispatcher, he, mainMenuModel);
    const WordlistViews = formInit({dispatcher, he, CorparchWidget, wordlistFormModel});
    const layoutViews = he.getLayoutViews();

    const Overview:React.FC<WordlistFormState & OverviewProps> = (props) => {

        const handleQueryClick = () => {
            dispatcher.dispatch<Actions.ToggleModalForm>({
                name: ActionName.ToggleModalForm,
                payload: {
                    visible: true
                }
            });
        };

        const handleModalClose = () => {
            dispatcher.dispatch<Actions.ToggleModalForm>({
                name: ActionName.ToggleModalForm,
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
                            {'\u00a0 | '}
                            <strong>{he.translate('wordlist__overview_title')}: </strong>
                            <a className="args" onClick={handleQueryClick}>
                                {props.wlpat ? props.wlpat : '\u00a0\u2014'}
                                {!!props.pfilterWords ?
                                    '\u00a0{\u2026' + he.translate('wordlist__pfilter_words_{num}',
                                        {num: List.size(splitFilterWords(props.pfilterWords))}) + '\u2026}' :
                                    null
                                }
                                {!!props.nfilterWords ?
                                    '\u00a0{\u2026' + he.translate('wordlist__nfilter_words_{num}',
                                        {num: List.size(splitFilterWords(props.nfilterWords))}) + '\u2026}' :
                                    null
                                }
                            </a>
                        </li> :
                        null
                    }
                    {props.modalVisible ?
                        <layoutViews.ModalOverlay onCloseKey={handleModalClose}>
                            <layoutViews.CloseableFrame onCloseClick={handleModalClose}
                                    label={he.translate('wordlist__overview_title')}>
                                <WordlistViews.WordListForm />
                            </layoutViews.CloseableFrame>
                        </layoutViews.ModalOverlay> :
                        null
                    }
                </basicOverview.EmptyQueryOverviewBar>
            </S.Overview>
        );
    }

    return BoundWithProps<OverviewProps, WordlistFormState>(Overview, wordlistFormModel);

}