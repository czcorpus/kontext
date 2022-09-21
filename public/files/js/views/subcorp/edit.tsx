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
import { isCQLSelection, isTTSelection, isServerWithinSelection, SubcorpusRecord, FormType, getFormTypeFromSelection } from '../../models/subcorp/common';
import { TextTypesModel } from '../../models/textTypes/main';
import { init as ttInit } from '../../views/textTypes/index';
import { init as withinViewInit } from './withinForm';
import { init as subcOverviewInit } from './overview';
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
    const SubcOverview = subcOverviewInit(he);

    // ------------------------ <TabContentWrapper /> --------------------------

    const TabContentWrapper:React.FC<{
        auxInfoElm?:React.ReactElement;
        htmlClass?:string;
    }> = (props) => (
        <S.TabContentWrapper>
            <form className={props.htmlClass}>
                {props.auxInfoElm ? props.auxInfoElm : null}
                <fieldset>
                    {props.children}
                </fieldset>
            </form>
        </S.TabContentWrapper>
    );

    // ------------------------ <RawCQL /> --------------------------

    const RawCQL:React.FC<{cql:string}> = ({cql}) => {

        const handleInputChange = (e:React.ChangeEvent<HTMLTextAreaElement>) => {
            dispatcher.dispatch(
                Actions.FormRawCQLSetValue,
                {
                    value: e.target.value
                }
            );
        }

        return (
            <S.RawCQL>
                <label htmlFor="inp_zBuJi">{he.translate('global__cql_query')}:</label>
                <textarea id="inp_zBuJi" className="cql" value={cql}
                        onChange={handleInputChange}
                        rows={6} cols={50} />
            </S.RawCQL>
        );
    }

    // ------------------------ <FormActionReuse /> --------------------------

    const FormActionReuse:React.FC<{
        data:SubcorpusRecord;
        liveAttrsEnabled:boolean;
        selectionType:FormType;
    }> = (props) => {

        const handleReuse = () => {
            const newName = window.prompt(
                he.translate('global__new_subcorpus_name_lab') + ':',
                `${props.data.name} (copy)`
            );
            if (newName) {
                dispatcher.dispatch<typeof Actions.ReuseQuery>({
                    name: Actions.ReuseQuery.name,
                    payload: {
                        selectionType: props.selectionType,
                        newName,
                    }
                });
            }
        };

        return (
            <TabContentWrapper htmlClass="reuse">
                <div className="info">
                    <layoutViews.InlineHelp noSuperscript={true} htmlClass="help-icon">
                        {he.translate('subclist__changes_can_be_saved_info')}
                    </layoutViews.InlineHelp>
                </div>
                {isCQLSelection(props.data.selections) ?
                    <RawCQL cql={props.data.selections} /> : null}
                {isServerWithinSelection(props.data.selections) ?
                    <WithinForm /> : null}
                {isTTSelection(props.data.selections) ?
                    <ttViews.TextTypesPanel LiveAttrsCustomTT={props.liveAttrsEnabled ? liveAttrsViews.LiveAttrsCustomTT : null} LiveAttrsView={props.liveAttrsEnabled ? liveAttrsViews.LiveAttrsView : null} /> :
                    null}
                <button type="button" className="default-button"
                            onClick={handleReuse}>
                        {he.translate('subclist__action_reuse')}
                </button>
            </TabContentWrapper>
        );
    }

    // ------------------------ <FormActionFile /> --------------------------

    const FormActionFile:React.FC<{
        data:SubcorpusRecord;
        userId:number;
    }> = (props) => {

        const handleArchive = () => {
            dispatcher.dispatch<typeof Actions.ArchiveSubcorpus>({
                name: Actions.ArchiveSubcorpus.name,
                payload: {
                    corpname: props.data.corpname,
                    subcname: props.data.usesubcorp,
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
                <SubcOverview data={props.data} userId={props.userId} standalone={false} />
                <hr />
                <S.RestoreTabContentWrapper>
                    {props.data.archived ?
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
        onSubmit:()=>void;

    }> = (props) => (
        <button type="button" className="default-button" onClick={props.onSubmit}>
            {he.translate('subclist__update_public_desc_btn')}
        </button>
    );

    // ------------------------ <PublishingTab /> --------------------------

    const PublishingTab:React.FC<{
        subcname:string;
        description:string;
        descriptionRaw:string;
        publicCode:string;
        previewEnabled:boolean;
        unsavedChanges:boolean;

    }> = (props) => {

        const handleSubmitUpdateNameAndDesc = () => {
            dispatcher.dispatch<typeof Actions.SubmitNameAndPublicDescription>({
                name: Actions.SubmitNameAndPublicDescription.name
            });
        };

        const handleSubcNameChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
            dispatcher.dispatch<typeof Actions.UpdateSubcName>({
                name: Actions.UpdateSubcName.name,
                payload: {
                    value: evt.target.value
                }
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

        const handlePreviewModeSwitch = () => {
            dispatcher.dispatch<typeof Actions.TogglePublicDescription>({
                name: Actions.TogglePublicDescription.name
            });
        };

        return (
            <TabContentWrapper>
                <S.PublishingTab>
                    <div>
                        <label>
                            {he.translate('subcform__subcorpus_name')}
                            <input type="text" onChange={handleSubcNameChange} value={props.subcname} />
                        </label>
                    </div>
                    <div className="header-bar">
                        <layoutViews.InlineHelp noSuperscript={true} htmlClass="help-icon">
                            {he.translate('subclist__public_description_note')}
                        </layoutViews.InlineHelp>
                        <span>
                            {props.unsavedChanges ?
                                <span>{he.translate('subcform__unsaved_changes') + '\u00a0|\u00a0'}</span> :
                                null
                            }
                        </span>
                        <label>
                            {he.translate('subcform__public_desc_preview_switch')}
                            <input type="checkbox" onChange={handlePreviewModeSwitch} checked={props.previewEnabled} />
                        </label>
                    </div>
                    {props.previewEnabled ?
                        <div className="preview" dangerouslySetInnerHTML={{__html: props.description}} /> :
                        <textarea className="desc" cols={60} rows={10}
                                onChange={handleTextAreaChange}
                                value={props.descriptionRaw || ''} />
                    }
                    <p className="markdown-note note">({he.translate('global__markdown_supported')})</p>
                    <div>
                        <PublishSubmitButton onSubmit={handleSubmitUpdateNameAndDesc} />
                    </div>
                </S.PublishingTab>
            </TabContentWrapper>
        );
    };


    // ------------------------ <SubcorpusEdit /> --------------------------

    const _SubcorpusEdit:React.FC<
    SubcorpusEditModelState &
    {
        corpname:string;
        subcname:string;
        userId:number;
    }> = (props) => {

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
            <S.SubcorpusEdit>
                {!props.data ?
                    <layoutViews.AjaxLoaderImage /> :
                    <>
                        <layoutViews.TabView className="ActionMenu" items={items} >
                            <FormActionFile key="restore" data={props.data}
                                userId={props.userId} />
                            <FormActionReuse
                                key="action-reuse"
                                data={props.data}
                                liveAttrsEnabled={props.liveAttrsEnabled}
                                selectionType={getFormTypeFromSelection(props.data.selections)} />
                            <PublishingTab key="publish"
                                subcname={props.data.name}
                                descriptionRaw={props.data.descriptionRaw}
                                description={props.data.description}
                                previewEnabled={props.previewEnabled}
                                publicCode={props.data.usesubcorp}
                                unsavedChanges={props.prevRawDescription !== props.data.descriptionRaw} />
                        </layoutViews.TabView>
                        <div className="loader-wrapper">
                            {props.isBusy ? <layoutViews.AjaxLoaderBarImage /> : null}
                        </div>
                    </>
            }
            </S.SubcorpusEdit>
        )
    }

    return BoundWithProps<
        {corpname:string; subcname:string; userId: number},
        SubcorpusEditModelState
    >(
        _SubcorpusEdit, subcorpEditModel
    );

}
