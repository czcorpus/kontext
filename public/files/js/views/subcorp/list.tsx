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
import {IActionDispatcher, Bound} from 'kombo';
import * as Kontext from '../../types/kontext';
import {
    SubcorpListModel, SubcListFilter, SortKey, UnfinishedSubcorp, SubcorpListItem,
    SubcorpListModelState
} from '../../models/subcorp/list';
import * as PluginInterfaces from '../../types/plugins';
import { List } from 'cnc-tskit';
import { Actions } from '../../models/subcorp/actions';
import { init as editViewInit } from './edit';

import * as S from './style';
import { SubcorpusEditModel } from '../../models/subcorp/edit';
import { TextTypesModel } from '../../models/textTypes/main';
import { SubcorpWithinFormModel } from '../../models/subcorp/withinForm';
import { itemIsCorplist } from '../../plugins/treeCorparch/common';


export interface ListViews {
    SubcorpList:React.ComponentClass;
}

export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    subcorpLinesModel:SubcorpListModel,
    subcorpEditModel:SubcorpusEditModel,
    textTypesModel:TextTypesModel,
    subcorpWithinFormModel:SubcorpWithinFormModel,
    liveAttrsViews:PluginInterfaces.LiveAttributes.Views,
) {

    const layoutViews = he.getLayoutViews();
    const SubcorpEdit = editViewInit(dispatcher, he, subcorpEditModel, textTypesModel, subcorpWithinFormModel, liveAttrsViews);

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
            </tr>
        );
    };

    // ------------------------ <PropertiesButton /> -----------------------------

    const PropertiesButton:React.FC<{
        onClick:() => void;

    }> = (props) => {

        return <layoutViews.ConfIcon className="properties-subc"
                    title={he.translate('subclist__subc_properties')}
                    onClick={props.onClick} />;
    }

    // ------------------------ <TrDataLine /> --------------------------

    const TrDataLine:React.FC<{
        idx:number;
        item:SubcorpListItem;
        pattern:string;
        actionButtonHandle:(idx:number)=>void;

    }> = (props) => {

        const renderLabel = () => {
            const item = props.item;
            if (!item.archived) {
                const title = he.translate('subclist__search_in_subc');
                const href = he.createActionLink(
                    'query',
                    {
                        corpname: item.corpus_name,
                        usesubcorp: item.id
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
                        <PropertiesButton onClick={()=>props.actionButtonHandle(props.idx)} />
                </td>
                <td>{
                    props.pattern && !props.item.name.includes(props.pattern) ?
                    he.translate('subclist__pattern_in_description') : null
                }</td>
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
        pattern:string;
        lines:Array<SubcorpListItem>;
        sortKey:SortKey;
        unfinished:Array<UnfinishedSubcorp>;
    }> {

        constructor(props) {
            super(props);
        }

        _exportSortKey(name) {
            if (name === this.props.sortKey.name) {
                return this.props.sortKey;
            }
            return null;
        }

        render() {
            return (
                <table className="data">
                    <tbody>
                        <tr>
                            <ThSortable ident="name" sortKey={this._exportSortKey('name')} label={he.translate('subclist__col_name')} />
                            <ThSortable ident="size" sortKey={this._exportSortKey('size')} label={he.translate('subclist__col_size')} />
                            <ThSortable ident="created" sortKey={this._exportSortKey('created')} label={he.translate('subclist__col_created')} />
                            <th />
                            <th />
                        </tr>
                        {List.map(item => (
                            <TrUnfinishedLine key={`${item.name}:${item.created}`} item={item} />
                        ), this.props.unfinished)}
                        {List.map((item, i) => (
                            <TrDataLine key={`${i}:${item.name}`} idx={i} item={item} pattern={this.props.pattern}
                                    actionButtonHandle={this.props.actionButtonHandle.bind(null, 'reuse')} />
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
                    ...props.filter,
                    show_archived: !props.filter.show_archived,
                    page: '1',
                }
            });
        };

        const handleCorpusSelection = (evt) => {
            dispatcher.dispatch<typeof Actions.UpdateFilter>({
                name: Actions.UpdateFilter.name,
                payload: {
                    ...props.filter,
                    corpname: evt.target.value,
                    page: '1',
                }
            });
        };

        const handlePatternSearch = (evt) => {
            dispatcher.dispatch<typeof Actions.UpdateFilterDebounce>({
                name: Actions.UpdateFilterDebounce.name,
                payload: {
                    ...props.filter,
                    pattern: evt.target.value,
                    page: '1',
                }
            });
        };

        return (
            <form className="filter" onSubmit={e => {e.preventDefault()}}>
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
                    <div>
                        <label htmlFor="inp_EDPtb">{he.translate('subclist__show_archived')}:</label>
                        <input id="inp_EDPtb" type="checkbox" onChange={handleShowArchived} checked={props.filter.show_archived} />
                    </div>
                    <div>
                        <label htmlFor="inp_pattern">{he.translate('subclist__search_pattern')}:</label>
                        <input id="inp_pattern" onChange={handlePatternSearch} value={props.filter.pattern} />
                    </div>
                </fieldset>
            </form>
        );
    };


    // ------------------------ <SubcorpList /> --------------------------

    class SubcorpList extends React.Component<SubcorpListModelState> {

        constructor(props) {
            super(props);
            this._handleActionButton = this._handleActionButton.bind(this);
            this._handleActionsClose = this._handleActionsClose.bind(this);
            this._handlePageChangeByClick = this._handlePageChangeByClick.bind(this);
            this._handlePageChange = this._handlePageChange.bind(this);
        }

        _handleActionButton(action:string, idx:number) {
            const item = this.props.lines[idx];
            dispatcher.dispatch<typeof Actions.ShowSubcEditWindow>({
                name: Actions.ShowSubcEditWindow.name,
                payload: {
                    corpusName: item.corpus_name,
                    subcorpusId: item.id,
                    subcorpusName: item.name
                }
            });
        }

        _handleActionsClose() {
            dispatcher.dispatch<typeof Actions.HideSubcEditWindow>({
                name: Actions.HideSubcEditWindow.name,
                payload: {}
            });
        }

        _handlePageChangeByClick = (curr, step) => {
            dispatcher.dispatch<typeof Actions.SetPage>({
                name: Actions.SetPage.name,
                payload: {
                    page: String(Number(curr) + step),
                    confirmed: true,
                }
            });
        };

        _handlePageChange = (evt, confirmed: boolean = false) => {
            dispatcher.dispatch<typeof Actions.SetPage>({
                name: Actions.SetPage.name,
                payload: {
                    page: evt.target.value,
                    confirmed: confirmed,
                }
            });
        };

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
                                        label={he.translate('subclist__subc_actions_{subc}', {subc: this.props.editWindowSubcorpus.subcorpusName})}
                                        scrollable={true}>
                                    <SubcorpEdit corpname={this.props.editWindowSubcorpus.corpusName} subcname={this.props.editWindowSubcorpus.subcorpusId} />
                                </layoutViews.CloseableFrame>
                            </layoutViews.ModalOverlay>
                        ) : null}
                    <S.SubcPaginator className='ktx-pagination'>
                        <layoutViews.SimplePaginator
                            currentPage={this.props.filter.page}
                            isLoading={this.props.isBusy}
                            totalPages={this.props.totalPages}
                            handleKeyPress={e => this._handlePageChange(e, true)}
                            handlePageChangeByClick={this._handlePageChangeByClick}
                            handlePageChangeByInput={this._handlePageChange} />
                    </S.SubcPaginator>
                    <DataTable actionButtonHandle={this._handleActionButton}
                        pattern={this.props.filter.pattern}
                        lines={this.props.lines}
                        sortKey={this.props.sortKey}
                        unfinished={this.props.unfinished} />
                </S.SubcorpList>
            );
        }
    }

    return {
        SubcorpList: Bound(SubcorpList, subcorpLinesModel)
    };
}