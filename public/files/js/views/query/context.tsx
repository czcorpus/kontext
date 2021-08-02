/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/**
 * This module contains views for the "Specify context" fieldset
 * within the main query form.
 */

import * as React from 'react';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Kontext } from '../../types/common';
import { QueryContextModel, QueryContextModelState } from '../../models/query/context';
import { Actions, ActionName } from '../../models/query/actions';
import { CtxLemwordType } from '../../models/query/common';
import { List, tuple } from 'cnc-tskit';
import * as S from './style';


export interface SpecifyContextFormProps {
    hasLemmaAttr:boolean;
    wPoSList:Array<{v:string; n:string}>;
}


export interface ContextViews {
    SpecifyContextForm:React.ComponentClass<SpecifyContextFormProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            queryContextModel:QueryContextModel):ContextViews {

    const layoutModels = he.getLayoutViews();

    // ------------------------------- <AllAnyNoneSelector /> ---------------------

    const AllAnyNoneSelector:React.FC<{
        inputName:string;
        value:CtxLemwordType;
        changeHandler:(evt) => void;

    }> = (props) => {

        return (
            <select name={props.inputName} value={props.value}
                    onChange={props.changeHandler}>
                <option value="all">{he.translate('query__aan_selector_all')}</option>
                <option value="any">{he.translate('query__aan_selector_any')}</option>
                <option value="none">{he.translate('query__aan_selector_none')}</option>
            </select>
        );
    };

    // ------------------------------- <LemmaFilter /> ---------------------

    const LemmaFilter:React.FC<{
        hasLemmaAttr:boolean;
        fc_lemword_wsize:[number, number];
        fc_lemword_type:CtxLemwordType;
        fc_lemword:string;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.QueryContextSetLemword>({
                name: ActionName.QueryContextSetLemword,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleRangeChange = (lft:number, rgt:number) => {
            dispatcher.dispatch<Actions.QueryContextSetLemwordWsize>({
                name: ActionName.QueryContextSetLemwordWsize,
                payload: {
                    value: tuple(lft, rgt)
                }
            });
        };

        const handleTypeChange = (evt) => {
            dispatcher.dispatch<Actions.QueryContextSetLemwordType>({
                name: ActionName.QueryContextSetLemwordType,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <dl className="form">
                <dt>
                    {he.translate('query__window')}:
                </dt>
                <dd>
                    <layoutModels.KwicRangeSelector rangeSize={5} isKwicExcluded={true}
                            initialLeft={props.fc_lemword_wsize[0]}
                            initialRight={props.fc_lemword_wsize[1]}
                            onClick={handleRangeChange} />
                </dd>
                <dt>
                    {props.hasLemmaAttr
                        ? he.translate('query__lw_lemmas')
                        : he.translate('query__lw_word_forms')
                    }:
                </dt>
                <dd>
                    <input type="text" className="fc_lemword" name="fc_lemword" value={props.fc_lemword}
                            onChange={handleInputChange} />
                    <span>
                        {'\u00A0'}
                        <AllAnyNoneSelector inputName="fc_lemword_type" value={props.fc_lemword_type} changeHandler={handleTypeChange} />
                    </span>
                </dd>
            </dl>
        );
    };

    // ------------------------------- <PoSFilter /> ---------------------

    const PoSFilter:React.FC<{
        fc_pos_wsize:[number, number];
        fc_pos:Array<string>;
        wPoSList:Array<{v:string; n:string}>;
        fc_pos_type:CtxLemwordType;

    }> = (props) => {

        const handleSelectChange = (checked, pos) => {
            dispatcher.dispatch<Actions.QueryContextSetPos>({
                name: ActionName.QueryContextSetPos,
                payload: {
                    checked: checked,
                    value: pos
                }
            });
        };

        const handleRangeChange = (lft:number, rgt:number) => {
            dispatcher.dispatch<Actions.QueryContextSetPosWsize>({
                name: ActionName.QueryContextSetPosWsize,
                payload: {
                    value: tuple(lft, rgt)
                }
            });
        };

        const handleTypeChange = (evt) => {
            dispatcher.dispatch<Actions.QueryContextSetPosType>({
                name: ActionName.QueryContextSetPosType,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <S.PoSFilter>
                <h3>
                    {he.translate('query__pos_filter_hd')}
                </h3>
                <dl className="form">
                    <dt>
                        {he.translate('query__window')}:
                    </dt>
                    <dd>
                        <layoutModels.KwicRangeSelector rangeSize={5} isKwicExcluded={true}
                                initialLeft={props.fc_pos_wsize[0]}
                                initialRight={props.fc_pos_wsize[1]}
                                onClick={handleRangeChange} />
                    </dd>
                    <dt>
                        {he.translate('query__pos_list')}:
                    </dt>
                    <dd>
                        <div className="pos-list">
                            <ul>
                                {List.map((item, i) =>
                                    <li key={i}>
                                        <input type="checkbox" id={item.n}
                                                checked={props.fc_pos.includes(item.n)}
                                                onChange={() => handleSelectChange(!props.fc_pos.includes(item.n), item.n)} />
                                        <label htmlFor={item.n}>{item.n}</label>
                                    </li>,
                                    props.wPoSList
                                )}
                            </ul>
                        </div>
                        <div className="all-any-none-sel">
                            <AllAnyNoneSelector inputName="fc_pos_type" value={props.fc_pos_type} changeHandler={handleTypeChange}/>
                        </div>
                    </dd>
                </dl>
            </S.PoSFilter>
        );
    };

    // ------------------------------- <SpecifyContextForm /> ---------------------

    const SpecifyContextForm:React.FC<SpecifyContextFormProps & QueryContextModelState> = (props) => {

            return (
                <div>
                    <h3>{props.hasLemmaAttr
                        ? he.translate('query__lemma_filter_hd')
                        : he.translate('query__word_form_filter_hd')}
                        {'\u00a0'}
                    </h3>
                    <LemmaFilter
                        hasLemmaAttr={props.hasLemmaAttr}
                        fc_lemword_wsize={props.formData.fc_lemword_wsize}
                        fc_lemword={props.formData.fc_lemword}
                        fc_lemword_type={props.formData.fc_lemword_type}
                    />
                    <hr />
                    {props.wPoSList && props.wPoSList.length > 0 ?
                        <PoSFilter
                            wPoSList={props.wPoSList}
                            fc_pos_wsize={props.formData.fc_pos_wsize}
                            fc_pos={props.formData.fc_pos}
                            fc_pos_type={props.formData.fc_pos_type}
                        /> :
                        null
                    }
                </div>
            );
    }

    return {
        SpecifyContextForm: BoundWithProps(SpecifyContextForm, queryContextModel)
    };
}