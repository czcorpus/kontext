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
import { CtxLemwordType, CtxWindowType } from '../../models/query/common';


export interface SpecifyContextFormProps {
    hasLemmaAttr:boolean;
    lemmaWindowSizes:Array<number>;
    wPoSList:Array<{v:string; n:string}>;
    posWindowSizes:Array<number>;
}


export interface ContextViews {
    SpecifyContextForm:React.ComponentClass<SpecifyContextFormProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            queryContextModel:QueryContextModel):ContextViews {

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

    // ------------------------------- <TRWindowSelector /> ---------------------

    const TRWindowSelector:React.FC<{
        namePrefix:string;
        windowTypeSelector:CtxWindowType;
        windowSizeSelector:string;
        options:Array<number>;

    }> = (props) => {

        const changeHandler = (evt) => {
            dispatcher.dispatch<Actions.QueryInputSelectContextFormItem>({
                name: ActionName.QueryInputSelectContextFormItem,
                payload: {
                    name: evt.target.name,
                    value: evt.target.value
                }
            });
        };

        return (
            <tr>
                <th>{he.translate('query__window')}:</th>
                <td>
                    <select name={`${props.namePrefix}_window_type`}
                            value={props.windowTypeSelector}
                            onChange={changeHandler}>
                        <option value="left">{he.translate('query__left')}</option>
                        <option value="both">{he.translate('query__both')}</option>
                        <option value="right">{he.translate('query__right')}</option>
                    </select>
                    {'\u00A0'}
                    <select name={`${props.namePrefix}_wsize`}
                            value={props.windowSizeSelector}
                            onChange={changeHandler}>
                        {props.options.map((item) => {
                            return <option key={item}>{item}</option>
                        })}
                    </select>
                    {'\u00A0'}
                    {he.translate('query__window_tokens')}.
                </td>
            </tr>
        );
    };

    // ------------------------------- <TRLemmaWindowSelector /> ---------------------

    const TRLemmaWindowSelector:React.FC<{
        options:Array<number>;
        fc_lemword_window_type:CtxWindowType;
        fc_lemword_wsize:string;

    }> = (props) => {

        return <TRWindowSelector
                    options={props.options}
                    namePrefix="fc_lemword"
                    windowTypeSelector={props.fc_lemword_window_type}
                    windowSizeSelector={props.fc_lemword_wsize} />;
    };

    // ------------------------------- <TRPosWindowSelector /> ---------------------

    const TRPosWindowSelector:React.FC<{
        options:Array<number>;
        fc_pos_window_type:CtxWindowType;
        fc_pos_wsize:string;

    }> = (props) => {

            return <TRWindowSelector
                        options={props.options}
                        namePrefix="fc_pos"
                        windowTypeSelector={props.fc_pos_window_type}
                        windowSizeSelector={props.fc_pos_wsize} />;
    };

    // ------------------------------- <LemmaFilter /> ---------------------

    const LemmaFilter:React.FC<{
        hasLemmaAttr:boolean;
        fc_lemword_wsize:string;
        fc_lemword_type:CtxLemwordType;
        fc_lemword:string;
        fc_lemword_window_type:CtxWindowType;
        lemmaWindowSizes:Array<number>;

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

        return (
            <table className="form">
                <tbody>
                    <TRLemmaWindowSelector options={props.lemmaWindowSizes}
                        fc_lemword_window_type={props.fc_lemword_window_type}
                        fc_lemword_wsize={props.fc_lemword_wsize} />
                    <tr>
                        <th>
                        {props.hasLemmaAttr
                            ? he.translate('query__lw_lemmas')
                            : he.translate('query__lw_word_forms')
                        }
                        </th>
                        <td>
                            <input type="text" className="fc_lemword" name="fc_lemword" value={props.fc_lemword}
                                    onChange={handleInputChange} />
                            {'\u00A0'}
                            <AllAnyNoneSelector inputName="fc_lemword_type" value={props.fc_lemword_type} />
                            {'\u00A0'}
                            {he.translate('query__of_these_items')}.
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    // ------------------------------- <PoSFilter /> ---------------------

    const PoSFilter:React.FC<{
        posWindowSizes:Array<number>;
        fc_pos_window_type:CtxWindowType;
        fc_pos_wsize:string;
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

        return (
            <div className="pos-filter">
                <h3>{he.translate('query__pos_filter')}</h3>
                <table className="form">
                    <tbody>
                        <TRPosWindowSelector options={props.posWindowSizes}
                            fc_pos_window_type={props.fc_pos_window_type}
                            fc_pos_wsize={props.fc_pos_wsize} />
                        <tr>
                            <th>
                                {he.translate('query__pos_filter')}:<br />
                                <span className="note">({he.translate('query__use_ctrl_click_for')})</span>
                            </th>
                            <td>
                                <select title={he.translate('query__select_one_or_more_pos_tags')}
                                        multiple={true}
                                        size={4}
                                        name="fc_pos" value={props.fc_pos}
                                        onChange={handleMultiSelectChange}>
                                    {props.wPoSList.map((item, i) => {
                                        return <option key={i} value={item.n}>{item.n}</option>;
                                    })}
                                </select>
                            </td>
                            <td>
                                <AllAnyNoneSelector inputName="fc_pos_type" value={props.fc_pos_type} />
                                {'\u00A0'}
                                {he.translate('query__of_these_items')}.
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                        lemmaWindowSizes={props.lemmaWindowSizes}
                        fc_lemword_window_type={props.formData.fc_lemword_window_type}
                        fc_lemword_wsize={props.formData.fc_lemword_wsize}
                        fc_lemword={props.formData.fc_lemword}
                        fc_lemword_type={props.formData.fc_lemword_type}
                    />
                    {props.wPoSList && props.wPoSList.length > 0 ?
                        <PoSFilter
                            posWindowSizes={props.posWindowSizes}
                            wPoSList={props.wPoSList}
                            fc_pos_window_type={props.formData.fc_pos_window_type}
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