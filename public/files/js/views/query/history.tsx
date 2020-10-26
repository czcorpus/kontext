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
import { Bound, IActionDispatcher, IModel } from 'kombo';
import { Keyboard, Dict, pipe, List } from 'cnc-tskit';

import { Kontext } from '../../types/common';
import { PluginInterfaces } from '../../types/plugins';
import { Actions, ActionName } from '../../models/query/actions';
import { QueryType } from '../../models/query/common';


export interface HistoryViews {
    RecentQueriesPageList:React.ComponentClass<{}>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            queryHistoryModel:IModel<{}>):HistoryViews {

    const queryTypes:{[k in QueryType]:string} = {
        'simple': he.translate('query__qt_simple'),
        'advanced': he.translate('query__qt_advanced')
    };

    // -------------------- <QueryTypeSelector /> ------------------------

    const QueryTypeSelector:React.FC<{
        value:string;

    }> = (props) => {

        const handleChange = (evt) => {
            dispatcher.dispatch<Actions.StorageSetQueryType>({
                name: ActionName.StorageSetQueryType,
                payload: {
                    value: evt.target.value
                }
            });
        };

        return (
            <select value={props.value} onChange={handleChange}>
                <option value="">
                    {he.translate('qhistory__sel_anytime')}
                </option>
                <option value="iquery">
                    {he.translate('query__qt_basic')}
                </option>
                <option value="lemma">
                    {he.translate('query__qt_lemma')}
                </option>
                <option value="phrase">
                    {he.translate('query__qt_phrase')}
                </option>
                <option value="word">
                    {he.translate('query__qt_word_form')}
                </option>
                <option value="char">
                    {he.translate('query__qt_word_part')}
                </option>
                <option value="cql">
                    {he.translate('query__qt_cql')}
                </option>
            </select>
        );
    };

    // -------------------- <CurrentCorpCheckbox /> ------------------------

    const CurrentCorpCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {

        const handleChange = () => {
            dispatcher.dispatch<Actions.StorageSetCurrentCorpusOnly>({
                name: ActionName.StorageSetCurrentCorpusOnly,
                payload: {
                    value: !props.value
                }
            });
        };
        return <input type="checkbox" checked={props.value} onChange={handleChange}
                    style={{verticalAlign: 'middle'}} />;
    };

    // -------------------- <ArchivedOnlyCheckbox /> ------------------------

    const ArchivedOnlyCheckbox:React.FC<{
        value:boolean;

    }> = (props) => {
        const handleChange = () => {
            dispatcher.dispatch<Actions.StorageSetArchivedOnly>({
                name: ActionName.StorageSetArchivedOnly,
                payload: {
                    value: !props.value
                }
            });
        };

        return <input type="checkbox" checked={props.value} onChange={handleChange}
                    style={{verticalAlign: 'middle'}} />;
    }


    // -------------------- <FilterForm /> ------------------------

    const FilterForm:React.FC<{
        currentCorpusOnly:boolean;
        queryType:string;
        archivedOnly:boolean;

    }> = (props) => {
        return (
            <form className="query-history-filter">
                <fieldset>
                    <legend>
                        {he.translate('qhistory__filter_legend')}
                    </legend>
                    <label>
                        {he.translate('qhistory__curr_corp_only_label')}:{'\u00a0'}
                        <CurrentCorpCheckbox value={props.currentCorpusOnly} />
                    </label>
                    <label>
                        {he.translate('qhistory__query_type_sel')}:{'\u00a0'}
                        <QueryTypeSelector value={props.queryType} />
                    </label>
                    <label>
                        {he.translate('qhistory__checkbox_archived_only')}:{'\u00a0'}
                        <ArchivedOnlyCheckbox value={props.archivedOnly} />
                    </label>
                </fieldset>
            </form>
        );
    };

    // -------------------- <AlignedQueryInfo /> ------------------------

    const AlignedQueryInfo:React.FC<{
        query_type:string;
        query:string;

    }> = (props) => {
        return (
            <div className="query-line">
                <span className="query-type">{queryTypes[props.query_type]}{'\u00a0\u25BA\u00a0'}</span>
                <span className="query">{props.query}</span>
            </div>
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

        _handleExpandClick() {
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

    // -------------------- <QueryInfo /> ------------------------

    const QueryInfo:React.FC<{
        query_type:string;
        query_sh:string;
        query:string;
        textTypes:Kontext.GeneralProps;
        aligned:Kontext.QueryHistoryItem['aligned'];

    }> = (props) => {

        return (
            <div className="query-info">
                <div className="query-line">
                    <span className="query-type">{queryTypes[props.query_type]}{'\u00a0\u25BA\u00a0'}</span>
                    {
                        props.query_sh ?
                        <pre className="query" dangerouslySetInnerHTML={{__html: props.query_sh}} /> :
                        <span className="query">{props.query}</span>
                    }
                </div>
                {props.aligned.map(v => <AlignedQueryInfo key={v.corpname}
                            query={v.query} query_type={v.query_type} />)}
                <TextTypesInfo textTypes={props.textTypes} />
            </div>
        );
    }

    // -------------------- <SavedNameInfo /> ------------------------

    const SavedNameInfo:React.FC<{
        queryId:string;
        hasEditor:boolean;
        editingQueryName:string;
        name:string;

    }> = (props) => {

        const handleEditClick = (evt) => {
            dispatcher.dispatch<Actions.StorageSetEditingQueryId>({
                name: ActionName.StorageSetEditingQueryId,
                payload: {
                    value: props.queryId
                }
            });
        };

        const handleDoNotSaveClick = () => {
            dispatcher.dispatch<Actions.StorageDoNotArchive>({
                name: ActionName.StorageDoNotArchive,
                payload: {
                    queryId: props.queryId
                }
            });
        };

        if (props.hasEditor) {
            return <SaveItemForm name={props.editingQueryName} />;

        } else {
            if (props.name) {
                return (
                    <div>
                        {he.translate('query__save_as_saved_as')}:{'\u00a0'}
                        <span className="saved-name">{props.name}</span>
                        {'\u00a0'}
                        <a className="util-button" onClick={handleDoNotSaveClick}>
                            {he.translate('query__save_as_transient')}
                        </a>
                    </div>
                );

            } else {
                return (
                    <div>
                        <a className="util-button" onClick={handleEditClick}>
                            {he.translate('query__save_button')}{'\u2026'}
                        </a>
                    </div>
                );
            }
        }
    }

    // -------------------- <SaveItemForm /> ------------------------

    const SaveItemForm:React.FC<{
        name:string;

    }> = (props) => {

        const handleInputChange = (evt) => {
            dispatcher.dispatch<Actions.StorageEditorSetName>({
                name: ActionName.StorageEditorSetName,
                payload: {
                    value: evt.target.value
                }
            });
        };

        const handleSubmitClick = () => {
            dispatcher.dispatch<Actions.StorageEditorClickSave>({
                name: ActionName.StorageEditorClickSave
            });
        };

        const handleCloseClick = () => {
            dispatcher.dispatch<Actions.StorageClearEditingQueryID>({
                name: ActionName.StorageClearEditingQueryID
            });
        };

        const handleKeyDown = (evt) => {
            if (evt.keyCode === Keyboard.Code.ESC) {
                evt.preventDefault();
                evt.stopPropagation();
                handleCloseClick();

            } else if (evt.keyCode === Keyboard.Code.ENTER) {
                evt.preventDefault();
                evt.stopPropagation();
                handleSubmitClick();
            }
        };

        return (
            <form onKeyDown={handleKeyDown}>
                <a onClick={handleCloseClick}>
                    <img src={he.createStaticUrl('img/close-icon.svg')} alt={he.translate('global__close')}
                                style={{width: '1em', verticalAlign: 'middle'}} />
                </a>
                {'\u00a0'}{he.translate('query__save_as_keep_archived')}:{'\u00a0'}
                <input type="text" style={{width: '15em'}}
                        value={props.name}
                        onChange={handleInputChange}
                        ref={item => item ? item.focus() : null} />
                {'\u00a0'}
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('global__ok')}
                </button>
                <br />
            </form>
        );
    };

    // -------------------- <DataRow /> ------------------------

    const DataRow:React.FC<{
        data:Kontext.QueryHistoryItem;
        hasEditor:boolean;
        editingQueryName:string;

    }> = (props) => {

        const handleFormClick = () => {
            dispatcher.dispatch<Actions.StorageOpenQueryForm>({
                name: ActionName.StorageOpenQueryForm,
                payload: {
                    idx: props.data.idx
                }
            });
        };

        return (
            <li>
                <span className="date">
                    {he.formatDate(new Date(props.data.created * 1000), 1)}
                </span>
                <div className="heading">
                    <strong>
                        {props.data.idx + 1}.
                    </strong>
                    {'\u00a0'}
                    <span className="corpname">
                        {props.data.human_corpname}
                        {props.data.subcorpname ?
                            <em className="subcorpname" title={he.translate('global__subcorpus')}>: {props.data.subcorpname}</em> :
                            null
                        }
                    </span>
                    {props.data.aligned.map(v => <span key={v.corpname} className="corpname"> + {v.human_corpname}</span>)}
                </div>
                <QueryInfo
                        query={props.data.query}
                        query_sh={props.data.query_sh}
                        query_type={props.data.query_type}
                        aligned={props.data.aligned}
                        textTypes={props.data.selected_text_types} />
                <div className="footer">
                    <a className="open-in-form util-button" onClick={handleFormClick}>
                        {he.translate('qhistory__open_in_form')}
                        {'\u2026'}
                    </a>
                    {props.data.query_id ?
                    <SavedNameInfo name={props.data.name} queryId={props.data.query_id}
                            hasEditor={props.hasEditor}
                            editingQueryName={props.editingQueryName} /> :
                            null /* legacy query history record cannot be archived  */
                    }
                </div>
            </li>
        );
    };

    // -------------------- <LoadMoreBlock /> ------------------------

    const LoadMoreBlock:React.FC<{
        modelIsBusy:boolean;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch<Actions.StorageLoadMore>({
                name: ActionName.StorageLoadMore
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

    }> = (props) => {
        if (props.dataLength > 0) {
            if (props.hasMoreItems) {
                return <LoadMoreBlock modelIsBusy={props.modelIsBusy} />

            } else {
                return null;
            }

        } else {
            return <NoDataBlock />;
        }
    };

    // -------------------- <DataTable /> ------------------------



    const DataTable:React.FC<{
        editingQueryId:string;
        offset:number;
        editingQueryName:string;
        hasMoreItems:boolean;
        modelIsBusy:boolean;
        data:Array<Kontext.QueryHistoryItem>;

    }> = (props) => {
        return (
            <div>
                    <ul className="history-entries">
                        {props.data.map((item, i) => {
                            const hasEditor = item.query_id === props.editingQueryId;
                            return <DataRow key={i + props.offset} data={item} hasEditor={hasEditor}
                                            editingQueryName={hasEditor ? props.editingQueryName : undefined} />;
                        })}
                    </ul>
                    <DataTableFooter dataLength={props.data.length} modelIsBusy={props.modelIsBusy}
                            hasMoreItems={props.hasMoreItems} />
            </div>
        );
    };

    // -------------------- <RecentQueriesPageList /> ------------------------

    const RecentQueriesPageList:React.FC<PluginInterfaces.QueryStorage.ModelState> = (props) => {
        return (
            <div className="RecentQueriesPageList">
                <FilterForm queryType={props.queryType}
                        currentCorpusOnly={props.currentCorpusOnly}
                        archivedOnly={props.archivedOnly} />
                <DataTable data={props.data} offset={props.offset}
                        modelIsBusy={props.isBusy}
                        hasMoreItems={props.hasMoreItems}
                        editingQueryId={props.editingQueryId}
                        editingQueryName={props.editingQueryName} />
            </div>
        );
    }


    return {
        RecentQueriesPageList: Bound(RecentQueriesPageList, queryHistoryModel)
    };

}