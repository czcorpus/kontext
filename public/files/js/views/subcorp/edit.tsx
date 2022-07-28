/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
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

import * as React from 'react';
import { Actions } from '../../models/subcorp/actions';

import * as Kontext from '../../types/kontext';
import { SubcorpusEditModel, SubcorpusEditModelState } from '../../models/subcorp/edit';
import { BoundWithProps, IActionDispatcher } from 'kombo';
import { isCQLSelection, isTTSelection, isServerWithinSelection, SubcorpusRecord } from '../../models/subcorp/common';
import { TextTypesModel } from '../../models/textTypes/main';
import { init as ttInit } from '../../views/textTypes/index';
import { init as withinViewInit } from './withinForm';
import { SubcorpWithinFormModel } from '../../models/subcorp/withinForm';
import * as PluginInterfaces from '../../types/plugins';
import * as S from './style';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    subcorpEditModel:SubcorpusEditModel,
    textTypesModel:TextTypesModel,
    subcorpWithinFormModel:SubcorpWithinFormModel,
    liveAttrsViews:PluginInterfaces.LiveAttributes.Views,
) {

    const layoutViews = he.getLayoutViews();
    const ttViews = ttInit(dispatcher, he, textTypesModel);
    const WithinForm = withinViewInit(dispatcher, he, subcorpWithinFormModel);


    // ------------------------ <TabContentWrapper /> --------------------------

    const TabContentWrapper:React.FC<{auxInfoElm?:React.ReactElement}> = (props) => (
        <S.TabContentWrapper>
            <form>
                {props.auxInfoElm ? props.auxInfoElm : null}
                <fieldset>
                    {props.children}
                </fieldset>
            </form>
        </S.TabContentWrapper>
    );

    // ------------------------ <FormActionReuseCQL /> --------------------------

    const FormActionReuseCQL:React.FC<{data: SubcorpusRecord}> = (props) => {

        let [state, setState] = React.useState({
            newName: props.data.origSubcName + ' (copy)',
            newCql: props.data.selections as string,
        });

        return (
            <div>
                <div>
                    <label htmlFor="inp_0sAoz">{he.translate('global__name')}:</label>
                    <input id="inp_0sAoz" type="text" style={{width: '20em'}}
                        onChange={e => setState({...state, newName: e.target.value})}
                        defaultValue={state.newName} />

                </div>
                <div>
                    <label htmlFor="inp_zBuJi">{he.translate('global__cql_query')}:</label>
                    <textarea id="inp_zBuJi" className="cql" defaultValue={JSON.stringify(state.newCql)}
                            onChange={e => setState({...state, newCql: e.target.value})}
                            rows={4} />
                </div>
                <p>
                    <img src={he.createStaticUrl('img/warning-icon.svg')}
                            alt={he.translate('global__warning')}
                            style={{width: '1em', marginRight: '0.4em', verticalAlign: 'middle'}} />
                </p>
                <div>
                    <button type="button" className="default-button"
                        //onClick={this._handleSubmit} TODO
                    >{he.translate('subcform__create_subcorpus')}</button>
                </div>
            </div>
        );
    }

    // ------------------------ <FormActionReuse /> --------------------------

    const FormActionReuse:React.FC<{data: SubcorpusRecord, liveAttrsEnabled: boolean}> = (props) => {
        return (
            <TabContentWrapper>
                {isCQLSelection(props.data.selections) ? <FormActionReuseCQL data={props.data} /> : null}
                {isServerWithinSelection(props.data.selections) ? <WithinForm /> : null}
                {isTTSelection(props.data.selections) ? <ttViews.TextTypesPanel LiveAttrsCustomTT={props.liveAttrsEnabled ? liveAttrsViews.LiveAttrsCustomTT : null} LiveAttrsView={props.liveAttrsEnabled ? liveAttrsViews.LiveAttrsView : null} /> : null}
            </TabContentWrapper>
        );
    }

    // ------------------------ <FormActionFile /> --------------------------

    const FormActionFile:React.FC<{
        corpname: string;
        subcname: string;
        name: string;
        deleted: number;
    }> = (props) => {

        const handleReuse = () => {
            let newName = prompt("New subcorpus name:", `${props.name} (copy)`)
            if (newName) {
                dispatcher.dispatch<typeof Actions.ReuseQuery>({
                    name: Actions.ReuseQuery.name,
                    payload: {newName}
                });
            }
        };

        const handleArchive = () => {
            dispatcher.dispatch<typeof Actions.ArchiveSubcorpus>({
                name: Actions.ArchiveSubcorpus.name,
                payload: {
                    corpname: props.corpname,
                    subcname: props.subcname,
                }
            });
        };

        const handleRestore = () => {
            dispatcher.dispatch<typeof Actions.RestoreSubcorpus>({
                name: Actions.RestoreSubcorpus.name
            });
        };

        const handleWipe = () => {
            if (window.confirm(he.translate('subclist__subc_delete_confirm_msg'))) {
                dispatcher.dispatch<typeof Actions.WipeSubcorpus>({
                    name: Actions.WipeSubcorpus.name,
                });
            }
        };

        return (
            <TabContentWrapper>
                {props.deleted ?
                    <p>{he.translate('subclist__archived')}: {he.formatDate(new Date(props.deleted * 1000), 1)}</p> :
                    null
                }
                <S.RestoreTabContentWrapper>
                    <button type="button" className="default-button"
                            onClick={handleReuse}>
                        {he.translate('subclist__action_reuse')}
                    </button>
                    {props.deleted ?
                        <button type="button" className="default-button"
                                onClick={handleRestore}>
                            {he.translate('global__restore')}
                        </button> :
                        <button type="button" className="default-button"
                                onClick={handleArchive}>
                            {he.translate('subclist__archive_subcorp')}
                        </button>
                    }
                    <button type="button" className="danger-button"
                            onClick={handleWipe}>
                        {he.translate('subclist__action_wipe')}
                    </button>
                </S.RestoreTabContentWrapper>
            </TabContentWrapper>
        );
    };

    // ------------------------ <PublishSubmitButton /> --------------------------

    const PublishSubmitButton:React.FC<{
        published:boolean;
        onSubmit:()=>void;

    }> = (props) => {
        return <button type="button" className="default-button"
                onClick={props.onSubmit}>
            {props.published ?
                he.translate('subclist__update_public_desc_btn') :
                he.translate('subclist__publish_now_btn')
            }
        </button>;
    };


    // ------------------------ <PublishingTab /> --------------------------

    const PublishingTab:React.FC<{
        descriptionRaw:string;
        published:boolean;
        publicCode:string;

    }> = (props) => {

        const handleSubmitUpdateDesc = () => {
            dispatcher.dispatch<typeof Actions.SubmitPublicDescription>({
                name: Actions.SubmitPublicDescription.name
            });
        };

        const handleTextAreaChange = (evt:React.ChangeEvent<HTMLTextAreaElement>) => {
            dispatcher.dispatch<typeof Actions.UpdatePublicDescription>({
                name: Actions.UpdatePublicDescription.name,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return <TabContentWrapper>
            <label htmlFor="inp_3IDJH">{he.translate('subcform__public_description')}:</label>
            <textarea className="desc" id="inp_3IDJH" cols={60} rows={10}
                    onChange={handleTextAreaChange}
                    value={props.descriptionRaw || ''} />
            <p className="note">({he.translate('global__markdown_supported')})</p>
            <div>
                <PublishSubmitButton onSubmit={handleSubmitUpdateDesc} published={props.published} />
            </div>
        </TabContentWrapper>
    };


    // ------------------------ <SubcorpusEdit /> --------------------------

    const _SubcorpusEdit:React.FC<SubcorpusEditModelState & {corpname:string; subcname: string}> = (props) => {

        const items:Array<{id:string, label:string, isDisabled?: boolean}> = [
            {id: 'restore', label: he.translate('subclist__action_file')},
            {id: 'structure', label: he.translate('subclist__action_structure'), isDisabled: props.data?.selections === undefined},
            {id: 'pub', label: he.translate('subclist__public_description_btn')}
        ];

        React.useEffect(
            () => {
                dispatcher.dispatch(
                    Actions.LoadSubcorpus,
                    {corpname: props.corpname, subcname: props.subcname}
                );
            },
            []
        );

        return (
            <div>
                {!props.data ?
                    <layoutViews.AjaxLoaderImage /> :
                    <>
                        <layoutViews.TabView className="ActionMenu" items={items} >
                            <FormActionFile key="restore" corpname={props.data.corpname} subcname={props.data.usesubcorp} name={props.data.origSubcName} deleted={props.data.deleted} />
                            <FormActionReuse key="action-reuse" data={props.data} liveAttrsEnabled={props.liveAttrsEnabled} />
                            <PublishingTab key="publish" published={!!props.data.published}
                                descriptionRaw={props.data.descriptionRaw}
                                publicCode={props.data.published ? props.data.usesubcorp : null} />
                        </layoutViews.TabView>
                        <div className="loader-wrapper">
                            {props.isBusy ? <layoutViews.AjaxLoaderBarImage /> : null}
                        </div>
                    </>
            }
            </div>
        )
    }

    return BoundWithProps<{corpname:string; subcname:string}, SubcorpusEditModelState>(_SubcorpusEdit, subcorpEditModel);

}
