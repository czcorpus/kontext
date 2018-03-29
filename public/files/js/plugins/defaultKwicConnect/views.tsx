/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as Immutable from 'immutable';
import { ActionDispatcher } from '../../app/dispatcher';
import { Kontext } from '../../types/common';
import { KwicConnectModel, KwicConnectState, Actions } from './model';
import { Component } from 'react';
import {PluginInterfaces} from '../../types/plugins';

export interface KwicConnectWidgetProps {

}


export interface View {
    KwicConnectWidget:React.ComponentClass<KwicConnectWidgetProps>;
}

export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers, model:KwicConnectModel):View {

    const layoutViews = he.getLayoutViews();

    // --------------------- <ProviderSwitch /> ------------------------------------

    const ProviderSwitch:React.SFC<{
        visibleIdx:number;
        providers:Immutable.Iterable<number, string>;

    }> = (props) => {

        const handleChange = (evt:React.ChangeEvent<HTMLSelectElement>) => {
            dispatcher.dispatch({
                actionType: Actions.SET_VISIBLE_PROVIDER,
                props: {value: evt.target.value}
            });
        };

        return <select onChange={handleChange}>
                {props.providers.map((provider, i) => {
                    return <option key={`opt${i}`} value={i}>{provider}</option>
                })}
            </select>;
    };

    // --------------------- <KwicConnectWidget /> ------------------------------------

    class KwicConnectWidget extends React.Component<KwicConnectWidgetProps, KwicConnectState> {

        constructor(props) {
            super(props);
            this.state = model.getState();
            this.stateChangeHandler = this.stateChangeHandler.bind(this);
        }

        stateChangeHandler(state:KwicConnectState) {
            this.setState(state);
        }

        componentDidMount() {
            model.addChangeListener(this.stateChangeHandler);
            dispatcher.dispatch({
                actionType: PluginInterfaces.KwicConnect.Actions.FETCH_INFO,
                props: {}
            });
        }

        componentWillUnmount() {
            model.removeChangeListener(this.stateChangeHandler);
        }

        renderWidget() {
            const providerOutput = this.state.data.get(this.state.visibleProviderIdx);
            if (providerOutput) {
                return (
                    <div className="KwicConnectWidget">
                        <ProviderSwitch visibleIdx={0} providers={this.state.data.map(p => p.heading)} />
                        <div>
                            {providerOutput.data.map((item, j) =>
                                <providerOutput.renderer key={`provider:${j}`} data={item} corpora={this.state.corpora} />)}
                            {providerOutput.note ?
                                <p className="note">{providerOutput.note}</p> : null}
                        </div>
                        <p className="note">{he.translate('default_kwic_connect__using_attr_for_srch_{attr}',
                                {attr: this.state.freqType})}</p>
                    </div>
                );

            } else {
                return null;
            }
        }

        render() {
            return (
                <div>
                    {this.renderWidget()}
                    {this.state.isBusy ? <layoutViews.AjaxLoaderImage /> : null}
                </div>
            );
        }
    }

    return {
        KwicConnectWidget: KwicConnectWidget
    };
}