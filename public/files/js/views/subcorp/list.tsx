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
import {IActionDispatcher, BoundWithProps} from 'kombo';
import {Kontext} from '../../types/common';
import {SubcorpListModel, SubcListFilter, SortKey, UnfinishedSubcorp, SubcorpListItem, SubcorpListModelState} from '../../models/subcorp/list';
import { CoreViews } from '../../types/coreViews';
import { List } from 'cnc-tskit';
import { Actions, ActionName } from '../../models/subcorp/actions';

import * as S from './style';



export interface SubcorpListProps {

}

export interface ListViews {
    SubcorpList:React.ComponentClass<SubcorpListProps>;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            subcorpLinesModel:SubcorpListModel) {

    const layoutViews = he.getLayoutViews();

    // ------------------------ <TrUnfinishedLine /> --------------------------

    const TrUnfinishedLine:React.FC<{
        item:UnfinishedSubcorp;

    }> = (props) => {

        return (
            <tr>
                <td>
                    {props.item.name}
                </td>
                <td className="processing">
                    {props.item.failed ?
                        he.translate('subclist__failed_item') :
                        he.translate('global__processing')
                    }
                </td>
                <td className="num">{he.formatDate(props.item.created, 1)}</td>
                <td />
                <td />
                <td />
            </tr>
        );
    };

    // ------------------------ <PublishCheckbox /> -----------------------------

    const PublishCheckbox:React.FC<{
        value:boolean;
        onChange:()=>void;

    }> = (props) => {
        return <input type="checkbox" checked={props.value} onChange={props.onChange} />;
    };

    // ------------------------ <DeleteButton /> -----------------------------

    const DeleteButton:React.FC<{
        rowIdx:number;
        subcname:string;

    }> = (props) => {

        const handleSubmit = () => {
            if (window.confirm(he.translate('subclist__subc_delete_confirm_{subc}', {subc: props.subcname}))) {
                dispatcher.dispatch<Actions.DeleteSubcorpus>({
                    name: ActionName.DeleteSubcorpus,
                    payload: {
                        rowIdx: props.rowIdx
                    }
                });
            }
        };

        return <layoutViews.DelItemIcon className="delete-subc"
                    title={he.translate('subclist__delete_subcorp')}
                    onClick={handleSubmit} />;
    }

    // ------------------------ <TrDataLine /> --------------------------

    const TrDataLine:React.FC<{
        idx:number;
        item:SubcorpListItem;
        publishCheckboxHandle:(idx:number)=>void;
        actionButtonHandle:(idx:number)=>void;

    }> = (props) => {

        const renderLabel = () => {
            const item = props.item;
            if (!item.deleted) {
                const title = he.translate('subclist__search_in_subc');
                const href = he.createActionLink(
                    'query',
                    [
                        ['corpname', item.corpname],
                        ['usesubcorp', item.usesubcorp]
                    ]
                );
                return <a title={title} href={href}>{item.name}</a>;

            } else {
                return <span>{props.item.name}</span>;
            }
        };

        return (
            <tr>
                <td>
                    {renderLabel()}
                </td>
                <td className="num">
                {   props.item.size ? he.formatNumber(props.item.size) : '-'}
                </td>
                <td>
                    {he.formatDate(props.item.created, 1)}
                </td>
                <td>
                    {props.item.deleted ?
                        null :
                        <PublishCheckbox value={props.item.published}
                                onChange={()=>props.publishCheckboxHandle(props.idx)} />
                    }
                </td>
                <td className="action-link">
                    {props.item.cql ?
                        <a onClick={()=>props.actionButtonHandle(props.idx)}
                                title={he.translate('subclist__click_to_access_the_backup')}>{'\u2713'}</a> :
                        null
                    }
                </td>
                <td>
                    {!props.item.deleted ?
                        <DeleteButton rowIdx={props.idx} subcname={props.item.usesubcorp} /> :
                        null
                    }
                </td>
            </tr>
        );
    };

    // ------------------------ <ThSortable /> --------------------------

    const ThSortable:React.FC<{
        ident:string;
        sortKey:SortKey;
        label:string;

    }> = (props) => {

        const renderSortFlag = () => {
            if (props.sortKey) {
                if (props.sortKey.reverse) {
                    return <img className="sort-flag" src={he.createStaticUrl('img/sort_desc.svg')} />;

                } else {
                    return <img className="sort-flag" src={he.createStaticUrl('img/sort_asc.svg')} />;
                }

            } else {
                return null;
            }
        };

        const handleSortClick = () => {
            dispatcher.dispatch<Actions.SortLines>({
                name: ActionName.SortLines,
                payload: {
                    colName: props.ident,
                    reverse: props.sortKey ? !props.sortKey.reverse : false
                }
            });
        };

        const getTitle = () => {
            if (props.sortKey) {
                return he.translate('global__sorted_click_change');
            }
            return he.translate('global__click_to_sort');
        };

        return (
            <th>
                <a onClick={handleSortClick} title={getTitle()}>
                    {props.label}
                    {renderSortFlag()}
                </a>
            </th>
        );
    };

    // ------------------------ <DataTable /> --------------------------

    class DataTable extends React.Component<{
        actionButtonHandle:(action:string, idx:number)=>void;
        lines:Array<SubcorpListItem>;
        sortKey:SortKey;
        unfinished:Array<UnfinishedSubcorp>;
    }> {

        constructor(props) {
            super(props);
            this._handlePublishCheckbox = this._handlePublishCheckbox.bind(this);
        }

        _exportSortKey(name) {
            if (name === this.props.sortKey.name) {
                return this.props.sortKey;
            }
            return null;
        }

        _handlePublishCheckbox(corpname:string, subcname:string):void {
            if (window.confirm(he.translate('subclist__publish_warning'))) {
                dispatcher.dispatch<Actions.PublishItem>({
                    name: ActionName.PublishItem,
                    payload: {
                        corpname: corpname,
                        subcname: subcname
                    }
                });
            }
        }

        render() {
            return (
                <table className="data">
                    <tbody>
                        <tr>
                            <ThSortable ident="name" sortKey={this._exportSortKey('name')} label={he.translate('subclist__col_name')} />
                            <ThSortable ident="size" sortKey={this._exportSortKey('size')} label={he.translate('subclist__col_size')} />
                            <ThSortable ident="created" sortKey={this._exportSortKey('created')} label={he.translate('subclist__col_created')} />
                            <th>{he.translate('subclist__col_published')}</th>
                            <th>{he.translate('subclist__col_backed_up')}</th>
                            <th />
                        </tr>
                        {List.map(item => <TrUnfinishedLine key={`${item.name}:${item.created}`} item={item} />, this.props.unfinished)}
                        {List.map((item, i) => (
                            <TrDataLine key={`${i}:${item.name}`} idx={i} item={item}
                                    actionButtonHandle={this.props.actionButtonHandle.bind(null, 'reuse')}
                                    publishCheckboxHandle={this.props.actionButtonHandle.bind(null, 'pub')} />
                        ), this.props.lines)}
                    </tbody>
                </table>
            );
        }
    }

    // ------------------------ <FilterForm /> --------------------------

    const FilterForm:React.FC<{
        filter:SubcListFilter;
        relatedCorpora:Array<string>;
        usesSubcRestore:boolean;

    }> = (props) => {

        const handleShowDeleted = () => {
            dispatcher.dispatch<Actions.UpdateFilter>({
                name: ActionName.UpdateFilter,
                payload: {
                    corpname: props.filter.corpname,
                    show_deleted: !props.filter.show_deleted
                }
            });
        };

        const handleCorpusSelection = (evt) => {
            dispatcher.dispatch<Actions.UpdateFilter>({
                name: ActionName.UpdateFilter,
                payload: {
                    corpname: evt.target.value,
                    show_deleted: props.filter.show_deleted
                }
            });
        };

        return (
            <form className="filter">
                <fieldset>
                    <legend>{he.translate('subclist__filter_heading')}</legend>
                    <div>
                        <label htmlFor="inp_YT2rx">{he.translate('global__corpus')}: </label>
                        <select id="inp_YT2rx" value={props.filter.corpname}
                                    onChange={handleCorpusSelection}>
                                <option value="">--</option>
                                {List.map(item => <option key={item} value={item}>{item}</option>, props.relatedCorpora)}
                            </select>
                    </div>
                    {props.usesSubcRestore ?
                        <div>
                            <label htmlFor="inp_EDPtb">{he.translate('subclist__show_deleted')}:</label>
                            <input id="inp_EDPtb" type="checkbox" onChange={handleShowDeleted} checked={props.filter['show_deleted']} />
                        </div> :
                        null
                    }
                </fieldset>
            </form>
        );
    };

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
            dispatcher.dispatch<Actions.ReuseQuery>({
                name: ActionName.ReuseQuery,
                payload: {
                    idx: this.props.idx,
                    newName: this.state.newName,
                    newCql: this.state.newCql
                }
            });
        }

        _handleNameChange(evt) {
            const newState = he.cloneState(this.state);
            newState.newName = evt.target.value;
            this.setState(newState);
        }

        _handleCqlChange(evt) {
            const newState = he.cloneState(this.state);
            newState.newCql = evt.target.value;
            this.setState(newState);
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
            dispatcher.dispatch<Actions.WipeSubcorpus>({
                name: ActionName.WipeSubcorpus,
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
            dispatcher.dispatch<Actions.RestoreSubcorpus>({
                name: ActionName.RestoreSubcorpus,
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
        rowIdx:number;
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
            dispatcher.dispatch<Actions.PublishSubcorpus>({
                name: ActionName.PublishSubcorpus,
                payload: {
                    rowIdx: this.props.rowIdx,
                    description: this.props.description
                }
            });
        }

        private handleSubmitUpdateDesc() {
            dispatcher.dispatch<Actions.SubmitPublicDescription>({
                name: ActionName.SubmitPublicDescription,
                payload: {
                    rowIdx: this.props.rowIdx
                }
            });
        }

        private handleTextAreaChange(evt:React.ChangeEvent<HTMLTextAreaElement>) {
            dispatcher.dispatch<Actions.UpdatePublicDescription>({
                name: ActionName.UpdatePublicDescription,
                payload: {
                    rowIdx: this.props.rowIdx,
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


    // ------------------------ <ActionBox /> --------------------------

    class ActionBox extends React.PureComponent<{
        idx:number;
        action:string;
        data:SubcorpListItem;
        modelIsBusy:boolean;
        onCloseClick:()=>void;

    }> {

        constructor(props) {
            super(props);
            this.handleActionSelect = this.handleActionSelect.bind(this);
        }

        handleActionSelect(action) {
            dispatcher.dispatch<Actions.SetActionBoxType>({
                name: ActionName.SetActionBoxType,
                payload: {value: action}
            });
        }

        render() {
            let items: Array<{id:string, label:string}> = [];
            let children = [];
            if (!this.props.data.deleted) {
                items.push({id: 'pub', label: he.translate('subclist__public_access_btn')});
                children.push(<PublishingTab key="publish" published={this.props.data.published}
                    description={this.props.data.description} rowIdx={this.props.idx}
                    publicCode={this.props.data.published ? this.props.data.usesubcorp : null} />)
            }
            if (!!this.props.data.cql) {
                items.push({id: 'reuse', label: he.translate('subclist__action_reuse')})
                children.push(<FormActionReuse key="action-reuse" idx={this.props.idx} data={this.props.data} />);
            }
            if (!!this.props.data.cql && this.props.data.deleted) {
                items.push(
                    {id: 'restore', label: he.translate('subclist__action_restore')},
                    {id: 'wipe', label: he.translate('subclist__action_wipe')}
                )
                children.push(<FormActionRestore key="restore" idx={this.props.idx}  />, <FormActionWipe key="wipe" idx={this.props.idx} />);
            }

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
                                {children}
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


    // ------------------------ <SubcorpList /> --------------------------

    class SubcorpList extends React.Component<SubcorpListProps & SubcorpListModelState> {

        constructor(props) {
            super(props);
            this._handleActionButton = this._handleActionButton.bind(this);
            this._handleActionsClose = this._handleActionsClose.bind(this);
        }

        _handleActionButton(action:string, idx:number) {
            dispatcher.dispatch<Actions.ShowActionWindow>({
                name: ActionName.ShowActionWindow,
                payload: {
                    value: idx,
                    action: action
                }
            });
        }

        _handleActionsClose() {
            dispatcher.dispatch<Actions.HideActionWindow>({
                name: ActionName.HideActionWindow,
                payload: {}
            });
        }

        render() {
            return (
                <S.SubcorpList>
                    <section className="inner">
                        <FilterForm filter={this.props.filter} relatedCorpora={this.props.relatedCorpora}
                                usesSubcRestore={this.props.usesSubcRestore} />
                    </section>
                    {this.props.actionBoxVisibleRow > -1
                        ? <ActionBox onCloseClick={this._handleActionsClose}
                                idx={this.props.actionBoxVisibleRow}
                                data={this.props.actionBoxVisibleRow > -1 ? this.props.lines[this.props.actionBoxVisibleRow] : null}
                                action={this.props.actionBoxActionType}
                                modelIsBusy={this.props.isBusy} />
                        : null}
                    <DataTable actionButtonHandle={this._handleActionButton}
                        lines={this.props.lines}
                        sortKey={this.props.sortKey}
                        unfinished={this.props.unfinished} />
                </S.SubcorpList>
            );
        }
    }

    return {
        SubcorpList: BoundWithProps(SubcorpList, subcorpLinesModel)
    };
}