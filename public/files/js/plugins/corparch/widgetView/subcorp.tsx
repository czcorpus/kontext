/*
 * Copyright (c) 2025 Charles University, Faculty of Arts,
 *                    Department of Linguistics
 * Copyright (c) 2025 Tomas Machalek <tomas.machalek@gmail.com>
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
import { CorplistWidgetModel } from '../widget.js';
import { Actions } from '../actions.js';
import { Actions as SubcActions } from '../../../models/subcorp/actions.js';
import { List } from 'cnc-tskit';
import * as S from './style.js';
import { PublicSubcorpListModel } from '../../../models/subcorp/listPublic.js';
import { Actions as GlobalActions } from '../../../models/common/actions.js';
import { SubcorpListItem } from 'js/models/subcorp/list.js';


export function init(
    dispatcher:IActionDispatcher,
    util:Kontext.ComponentHelpers,
    widgetModel:CorplistWidgetModel,
    publicSubcModel:PublicSubcorpListModel,
):{
    SubcorpWidget: React.FC<{widgetId:string, minSrchQuerySize:number;}>,
    SubcorpSelection: React.FC<{
        widgetId:string;
        corpusName:string;
        currSubcorpus:string;
        subcName:string;
        availSubcorpora:Array<Kontext.SubcorpListItem>;
    }>
} {

    const layoutViews = util.getLayoutViews();


// ------------------------------ <PubSubcMetadata /> -------------------

    const PubSubcMetadata:React.FC<{
        data:SubcorpListItem;

    }> = ({data}) => (
        <S.PubSubcMetadata>
            (<span className="label">{util.translate('pubsubclist__author')}:</span>{data.author_fullname},
            <span className="label">{util.translate('global__size')}:</span>{data.size_info || data.size},
            <span className="label">{util.translate('global__date')}:</span>{util.formatDate(data.created)})
        </S.PubSubcMetadata>
    );

// ------------------------------ <CurrCorpCheckbox /> ------------------

    const CurrCorpCheckbox:React.FC<{
        widgetId:string;
        checked:boolean;
    }> = (props) => {

        const handleCheckbox = () => {
            dispatcher.dispatch(SubcActions.PubSubcToggleOnlyCurrCorpus)
        };

        return (
            <S.CurrCorpCheckbox>
                <input id={`curr_corp_checkbox_${props.widgetId}`} type="checkbox" checked={props.checked} onChange={handleCheckbox} />
                <label htmlFor={`curr_corp_checkbox_${props.widgetId}`}>
                    {util.translate('defaultCorparch__currentCorpusOnly')}
                </label>
            </S.CurrCorpCheckbox>
        )
    };

// ------------------------------ <SubcWidget /> ------------------------


    const SubcorpWidget:React.FC<{
        widgetId:string;
        minSrchQuerySize:number;
    }> = (props) => {

        const state = useModel(publicSubcModel);

        const handleItemClick = (corpname: string, subcorpus:string) => () => {
            dispatcher.dispatch(
                Actions.WidgetExternalListItemClicked,
                {
                    widgetId: props.widgetId,
                    corpname,
                    subcorpus
                }
            );
        }


        const handleInput = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<typeof SubcActions.SetSearchQuery>({
                name: SubcActions.SetSearchQuery.name,
                payload: {
                    widgetId: props.widgetId,
                    value: evt.target.value
                }
            });
        };

        return (
            <S.SubcorpWidget>
                <div className="autocomplete-wrapper">
                    <div className="input-wrapper">
                        <input className="tt-input" type="text"
                            value={state.searchQuery}
                            placeholder={util.translate('defaultCorparch__publicSubcAuthorOrIdentifier')}
                            onChange={handleInput}
                            ref={item => item ? item.focus() : null}  />
                    </div>
                    <CurrCorpCheckbox widgetId={props.widgetId} checked={state.onlyCurrCorpus} />
                </div>
                <ul className="tt-search-list">
                {List.map(
                    item => (
                        <S.TTSuggestion key={item.id} className="tt-suggestion">
                            <a className="subc-ident" onClick={handleItemClick(item.corpus_name, item.id)}>{item.corpus_name} / {item.name}</a>
                            <PubSubcMetadata data={item} />
                        </S.TTSuggestion>
                    ),
                    state.data
                )}
                </ul>
            </S.SubcorpWidget>
        );
    }


// ------------------------------- <SubcorpSelection /> -----------------------------

    const SubcorpSelection:React.FC<{
        widgetId:string;
        corpusName:string;
        currSubcorpus:string;
        subcName:string;
        availSubcorpora:Array<Kontext.SubcorpListItem>;

    }> = (props) => {

        const handleSubcorpChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            const srch = List.find(
                x => x.v === evt.target.value,
                props.availSubcorpora
            );
            dispatcher.dispatch(
                Actions.WidgetSubcorpusSelected,
                {
                    widgetId: props.widgetId,
                    subcorpus: srch.v,
                }
            );
        };

        return (
            <span id="subcorp-selector-wrapper">
                <select id="subcorp-selector" name="usesubcorp" value={props.currSubcorpus ? props.currSubcorpus : ''}
                        onChange={handleSubcorpChange}>
                    {List.map(
                        item => <option key={item.v} value={item.v}>{item.n}</option>,
                        props.availSubcorpora
                    )}
                </select>
            </span>
        )
    };


    return { SubcorpWidget, SubcorpSelection};
}