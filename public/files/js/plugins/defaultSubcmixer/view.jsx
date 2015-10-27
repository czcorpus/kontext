/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

define(['vendor/react', 'jquery', 'vendor/multi-slider/index'], function (React, $, MultiSlider) {
    'use strict';

    let lib = {};

    lib.init = function (dispatcher, mixins, textStructureStore) {

        function getOrientation(struct, offset=0) {
            let colors = ['#549605', '#d41b4f', '#1bafd4', '#d4af1b'];
            let idx = struct.getDepth() - 1 + offset;
            if (idx <= colors.length - 1) {
                return {level : idx, color : colors[idx]};

            } else {
                return {level : idx, color: '#000000'};
            }
        }

        /**
         * A corpus subset heading with color navigation, attribute selector etc.
         */
        let SubsetHeading = React.createClass({

            mixins : mixins,

            _changeListener : function (store, action, err) {
                this.setState({ratio: this.props.struct.getRatio()});
            },

            _handleCloseIconClick : function () {
                dispatcher.dispatch({
                    actionType: 'SUBCMIXER_CLEAN_STRUCTURE',
                    props: {
                        structId: this.props.struct.getId()
                    }
                })
            },

            _renderValueSelector : function (initialValue) {
                if (this.props.textTypes.hasOwnProperty(this.props.fixedVal)) {
                    return (
                        <select defaultValue={this._getInitialValueFor(this.props.fixedVal)}
                            onChange={this._handleConditionChange.bind(this, 'attr_value')}>
                        {this.props.textTypes[this.props.fixedVal].values.map(function (item) {
                            return <option key={item} value={item}>{item}</option>;
                        })}
                        </select>
                    );

                } else {
                    return <input type="text" size="5" />;
                }
            },

            _renderOperatorSelector : function () {
                let isNumeric = () => {
                    return this.props.textTypes.hasOwnProperty(this.props.fixedVal)
                            && this.props.textTypes[this.props.fixedVal].type === 'numeric';
                };
                return (
                    <select onChange={this._handleConditionChange.bind(this, 'operator')}>
                        <option value="EQ">=</option>
                        <option value="NE">&lt;&gt;</option>
                        {isNumeric() ? (<option value="LTE">&le;</option>) : ''}
                        {isNumeric() ? (<option value="GTE">&ge;</option>) : ''}
                    </select>
                );
            },

            _handleConditionChange : function (valueType, event) {
                dispatcher.dispatch({
                    actionType: 'UPDATE_SUBSET_PROP',
                    props: {
                        structId: this.props.struct.getId(),
                        valueType: valueType,
                        value: event.target.value
                    }
                });
            },

            _getInitialValueFor : function (v) {
                if (this.props.textTypes.hasOwnProperty(v)) {
                    return this.props.textTypes[v].values[0];
                }
                return null;
            },

            _handleRatioFocus : function (event) {
                this.props.ratioSliderActivation(event, getOrientation(this.props.struct).color);
            },

            componentDidMount : function () {
                textStructureStore.addChangeListener(this._changeListener);
                dispatcher.dispatch({
                    actionType: 'UPDATE_SUBSET_PROPS',
                    props: {
                        structId: this.props.struct.getId(),
                        value: this._getInitialValueFor(this.props.fixedVal),
                        operator: 'EQ'
                    }
                });
            },

            componentWillUnmount : function () {
                textStructureStore.removeChangeListener(this._changeListener);
            },

            getInitialState : function () {
                return {ratio: 0};
            },

            render : function () {
                if (this.props.fixedVal !== null) {
                    let orientation = getOrientation(this.props.struct);
                    return (
                        <div className="structure-heading">
                            <span className="orientation"
                                title={this.translate('Subsets with the same color are of the same depth in the hierarchy.')}
                                style={{color: orientation.color}}>&#9679;</span>
                            <strong>{this.props.fixedVal}</strong>
                            {this._renderOperatorSelector()}
                            {this._renderValueSelector()},
                            &nbsp;{this.translate('ratio')}&nbsp;=&nbsp;
                            <button type="button"
                                onClick={this._handleRatioFocus}>{this.state.ratio.toFixed()}</button> <strong>%</strong>
                            <img
                                className="close-icon"
                                src={this.createStaticUrl('img/close-icon.png')}
                                title={this.translate('remove subset')}
                                onClick={this._handleCloseIconClick} />
                        </div>
                    );

                } else {
                    return (
                        <div className="structure-heading">
                            {this.translate('whole subcorpus')}
                        </div>);
                }
            }
        });

        /**
         *
         */
        var NewSubsetBox = React.createClass({
            mixins : mixins,

            _handleButtonClick : function () {
                dispatcher.dispatch({
                    actionType: 'SUBCMIXER_ADD_STRUCTURE',
                    props: {
                        structId: this.props.struct.getId(),
                        structattr: this.state.currentStructattr
                    }
                });
            },

            _handleStructattrSelection : function (evt) {
                this.setState({currentStructattr: evt.target.value});
            },

            getInitialState : function () {
                return {currentStructattr: this.props.structattrs[0][0]};
            },

            render : function () {
                let self = this;
                let items = this.props.structattrs.map(function (item) {
                    return <option key={item[0]} value={item[0]}>{item[1]}</option>;
                });
                let addNewMsg = this.props.struct.isStructured()
                    ? this.translate('define another subset')
                    : this.translate('define a subset');
                let orientation = getOrientation(this.props.struct, 1);
                return (
                    <div className="text-structure-box new-subset">
                        <div className="structure-heading">
                            <span className="orientation"
                            style={{color: orientation.color}}
                            title={this.translate('Subsets with the same color are of the same depth in the hierarchy.')}>&#9679;</span>
                            <select className="util-button"
                                    disabled={this.props.struct.isStructured()}
                                    defaultValue={this.props.structattrs[0][0]}
                                    onChange={this._handleStructattrSelection}>
                                {items}
                            </select>
                        </div>
                        <div className="structure">
                            <button className="util-button"
                                    type="button" onClick={this._handleButtonClick}>{addNewMsg}</button>
                        </div>
                    </div>
                );
            }
        });

        /**
         * text mixing ratios slider
         */
        var RatioSlider = React.createClass({

            mixins : mixins,

            _getInitialValues : function () {
                if (!this.props.values) {
                    let dist = 100 / (this.props.numBars + 1);
                    return Array(this.props.numBars + 1).fill(1).map((v, i) => dist);

                } else {
                    let sum = this.props.values.reduce((prev, v) => prev + v, 0);
                    return this.props.values.concat([100 - sum]); // adding an "unused" slot
                }
            },

            _getColors : function (n) {
                let ans = Array(n - 1).fill(this.props.color);
                ans.push('#dadada');
                return ans;
            },

            componentDidMount : function () {
                if (!this.props.values) {
                    let values = this._getInitialValues();
                    dispatcher.dispatch({
                        actionType: 'UPDATE_ALL_SUBSETS_RATIOS',
                        props: {
                            structId: this.props.parentStruct.getId(),
                            values: values.slice(0, values.length - 1)
                        }
                    });
                }
            },

            _onSliderChange : function (values) {
                this.setState({
                    values: values
                });
                this.props.onChange(values);
            },

            getInitialState : function () {
                return {values: this._getInitialValues()};
            },

            render : function () {
                let ratios = this.state.values.map((v) => v.toFixed(0)).join(', ');
                return (
                    <div className="slider-box">
                        <img
                                className="close-icon"
                                src={this.createStaticUrl('img/close-icon.png')}
                                title={this.translate('close slider')}
                                onClick={this.props.closeSlider} />
                        <h3>{this.translate('defaultSubcmixer__current_ratios_heading')}</h3>
                        <p>{this.translate('defaultSubcmixer__current_ratios_{values}', {values: ratios})}</p>
                        <div className="slider-wrapper">
                            <MultiSlider
                                values={this.state.values}
                                colors={this._getColors(this.state.values.length)}
                                onChange={this._onSliderChange}
                                handleSize={8}
                                height={30} />
                        </div>
                    </div>
                );
            }

        });

        /**
         *
         */
        var TextStructureBox = React.createClass({

            _updater : null,

            _activateRatioSlider : function (event, sliderColor) {
                this.setState({slider: true, sliderValues: null, sliderColor: sliderColor});
            },

            _deactivateRatioSlider : function () {
                this.setState({slider: false, sliderValues: null, sliderColor: null});
            },

            _dispatchChanges : function (values) {
                dispatcher.dispatch({
                    actionType: 'UPDATE_ALL_SUBSETS_RATIOS',
                    props: {
                        structId: this.props.struct.getId(),
                        values: values
                    }
                });
            },

            _handleSliderChange : function (values) {
                let self = this;

                if (this._updater) {
                    clearTimeout(this._updater);
                }
                this._updater = setTimeout(function () {
                    self._dispatchChanges(values);
                }, 100);
            },

            _changeListener : function (store, action, err) {
                if (action === 'UPDATE_ALL_SUBSETS_RATIOS' && this.state.slider) {
                    this.setState({
                        slider: this.state.slider,
                        sliderValues: this.props.struct.getProportions().map((x) => x.getRatio())
                    });
                }
            },

            getInitialState : function () {
                return {slider: false, sliderValues: null, sliderColor: null};
            },

            componentDidMount : function () {
                textStructureStore.addChangeListener(this._changeListener);
            },

            componentWillUnmount : function () {
                textStructureStore.removeChangeListener(this._changeListener);
            },

            render : function () {
                let structureCells = [];
                let self = this;

                this.props.struct.getProportions().forEach(function (prop, i) {
                    structureCells.push(<TextStructureBox
                                        key={prop.getId()}
                                        struct={prop}
                                        fixedVal={prop.structattrToString()}
                                        structattrs={self.props.structattrs}
                                        textTypes={self.props.textTypes}
                                        parentratioSliderActivation={self._activateRatioSlider}
                                       />);
                });
                return (
                    <div className="text-structure-box">
                        <SubsetHeading
                            struct={this.props.struct}
                            fixedVal={this.props.fixedVal}
                            textTypes={this.props.textTypes}
                            ratioSliderActivation={this.props.parentratioSliderActivation} />
                        {
                            this.state.slider
                            ? <RatioSlider
                                closeSlider={this._deactivateRatioSlider}
                                onChange={this._handleSliderChange}
                                numBars={structureCells.length}
                                parentStruct={this.props.struct}
                                values={this.state.sliderValues}
                                color={this.state.sliderColor} />
                            : null
                        }
                        <div className="structure">
                            {structureCells}
                            <NewSubsetBox struct={this.props.struct} structattrs={this.props.structattrs} />
                        </div>
                    </div>
                );
            }
        });

        /**
         *
         */
        var Widget = React.createClass({
            mixins : mixins,

            _changeListener : function (store, action, err) {
                this.setState({rootStructure: store.getRootStructure()});
            },

            _handleSubmitClick : function () {
                dispatcher.dispatch({
                    actionType: 'SUBCMIXER_RUN',
                    props: {
                        subcname: $('#subcname').val() // non-react world
                    }
                });
            },

            getInitialState : function () {
                return {rootStructure: this.props.rootStruct};
            },

            componentDidMount : function () {
                textStructureStore.addChangeListener(this._changeListener);
            },

            render : function () {
                return (
                    <div>
                        <TextStructureBox
                            struct={this.props.rootStruct}
                            fixedVal={null}
                            structattrs={this.props.structattrs}
                            textTypes={this.props.textTypes}
                            parentratioSliderActivation={null} />
                        <button className="default-button"
                                onClick={this._handleSubmitClick}
                                type="button">{this.translate('Create subcorpus')}</button>
                    </div>
                );
            }
        });


        return {
            Widget: Widget
        };
    };

    return lib;
});
