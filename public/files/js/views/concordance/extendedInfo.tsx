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
import {Kontext} from '../../types/common';
import {init as ttOverviewInit} from './ttOverview';
import { TextTypesDistModel } from '../../models/concordance/ttDistModel';
import {ConcDashboard, ConcDashboardState} from '../../models/concordance/dashboard';
import {UsageTipsModel, UsageTipsState, UsageTipCategory} from '../../models/usageTips';
import { PluginInterfaces } from '../../types/plugins';
import { IActionDispatcher, Bound, BoundWithProps } from 'kombo';


export interface ConcExtendedInfoProps {
    kwicConnectView:PluginInterfaces.KwicConnect.WidgetWiew;
}


export interface ExtendedInfoViews {
    ConcExtendedInfo: React.ComponentClass<ConcExtendedInfoProps, ConcDashboardState>;
}

export interface ExtendedInfoViewsInitArgs {
    dispatcher:IActionDispatcher;
    he:Kontext.ComponentHelpers;
    ttDistModel:TextTypesDistModel;
    dashboardModel:ConcDashboard;
    usageTipsModel:UsageTipsModel;
}

export function init({dispatcher, he, ttDistModel, dashboardModel, usageTipsModel}:ExtendedInfoViewsInitArgs):ExtendedInfoViews {

    const layoutViews = he.getLayoutViews();
    const ttDistViews = ttOverviewInit(dispatcher, he, ttDistModel);

    // ------------------------- <MinimizeIcon /> ---------------------------

    const MinimizeIcon:React.SFC<{
        minimized:boolean;

    }> = (props) => {

        const handleClick = () => {
            dispatcher.dispatch({
                name: props.minimized ?
                    'DASHBOARD_MAXIMIZE_EXTENDED_INFO' :
                    'DASHBOARD_MINIMIZE_EXTENDED_INFO',
                payload: {}
            });
        };

        if (props.minimized) {
            return <a className="MinimizeIcon" onClick={handleClick} title={he.translate('global__restore')}>
                <layoutViews.ImgWithMouseover
                        src={he.createStaticUrl('img/maximize-icon-vert.svg')}
                        alt={he.translate('global__restore_dashboard')} />
            </a>;

        } else {
            return <a className="MinimizeIcon" onClick={handleClick} title={he.translate('global__minimize')}>
                <layoutViews.ImgWithMouseover
                        src={he.createStaticUrl('img/minimize-icon-vert.svg')}
                        alt={he.translate('global__minimize')} />
            </a>;
        }
    }

    // ---------------------- <UsageTips /> ----------------------------------------

    class UsageTips extends React.PureComponent<UsageTipsState> {

        constructor(props) {
            super(props);
            this.handleNextClick = this.handleNextClick.bind(this);
        }

        handleNextClick(e:React.MouseEvent<HTMLAnchorElement>) {
            dispatcher.dispatch({
                name: 'NEXT_CONC_HINT',
                payload: {}
            });
        }

        render() {
            return <div className="UsageTips">
                {this.props.currentHints.get(UsageTipCategory.CONCORDANCE)}
                {'\u00a0'}<span className="next-hint">
                <a onClick={this.handleNextClick} title={he.translate('global__next_tip')}>
                    <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/next-page.svg')}
                            alt={he.translate('global__next_tip')} />
                </a></span>
            </div>
        };
    }

    const BoundUsageTips = Bound(UsageTips, usageTipsModel);

    // ---------------------- <ConcExtendedInfo /> ----------------------------------------

    class ConcExtendedInfo extends React.PureComponent<ConcExtendedInfoProps & ConcDashboardState> {

        constructor(props) {
            super(props);
        }

        private hasKwicConnectView() {
            return this.props.kwicConnectView !== null;
        }

        componentDidMount() {
            if (!this.props.expanded) { // we are doing a pre-load here
                dispatcher.dispatch({
                    name: 'CONCORDANCE_LOAD_TT_DIST_OVERVIEW',
                    payload: {}
                });
            }
        }

        render() {
            return (
                <div className="ConcExtendedInfo">
                    <header>
                        <MinimizeIcon minimized={!this.props.expanded} />
                    </header>
                    {this.props.expanded ?
                        <div className="contents">
                            {this.props.showFreqInfo ?
                                <div className="box">
                                    <ttDistViews.TextTypesDist />
                                </div> :
                                null
                            }
                            <div className="box">
                                {this.hasKwicConnectView() ? <this.props.kwicConnectView /> : null}
                            </div>
                            <div className="box">
                                <h3 className="block">
                                    {he.translate('concview__tips_heading')}
                                    <img src={he.createStaticUrl('img/lightbulb.svg')}
                                            alt={he.translate('global__lightbulb_icon')}
                                            className="lightbulb" />
                                </h3>
                                <hr />
                                <BoundUsageTips />
                            </div>
                        </div> :
                        <div></div>
                    }
                </div>
            );
        }
    }


    return {
        ConcExtendedInfo: BoundWithProps<ConcExtendedInfoProps, ConcDashboardState>(ConcExtendedInfo, dashboardModel)
    }

}