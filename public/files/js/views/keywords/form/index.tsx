/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
import { Bound, IActionDispatcher } from 'kombo';

import * as Kontext from '../../../types/kontext';
import * as S from './style';
import * as PluginInterfaces from '../../../types/plugins';
import { Actions } from '../../../models/keywords/actions';
import { KeywordsFormModel, KeywordsFormState } from '../../../models/keywords/form';


export interface KeywordsFormViewArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    FocusCorpWidget:PluginInterfaces.Corparch.WidgetView;
    focusCorpWidgetId:string;
    RefCorpWidget:PluginInterfaces.Corparch.WidgetView;
    refCorpWidgetId:string;
    keywordsFormModel:KeywordsFormModel;
}


export function init({
    dispatcher,
    he,
    FocusCorpWidget,
    focusCorpWidgetId,
    RefCorpWidget,
    refCorpWidgetId,
    keywordsFormModel,
}:KeywordsFormViewArgs):React.ComponentClass<{}> {

    const layoutViews = he.getLayoutViews();

    const KeywordsForm:React.FC<KeywordsFormState> = (props) => {

        const handleAttrChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetAttr,
                {value: evt.target.value}
            );
        }

        const handlePatternChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetPattern,
                {value: evt.target.value}
            );
        }

        const handleScoreTypeChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetScoreType,
                {value: evt.target.value}
            );
        }

        const handleSubmit = (evt) => {
            dispatcher.dispatch(Actions.SubmitQuery);
        }

        return (
            <S.KeywordsForm>
                <label>Focus corp</label>
                {FocusCorpWidget ? <FocusCorpWidget widgetId={focusCorpWidgetId} /> : null}
                <label>Reference corp</label>
                {RefCorpWidget ? <RefCorpWidget widgetId={refCorpWidgetId} /> : null}
                <S.MainFieldset>
                    <label>Attr</label>
                    <input onChange={handleAttrChange} type='text' value={props.attr}/>
                    <label>Pattern</label>
                    <input onChange={handlePatternChange} type='text' value={props.pattern}/>
                    <label>Score type</label>
                    <select value={props.scoreType} onChange={handleScoreTypeChange}>
                        <option value='logL'>log-likelihood</option>
                        <option value='chi2'>chi square</option>
                    </select>
                </S.MainFieldset>
                <div className="buttons">
                    {
                        props.isBusy ?
                            <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={he.translate('global__loading')} title={he.translate('global__loading')} /> :
                            <button role='button' className="default-button" onClick={handleSubmit}>{he.translate('query__search_btn')}</button>
                    }
                </div>
            </S.KeywordsForm>
        );
    }


    return Bound(KeywordsForm, keywordsFormModel);

}