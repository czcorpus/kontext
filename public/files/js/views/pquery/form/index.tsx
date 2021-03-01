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

import * as React from 'react';
import { BoundWithProps, IActionDispatcher } from 'kombo';

import { Kontext } from '../../../types/common';
import { PqueryFormModel, PqueryFormModelState } from '../../../models/pquery/form';
import { Actions, ActionName } from '../../../models/pquery/actions';
import * as S from './style';
import { Dict, List } from 'cnc-tskit';

export interface PqueryFormViewsArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    model:PqueryFormModel;
}

interface PqueryFormProps {
    corparchWidget:React.ComponentClass;
}


export function init({dispatcher, he, model}:PqueryFormViewsArgs):React.ComponentClass<{
    corparchWidget:React.ComponentClass
}> {


    const PqueryForm:React.FC<PqueryFormModelState & PqueryFormProps> = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch<Actions.SubmitQuery>({
                name: ActionName.SubmitQuery,
                payload: {}
            });
        };

        const addQueryHandler = () => {
            dispatcher.dispatch<Actions.AddQueryItem>({
                name: ActionName.AddQueryItem,
                payload: {}
            });
        };

        const removeQueryHandler = (sourceId) => {
            dispatcher.dispatch<Actions.RemoveQueryItem>({
                name: ActionName.RemoveQueryItem,
                payload: {sourceId: sourceId}
            });
        };
        
        const handleQueryChange = (sourceId, query) => {
            dispatcher.dispatch<Actions.QueryChange>({
                name: ActionName.QueryChange,
                payload: {
                    sourceId: sourceId,
                    query: query
                }
            });
        };

        const handleFreqChange = (e) => {
            dispatcher.dispatch<Actions.FreqChange>({
                name: ActionName.FreqChange,
                payload: {
                    value: e.target.value
                }
            });
        };

        const handlePositionChange = (e) => {
            dispatcher.dispatch<Actions.PositionChange>({
                name: ActionName.PositionChange,
                payload: {
                    value: e.target.value
                }
            });
        };

        const handleAttrChange = (e) => {
            dispatcher.dispatch<Actions.AttrChange>({
                name: ActionName.AttrChange,
                payload: {
                    value: e.target.value
                }
            });
        };

        return (
            <S.PqueryForm>
                <props.corparchWidget />
                <form>
                    <p>Pquery form TODO</p>
                    {Dict.mapEntries(([k, v]) => <fieldset id={k} key={k}>
                            <textarea name={k} onChange={x => handleQueryChange(k, x.target.value)} value={v.query} />
                            {Dict.size(props.queries) > 1 ? <button type="button" onClick={x => removeQueryHandler(k)}>x</button> : null}
                        </fieldset>,
                        props.queries
                    )}
                    <button type="button" onClick={addQueryHandler}>+</button>
                    <fieldset>
                        <label htmlFor="freq">Min. fq</label>
                        <input id="freq" onChange={handleFreqChange} value={props.minFreq}/>
                        <label htmlFor="pos">Position</label>
                        <input id="pos" onChange={handlePositionChange} value={props.position}/>
                        <label htmlFor="attr">Attribute</label>
                        <select id="attr" value={props.attr} onChange={handleAttrChange}>
                            {List.map(item => <option key={item.n}>{item.n}</option>, props.attrs)}
                            {List.map(item => <option key={item.n}>{item.n}</option>, props.structAttrs)}
                        </select>
                    </fieldset>
                    <button type="button" onClick={handleSubmit}>Submit</button>
                </form>
            </S.PqueryForm>
        )
    };

    return BoundWithProps<PqueryFormProps, PqueryFormModelState>(PqueryForm, model);
}
