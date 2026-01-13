/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { IActionDispatcher, useModel } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import * as S from './style.js';
import * as PluginInterfaces from '../../../types/plugins/index.js';
import * as theme from '../../theme/default/index.js';
import { Actions } from '../../../models/keywords/actions.js';
import { KeywordsFormModel } from '../../../models/keywords/form.js';
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
}:KeywordsFormViewArgs):React.FC {

    const layoutViews = he.getLayoutViews();

    const statTestToLabel = (v: string):string => {
        switch (v) {
            case 'logL':
                return "Log-likelihood"
            case 'chi2':
                return he.translate('kwords__chi_square');
            case 'din':
                return he.translate('kwords__effect_size');
            default:
                return '??';
        }
    };


    // --------------- <IncludeNonWordsCheckbox /> ------------------------

    const IncludeNonWordsCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleChange = (value:boolean) => {
            dispatcher.dispatch(
                Actions.KeywordsFormSetIncludeNonwords,
                {
                    value
                }
            );
        };

        return (
            <>
                <div>
                    <label htmlFor="wl-include-non-words-checkbox">
                        {he.translate('wordlist__incl_non_word_label')}:
                    </label>
                </div>
                <S.IncludeNonWordsCheckbox>
                    <S.IncludeNonWordsCheckboxSpan>
                        <layoutViews.ToggleSwitch htmlClass="toggle" checked={props.value} onChange={handleChange}
                            id="wl-include-non-words-checkbox"/>
                    </S.IncludeNonWordsCheckboxSpan>
                </S.IncludeNonWordsCheckbox>
            </>
        );
    };


    // ------------------ <KeywordsFilterFieldset /> -------------------------------

    const KeywordsFilterFieldset:React.FC = (props) => {

        const state = useModel(keywordsFormModel);

        const handlePatternChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetPattern,
                {value: evt.target.value}
            );
        };

        const handleFilterTypeChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetFilterType,
                {value: evt.target.value}
            );
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

        const handleMinFilter = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetMinFilter,
                {value: evt.target.value}
            );
        };

        const handleMaxFilter = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch(
                Actions.SetMaxFilter,
                {value: evt.target.value}
            );
        };

        return (
            <S.KeywordsFilterFieldset>
                <div>
                    <label htmlFor="kw-pattern">{he.translate('kwords__pattern')}:</label>
                </div>
                <div>
                    <input id="kw-pattern" className="pattern" onChange={handlePatternChange} type='text' value={state.pattern}/>
                </div>

                <div>
                    <label htmlFor="kw-minfreq">{he.translate('kwords__min_freq')}:</label>
                </div>
                <div>
                    <layoutViews.ValidatedItem invalid={state.wlMinFreqInput.isInvalid}
                            errorDesc={state.wlMinFreqInput.errorDesc}
                            htmlClass="freq">
                        <input id="kw-minfreq" type="text" value={state.wlMinFreqInput.value} onChange={handleMinFreq} />
                    </layoutViews.ValidatedItem>
                </div>

                <div>
                    <label htmlFor="kw-maxfreq">{he.translate('kwords__max_freq')}:</label>
                </div>
                <div>
                    <layoutViews.ValidatedItem invalid={state.wlMaxFreqInput.isInvalid}
                            errorDesc={state.wlMaxFreqInput.errorDesc}
                            htmlClass="freq">
                        <input id="kw-maxfreq" type="text" value={state.wlMaxFreqInput.value} onChange={handleMaxFreq} />
                    </layoutViews.ValidatedItem>
                </div>

                <IncludeNonWordsCheckbox value={state.includeNonWords} />

                <div>
                    <label htmlFor="kw-minfreq">{he.translate('kwords__min_filter')} </label>
                    <select id="kw-filter" value={state.filterType} onChange={handleFilterTypeChange}>
                        <option value="logL">{statTestToLabel('logL')}</option>
                        <option value="chi2">{statTestToLabel('chi2')}</option>
                        <option value="din">{statTestToLabel('din')}</option>
                    </select>:
                </div>
                <div>
                    <layoutViews.ValidatedItem invalid={state.filterMinValue.isInvalid}
                            errorDesc={state.filterMinValue.errorDesc}
                            htmlClass="freq">
                        <input id="kw-minfreq" type="text" value={state.filterMinValue.value} onChange={handleMinFilter} />
                    </layoutViews.ValidatedItem>
                </div>

                <div>
                    <label htmlFor="kw-maxfreq">{he.translate('kwords__max_filter')} </label>
                    <span className="min-score">{statTestToLabel(state.filterType)}</span>:
                </div>
                <div>
                    <layoutViews.ValidatedItem invalid={state.filterMaxValue.isInvalid}
                            errorDesc={state.filterMaxValue.errorDesc}
                            htmlClass="freq">
                        <input id="kw-maxfreq" type="text" value={state.filterMaxValue.value} onChange={handleMaxFilter} />
                    </layoutViews.ValidatedItem>
                </div>
            </S.KeywordsFilterFieldset>
        );
    }


    // ------------------ <KeywordsForm /> ---------------------------------

    const KeywordsForm:React.FC = (props) => {

        const state = useModel(keywordsFormModel);

        const handleAttrChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch(
                Actions.SetAttr,
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

        const handleFilterExpand = () => {
            dispatcher.dispatch(Actions.KeywordsToggleFilterFieldset);
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
                    <div>
                        <select id="kw-attribute" value={state.attr} onChange={handleAttrChange}>
                            {List.map(
                                item => <option key={item.n} value={item.n}>{item.label}</option>,
                                state.availAttrs
                            )}
                        </select>
                    </div>

                    {state.manateeIsCustomCNC ?
                        <label htmlFor="kw-score">{he.translate('kwords__score_type')}</label> :
                        null}
                    {state.manateeIsCustomCNC ?
                        <div>
                            <select id="kw-score" value={state.scoreType} onChange={handleScoreTypeChange}>
                                <option value="logL">{statTestToLabel('logL')}</option>
                                <option value="chi2">{statTestToLabel('chi2')}</option>
                                <option value="din">{statTestToLabel('din')}</option>
                            </select>
                        </div> :
                        null}
                </S.MainFieldset>
                <theme.ExpandableSectionLabel id="kw-filters">
                    <layoutViews.ExpandButton isExpanded={state.filterVisible} onClick={handleFilterExpand} />
                    <a onClick={handleFilterExpand}>
                        {he.translate('kwords__filter_section_header')}
                    </a>
                    <div>
                        {state.manateeIsCustomCNC && state.filterVisible ?
                        <KeywordsFilterFieldset /> :
                        null
                        }
                    </div>
                </theme.ExpandableSectionLabel>
                <div className="buttons">
                    {
                        state.isBusy ?
                            <img className="ajax-loader" src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={he.translate('global__loading')} title={he.translate('global__loading')} /> :
                            <button type='button' className="default-button" onClick={handleSubmit}>{he.translate('query__search_btn')}</button>
                    }
                </div>
            </S.KeywordsForm>
        );
    }


    return KeywordsForm;

}