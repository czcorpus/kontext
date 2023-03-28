/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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
import {IActionDispatcher, BoundWithProps} from 'kombo';
import * as Kontext from '../../types/kontext';
import * as PluginInterfaces from '../../types/plugins';
import { SubcorpFormModel, SubcorpFormModelState } from '../../models/subcorp/new';
import { SubcorpWithinFormModel } from '../../models/subcorp/withinForm';
import { TextTypesPanelProps } from '../textTypes';
import { Actions } from '../../models/subcorp/actions';
import { init as withinViewInit } from './withinForm';

import * as S from './style';


export interface FormsModuleArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    CorparchComponent:PluginInterfaces.Corparch.WidgetView;
    subcorpFormModel:SubcorpFormModel;
    subcorpWithinFormModel:SubcorpWithinFormModel;
    corparchWidgetId:string;
}

export interface SubcorpFormProps {
    ttProps:TextTypesPanelProps;
    ttComponent:React.ComponentClass<TextTypesPanelProps>;
}

export interface FormViews {
    SubcorpForm:React.ComponentClass<SubcorpFormProps>;
    SubcDescription:React.FC<{value:Kontext.FormValue<string>}>;
}

export function init({
    dispatcher,
    he,
    CorparchComponent,
    subcorpFormModel,
    subcorpWithinFormModel,
    corparchWidgetId
}:FormsModuleArgs):FormViews {

    const layoutViews = he.getLayoutViews();
    const WithinForm = withinViewInit(dispatcher, he, subcorpWithinFormModel);

    /**
     *
     */
    const SubcNameInput:React.FC<{
        value:Kontext.FormValue<string>;
    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<typeof Actions.FormSetSubcName>({
                name: Actions.FormSetSubcName.name,
                payload: {value: evt.target.value}
            });
        };

        return <layoutViews.ValidatedItem invalid={props.value.isInvalid} htmlClass="subcname">
                <input type="text" value={props.value.value} onChange={handleChange} />
            </layoutViews.ValidatedItem>;
    };

    // ------------------------ <SubcDescription /> --------------------------

    const SubcDescription:React.FC<{
        value:Kontext.FormValue<string>;

    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<HTMLTextAreaElement>) => {
            dispatcher.dispatch<typeof Actions.FormSetDescription>({
                name: Actions.FormSetDescription.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return <>
            <layoutViews.ValidatedItem invalid={props.value.isInvalid}>
                <textarea rows={8} cols={60} value={props.value.value} onChange={handleChange} />
            </layoutViews.ValidatedItem>
            <p className="note">({he.translate('global__markdown_supported')})</p>
            </>;
    };


    /**
     *
     */
    const SubcorpForm:React.FC<SubcorpFormProps & SubcorpFormModelState> = (props) => {

        const handleInputModeChange = (v) => {
            dispatcher.dispatch<typeof Actions.FormSetInputMode>({
                name: Actions.FormSetInputMode.name,
                payload: {
                    value: v
                }
            });
        };

        const handleCreateClick = () => {
            dispatcher.dispatch<typeof Actions.FormSubmit>({
                name: Actions.FormSubmit.name,
                payload: {
                    selectionType: props.inputMode,
                    asDraft: false,
                }
            });
        };

        return (
            <S.SubcorpForm>
                <table className="form">
                    <tbody>
                        <tr>
                            <th>
                                {he.translate('global__corpus')}:
                            </th>
                            <td>
                                <CorparchComponent widgetId={corparchWidgetId} />
                                <div className="starred"></div>
                            </td>
                        </tr>
                        <tr className="required">
                            <th style={{width: '20%'}}>
                                {he.translate('global__new_subcorpus_name_lab')}:
                            </th>
                            <td style={{width: '80%'}}>
                                <SubcNameInput value={props.subcname} />
                            </td>
                        </tr>
                        <tr>
                            <th>
                                {he.translate('subcform__public_description')}:
                                <p className="public-desc-help">
                                    ({he.translate('subcform__public_description_help')})
                                </p>
                            </th>
                            <td>
                                <SubcDescription value={props.description} />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div className="data-sel">
                    <layoutViews.TabView
                            className="FreqFormSelector"
                            defaultId={props.inputMode}
                            callback={handleInputModeChange}
                            items={[
                                {
                                    id: 'tt-sel',
                                    label: he.translate('subcform__mode_attr_list')
                                },
                                {
                                    id: 'within',
                                    label: he.translate('subcform__mode_raw_within')
                                }]}>
                        <props.ttComponent {...props.ttProps} />
                        <WithinForm />
                    </layoutViews.TabView>
                    <div id="subc-mixer-row">
                        <div className="widget"></div>
                    </div>
                </div>
                {props.isBusy ?
                    <layoutViews.AjaxLoaderBarImage /> :
                    <p className='submit-buttons'>
                        <button className="default-button" type="button"
                                onClick={handleCreateClick}>
                            {he.translate('subcform__create_subcorpus')}
                        </button>
                    </p>
                }
            </S.SubcorpForm>
        );
    }

    return {
        SubcorpForm: BoundWithProps<SubcorpFormProps, SubcorpFormModelState>(SubcorpForm, subcorpFormModel),
        SubcDescription
    };
}