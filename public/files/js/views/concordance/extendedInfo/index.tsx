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
import { IActionDispatcher, Bound, BoundWithProps } from 'kombo';

import * as Kontext from '../../../types/kontext.js';
import { init as ttOverviewInit } from '../ttOverview/index.js';
import { TextTypesDistModel } from '../../../models/concordance/ttdist/model.js';
import { ConcDashboard, ConcDashboardState } from '../../../models/concordance/dashboard.js';
import { UsageTipsModel, UsageTipsState, UsageTipCategory } from '../../../models/usageTips/index.js';
import * as PluginInterfaces from '../../../types/plugins/index.js';
import { Actions } from '../../../models/concordance/actions.js';
import { Actions as HintActions } from '../../../models/usageTips/actions.js';
import * as S2 from '../style.js';
import * as S from './style.js';


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

    const MinimizeIcon:React.FC<{
        minimized:boolean;

    }> = (props) => {

        const handleClick = () => {
            if (props.minimized) {
                dispatcher.dispatch<typeof Actions.DashboardMaximizeExtInfo>({
                    name: Actions.DashboardMaximizeExtInfo.name
                });

            } else {
                dispatcher.dispatch<typeof Actions.DashboardMinimizeExtInfo>({
                    name: Actions.DashboardMinimizeExtInfo.name
                });
            }
        };

        if (props.minimized) {
            return <S.MinimizeIcon onClick={handleClick} title={he.translate('global__restore')}>
                <layoutViews.ImgWithMouseover
                        src={he.createStaticUrl('img/maximize-icon-vert.svg')}
                        alt={he.translate('global__restore_dashboard')} />
            </S.MinimizeIcon>;

        } else {
            return <S.MinimizeIcon onClick={handleClick} title={he.translate('global__minimize')}>
                <layoutViews.ImgWithMouseover
                        src={he.createStaticUrl('img/minimize-icon-vert.svg')}
                        alt={he.translate('global__minimize')} />
            </S.MinimizeIcon>;
        }
    }

    // ---------------------- <UsageTips /> ----------------------------------------

    class UsageTips extends React.PureComponent<UsageTipsState> {

        constructor(props) {
            super(props);
            this.handleNextClick = this.handleNextClick.bind(this);
        }

        handleNextClick(e:React.MouseEvent<HTMLAnchorElement>) {
            dispatcher.dispatch<typeof HintActions.NextConcHint>({
                name: HintActions.NextConcHint.name
            });
        }

        render() {
            return <S2.UsageTips>
                {this.props.currentHints[UsageTipCategory.CONCORDANCE]}
                {'\u00a0'}<span className="next-hint">
                <a onClick={this.handleNextClick} title={he.translate('global__next_tip')}>
                    <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/next-page.svg')}
                            alt={he.translate('global__next_tip')} />
                </a></span>
            </S2.UsageTips>
        };
    }

    const BoundUsageTips = Bound(UsageTips, usageTipsModel);

    // ---------------------- <ConcExtendedInfo /> ----------------------------------------

    const ConcExtendedInfo:React.FC<ConcExtendedInfoProps & ConcDashboardState> = (props) => {

        const hasKwicConnectView = () => props.kwicConnectView !== null;

        React.useEffect(
            () => {
                if (!props.expanded) { // we are doing a pre-load here
                    dispatcher.dispatch(
                        Actions.LoadTTDictOverview
                    );
                }
            },
            []
        );

        return (
            <S.ConcExtendedInfo className={props.expanded ? null : 'collapsed'}>
                <header>
                    <MinimizeIcon minimized={!props.expanded} />
                </header>
                {props.expanded ?
                    <div className="contents">
                        {props.showFreqInfo ?
                            <div className="box">
                                <ttDistViews.TextTypesDist />
                            </div> :
                            null
                        }
                        <div className="box">
                            {hasKwicConnectView() ? <props.kwicConnectView /> : null}
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
            </S.ConcExtendedInfo>
        );
    }


    return {
        ConcExtendedInfo: BoundWithProps<ConcExtendedInfoProps, ConcDashboardState>(ConcExtendedInfo, dashboardModel)
    }

}