/*
 * Copyright (c) 2016 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { Actions } from '../../models/subcorp/actions.js';
import * as Kontext from '../../types/kontext.js';
import { SubcorpusEditModel, SubcorpusEditModelState } from '../../models/subcorp/edit.js';
import { BoundWithProps, IActionDispatcher } from 'kombo';
import {
    isCQLSelection, isTTSelection, isServerWithinSelection, SubcorpusRecord,
    FormType, getFormTypeFromSelection } from '../../models/subcorp/common.js';
import { TextTypesModel } from '../../models/textTypes/main.js';
import { init as ttInit } from '../../views/textTypes/index.js';
import { init as withinViewInit } from './withinForm.js';
import { init as subcOverviewInit } from './overview.js';
import { SubcorpWithinFormModel } from '../../models/subcorp/withinForm.js';
import * as PluginInterfaces from '../../types/plugins/index.js';
import * as S from './style.js';


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
        children?:React.ReactNode;
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
        bibIdAttr:string;
        liveAttrsInitialized:boolean;
    }> = (props) => {

        React.useEffect(
            () => {
                if (isTTSelection(props.data.selections) && props.liveAttrsEnabled && !props.liveAttrsInitialized) {
                    dispatcher.dispatch(
                        PluginInterfaces.LiveAttributes.Actions.RefineClicked,
                        {
                            onlyUnlockedSelections: false
                        }
                    );
                }
            },
            []
        )

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

        const handleCreate = () => {
            dispatcher.dispatch<typeof Actions.ReuseQuery>({
                name: Actions.ReuseQuery.name,
                payload: {
                    selectionType: props.selectionType,
                    newName: props.data.name,
                    usesubcorp: props.data.usesubcorp,
                }
            });
        };

        const handleShowDownloadDocumentsWidget = () => {
            dispatcher.dispatch(
                PluginInterfaces.LiveAttributes.Actions.ToggleDocumentListWidget
            );
        };

        const textTypesControls = [];
        if (props.liveAttrsEnabled) {
            textTypesControls.push(
                <a onClick={handleShowDownloadDocumentsWidget}
                    className={"util-button" + (props.bibIdAttr ? "" : " disabled")}>
                    {he.translate('subc__save_list_of_documents')}
                </a>
            );
        }
        return (
            <TabContentWrapper htmlClass="reuse">
                <S.ReuseTabContentWrapper>
                    {props.data.isDraft ?
                        null :
                        <div className="info">
                            <layoutViews.InlineHelp noSuperscript={true} htmlClass="help-icon">
                                {he.translate('subclist__changes_can_be_saved_info')}
                            </layoutViews.InlineHelp>
                        </div>
                    }
                    {isCQLSelection(props.data.selections) ?
                        <RawCQL cql={props.data.selections} /> : null}
                    {isServerWithinSelection(props.data.selections) ?
                        <WithinForm /> : null}
                    {isTTSelection(props.data.selections) ?
                        <ttViews.TextTypesPanel LiveAttrsCustomTT={props.liveAttrsEnabled ?
                                    liveAttrsViews.LiveAttrsCustomTT : null}
                                    controls={textTypesControls}
                            LiveAttrsView={props.liveAttrsEnabled ?
                                liveAttrsViews.LiveAttrsView : null} /> :
                        null}
                        <p className='submit-buttons'>
                            {props.data.isDraft ?
                                <button type="button" className="default-button"
                                        onClick={handleCreate}>
                                    {he.translate('subcform__create_subcorpus')}
                                </button> :
                                <button type="button" className="default-button"
                                        onClick={handleReuse}>
                                    {he.translate('subclist__action_reuse')}
                                </button>
                            }
                        </p>
                </S.ReuseTabContentWrapper>
            </TabContentWrapper>
        );
    }

    // ------------------------ <FormActionFile /> --------------------------

    const FormActionFile:React.FC<{
        data:SubcorpusRecord;
        inputMode:FormType;
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

        const handleFinalize = () => {
            dispatcher.dispatch<typeof Actions.ReuseQuery>({
                name: Actions.ReuseQuery.name,
                payload: {
                    selectionType: props.inputMode,
                    newName: props.data.name,
                    usesubcorp: props.data.usesubcorp
                }
            });
        };

        return (
            <TabContentWrapper>
                <SubcOverview data={props.data} standalone={false} />
                <hr />
                <S.RestoreTabContentWrapper>
                    {props.data.isDraft ?
                        <button type="button" className="default-button" onClick={handleFinalize}>
                            {he.translate('subcform__finalize_subcorpus')}
                        </button> :
                        null
                    }
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
        usesubcorp:string;
        userId:number;
        bibIdAttr:string;
    }> = (props) => {

        const items:Array<{id:string, label:string, isDisabled?: boolean}> = [
            {
                id: 'restore',
                label: he.translate('subclist__action_file')
            },
            {
                id: 'structure',
                label: he.translate('subclist__action_structure'),
                isDisabled: props.data?.selections === undefined
            },
            {
                id: 'pub',
                label: he.translate('subclist__public_description_btn')
            }
        ];

        React.useEffect(
            () => {
                dispatcher.dispatch(
                    Actions.LoadSubcorpus,
                    {corpname: props.corpname, usesubcorp: props.usesubcorp}
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
                                inputMode={getFormTypeFromSelection(props.data.selections)} />
                            <FormActionReuse
                                key="action-reuse"
                                data={props.data}
                                liveAttrsEnabled={props.liveAttrsEnabled}
                                liveAttrsInitialized={props.liveAttrsInitialized}
                                selectionType={getFormTypeFromSelection(props.data.selections)}
                                bibIdAttr={props.bibIdAttr} />
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
        {corpname:string; usesubcorp:string; userId:number; bibIdAttr:string},
        SubcorpusEditModelState
    >(
        _SubcorpusEdit, subcorpEditModel
    );

}
