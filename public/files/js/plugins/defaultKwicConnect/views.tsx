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
import { Kontext } from '../../types/common';
import { KwicConnectModel, KwicConnectState } from './model';
import {PluginInterfaces} from '../../types/plugins';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';

export interface KwicConnectContainerProps {

}


export interface View {
    KwicConnectContainer:React.ComponentClass<KwicConnectContainerProps>;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, model:KwicConnectModel):View {

    const layoutViews = he.getLayoutViews();

    // --------------------- <KwicConnectContainer /> ------------------------------------

    class KwicConnectContainer extends React.Component<KwicConnectContainerProps, KwicConnectState> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = model.getInitialState();
            this.stateChangeHandler = this.stateChangeHandler.bind(this);
        }

        stateChangeHandler(state:KwicConnectState) {
            this.setState(state);
        }

        componentDidMount() {
            this.modelSubscription = model.addListener(this.stateChangeHandler);
            dispatcher.dispatch({
                name: PluginInterfaces.KwicConnect.Actions.FETCH_INFO,
                payload: {}
            });
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            const outList = this.state.data.filter(output => !!output);
            return (
                <div className="KwicConnectContainer">
                    {outList.map(output => (
                        <React.Fragment key={output.heading}>
                            <div className="KwicConnectWidget">
                                <h3 className="tckc-provider block">{output.heading}
                                <img src={he.createStaticUrl('img/book.svg')}
                                                alt={he.translate('global__icon_book')} /></h3>
                                <p className="note">
                                    {output.note ? output.note + '\u00a0|\u00a0' : null}
                                    {he.translate('default_kwic_connect__using_attr_for_srch_{attr}',
                                        {attr: this.state.freqType})}
                                </p>
                                <hr />
                                <layoutViews.ErrorBoundary>
                                    <div className="contents">
                                        {output.data.size > 0 ?
                                            <>
                                                {output.data.map((item, j) =>
                                                    React.createElement(
                                                        output.renderer,
                                                        {
                                                            key: `provider:${j}`,
                                                            data: item,
                                                            corpora: this.state.corpora
                                                        }
                                                    ))
                                                }
                                            </> :
                                            <p className="data-not-avail">
                                                <img src={he.createStaticUrl('img/info-icon.svg')} />
                                                {he.translate('global__no_data_avail')}
                                            </p>
                                        }
                                    </div>
                                </layoutViews.ErrorBoundary>
                            </div>
                        </React.Fragment>
                    ))}
                    {this.state.isBusy ?
                        <div className="loader">
                            <hr />
                            <layoutViews.AjaxLoaderImage />
                        </div> :
                        null
                    }
                </div>
            );
        }
    }

    return {
        KwicConnectContainer: KwicConnectContainer
    };
}