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
import { tuple } from 'cnc-tskit';


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

    }> = (props) => {

        const changeHandler = (evt) => {
            dispatcher.dispatch<Actions.QueryInputSelectContextFormItem>({
                name: ActionName.QueryInputSelectContextFormItem,
                payload: {
                    name: props.inputName,
                    value: evt.target.value
                }
            });
        };

        return (
            <select name={props.inputName} value={props.value}
                    onChange={changeHandler}>
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
            dispatcher.dispatch<Actions.QueryInputSelectContextFormItem>({
                name: ActionName.QueryInputSelectContextFormItem,
                payload: {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        };

        const handleRangeChange = (lft:number, rgt:number) => {
            dispatcher.dispatch<Actions.QueryInputSelectContextFormItem>({
                name: ActionName.QueryInputSelectContextFormItem,
                payload: {
                    name: 'fc_lemword_wsize',
                    value: tuple(lft, rgt)
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
                    <AllAnyNoneSelector inputName="fc_lemword_type" value={props.fc_lemword_type} />
                    {'\u00A0'}
                    {he.translate('query__of_these_items')}
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

        const handleMultiSelectChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            const sel = [];
            for (let i = 0; i < evt.target.length; i++) {
                const opt = evt.target[i] as HTMLOptionElement;
                if (opt.selected) {
                    sel.push(opt.value);
                }
            }
            dispatcher.dispatch<Actions.QueryInputSelectContextFormItem>({
                name: ActionName.QueryInputSelectContextFormItem,
                payload: {
                    name: evt.target.name,
                    value: sel
                }
            });
        };

        const handleRangeChange = (lft:number, rgt:number) => {
            dispatcher.dispatch<Actions.QueryInputSelectContextFormItem>({
                name: ActionName.QueryInputSelectContextFormItem,
                payload: {
                    name: 'fc_pos_wsize',
                    value: tuple(lft, rgt)
                }
            });
        };

        return (
            <div className="pos-filter">
                <h3>{he.translate('query__pos_filter')}</h3>
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
                        {he.translate('query__pos_filter')}:
                    </dt>
                    <dd>
                        <div>
                            <select title={he.translate('query__select_one_or_more_pos_tags')}
                                    multiple={true}
                                    size={4}
                                    name="fc_pos" value={props.fc_pos}
                                    className="fc_pos"
                                    onChange={handleMultiSelectChange}>
                                {props.wPoSList.map((item, i) => {
                                    return <option key={i} value={item.n}>{item.n}</option>;
                                })}
                            </select>
                            <br />
                            <span className="note">({he.translate('query__use_ctrl_click_for')})</span>
                        </div>
                        <div className="all-any-none-sel">
                            <AllAnyNoneSelector inputName="fc_pos_type" value={props.fc_pos_type} />
                        </div>
                        <span>{'\u00A0'}{he.translate('query__of_these_items')}</span>
                    </dd>
                </dl>
            </div>
        );
    };

    // ------------------------------- <SpecifyContextForm /> ---------------------

    const SpecifyContextForm:React.FC<SpecifyContextFormProps & QueryContextModelState> = (props) => {

            return (
                <div>
                    <h3>{props.hasLemmaAttr
                        ? he.translate('query__lemma_filter')
                        : he.translate('query__word_form_filter')}
                    </h3>
                    <LemmaFilter
                        hasLemmaAttr={props.hasLemmaAttr}
                        fc_lemword_wsize={props.formData.fc_lemword_wsize}
                        fc_lemword={props.formData.fc_lemword}
                        fc_lemword_type={props.formData.fc_lemword_type}
                    />
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