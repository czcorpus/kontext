/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import { BoundWithProps, IActionDispatcher } from 'kombo';
import { Keyboard, Dict, pipe, List } from 'cnc-tskit';

import * as Kontext from '../../../types/kontext';
import { Actions } from '../../../models/searchHistory/actions';
import { QueryType } from '../../../models/query/query';

import * as S from './style';
import { SearchHistoryModelState, ConcQueryHistoryItem,
    QueryHistoryItem } from '../../../models/searchHistory/common';
import { SearchHistoryModel } from '../../../models/searchHistory';
import { init as fieldsViewInit } from './srchFields';
import gearIcon from '../../../../img/config-icon.svg';
import gearIconS from '../../../../img/config-icon_s.svg';

import * as QS from '../../query/style';


export interface HistoryViews {
    RecentQueriesPageList:React.ComponentClass<{onCloseClick: ()=>void; onHelpClick: ()=>void}>;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    queryHistoryModel:SearchHistoryModel
):HistoryViews {

    const layoutViews = he.getLayoutViews();
    const srchFields = fieldsViewInit(dispatcher, he, queryHistoryModel);

    const supertypeToHuman = (qSupertype:Kontext.QuerySupertype) => {
        switch (qSupertype) {
            case 'conc':
                return he.translate('qhistory__qs_conc');
            case 'pquery':
                return he.translate('qhistory__qs_pquery');
            case 'wlist':
                return he.translate('qhistory__qs_wlist');
            case 'kwords':
                return he.translate('qhistory__qs_kwords');
        }
    };

    const typeToHuman = (qtype:QueryType) => {
        return qtype === 'advanced' ?
            he.translate('query__qt_advanced') :
            he.translate('query__qt_simple');
    };

    // -------------------- <FilterForm /> ------------------------

    const FilterForm:React.FC<{
        corpname:string;
        currentCorpusOnly:boolean;
        querySupertype:Kontext.QuerySupertype;
        archivedOnly:boolean;
        supportsFulltext:boolean;
        searchFormView:string;

    }> = (props) => {

        const handleChangeSearchFormView = (id:string) => {
            dispatcher.dispatch(
                Actions.ChangeSearchForm,
                {value: id},
            );
        };

        const items = [{id: 'quick', label: he.translate('qhistory__quick_search')}];
        if (props.supportsFulltext) {
            items.push({id: 'extended', label: he.translate('qhistory__extended_search')});
        }

        const handleClickSearch = () => {
            dispatcher.dispatch(
                Actions.SubmitExtendedSearch
            );
        };

        const handleKeyDown = (evt:KeyboardEvent) => {
            if (evt.key === 'Enter') {
                evt.stopPropagation();
                dispatcher.dispatch(
                    Actions.SubmitExtendedSearch
                );
            }
        };

        React.useEffect(() => {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);

        }, [])

        return (
            <layoutViews.TabView
                    className="SortFormSelector"
                    defaultId={props.searchFormView}
                    callback={handleChangeSearchFormView}
                    items={items}>

                <S.FilterForm>
                    <fieldset className="basic">
                        <legend>
                            {he.translate('qhistory__filter_legend')}
                        </legend>
                        <div className="grid-inputs">
                            <srchFields.BasicFields corpusSel={true} archivedAsEnable={false} />
                        </div>
                    </fieldset>
                </S.FilterForm>

                <S.FilterForm>
                    <fieldset className="advanced">
                        <div className="grid-inputs">
                            <srchFields.BasicFields corpusSel={false} archivedAsEnable={true} />
                            <srchFields.ExtendedFields />
                        </div>
                        {!props.querySupertype ?
                            <p className="note">({he.translate('qhistory__any_search_note')})</p> :
                            null
                        }
                        <div className="button-area">
                            <div style={{flexGrow: '1'}}></div>
                            <button type="button" className="util-button" onClick={handleClickSearch}>
                                {he.translate('qhistory__search_button')}
                            </button>
                        </div>
                    </fieldset>
                </S.FilterForm>

            </layoutViews.TabView>
        );
    };

    // -------------------- <AlignedQueryInfo /> ------------------------

    const AlignedQueryInfo:React.FC<{
        query_type:QueryType;
        query:string;

    }> = (props) => {
        return (
            <S.AlignedQueryInfoDiv>
                <S.QueryAndTypeDiv>
                    <span className="symbol">{'\u2016\u00a0'}</span>
                    <span className="query" title={typeToHuman(props.query_type)}>
                        {props.query ?
                            props.query :
                            <span className="blank">-- {he.translate('qhistory__blank_query')} --</span>
                        }
                    </span>
                </S.QueryAndTypeDiv>
            </S.AlignedQueryInfoDiv>
        );
    };

    // -------------------- <TextTypesInfo /> ------------------------

    class TextTypesInfo extends React.Component<{
        textTypes:Kontext.GeneralProps;
    },
    {
        expanded:boolean;
    }> {

        constructor(props) {
            super(props);
            this.state = {
                expanded: false
            };
            this._handleExpandClick = this._handleExpandClick.bind(this);
        }

        _handleExpandClick(e) {
            e.stopPropagation();
            this.setState({expanded: !this.state.expanded});
        }

        render() {
            if (!Dict.empty(this.props.textTypes)) {
                return (
                    <div className="text-types-info">
                        <a className="switch" onClick={this._handleExpandClick}
                                title={he.translate(this.state.expanded ? 'global__click_to_hide' : 'global__click_to_expand')}>
                            {he.translate('qhistory__attached_text_types')}
                            {!this.state.expanded ? '\u00a0\u2026' : null}
                        </a>
                        {this.state.expanded ? ':' : null}
                        {this.state.expanded ?
                            (<ul>
                                {pipe(
                                    this.props.textTypes,
                                    Dict.keys(),
                                    List.map(k => (
                                        <li key={k}>
                                            <strong>{k}</strong>:
                                            {this.props.textTypes[k].join(', ')}
                                        </li>
                                    ))
                                )}
                            </ul>) : null
                        }
                    </div>
                );

            } else {
                return null;
            }
        }
    };

    // ------

    const handleAreaClick = (idx:number) => () => {
        dispatcher.dispatch<typeof Actions.HistoryOpenQueryForm>({
            name: Actions.HistoryOpenQueryForm.name,
            payload: {
                idx
            }
        });
    };

    // -------------------- <ConcQueryInfo /> ------------------------

    const ConcQueryInfo:React.FC<{
        itemIdx:number;
        isEdited:boolean;
        query_sh:string;
        query:string;
        textTypes:Kontext.GeneralProps;
        aligned:ConcQueryHistoryItem['aligned'];

    }> = (props) => (
        <S.QueryInfoDiv onClick={handleAreaClick(props.itemIdx)} title={he.translate('qhistory__open_in_form')}>
            <S.QueryAndTypeDiv>
                {
                    props.query_sh ?
                    <QS.SyntaxHighlight className="query" dangerouslySetInnerHTML={{__html: props.query_sh}} /> :
                    <span className="query">{props.query}</span>
                }
            </S.QueryAndTypeDiv>
            {List.map(
                v => <AlignedQueryInfo key={v.corpname}
                        query={v.query} query_type={v.query_type} />,
                props.aligned
            )}
            <TextTypesInfo textTypes={props.textTypes} />
            {List.map(
                v => <span key={v.corpname} className="corpname"> || {v.human_corpname}</span>,
                props.aligned
            )}
        </S.QueryInfoDiv>
    );

    // -------------------- <PQueryInfo /> ----------------------------

    const PQueryInfo:React.FC<{
        itemIdx:number;
        isEdited:boolean;
        query_sh:string;
        query:string;
    }> = (props) => (
        <S.QueryInfoDiv onClick={handleAreaClick(props.itemIdx)} title={he.translate('qhistory__open_in_form')}>
            <S.QueryAndTypeDiv>
                {
                    props.query_sh ?
                    <QS.SyntaxHighlight className="query" dangerouslySetInnerHTML={{__html: props.query_sh}} /> :
                    <span className="query">{props.query}</span>
                }
            </S.QueryAndTypeDiv>
        </S.QueryInfoDiv>
    );

    // -------------------- <WlistQueryInfo /> ------------------------

    const WlistQueryInfo:React.FC<{
        itemIdx:number;
        isEdited:boolean;
        query_sh:string;
        query:string;
        pfilter:Array<string>;
        nfilter:Array<string>;
    }> = (props) => (
        <S.QueryInfoDiv onClick={handleAreaClick(props.itemIdx)} title={he.translate('qhistory__open_in_form')}>
            <S.QueryAndTypeDiv>
                {
                    props.query_sh ?
                    <QS.SyntaxHighlight className="query" dangerouslySetInnerHTML={{__html: props.query_sh}} /> :
                    <span className="query">{props.query}</span>
                }
            </S.QueryAndTypeDiv>
            {List.empty(props.pfilter) ?
                null :
                <dl className="pnfilter">
                    <dt>{he.translate('query__qfilter_pos')}:</dt>
                    <dd>{props.pfilter.join(', ')}</dd>
                </dl>
            }
            {List.empty(props.nfilter) ?
                null :
                <dl className="pnfilter">
                    <dt>{he.translate('query__qfilter_neg')}:</dt>
                    <dd>{props.nfilter.join(', ')}</dd>
                </dl>
            }
        </S.QueryInfoDiv>
    );

    // -------------------- <KWordsQueryInfo /> ------------------------

    const KWordsQueryInfo:React.FC<{
        itemIdx:number;
        isEdited:boolean;
        query_sh:string;
        query:string;
    }> = (props) => (
        <S.QueryInfoDiv onClick={handleAreaClick(props.itemIdx)} title={he.translate('qhistory__open_in_form')}>
            <S.QueryAndTypeDiv>
                {
                    props.query_sh ?
                    <QS.SyntaxHighlight className="query" dangerouslySetInnerHTML={{__html: props.query_sh}} /> :
                    <span className="query">{props.query}</span>
                }
            </S.QueryAndTypeDiv>
        </S.QueryInfoDiv>
    );

    // -------------------- <SavedNameInfo /> ------------------------

    const SavedNameInfo:React.FC<{
        itemIdx:number;
        hasEditor:boolean;
        editingQueryName:string;

    }> = (props) => {

        const handleEditClick = (evt) => {
            dispatcher.dispatch<typeof Actions.HistorySetEditedItem>({
                name: Actions.HistorySetEditedItem.name,
                payload: {
                    itemIdx: props.itemIdx
                }
            });
        };

        const handleDoNotSaveClick = () => {
            dispatcher.dispatch<typeof Actions.HistoryDoNotArchive>({
                name: Actions.HistoryDoNotArchive.name,
                payload: {
                    itemIdx: props.itemIdx
                }
            });
        };

        return (
            <S.SavedNameInfo>
                {props.editingQueryName && !props.hasEditor ?
                    <button className="util-button" onClick={handleDoNotSaveClick}>
                        {he.translate('query__save_as_transient')}
                    </button> :
                    props.hasEditor ?
                        <SaveItemForm name={props.editingQueryName} itemIdx={props.itemIdx} /> :
                        <button className="util-button" onClick={handleEditClick}>
                            {he.translate('query__save_button')}{'\u2026'}
                        </button>
                }

            </S.SavedNameInfo>
        );
    }

    // -------------------- <SaveItemForm /> ------------------------

    const SaveItemForm:React.FC<{
        itemIdx:number;
        name:string;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<typeof Actions.HistoryEditorSetName>({
                name: Actions.HistoryEditorSetName.name,
                payload: {
                    itemIdx: props.itemIdx,
                    value: evt.target.value
                }
            });
        };

        const handleSubmitClick = () => {
            dispatcher.dispatch<typeof Actions.HistoryEditorClickSave>({
                name: Actions.HistoryEditorClickSave.name,
                payload: {
                    itemIdx: props.itemIdx
                }
            });
        };

        const handleCloseClick = () => {
            dispatcher.dispatch<typeof Actions.HistoryCloseEditedItem>({
                name: Actions.HistoryCloseEditedItem.name,
                payload: {
                    itemIdx: props.itemIdx
                }
            });
        };

        const handleKeyDown = (evt) => {
            if (evt.key === Keyboard.Value.ESC) {
                evt.preventDefault();
                evt.stopPropagation();
                handleCloseClick();

            } else if (evt.key === Keyboard.Value.ENTER) {
                evt.preventDefault();
                evt.stopPropagation();
                handleSubmitClick();
            }
        };

        return (
            <S.SaveItemForm onKeyDown={handleKeyDown}>
                <a onClick={handleCloseClick}>
                    <img src={he.createStaticUrl('img/close-icon.svg')} alt={he.translate('global__close')}
                                style={{width: '1em', verticalAlign: 'middle'}} />
                </a>
                <label>
                    <span>{he.translate('query__save_as_keep_archived')}:</span>
                    <input type="text" style={{width: '15em'}}
                            value={props.name}
                            onChange={handleInputChange}
                            ref={item => item ? item.focus() : null} />
                    </label>
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('global__ok')}
                </button>
                <br />
            </S.SaveItemForm>
        );
    };

    // ----------- <RemoveFromHistoryButton /> ------------------

    const RemoveFromHistoryButton:React.FC<{
        itemIdx:number;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.RemoveItemFromList>({
                name: Actions.RemoveItemFromList.name,
                payload: {
                    itemIdx: props.itemIdx
                }
            });
        };

        return (
            <S.RemoveFromHistoryButton type="button" className="util-button" onClick={handleClick}>
                {he.translate('qhistory__remove_from_list')}
            </S.RemoveFromHistoryButton>
        );
    };

    // ------------------ <RowToolbar /> -----------------------------------

    const RowToolbar:React.FC<{
        itemIdx:number;
        queryId:string;
        name:string;
        nameEditorVisible:boolean;

    }> = (props) => (
        <S.RowToolbar>
            <RemoveFromHistoryButton itemIdx={props.itemIdx} />
            <span>
                {props.queryId ?
                <SavedNameInfo
                        itemIdx={props.itemIdx}
                        hasEditor={props.nameEditorVisible}
                        editingQueryName={props.name} /> :
                        null /* legacy query history record cannot be archived  */
                }
            </span>
        </S.RowToolbar>
    );

    // -------------------- <DataRowActions /> ------------------------

    const DataRowActions:React.FC<{
        data:QueryHistoryItem;
        toolbarVisible:boolean;
        nameEditorVisible:boolean;

    }> = (props) => {

        const handleRowToolbarClick = () => {
            dispatcher.dispatch<typeof Actions.ToggleRowToolbar>({
                name: Actions.ToggleRowToolbar.name,
                payload: {
                    rowIdx: props.data.idx
                }
            });
        };

        return (
            <S.ActionsDiv>
                {props.data.name && !props.nameEditorVisible ?
                    <span className="saved-as">
                        {he.translate('query__save_as_saved_as')}:{'\u00a0'}
                        <span className="saved-name">{props.data.name}</span>
                    </span> :
                    null
                }
                <span className="tools">
                    {props.toolbarVisible ?
                        <RowToolbar
                            itemIdx={props.data.idx}
                            queryId={props.data.query_id}
                            name={props.data.name}
                            nameEditorVisible={props.nameEditorVisible} /> :
                        null
                    }
                    <a onClick={handleRowToolbarClick}>
                        {props.toolbarVisible ?
                            <layoutViews.ImgWithMouseover src={gearIconS} src2={gearIcon} alt="close edit" /> :
                            <layoutViews.ImgWithMouseover src={gearIcon} src2={gearIconS} alt="edit" />
                        }
                    </a>
                </span>
            </S.ActionsDiv>
        )
    }

    // -------------------- <DataRow /> ------------------------

    const DataRow:React.FC<{
        toolbarVisible:boolean;
        nameEditorVisible:boolean;
        data:QueryHistoryItem;

    }> = ({toolbarVisible, nameEditorVisible, data}) => {

        const renderQuery = () => {
            switch (data.q_supertype) {
            case 'conc':
                return <ConcQueryInfo
                    itemIdx={data.idx}
                    isEdited={toolbarVisible}
                    query={data.query}
                    query_sh={data.query_sh}
                    aligned={data.aligned}
                    textTypes={data.selected_text_types} />;
            case 'pquery':
                return <PQueryInfo
                    itemIdx={data.idx}
                    isEdited={toolbarVisible}
                    query={data.query}
                    query_sh={data.query_sh} />;

            case 'wlist':
                return <WlistQueryInfo
                            itemIdx={data.idx}
                            isEdited={toolbarVisible}
                            query={data.query}
                            query_sh={data.query_sh}
                            pfilter={data.pfilter_words}
                            nfilter={data.nfilter_words} />;
            case 'kwords':
                return <KWordsQueryInfo
                            itemIdx={data.idx}
                            isEdited={toolbarVisible}
                            query={data.query}
                            query_sh={data.query_sh} />;
            }
        };
        return (
            <S.DataRowLi>
                <div className="heading">
                    <strong>
                        {data.idx + 1}.
                    </strong>
                    {'\u00a0'}
                    <h3>
                        <span className="supertype">
                            {supertypeToHuman(data.q_supertype)}
                            {
                                data.q_supertype === 'conc' && data.form_type === 'filter' ?
                                    <span style={{textTransform: 'lowercase'}}>
                                        {'\u00a0(' + he.translate('query__filter_th')})
                                    </span> :
                                    null
                            }
                        </span>,{'\u00a0'}
                        {data.human_corpname}
                        {data.subcorpus_name ?
                            <span className="subcorpname" title={he.translate('global__subcorpus')}>{'\u00a0/\u00a0'}
                                    {data.subcorpus_name}</span> :
                            null
                        }
                    </h3>
                    <span className="date">
                        {he.formatDate(new Date(data.created * 1000), 1)}
                    </span>
                </div>
                {renderQuery()}
                {data.q_supertype !== 'conc' || data.form_type !== 'filter' ?
                    <DataRowActions toolbarVisible={toolbarVisible}
                            nameEditorVisible={nameEditorVisible}
                            data={data} /> :
                    null
                }
            </S.DataRowLi>
        );
    };

    // -------------------- <LoadMoreBlock /> ------------------------

    const LoadMoreBlock:React.FC<{
        modelIsBusy:boolean;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<typeof Actions.HistoryLoadMore>({
                name: Actions.HistoryLoadMore.name
            });
        };

        return (
            <div className="last-row">
                <a onClick={handleClick}>
                    {props.modelIsBusy ?
                    (<img src={he.createStaticUrl('img/ajax-loader.gif')}
                            alt={he.translate('global__loading')} />) :
                    <span>{he.translate('qhistory__load_more_link')}</span>
                    }
                </a>
            </div>
        );
    };

    // -------------------- <NoDataBlock /> ------------------------

    const NoDataBlock:React.FC<{}> = (props) => {
        return (
            <div className="last-row">
                {he.translate('global__no_data_found')}
            </div>
        );
    };

    // -------------------- <DataTableFooter /> ------------------------

    const DataTableFooter:React.FC<{
        dataLength:number;
        hasMoreItems:boolean;
        modelIsBusy:boolean;
        searched:boolean;

    }> = (props) => {
        if (props.dataLength > 0) {
            if (props.hasMoreItems) {
                return <LoadMoreBlock modelIsBusy={props.modelIsBusy} />

            } else {
                return null;
            }

        } else {
            if (props.searched) {
                return <NoDataBlock />;
            } else {
                return null;
            }
        }
    };

    // -------------------- <DataTable /> ------------------------

    const DataTable:React.FC<{
        offset:number;
        hasMoreItems:boolean;
        modelIsBusy:boolean;
        itemsToolbars:Array<[boolean, boolean]>;
        data:Array<QueryHistoryItem>;
        searched:boolean;

    }> = (props) => {
        return (
            <div>
                <ul className="history-entries">
                    {pipe(
                        props.data,
                        List.map(
                            item => {
                                const [ toolbarVisible, nameEdited ] = props.itemsToolbars[item.idx];
                                return (
                                    <DataRow key={item.idx + props.offset} data={item}
                                        toolbarVisible={toolbarVisible}
                                        nameEditorVisible={nameEdited} />
                                );
                            }
                        )
                    )}
                </ul>
                <DataTableFooter dataLength={props.data.length} modelIsBusy={props.modelIsBusy}
                        hasMoreItems={props.hasMoreItems} searched={props.searched} />
            </div>
        );
    };

    // -------------------- <HelpControls /> ---------------------------------

    const HelpControls:React.FC<{}> = (props) => {

        const handleBackClick = () => {
            dispatcher.dispatch(
                Actions.ToggleHelpView
            );
        };

        return (
            <div className="navig">
                <a onClick={handleBackClick}>
                    <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/back-button.svg')}
                        alt={he.translate('global__back')} />
                </a>
            </div>
        );
    }

    // -------------------- <HelpView /> -------------------------------------


    const HelpView:React.FC<{}> = (props) => {



        return (
            <S.HelpView>
                <h2>{he.translate('qhistory__extended_search')}</h2>
                <h3>{he.translate('qhistory__help_any_search')}</h3>
                <p>
                    {he.translate('qhistory__help_section_any_type_search')}
                </p>
                <h3>{he.translate('qhistory__help_extended_search_conc')}</h3>
                <p>
                    {he.translate('qhistory__help_section_intro')}
                </p>
                <div className="table-and-schema">
                    <table className="query-parts">
                        <thead>
                            <tr>
                                <th rowSpan={2}>{he.translate('qhistory__help_query_part')}</th>
                                <th colSpan={2}>{he.translate('qhistory__help_comparison_method')}</th>
                            </tr>
                            <tr>
                                <th>{he.translate('qhistory__help_exact_match')}</th>
                                <th>{he.translate('qhistory__help_substring')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{he.translate('qhistory__help_posattr_name')} <code>(A)</code></td>
                                <td>{'\u2705'}</td>
                                <td>{'\u274C'}</td>
                            </tr>
                            <tr>
                                <td>{he.translate('qhistory__help_posattr_value')} <code>(B)</code></td>
                                <td>{'\u2705'}</td>
                                <td>{'\u2705'}</td>
                            </tr>
                            <tr>
                                <td>{he.translate('qhistory__help_structure_name')} <code>(C)</code></td>
                                <td>{'\u2705'}</td>
                                <td>{'\u274C'}</td>
                            </tr>
                            <tr>
                                <td>{he.translate('qhistory__help_structattr_name')} <code>(D)</code></td>
                                <td>{'\u2705'}</td>
                                <td>{'\u274C'}</td>
                            </tr>
                            <tr>
                                <td>{he.translate('qhistory__help_structattr_value')} <code>(E)</code></td>
                                <td>{'\u2705'}</td>
                                <td>{'\u2705'}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="schema">
                        <img src={he.createStaticUrl('img/fs_help.svg')} />
                    </div>
                </div>
                <h4>{he.translate('query__qt_simple')}</h4>
                <p>
                    {he.translate('qhistory__help_section_simple_query')}
                </p>
                <h4>{he.translate('query__qt_advanced')}</h4>
                <p>
                    {he.translate('qhistory__help_section_advanced_query')}
                </p>
            </S.HelpView>
        );
    };

    // -------------------- <SrchResult /> --------------------------------------

    const SrchResult:React.FC<{
        searchFormView:'extended'|'quick';
        data:Array<QueryHistoryItem>;
        isBusy:boolean;
        offset:number;
        hasMoreItems:boolean;
        itemsToolbars:Array<[boolean, boolean]>;
        searched:boolean;

    }> = (props) => {
        if (props.searchFormView === 'quick') {
            return <>
                {props.data.length > 0 ?
                    <DataTable data={props.data} offset={props.offset}
                            modelIsBusy={props.isBusy}
                            hasMoreItems={props.hasMoreItems}
                            itemsToolbars={props.itemsToolbars}
                            searched={props.searched} /> :
                    null
                }
                {props.isBusy ?
                    <div className="loader"><layoutViews.AjaxLoaderImage /></div> :
                    null
                }
            </>;

        } else {
            return <>
                {props.isBusy ?
                    <div className="loader"><layoutViews.AjaxLoaderImage /></div> :
                    <DataTable data={props.data} offset={props.offset}
                            modelIsBusy={props.isBusy}
                            hasMoreItems={props.hasMoreItems}
                            itemsToolbars={props.itemsToolbars}
                            searched={props.searched} />
                }
            </>;
        }
    };

    // -------------------- <RecentQueriesPageList /> ------------------------

    const RecentQueriesPageList:React.FC<
            SearchHistoryModelState &
            {
                onCloseClick: ()=>void
                onHelpClick: ()=>void
            }> = (props) => {
        return (
            <layoutViews.ModalOverlay onCloseKey={props.onCloseClick}>
                <layoutViews.CloseableFrame
                        scrollable={true}
                        onCloseClick={props.onCloseClick}
                        onHelpClick={props.onHelpClick}
                        label={he.translate('query__recent_queries_link')}
                        customClass="OptionsContainer"
                        customControls={props.isHelpVisible ? <HelpControls /> : null} >
                {props.isHelpVisible ?
                    <div><HelpView /></div> :
                    <S.RecentQueriesPageList>
                        <FilterForm
                            corpname={props.corpname}
                            querySupertype={props.querySupertype}
                            currentCorpusOnly={props.currentCorpusOnly}
                            archivedOnly={props.archivedOnly}
                            supportsFulltext={props.supportsFulltext}
                            searchFormView={props.searchFormView} />
                        <SrchResult
                            searchFormView={props.searchFormView}
                            data={props.data}
                            isBusy={props.isBusy}
                            offset={props.offset}
                            hasMoreItems={props.hasMoreItems}
                            itemsToolbars={props.itemsToolbars}
                            searched={props.searched} />
                    </S.RecentQueriesPageList>
                }
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    }


    return {
        RecentQueriesPageList: BoundWithProps<
        {onCloseClick: ()=>void; onHelpClick: ()=>void},
        SearchHistoryModelState>(RecentQueriesPageList, queryHistoryModel)
    };

}