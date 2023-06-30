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
import { List } from 'cnc-tskit';


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

        const handleAttrChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetAttr,
                {value: evt.target.value}
            );
        };

        const handlePatternChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetPattern,
                {value: evt.target.value}
            );
        };

        const handleScoreTypeChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetScoreType,
                {value: evt.target.value}
            );
        };

        const handleSubmit = (evt) => {
            dispatcher.dispatch(Actions.SubmitQuery);
        };

        const handleMinFreq = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetMinFreq,
                {value: evt.target.value}
            );
        };

        const handleMaxFreq = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetMaxFreq,
                {value: evt.target.value}
            );
        };

        return (
            <S.KeywordsForm>
                <div className="corp-sel">
                    <label>{he.translate('kwords__focus_corpus')}:</label>
                    {FocusCorpWidget ? <FocusCorpWidget widgetId={focusCorpWidgetId} /> : null}
                    <label>{he.translate('kwords__reference_corpus')}:</label>
                    {RefCorpWidget ? <RefCorpWidget widgetId={refCorpWidgetId} /> : null}
                </div>
                <S.MainFieldset>
                    <label htmlFor="kw-attribute">{he.translate('global__attribute')}:</label>
                    <select id="kw-attribute" value={props.attr} onChange={handleAttrChange}>
                        {List.map(
                            item => <option key={item.n} value={item.n}>{item.label}</option>,
                            props.availAttrs
                        )}
                    </select>

                    <label htmlFor="kw-pattern">{he.translate('kwords__pattern')}:</label>
                    <input id="kw-pattern" className="pattern" onChange={handlePatternChange} type='text' value={props.pattern}/>

                    {props.manateeIsCustomCNC ?
                        <label htmlFor="kw-score">{he.translate('kwords__score_type')}:</label>:
                        null}
                    {props.manateeIsCustomCNC ?
                        <select id="kw-score" value={props.scoreType} onChange={handleScoreTypeChange}>
                            <option value='logL'>Log-likelihood</option>
                            <option value='chi2'>Chi-square</option>
                            <option value='effS'>{he.translate('kwords__effect_size')}</option>
                        </select> :
                        null}

                    <label htmlFor="kw-minfreq">{he.translate('kwords__min_freq')}:</label>
                    <layoutViews.ValidatedItem invalid={props.wlMinFreqInput.isInvalid}
                            errorDesc={props.wlMinFreqInput.errorDesc}
                            htmlClass="freq">
                        <input id="kw-minfreq" type="text" value={props.wlMinFreqInput.value} onChange={handleMinFreq} />
                    </layoutViews.ValidatedItem>

                    <label htmlFor="kw-maxfreq">{he.translate('kwords__max_freq')}:</label>
                    <layoutViews.ValidatedItem invalid={props.wlMaxFreqInput.isInvalid}
                            errorDesc={props.wlMaxFreqInput.errorDesc}
                            htmlClass="freq">
                        <input id="kw-maxfreq" type="text" value={props.wlMaxFreqInput.value} onChange={handleMaxFreq} />
                    </layoutViews.ValidatedItem>
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