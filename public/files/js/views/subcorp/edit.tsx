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
import { SubcorpListItem } from '../../models/subcorp/list';
import * as CoreViews from '../../types/coreViews';
import { List } from 'cnc-tskit';
import { Actions } from '../../models/subcorp/actions';

import * as S from './style';
import * as Kontext from '../../types/kontext';
import { SubcorpusEditModel, SubcorpusEditModelState } from '../../models/subcorp/edit';
import { IActionDispatcher } from 'kombo';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    subcorpEditModel:SubcorpusEditModel
) {

    const layoutViews = he.getLayoutViews();


    // ------------------------ <FormActionTemplate /> --------------------------

    const FormActionTemplate:React.FC<{auxInfoElm?:React.ReactElement}> = (props) => {

        return (
            <form className="subc-action">
                {props.auxInfoElm ? props.auxInfoElm : null}
                <fieldset>
                    <legend>
                        <img src={he.createStaticUrl('img/collapse.svg')} alt="action form" />
                    </legend>
                    {props.children}
                </fieldset>
            </form>
        );
    };

    // ------------------------ <FormActionReuse /> --------------------------

    class FormActionReuse extends React.Component<{
        idx:number;
        data:SubcorpListItem;
    },
    {
        newName:string;
        newCql:string;
    }> {

        constructor(props) {
            super(props);
            this._handleSubmit = this._handleSubmit.bind(this);
            this._handleNameChange = this._handleNameChange.bind(this);
            this._handleCqlChange = this._handleCqlChange.bind(this);
            const subcorpusName = this.props.data.origSubcName ? this.props.data.origSubcName : this.props.data.usesubcorp;
            this.state = {
                newName: `${subcorpusName} (${he.translate('global__copy')})`,
                newCql: this.props.data.cql
            };
        }

        _handleSubmit() {
            dispatcher.dispatch<typeof Actions.ReuseQuery>({
                name: Actions.ReuseQuery.name,
                payload: {
                    newName: this.state.newName,
                    newCql: this.state.newCql
                }
            });
        }

        _handleNameChange(evt) {
            this.setState({
                ...this.state,
                newName: evt.target.value
            });
        }

        _handleCqlChange(evt) {
            this.setState({
                ...this.state,
                newCql: evt.target.value
            });
        }

        render() {
            return (
                <FormActionTemplate>
                    <div>
                        <label htmlFor="inp_0sAoz">{he.translate('global__name')}:</label>
                        <input id="inp_0sAoz" type="text" style={{width: '20em'}}
                                defaultValue={this.state.newName}
                                onChange={this._handleNameChange} />

                    </div>
                    <div>
                        <label htmlFor="inp_zBuJi">{he.translate('global__cql_query')}:</label>
                        <textarea id="inp_zBuJi" className="cql" defaultValue={this.props.data.cql}
                                onChange={this._handleCqlChange} rows={4} />
                    </div>
                    <p>
                        <img src={he.createStaticUrl('img/warning-icon.svg')}
                                alt={he.translate('global__warning')}
                                style={{width: '1em', marginRight: '0.4em', verticalAlign: 'middle'}} />
                        {he.translate('subclist__reuse_query_warn')}
                    </p>
                    <div>
                        <button type="button" className="default-button"
                            onClick={this._handleSubmit}>{he.translate('subcform__create_subcorpus')}</button>
                    </div>
                </FormActionTemplate>
            );
        }
    }

    // ------------------------ <FormActionWipe /> --------------------------

    const FormActionWipe:React.FC<{
        idx:number;

    }> = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch<typeof Actions.WipeSubcorpus>({
                name: Actions.WipeSubcorpus.name,
                payload: {
                    idx: props.idx
                }
            });
        };

        return (
            <FormActionTemplate>
                <p>{he.translate('subclist__info_subc_will_be_wiped')}</p>
                <button type="button" className="default-button"
                        onClick={handleSubmit}>
                    {he.translate('global__confirm')}
                </button>
            </FormActionTemplate>
        );
    };


    // ------------------------ <FormActionRestore /> --------------------------

    const FormActionRestore:React.FC<{
        idx:number;

    }> = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch<typeof Actions.RestoreSubcorpus>({
                name: Actions.RestoreSubcorpus.name,
                payload: {
                    idx: props.idx
                }
            });
        };

        return (
            <FormActionTemplate>
                <p>{he.translate('subclist__info_subc_will_be_restored')}</p>
                <button type="button" className="default-button"
                        onClick={handleSubmit}>
                    {he.translate('global__confirm')}
                </button>
            </FormActionTemplate>
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

    class PublishingTab extends React.PureComponent<{
        description:string;
        published:boolean;
        publicCode:string;

    }> {

        constructor(props) {
            super(props);
            this.handleSubmitPublish = this.handleSubmitPublish.bind(this);
            this.handleTextAreaChange = this.handleTextAreaChange.bind(this);
            this.handleSubmitUpdateDesc = this.handleSubmitUpdateDesc.bind(this);
        }

        private handleSubmitPublish() {
            dispatcher.dispatch<typeof Actions.PublishSubcorpus>({
                name: Actions.PublishSubcorpus.name
            });
        }

        private handleSubmitUpdateDesc() {
            dispatcher.dispatch<typeof Actions.UpdatePublicDescription>({
                name: Actions.UpdatePublicDescription.name
            });
        }

        private handleTextAreaChange(evt:React.ChangeEvent<HTMLTextAreaElement>) {
            dispatcher.dispatch<typeof Actions.UpdatePublicDescription>({
                name: Actions.UpdatePublicDescription.name,
                payload: {
                    description: evt.target.value
                }
            });
        }

        private renderPublicCodeInfo() {
            if (this.props.publicCode) {
                return (
                    <dl className="public-code">
                        <dt>{he.translate('subclist__public_code')}:</dt>
                        <dd><input type="text" value={this.props.publicCode} readOnly={true} /></dd>
                    </dl>
                );
            }
            return null;
        }

        render() {
            return <FormActionTemplate auxInfoElm={this.renderPublicCodeInfo()}>
                <label htmlFor="inp_3IDJH">{he.translate('subcform__public_description')}:</label>
                <textarea className="desc" id="inp_3IDJH" cols={60} rows={10}
                        onChange={this.handleTextAreaChange}
                        value={this.props.description || ''} />
                <p className="note">({he.translate('global__markdown_supported')})</p>
                <p style={{width: '40em'}}>
                    <img src={he.createStaticUrl('img/warning-icon.svg')}
                        alt="warning-icon.svg" style={{width: '1.3em', verticalAlign: 'middle', marginRight: '0.3em'}} />
                    {
                        this.props.published ?
                            he.translate('subclist__ex_post_desc_update_warning') :
                            he.translate('subclist__ex_post_publish_warning')
                    }
                </p>
                <div>
                    <PublishSubmitButton onSubmit={this.props.published ? this.handleSubmitUpdateDesc :
                                            this.handleSubmitPublish} published={this.props.published} />
                </div>
            </FormActionTemplate>
        }
    };


    // ------------------------ <SubcorpusEdit /> --------------------------

    const SubcorpusEdit:React.FC<SubcorpusEditModelState> = (props) => {

        // TODO avail translations:
        // subclist__public_access_btn
        // subclist__action_reuse
        // subclist__subc_actions_{subc}

        let items: Array<{id:string, label:string}> = [
            {id: 'pub', label: he.translate('subclist__public_access_btn')},
            {id: 'reuse', label: he.translate('subclist__action_reuse')},
            {id: 'restore', label: he.translate('subclist__action_restore')},
            {id: 'wipe', label: he.translate('subclist__action_wipe')}
        ];
        return (
            <layoutViews.ModalOverlay onCloseKey={this.props.onCloseClick}>
                <layoutViews.CloseableFrame onCloseClick={this.props.onCloseClick}
                        customClass="subcorp-actions"
                        autoWidth={CoreViews.AutoWidth.WIDE}
                        label={he.translate('subclist__subc_actions_{subc}', {subc: this.props.data.name})}>
                    <div>
                        <layoutViews.TabView
                                className="ActionMenu"
                                callback={this.handleActionSelect}
                                items={items} >
                            <PublishingTab key="publish" published={props.data.published}
                                description={props.data.description}
                                publicCode={props.data.published ? props.data.usesubcorp : null} />
                            <FormActionReuse key="action-reuse" idx={this.props.idx} data={this.props.data} />
                            <FormActionRestore key="restore" idx={this.props.idx}  />, <FormActionWipe key="wipe" idx={this.props.idx} />
                        </layoutViews.TabView>
                        <div className="loader-wrapper">
                            {this.props.modelIsBusy ? <layoutViews.AjaxLoaderBarImage /> : null}
                        </div>
                    </div>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        )
    }

}
