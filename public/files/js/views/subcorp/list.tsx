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
import { createSelectId } from '../../models/subcorp/common';
import * as PluginInterfaces from '../../types/plugins';
import { Dict, List, pipe, tuple } from 'cnc-tskit';
import { Actions } from '../../models/subcorp/actions';
import { init as editViewInit } from './edit';

import * as S from './style';
import { SubcorpusEditModel } from '../../models/subcorp/edit';
import { TextTypesModel } from '../../models/textTypes/main';
import { SubcorpWithinFormModel } from '../../models/subcorp/withinForm';

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

    // ------------------------ <TrUnsavedSubc /> --------------------------

    const TrUnsavedSubc:React.FC<{
        item:UnfinishedSubcorp;

    }> = (props) => {
        return (
            <tr>
                <td>
                    {props.item.name}
                </td>
                <td>
                    {props.item.corpusName}
                </td>
                <td>
                    <layoutViews.AjaxLoaderBarImage />
                </td>
                <td className="num">{he.formatDate(props.item.created, 1)}</td>
                <td className="processing">
                    {props.item.error ?
                        he.translate('subclist__failed_item') :
                        he.translate('global__processing')
                    }
                </td>
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

    // ------------------------ <TDSelectLine /> ------------------------

    const TDSelectLine:React.FC<{
        selectId:string;
        selected:boolean;

    }> = ({selected, selectId}) => {

        const handleClick = () => {
            dispatcher.dispatch(
                Actions.ToggleSelectLine,
                {
                    selectId: selectId,
                }
            );
        };

        return (
            <td>
                <input type="checkbox" checked={selected} onChange={handleClick} />
            </td>
        );
    }

    // ------------------------ <TrDataLine /> --------------------------

    const TrDataLine:React.FC<{
        idx:number;
        item:SubcorpListItem;
        selectId:string;
        selected:boolean;
        actionButtonHandle:(idx:number)=>void;
        error?:string;

    }> = (props) => {

        const renderLabel = () => {
            const item = props.item;
            if (!item.archived && !item.is_draft) {
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
                if (item.is_draft) {
                    const title = he.translate('subclist__edit_draft');
                    const href = he.createActionLink(
                        'subcorpus/new',
                        {
                            corpname: item.corpus_name,
                            usesubcorp: item.id
                        }
                    );
                    return <a title={title} href={href} className="draft">{item.name}</a>;
                }
                return <span>{props.item.name}</span>;
            }
        };

        const notes = [];
        if (props.item.info) {
            List.push(props.item.info, notes);
        }
        if (props.item.archived) {
            List.push(he.translate('subclist__archived'), notes);
        }
        if (props.item.is_draft) {
            List.push(he.translate('subclist__draft'), notes);
        }

        return (
            <S.DataLineTr>
                <td>
                    {renderLabel()}
                </td>
                <td>
                    {props.item.corpus_name}
                </td>
                <td className="num">
                {   props.item.size ? he.formatNumber(props.item.size) : '-'}
                </td>
                <td>
                    {he.formatDate(props.item.created, 1)}
                </td>
                <td className={props.error ? 'processing' : null}>
                    {props.error ?
                        <span>{he.translate('subclist__failed_item')}</span> :
                        notes.join(', ')
                    }
                </td>
                <td>
                        <PropertiesButton onClick={()=>props.actionButtonHandle(props.idx)} />
                </td>
                <TDSelectLine selectId={props.selectId} selected={props.selected} />
            </S.DataLineTr>
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

    // ------------------------ <LineSelectionOps /> -------------------

    const LineSelectionOps:React.FC<{
        numSelected:number;

    }> = ({numSelected}) => {

        const handleClickClear = (props) => {
            dispatcher.dispatch(
                Actions.ClearSelectedLines
            );
        };

        const handleClickArchive = (props) => {
            dispatcher.dispatch(
                Actions.ArchiveSelectedLines
            );
        };

        const handleClickDelete = (props) => {
            if (window.confirm(he.translate('subclist__multi_subc_delete_confirm_msg'))) {
                dispatcher.dispatch(
                    Actions.DeleteSelectedLines
                );
            }
        };

        return (
            <S.LineSelectionOps>
                <label>
                {he.translate('subclist__selected_items')}: {numSelected}
                </label>
                <button type="button" className="util-button" onClick={handleClickClear}>
                    {he.translate('subclist__clear_selection')}
                </button>
                <button type="button" className="util-button" onClick={handleClickArchive}>
                    {he.translate('subclist__archive_subcorp')}
                </button>
                <button type="button" className="util-button" onClick={handleClickDelete}>
                    {he.translate('subclist__action_wipe')}
                </button>
            </S.LineSelectionOps>
        );
    };

    // ------------------------ <DataTable /> --------------------------

    const DataTable:React.FC<{
        actionButtonHandle:(action:string, idx:number)=>void;
        pattern:string;
        lines:Array<SubcorpListItem>;
        selectedItems:Array<string>;
        sortKey:SortKey;
        unfinished:Array<UnfinishedSubcorp>;
    }> = (props) => {

        const exportSortKey = (name) => {
            if (name === props.sortKey.name) {
                return props.sortKey;
            }
            return null;
        }

        const numSelected = props.selectedItems.length;
        const runningDrafts = pipe(
            props.unfinished,
            List.filter(x => !!x.subcorpusId),
            List.map(
                item => tuple(item.subcorpusId, item)
            ),
            Dict.fromEntries()
        );

        return (
            <div>
                <table className="data">
                    <tbody>
                        <tr>
                            <ThSortable ident="name" sortKey={exportSortKey('name')} label={he.translate('subclist__col_name')} />
                            <ThSortable ident="corpus_name" sortKey={exportSortKey('corpus_name')} label={he.translate('global__corpus')} />
                            <ThSortable ident="size" sortKey={exportSortKey('size')} label={he.translate('subclist__col_size')} />
                            <ThSortable ident="created" sortKey={exportSortKey('created')} label={he.translate('subclist__col_created')} />
                            <th>{he.translate('global__note_heading')}</th>
                            <th />
                            <th />
                        </tr>
                        {pipe(
                            props.unfinished,
                            List.filter(x => !x.finished),
                            List.map(item => (
                                <TrUnsavedSubc key={`${item.name}:${item.created}`} item={item} />
                            ))
                        )}
                        {pipe(
                            props.lines,
                            List.map(
                                (item, i) => {
                                    const selectId = createSelectId(item.corpus_name, item.id);
                                    return <TrDataLine
                                                key={`${i}:${item.name}`}
                                                idx={i}
                                                item={item}
                                                selectId={selectId}
                                                error={runningDrafts[item.id]?.error?.message}
                                                selected={props.selectedItems.includes(selectId)}
                                                actionButtonHandle={props.actionButtonHandle.bind(null, 'reuse')} />
                                }
                            )
                        )}
                    </tbody>
                </table>
                {numSelected > 0 ?
                    <LineSelectionOps numSelected={numSelected} /> :
                    null
                }
            </div>
        );
    }

    // ------------------------ <FilterForm /> --------------------------

    const FilterForm:React.FC<{
        filter:SubcListFilter;
        relatedCorpora:Array<string>;

    }> = (props) => {
        const MIN_PATTERN_LENGTH = 3
        const [pattern, setPattern] = React.useState(props.filter.pattern);

        const handleShowArchived = () => {
            dispatcher.dispatch<typeof Actions.UpdateFilter>({
                name: Actions.UpdateFilter.name,
                payload: {
                    filter: {
                        ...props.filter,
                        show_archived: !props.filter.show_archived,
                        page: '1',
                    },
                    debounced: false,
                }
            });
        };

        const handleCorpusSelection = (evt) => {
            dispatcher.dispatch<typeof Actions.UpdateFilter>({
                name: Actions.UpdateFilter.name,
                payload: {
                    filter: {
                        ...props.filter,
                        corpname: evt.target.value,
                        page: '1',
                    },
                    debounced: false,
                }
            });
        };

        const handlePatternSearch = (evt) => {
            setPattern(evt.target.value);

            let search = '';
            if (evt.target.value.length >= MIN_PATTERN_LENGTH) {
                search = evt.target.value;
            }

            if (props.filter.pattern !== search) {
                dispatcher.dispatch<typeof Actions.UpdateFilter>({
                    name: Actions.UpdateFilter.name,
                    payload: {
                        filter: {
                            ...props.filter,
                            pattern: search,
                            page: '1',
                        },
                        debounced: true,
                    }
                });
            };
        };

        return (
            <S.SubclistFilterForm className="filter" onSubmit={e => {e.preventDefault()}}>
                <fieldset>
                    <legend>{he.translate('subclist__filter_heading')}</legend>
                    <div className="inputs">
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
                            <input id="inp_EDPtb" type="checkbox" onChange={handleShowArchived} checked={!!props.filter.show_archived} />
                        </div>
                        <div>
                            <label htmlFor="inp_pattern">{he.translate('subclist__search_pattern')}:</label>
                            <input id="inp_pattern" onChange={handlePatternSearch} value={pattern} className={pattern.length < MIN_PATTERN_LENGTH ? 'inactive' : null}/>
                        </div>
                    </div>
                </fieldset>
            </S.SubclistFilterForm>
        );
    };


    // ------------------------ <SubcorpList /> --------------------------

    const SubcorpList:React.FC<SubcorpListModelState> = (props) => {

        const handleActionButton = (action:string, idx:number) => {
            const item = props.lines[idx];
            dispatcher.dispatch(
                Actions.ShowSubcEditWindow,
                {
                    corpusName: item.corpus_name,
                    subcorpusId: item.id,
                    subcorpusName: item.name,
                    bibIdAttr: item.bib_id_attr
                }
            );
        };

        const handleActionsClose = () => {
            dispatcher.dispatch(
                Actions.HideSubcEditWindow,
            );
        };

        const handlePageChange = (page:string) => {
            dispatcher.dispatch(
                Actions.SetPage,
                {page}
            );
        };

        return (
            <S.SubcorpList>
                <section className="inner">
                    <FilterForm filter={props.filter} relatedCorpora={props.relatedCorpora} />
                </section>
                {props.editWindowSubcorpus !== null
                    ? (
                        <layoutViews.ModalOverlay onCloseKey={handleActionsClose}>
                            <layoutViews.CloseableFrame onCloseClick={handleActionsClose}
                                    label={he.translate('subclist__subc_actions_{subc}', {subc: props.editWindowSubcorpus.subcorpusName})}
                                    scrollable={true}>
                                <SubcorpEdit
                                    corpname={props.editWindowSubcorpus.corpusName}
                                    usesubcorp={props.editWindowSubcorpus.subcorpusId}
                                    bibIdAttr={props.editWindowSubcorpus.bibIdAttr}
                                    userId={props.userId} />
                            </layoutViews.CloseableFrame>
                        </layoutViews.ModalOverlay>
                    ) : null}
                <S.SubcPaginator className='ktx-pagination'>
                    <layoutViews.SimplePaginator
                        currentPage={props.filter.page}
                        isLoading={props.isBusy}
                        totalPages={props.totalPages}
                        handlePageChange={handlePageChange} />
                </S.SubcPaginator>
                <DataTable actionButtonHandle={handleActionButton}
                    pattern={props.filter.pattern}
                    lines={props.lines}
                    selectedItems={props.selectedItems}
                    sortKey={props.sortKey}
                    unfinished={props.processedItems} />
            </S.SubcorpList>
        );
    }

    return {
        SubcorpList: Bound(SubcorpList, subcorpLinesModel)
    };
}