import * as React from 'react';
import { IActionDispatcher } from 'kombo';
import { FilterRecord, FeatureSelectProps } from './models';
import * as Immutable from 'immutable';
import { Kontext } from '../../../types/common';

export function init(dispatcher:IActionDispatcher, ut:Kontext.ComponentHelpers):React.ComponentClass<FeatureSelectProps> {

    const CategoryDetail:React.FunctionComponent<{
        allValues:Immutable.List<string>;
        availableValues:Immutable.List<string>;
        onChangeHandler:(event) => void;
        categoryName:string;
        filterFeatures:Immutable.List<FilterRecord>;
    }> = (props) => {
        const categoryFilterRecord = new FilterRecord({'name': props.categoryName});
        const checkboxes = props.allValues.sort().map(value => {
            const filterRecord = categoryFilterRecord.set('value', value);
            return <li key={value}>
                <input
                    onChange={props.onChangeHandler}
                    type="checkbox"
                    id={props.categoryName + '-' + value}
                    name={props.categoryName}
                    value={value}
                    checked={props.filterFeatures.some(x => x.equals(filterRecord) ? true : false)}
                    disabled={props.availableValues.includes(value) ? false : true} />
                <label htmlFor={props.categoryName + '-' + value}>{value}</label>
            </li>
        });
        return <ul className="defaultTaghelper_PositionList">{checkboxes}</ul>;
    }

    const CategorySelect:React.FunctionComponent<{
        selectedCategory:string;
        allFeatures:Immutable.Map<string, Immutable.List<string>>;
        availableFeatures:Immutable.Map<string, Immutable.List<string>>;
        onSelectCategoryHandler:(event) => void;

    }> = (props) => {
        const categories = props.allFeatures.keySeq().sort().map(category => {
            const availableValuesCount = (props.availableFeatures.has(category) ? props.availableFeatures.get(category).size : 0);
            return <option key={category} value={category}>
                    {category + " (" + availableValuesCount + ")"}
                </option>;
        });
        return <select multiple size={20} onChange={props.onSelectCategoryHandler}
                        value={[props.selectedCategory]}>{categories}</select>;
    }

    // --------------------- <QueryLineCategory /> ----------------------------------------

    const QueryLineCategory:React.FunctionComponent<{
        categoryName:string;
        filterFeaturesCategory:Immutable.List<FilterRecord>;
        handleRemoveFilter:(event) => void;
    }> = (props) => {
        const buttonGroup = props.filterFeaturesCategory
            .sort()
            .map(filter => (
                <li key={filter.composeString()} className="item">
                    <span>{filter.get('value')}</span>
                    <button name={filter.get('name')} type="button" value={filter.get('value')}
                            onClick={props.handleRemoveFilter} className="query-close">{'\u00D7'}</button>
                </li>
            )).toArray();
        return (
            <li className = "query-button-group">
                {props.categoryName + ' = '}
                <ul key="cat-name">
                    {buttonGroup}
                </ul>
            </li>
        );
    }

    // ------------------------ <QueryExpression /> --------------------------------------------

    const QueryExpression:React.FunctionComponent<{
        filterFeatures:Immutable.List<FilterRecord>;
        handleRemoveFilter:(event) => void;
    }> = (props) => {
        const groupedFilterFeatures = props.filterFeatures.groupBy(item => item.get('name'))
        const selected = groupedFilterFeatures.sort().reduce(
            (acc, val, key) => acc.concat([
                acc.length ? <li key={`amp:${key}`} className = "query-button-group amp">{'&'}</li> : null,
                <QueryLineCategory
                    key={key}
                    categoryName={key}
                    filterFeaturesCategory={val.toList()}
                    handleRemoveFilter={props.handleRemoveFilter} />
            ]),
            []
        );
        return (
            <div className="QueryExpression">
                {selected.length > 0 ? <ul className="query-line">{selected}</ul> : null}
            </div>
        );
    }

    // ---------------------------- <FeatureSelect /> ---------------------------------

    class FeatureSelect extends React.Component<FeatureSelectProps> {

        constructor(props) {
            super(props);
            this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
            this.handleRemoveFilter = this.handleRemoveFilter.bind(this);
            this.handleCategorySelect = this.handleCategorySelect.bind(this);
        }

        handleCheckboxChange(event) {
            if (event.target.checked) {
                dispatcher.dispatch({
                    name: 'TAGHELPER_ADD_FILTER',
                    payload: {
                        sourceId: this.props.sourceId,
                        name: event.target.name,
                        value: event.target.value
                    }
                });
            } else {
                this.handleRemoveFilter(event);
            }
        }

        handleRemoveFilter(event) {
            dispatcher.dispatch({
                name: 'TAGHELPER_REMOVE_FILTER',
                payload: {
                    sourceId: this.props.sourceId,
                    name: event.target.name,
                    value: event.target.value
                }
            });
        };

        handleCategorySelect(event) {
            dispatcher.dispatch({
                name: 'TAGHELPER_SELECT_CATEGORY',
                payload: {
                    sourceId: this.props.sourceId,
                    value: event.target.value
                }
            });
        }

        render() {
            if (this.props.error) {
                return <div>Error: {this.props.error.message}</div>;

            } else {
                return(
                    <div className='FeatureSelect'>
                        <h4>{ut.translate('taghelper__selected_features_label')}:</h4>
                        <div className='QueryLine' style={{maxWidth: '39em', minHeight: '4em'}}>
                            <QueryExpression
                                filterFeatures={this.props.filterFeaturesHistory.last()}
                                handleRemoveFilter={this.handleRemoveFilter} />
                        </div>
                        <div style={{display: 'flex', alignItems: 'stretch'}}>
                            <div className='CategoryDetail' style={{marginRight: '5em'}}>
                                <h4>{ut.translate('taghelper__part_of_speech_label')}:</h4>
                                <CategoryDetail
                                    onChangeHandler={(event) => this.handleCheckboxChange(event)}
                                    filterFeatures={this.props.filterFeaturesHistory.last()}
                                    categoryName="POS"
                                    allValues={this.props.allFeatures.get("POS", Immutable.List([]))}
                                    availableValues={this.props.availableFeatures.get("POS", Immutable.List([]))} />
                            </div>
                            <div>
                                <h4>{ut.translate('taghelper__features_label')}:</h4>
                                <div style={{display: 'flex', alignItems: 'flex-start'}}>
                                    <div className='CategorySelect' style={{marginRight: '2em'}}>
                                        <CategorySelect
                                            allFeatures={this.props.allFeatures.remove("POS")}
                                            availableFeatures={this.props.availableFeatures.remove("POS")}
                                            onSelectCategoryHandler={this.handleCategorySelect}
                                            selectedCategory={this.props.showCategory} />
                                    </div>
                                    <div className='CategoryDetail'>
                                        <CategoryDetail
                                            onChangeHandler={(event) => this.handleCheckboxChange(event)}
                                            filterFeatures={this.props.filterFeaturesHistory.last()}
                                            categoryName={this.props.showCategory}
                                            allValues={this.props.allFeatures.get(this.props.showCategory, Immutable.List([]))}
                                            availableValues={this.props.availableFeatures.get(this.props.showCategory, Immutable.List([]))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        }
    }

    return FeatureSelect;
}
