/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
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
import {ActionDispatcher} from '../../app/dispatcher';
import {Kontext} from '../../types/common';
import {init as ttOverviewInit} from './ttOverview';
import { TextTypesDistModel } from '../../models/concordance/ttDistModel';
import {ConcDashboard, ConcDashboardState} from '../../models/concordance/dashboard';
import { PluginInterfaces } from '../../types/plugins';


export interface ConcExtendedInfoProps {
    kwicConnectView:PluginInterfaces.KwicConnect.WidgetWiew;
}


export interface ExtendedInfoViews {
    ConcExtendedInfo: React.ComponentClass<ConcExtendedInfoProps>;
}

export interface ExtendedInfoViewsInitArgs {
    dispatcher:ActionDispatcher;
    he:Kontext.ComponentHelpers;
    ttDistModel:TextTypesDistModel;
    dashboardModel:ConcDashboard;
}

export function init({dispatcher, he, ttDistModel, dashboardModel}:ExtendedInfoViewsInitArgs):ExtendedInfoViews {

    const layoutViews = he.getLayoutViews();
    const ttDistViews = ttOverviewInit(dispatcher, he, ttDistModel);

    // ------------------------- <MinimizeIcon /> ---------------------------

    const MinimizeIcon:React.SFC<{
        minimized:boolean;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                actionType: props.minimized ?
                    'DASHBOARD_MAXIMIZE_EXTENDED_INFO' :
                    'DASHBOARD_MINIMIZE_EXTENDED_INFO',
                props: {}
            });
        };

        if (props.minimized) {
            return <a className="MinimizeIcon" onClick={handleClick} title={he.translate('global__restore')}>
                <layoutViews.ImgWithMouseover
                        src={he.createStaticUrl('img/maximize-icon.svg')}
                        alt={he.translate('global__restore_dashboard')} />
            </a>;

        } else {
            return <a className="MinimizeIcon" onClick={handleClick} title={he.translate('global__minimize')}>
                <layoutViews.ImgWithMouseover
                        src={he.createStaticUrl('img/minimize-icon.svg')}
                        alt={he.translate('global__minimize')} />
            </a>;
        }

    }

    // ---------------------- <ConcExtendedInfo /> ----------------------------------------

    class ConcExtendedInfo extends React.Component<ConcExtendedInfoProps, ConcDashboardState> {

        constructor(props) {
            super(props);
            this.state = dashboardModel.getState();
            this.handleStoreChange = this.handleStoreChange.bind(this);
        }

        private handleStoreChange(state) {
            this.setState(state);
        }

        private hasKwicConnectView() {
            return this.props.kwicConnectView !== null;
        }

        componentDidMount() {
            dashboardModel.addChangeListener(this.handleStoreChange);
            if (!this.state.expanded) { // we are doing a pre-load here
                dispatcher.dispatch({
                    actionType: 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW',
                    props: {}
                });
            }
        }

        componentWillUnmount() {
            dashboardModel.removeChangeListener(this.handleStoreChange);
        }

        render() {
            return (
                <div className="ConcExtendedInfo">
                    <header>
                        <h2>
                            {this.state.expanded ? he.translate('concview__extended_info') : '\u00a0'}
                        </h2>
                        <MinimizeIcon minimized={!this.state.expanded} />
                    </header>
                    {this.state.expanded ?
                        <div className="contents">
                            {this.state.showFreqInfo ?
                                <div className="box">
                                    <ttDistViews.TextTypesDist />
                                </div> :
                                null
                            }
                            <div className="box">
                                {this.hasKwicConnectView() ? <this.props.kwicConnectView /> : null}
                            </div>
                        </div> :
                        <div></div>
                    }
                </div>
            );
        }
    }


    return {
        ConcExtendedInfo: ConcExtendedInfo
    }

}