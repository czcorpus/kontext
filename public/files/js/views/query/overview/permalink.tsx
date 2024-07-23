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

import * as React from 'react';
import { IActionDispatcher, Bound } from 'kombo';

import * as Kontext from '../../../types/kontext';
import { QuerySaveAsFormModel, QuerySaveAsFormModelState } from '../../../models/query/save';
import { Actions } from '../../../models/query/actions';
import { Actions as MainMenuActions } from '../../../models/mainMenu/actions';
import { Actions as ConcActions } from '../../../models/concordance/actions';
import { SaveHintParagraph as Style_SaveHintParagraph } from '../style';
import * as S from './style';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    querySaveAsModel:QuerySaveAsFormModel
):React.ComponentClass<{}, QuerySaveAsFormModelState> {

    const PersistentConcordanceForm:React.FC<QuerySaveAsFormModelState> = (props) => {

        const layoutViews = he.getLayoutViews();

        const handleCloseEvent = () => {
            dispatcher.dispatch<typeof MainMenuActions.ClearActiveItem>({
                name: MainMenuActions.ClearActiveItem.name
            });
        }

        const handleArchivingStatus = (evt) => {
            dispatcher.dispatch<typeof ConcActions.MakeConcPermanent>({
                name: ConcActions.MakeConcPermanent.name,
                payload: {
                    revoke: hasFlagArchived
                }
            });
        }

        const createPermanentUrl = () => {
            return he.createActionLink('view', {q: '~' + props.queryId});
        }

        const handleCopyToClipboard = () => {
            dispatcher.dispatch(
                Actions.CopyPermalinkToClipboard,
                {url: createPermanentUrl()}
            );
        }

        const handleUserIdChange = (value: string) => {
            dispatcher.dispatch(Actions.UserQueryIdChange, {value});
        }

        const handleUserIdSubmit = () => {
            dispatcher.dispatch(Actions.UserQueryIdSubmit);
        }

        const handleAdvancedModeSwitch = () => {
            dispatcher.dispatch(Actions.PermalinkAdvancedModeSet, {value: !props.advancedMode});
        }

        React.useEffect(
            () => {
                dispatcher.dispatch(
                    ConcActions.GetConcArchiveStatus
                );
            },
            []
        );

        return (
            <layoutViews.ModalOverlay onCloseKey={handleCloseEvent}>
                <layoutViews.CloseableFrame onCloseClick={handleCloseEvent}
                            label={he.translate('concview__make_conc_link_permanent_hd')}
                            icon={<img
                                    src={he.createStaticUrl('img/share.svg')}
                                    alt="share"
                                    style={{width: '1em'}} />}>
                    {props.isBusy ?
                        <layoutViews.AjaxLoaderImage /> :
                        <S.PersistentConcordanceForm>
                            <div className="input-row">
                                <input type="text" readOnly={true}
                                        value={createPermanentUrl()}
                                        className="link archived"
                                        onClick={e => (e.target as HTMLInputElement).select()} />
                                <a onClick={handleCopyToClipboard}>
                                    <layoutViews.ImgWithMouseover
                                            src={he.createStaticUrl('img/copy-icon.svg')}
                                            src2={he.createStaticUrl('img/copy-icon_s.svg')}
                                            alt={he.translate('global__copy_to_clipboard')}
                                            style={{width: '1.8em', marginLeft: '0.3em'}} />
                                </a>
                            </div>
                            <S.AdvancedOptions>
                                <S.AdvancedModeSwitch>
                                    <layoutViews.ExpandButton isExpanded={props.advancedMode}
                                        onClick={handleAdvancedModeSwitch} />
                                    <a onClick={handleAdvancedModeSwitch}>{he.translate('global__advanced_options')}</a>
                                </S.AdvancedModeSwitch>
                                {props.advancedMode ?
                                    <div className="custom-name">
                                        <div>
                                            <label>
                                                {he.translate('concview__create_new_id_label')}:
                                            </label>
                                        </div>
                                        <div className="input">
                                            <input type="text" value={props.userQueryId}
                                                    onChange={e => handleUserIdChange(e.target.value)}
                                                    disabled={props.userQueryIdSubmit}/>
                                        </div>
                                        <div className="submit">
                                            <button type="button"
                                                        className={props.userQueryId.length === 0 || !props.userQueryIdValid || props.userQueryIdIsBusy ? "disabled-button" : "default-button"}
                                                        disabled={props.userQueryId.length === 0 || !props.userQueryIdValid || props.userQueryIdIsBusy}
                                                        onClick={handleUserIdSubmit}>
                                                    {he.translate('concview__set_new_id_button')}
                                            </button>
                                        </div>
                                    </div> :
                                    null
                                }
                            </S.AdvancedOptions>
                            <div className="messages">
                                <span style={{marginLeft: "1em"}}>{props.userQueryIdMsg.join(", ")}</span>
                                <div style={{width: '1.2em', marginLeft: '0.3em'}} hidden={props.userQueryIdValid}>
                                    <layoutViews.StatusIcon
                                        status="error" htmlClass="icon"/>
                                </div>
                            </div>
                        </S.PersistentConcordanceForm>
                    }
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }

    return Bound<QuerySaveAsFormModelState>(PersistentConcordanceForm, querySaveAsModel);
}



