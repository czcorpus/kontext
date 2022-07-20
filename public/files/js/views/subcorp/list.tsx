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
import * as Kontext from '../../types/kontext';
import {
    SubcorpListModel, SubcListFilter, SortKey, UnfinishedSubcorp, SubcorpListItem,
    SubcorpListModelState
} from '../../models/subcorp/list';
import { List } from 'cnc-tskit';
import { Actions } from '../../models/subcorp/actions';
import { init as editViewInit } from './edit';

import * as S from './style';
import { SubcorpusEditModel } from '../../models/subcorp/edit';
import { TextTypesModel } from '../../models/textTypes/main';
import { SubcorpWithinFormModel } from '../../models/subcorp/withinForm';



export interface SubcorpListProps {

}

export interface ListViews {
    SubcorpList:React.ComponentClass<SubcorpListProps>;
}

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    subcorpLinesModel:SubcorpListModel,
    subcorpEditModel:SubcorpusEditModel,
    textTypesModel:TextTypesModel,
    subcorpWithinFormModel:SubcorpWithinFormModel
) {

    const layoutViews = he.getLayoutViews();
    const SubcorpEdit = editViewInit(dispatcher, he, subcorpEditModel, textTypesModel, subcorpWithinFormModel);

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

    // ------------------------ <ArchiveButton /> -----------------------------

    const ArchiveButton:React.FC<{
        rowIdx:number;
        subcname:string;

    }> = (props) => {

        const handleSubmit = () => {
            dispatcher.dispatch<typeof Actions.ArchiveSubcorpus>({
                name: Actions.ArchiveSubcorpus.name,
                payload: {
                    rowIdx: props.rowIdx
                }
            });
        };

        return <layoutViews.DelItemIcon className="archive-subc"
                    title={he.translate('subclist__archive_subcorp')}
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
                    {
                        corpname: item.corpname,
                        usesubcorp: item.usesubcorp
                    }
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
                        <a onClick={()=>props.actionButtonHandle(props.idx)}>
                            {he.translate('subclist__subc_properties')}
                        </a>
                </td>
                <td>
                    {!props.item.deleted ?
                        <ArchiveButton rowIdx={props.idx} subcname={props.item.usesubcorp} /> :
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
            dispatcher.dispatch<typeof Actions.SortLines>({
                name: Actions.SortLines.name,
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
                dispatcher.dispatch<typeof Actions.PublishItem>({
                    name: Actions.PublishItem.name,
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
                            <th />
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

        const handleShowArchived = () => {
            dispatcher.dispatch<typeof Actions.UpdateFilter>({
                name: Actions.UpdateFilter.name,
                payload: {
                    corpname: props.filter.corpname,
                    show_archived: !props.filter.show_archived
                }
            });
        };

        const handleCorpusSelection = (evt) => {
            dispatcher.dispatch<typeof Actions.UpdateFilter>({
                name: Actions.UpdateFilter.name,
                payload: {
                    corpname: evt.target.value,
                    show_archived: props.filter.show_archived
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
                            <label htmlFor="inp_EDPtb">{he.translate('subclist__show_archived')}:</label>
                            <input id="inp_EDPtb" type="checkbox" onChange={handleShowArchived} checked={props.filter['show_archived']} />
                        </div> :
                        null
                    }
                </fieldset>
            </form>
        );
    };




    // ------------------------ <SubcorpList /> --------------------------

    class SubcorpList extends React.Component<SubcorpListProps & SubcorpListModelState> {

        constructor(props) {
            super(props);
            this._handleActionButton = this._handleActionButton.bind(this);
            this._handleActionsClose = this._handleActionsClose.bind(this);
        }

        _handleActionButton(action:string, idx:number) {
            const item = this.props.lines[idx];
            dispatcher.dispatch<typeof Actions.ShowSubcEditWindow>({
                name: Actions.ShowSubcEditWindow.name,
                payload: {
                    corpname: item.corpname,
                    subcname: item.usesubcorp
                }
            });
        }

        _handleActionsClose() {
            dispatcher.dispatch<typeof Actions.HideSubcEditWindow>({
                name: Actions.HideSubcEditWindow.name,
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
                    {this.props.editWindowSubcorpus !== null
                        ? (
                            <layoutViews.ModalOverlay onCloseKey={this._handleActionsClose}>
                                <layoutViews.CloseableFrame onCloseClick={this._handleActionsClose}
                                        label="subc. properties (TODO msg)" scrollable={true}>
                                    <SubcorpEdit corpname={this.props.editWindowSubcorpus[0]} subcname={this.props.editWindowSubcorpus[1]} />
                                </layoutViews.CloseableFrame>
                            </layoutViews.ModalOverlay>
                        ) : null}
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