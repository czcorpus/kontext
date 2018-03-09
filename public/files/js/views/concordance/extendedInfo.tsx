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
import { PluginInterfaces } from '../../types/plugins';


export interface ConcExtendedInfoProps {
    kwicConnectView:PluginInterfaces.KwicConnect.WidgetWiew;
}


export interface ExtendedInfoViews {
    ConcExtendedInfo: React.ComponentClass<ConcExtendedInfoProps>;
}


export function init(dispatcher:ActionDispatcher, he:Kontext.ComponentHelpers, ttDistModel:TextTypesDistModel):ExtendedInfoViews {

    const layoutViews = he.getLayoutViews();
    const ttDistViews = ttOverviewInit(dispatcher, he, ttDistModel);

    // ------------------------- <ConcordanceDashboard /> ---------------------------

    const CloseIcon:React.SFC<{}> = (props) => {

        const handleClick = () => {
            if (window.confirm(
                    he.translate('concview__close_tt_overview_confirm_msg'))) {
                dispatcher.dispatch({
                    actionType: 'GENERAL_VIEW_OPTIONS_SET_TT_OVERVIEW_VISIBILITY',
                    props: {
                        value: false
                    }
                });
            }
        };

        return <a className="CloseIcon" onClick={handleClick} title={he.translate('global__close')}>
            <layoutViews.ImgWithMouseover src={he.createStaticUrl('img/close-icon.svg')} alt={he.translate('global__close')} />
        </a>;
    };

    // ---------------------- <Menu /> ----------------------------------------

    const Menu:React.SFC<{
        activeTab:string;
        clickHandler:(v:string)=>void;

    }> = (props) => {
        return(
            <div className="Menu">
                <ul>
                    <li className={props.activeTab === 'tt-overview' ? 'active' : ''}>
                        <a onClick={() => props.clickHandler('tt-overview')}>{he.translate('concview__text_types_ratios_head')}</a>
                    </li>
                    <li className={props.activeTab === 'kwic-connect' ? 'active' : ''}>
                        <a onClick={() => props.clickHandler('kwic-connect')}>Extended kwic info</a>
                    </li>
                </ul>
            </div>
        );
    };

    // ---------------------- <ConcExtendedInfo /> ----------------------------------------

    class ConcExtendedInfo extends React.Component<ConcExtendedInfoProps, {
        activeTab:string;

    }> {

        constructor(props) {
            super(props);
            this.state = {
                activeTab: 'tt-overview'
            };
            this.handleActiveTabChange = this.handleActiveTabChange.bind(this);
        }

        private handleActiveTabChange(v:string) {
            this.setState({activeTab: v});
        }

        private renderTab() {
            switch (this.state.activeTab) {
                case 'tt-overview':
                    return <ttDistViews.TextTypesDist />;
                case 'kwic-connect':
                    return <this.props.kwicConnectView />;
            }
        }

        render() {
            return (
                <div className="ConcExtendedInfo">
                    <CloseIcon />
                    <h2>Concordance summary</h2>
                    <Menu activeTab={this.state.activeTab} clickHandler={this.handleActiveTabChange} />
                    {this.renderTab()}
                </div>
            );
        }
    }


    return {
        ConcExtendedInfo: ConcExtendedInfo
    }

}