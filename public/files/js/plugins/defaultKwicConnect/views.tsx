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
import * as Kontext from '../../types/kontext';
import { KwicConnectModel, KwicConnectState } from './model';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { List } from 'cnc-tskit';
import * as PluginInterfaces from '../../types/plugins';

import * as S from './style';

export interface KwicConnectContainerProps {

}


export interface View {
    KwicConnectContainer:React.ComponentClass<KwicConnectContainerProps>;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, model:KwicConnectModel):View {

    const layoutViews = he.getLayoutViews();

    // --------------------- <KwicConnectContainer /> ------------------------------------

    class KwicConnectContainer extends React.PureComponent<KwicConnectContainerProps & KwicConnectState> {

        componentDidMount() {
            dispatcher.dispatch({
                name: PluginInterfaces.KwicConnect.Actions.FetchInfo
            });
        }

        render() {
            const outList = this.props.data.filter(output => !!output);
            return (
                <S.KwicConnectContainer className="KwicConnectContainer">
                    {List.map(output => (
                        <React.Fragment key={output.heading}>
                            <div className="KwicConnectWidget">
                                <h3 className="tckc-provider block">{output.heading}
                                <img src={he.createStaticUrl('img/book.svg')}
                                                alt={he.translate('global__icon_book')} /></h3>
                                <p className="note">
                                    {output.note ? output.note + '\u00a0|\u00a0' : null}
                                    {he.translate('default_kwic_connect__using_attr_for_srch_{attr}',
                                        {attr: this.props.freqType})}
                                </p>
                                <hr />
                                <layoutViews.ErrorBoundary>
                                    <div className="contents">
                                        {output.data.length > 0 ?
                                            <>
                                                {List.map((item, j) =>
                                                    React.createElement(
                                                        output.renderer,
                                                        {
                                                            key: `provider:${j}`,
                                                            data: item,
                                                            corpora: this.props.corpora
                                                        }
                                                    ), output.data)
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
                    ), outList)}
                    {this.props.isBusy ?
                        <div className="loader">
                            <hr />
                            <layoutViews.AjaxLoaderImage />
                        </div> :
                        null
                    }
                </S.KwicConnectContainer>
            );
        }
    }

    return {
        KwicConnectContainer: BoundWithProps(KwicConnectContainer, model)
    };
}